import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withUserAuth } from "@/lib/user-auth"
import { generateTopicCards } from "@/lib/topic-generation"
import type { RecommendationMode } from "@/lib/topic-generation"
import { getTodayAiHotBriefing } from "@/lib/aihot-briefing"
import { VALID_ELEMENT_CODES } from "@/lib/topic-validation"
import type { TopicCard } from "@/lib/topic-validation"
import { hasConflict } from "@/lib/topic-element-logic"
import type { Prisma } from "@/generated/prisma/client"
import type { ContentTheme } from "@/types/api"

export const maxDuration = 60

const RECOMMENDATION_MODES = new Set<RecommendationMode>(["normal", "daily", "weekly"])

function parseRecommendationMode(value: unknown): RecommendationMode | null {
  if (value == null) return "normal"
  return typeof value === "string" && RECOMMENDATION_MODES.has(value as RecommendationMode)
    ? (value as RecommendationMode)
    : null
}

function buildProjectSource(project: {
  name: string
  industry: string | null
  targetCustomer: string | null
  offer: string | null
  deliveryGoal: string | null
} | null) {
  if (!project) return null
  const content = [
    project.industry ? `行业：${project.industry}` : null,
    project.targetCustomer ? `目标客户：${project.targetCustomer}` : null,
    project.offer ? `产品/服务：${project.offer}` : null,
    project.deliveryGoal ? `交付目标：${project.deliveryGoal}` : null,
  ].filter(Boolean).join("\n")

  if (!content) return null
  return {
    category: "client_project",
    title: project.name,
    content,
  }
}

async function getHotTopicSources() {
  try {
    const briefing = await getTodayAiHotBriefing()
    return briefing.items.slice(0, 4).map((item) => ({
      category: "industry_hot",
      title: item.title,
      content: `${item.categoryLabel}｜${item.summary}｜${item.url}`,
    }))
  } catch (error) {
    console.warn("[topic-gen] AIHOT briefing unavailable:", error)
    return []
  }
}

export function buildBenchmarkAccountSources(
  accounts: Array<{ nickname: string | null; targetUrl: string; latestVideos: unknown; viralVideos: unknown }>,
) {
  return accounts.flatMap((account) => {
    const viralVideos = Array.isArray(account.viralVideos) ? account.viralVideos.slice(0, 3) : []
    const latestVideos = Array.isArray(account.latestVideos) ? account.latestVideos.slice(0, 3) : []
    const videos = [...viralVideos, ...latestVideos]
    if (videos.length === 0) return []

    return [{
      category: "benchmark_reference",
      title: account.nickname || account.targetUrl,
      content: videos.map((video, index) => {
        const item = video as { title?: string; likes?: number; comments?: number; shares?: number; collects?: number }
        return `${index + 1}. ${item.title || "无标题"}｜赞${item.likes ?? 0} 评${item.comments ?? 0} 转${item.shares ?? 0} 藏${item.collects ?? 0}`
      }).join("\n"),
    }]
  }).slice(0, 4)
}

function truncateText(value: string | null | undefined, limit = 180) {
  const text = value?.replace(/\s+/g, " ").trim() ?? ""
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

export function buildVideoCopyExtractionSources(
  extractions: Array<{ videoTitle: string | null; sourceUrl: string; transcript: string | null; analysisResult: unknown }>,
) {
  return extractions.flatMap((record) => {
    const analysis = record.analysisResult ? truncateText(JSON.stringify(record.analysisResult), 240) : ""
    const transcript = truncateText(record.transcript, 180)
    if (!analysis && !transcript) return []
    return [{
      category: "benchmark_reference",
      title: record.videoTitle || record.sourceUrl,
      content: [
        analysis ? `结构化拆解：${analysis}` : null,
        transcript ? `原文摘要：${transcript}` : null,
        `来源：${record.sourceUrl}`,
      ].filter(Boolean).join("\n"),
    }]
  }).slice(0, 4)
}

export const POST = withUserAuth(async (request, { user }) => {
  const requestId = `topic-gen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  console.log(`[${requestId}] Topic generation initiated by user ${user.id}`)

  const body = await request.json()
  const recommendationMode = parseRecommendationMode(body.recommendationMode)
  if (!recommendationMode) {
    return NextResponse.json(
      { error: "recommendationMode 必须是 normal、daily 或 weekly" },
      { status: 400 },
    )
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : null
  const knowledgeEntryIds = Array.isArray(body.knowledgeEntryIds)
    ? body.knowledgeEntryIds.filter((value: unknown): value is string => typeof value === "string")
    : []
  let forcedElementCodes: string[] | undefined
  if (Array.isArray(body.elementCodes)) {
    const raw = body.elementCodes as string[]
    const validSet = new Set<string>(VALID_ELEMENT_CODES)

    const invalid = raw.filter((c) => !validSet.has(c))
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `非法的元素代码: ${invalid.join(", ")}` },
        { status: 400 },
      )
    }

    const deduped = [...new Set(raw)]

    if (deduped.length < 2 || deduped.length > 3) {
      return NextResponse.json(
        { error: "元素数量必须为2或3个（去重后）" },
        { status: 400 },
      )
    }

    for (let i = 0; i < deduped.length; i++) {
      for (let j = i + 1; j < deduped.length; j++) {
        if (hasConflict(deduped[i], deduped[j])) {
          return NextResponse.json(
            { error: `元素冲突: ${deduped[i]} 和 ${deduped[j]} 不可同时使用` },
            { status: 400 },
          )
        }
      }
    }

    forcedElementCodes = deduped
  }

  const refreshCount = typeof body.refreshCount === "number" ? body.refreshCount : 0

  const [project, elements, recentSelections, selectedKnowledge, ipProfile, watchAccounts, videoCopyExtractions] = await Promise.all([
    projectId
      ? prisma.clientProject.findFirst({
          where: { id: projectId, userId: user.id, status: "active" },
          select: {
            id: true,
            name: true,
            industry: true,
            targetCustomer: true,
            offer: true,
            deliveryGoal: true,
          },
        })
      : Promise.resolve(null),
    prisma.topicElement.findMany({
      where: { status: "published" },
      orderBy: { sortOrder: "asc" },
    }),
    // Fetch last 5 topic generations for history-aware derivation
    prisma.topicSelection.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { elementCodes: true, candidates: true },
    }),
    knowledgeEntryIds.length > 0
      ? prisma.knowledgeEntry.findMany({
          where: {
            id: { in: knowledgeEntryIds },
            userId: user.id,
            status: "active",
            ...(projectId ? { projectId } : {}),
          },
          select: { category: true, title: true, content: true },
          take: 12,
        })
      : Promise.resolve([]),
    // Fetch IpProfile for content line themes (降级：不存在时跳过)
    prisma.ipProfile.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        displayName: true,
        nickname: true,
        industry: true,
        primaryOffer: true,
        targetAudience: true,
        ipTraits: true,
        toneOfVoice: true,
        proofPoints: true,
        callToAction: true,
        promptSnapshot: true,
        content: true,
      },
    }).catch(() => null),
    prisma.watchAccount.findMany({
      where: { userId: user.id },
      orderBy: { lastRefreshedAt: "desc" },
      take: 6,
      select: {
        nickname: true,
        targetUrl: true,
        latestVideos: true,
        viralVideos: true,
      },
    }).catch((error) => {
      console.warn(`[${requestId}] Watch account sources unavailable:`, error)
      return []
    }),
    prisma.videoCopyExtraction.findMany({
      where: {
        userId: user.id,
        status: "completed",
      },
      orderBy: { completedAt: "desc" },
      take: 8,
      select: {
        videoTitle: true,
        sourceUrl: true,
        transcript: true,
        analysisResult: true,
      },
    }).catch((error) => {
      console.warn(`[${requestId}] Video copy extraction sources unavailable:`, error)
      return []
    }),
  ])

  if (projectId && !project) {
    return NextResponse.json(
      { error: "客户项目不存在或已归档" },
      { status: 404 },
    )
  }

  if (elements.length < 2) {
    console.error(
      `[${requestId}] Insufficient topic elements: ${elements.length}`,
    )
    return NextResponse.json(
      { error: "系统数据未就绪，请稍后再试" },
      { status: 500 },
    )
  }

  // Extract recent element sets and titles for dedup
  const recentElementSets = recentSelections
    .map((s) => {
      const codes = s.elementCodes
      return Array.isArray(codes) ? (codes as string[]) : []
    })
    .filter((s) => s.length > 0)

  const recentTitles = recentSelections.flatMap((s) => {
    const candidates = s.candidates
    if (!Array.isArray(candidates)) return []
    return (candidates as unknown as TopicCard[])
      .map((c) => c.title)
      .filter(Boolean)
  })

  console.log(
    `[${requestId}] Loaded ${elements.length} elements, ${recentElementSets.length} recent sets, ${recentTitles.length} recent titles, refresh=${refreshCount}`,
  )
  const startTime = Date.now()
  const projectSource = buildProjectSource(project)
  const hotTopicSources = await getHotTopicSources()
  const benchmarkSources = buildBenchmarkAccountSources(watchAccounts)
  const videoCopySources = buildVideoCopyExtractionSources(videoCopyExtractions)
  const topicSources = [
    ...(projectSource ? [projectSource] : []),
    ...selectedKnowledge,
    ...benchmarkSources,
    ...videoCopySources,
    ...hotTopicSources,
  ]

  // Extract content line themes from IpProfile (降级：无定位时 themes 为空)
  const contentRaw = ipProfile?.content as { themes?: ContentTheme[] } | null
  const contentThemes = Array.isArray(contentRaw?.themes) ? contentRaw.themes : []
  const topicIpProfile = ipProfile
    ? {
        id: ipProfile.id,
        displayName: ipProfile.displayName,
        nickname: ipProfile.nickname,
        industry: ipProfile.industry,
        primaryOffer: ipProfile.primaryOffer,
        targetAudience: ipProfile.targetAudience,
        ipTraits: ipProfile.ipTraits,
        toneOfVoice: ipProfile.toneOfVoice,
        proofPoints: ipProfile.proofPoints,
        callToAction: ipProfile.callToAction,
        promptSnapshot: ipProfile.promptSnapshot,
        content: ipProfile.content,
      }
    : null

  let result = await generateTopicCards({
    ipProfile: topicIpProfile,
    elements,
    topicSources,
    recommendationMode,
    forcedElementCodes,
    recentElementSets,
    recentTitles,
    refreshCount,
    contentThemes,
  })

  if (!result.success && (benchmarkSources.length > 0 || videoCopySources.length > 0 || hotTopicSources.length > 0)) {
    console.warn(`[${requestId}] Enriched topic generation failed, retrying with base sources: ${result.error}`)
    result = await generateTopicCards({
      ipProfile: topicIpProfile,
      elements,
      topicSources: [
        ...(projectSource ? [projectSource] : []),
        ...selectedKnowledge,
      ],
      recommendationMode,
      forcedElementCodes,
      recentElementSets,
      recentTitles,
      refreshCount,
      contentThemes,
    })
  }

  const duration = Date.now() - startTime
  console.log(
    `[${requestId}] Generation completed in ${duration}ms, success=${result.success}`,
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  const today = new Date().toISOString().split("T")[0]
  const selection = await prisma.topicSelection.create({
    data: {
      userId: user.id,
      ipProfileId: "",
      elementCodes: result.elementCodes as unknown as Prisma.InputJsonValue,
      candidates: result.cards as unknown as Prisma.InputJsonValue,
      promptText: result.promptText,
      model: result.model,
      status: "pending",
      recommendationMode,
      recommendedDate: today,
    },
  })

  console.log(`[${requestId}] TopicSelection created: ${selection.id}, strategy=${result.strategy}`)

  return NextResponse.json({
    data: {
      topicSelectionId: selection.id,
      cards: result.cards,
      elementCodes: result.elementCodes,
      strategy: result.strategy,
      sourceHighlights: topicSources.slice(0, 16),
    },
  })
})
