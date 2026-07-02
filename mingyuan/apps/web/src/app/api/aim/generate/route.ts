import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, authErrorResponse } from "@/lib/user-auth"
import { generateAimContent } from "@/lib/aim-generator"
import { parseGenerateBody, validateGenerateInput } from "@/lib/aim-generate-validate"
import { prisma } from "@/lib/prisma"

async function buildRawInputWithVideoCopyContext(
  userId: string,
  rawInput: string,
  videoCopyExtractionId?: string
) {
  if (!videoCopyExtractionId) return rawInput

  const record = await prisma.videoCopyExtraction.findFirst({
    where: { id: videoCopyExtractionId, userId },
    select: {
      videoTitle: true,
      sourceUrl: true,
      transcript: true,
      analysisResult: true,
    },
  })
  if (!record) return rawInput

  const analysis = record.analysisResult
    ? JSON.stringify(record.analysisResult, null, 2)
    : ""
  const transcript = record.transcript && !rawInput.includes(record.transcript)
    ? `对标原文：\n${record.transcript}`
    : null
  const analysisBlock = analysis && !rawInput.includes(analysis)
    ? `结构化拆解：\n${analysis}`
    : null

  return [
    rawInput,
    "",
    "=== 爆款文案拆解上下文（生成时必须参考） ===",
    "硬规则：生成内容不得偏离对标视频的核心选题。IP特色只能用于替换案例、身份表达、产品承接和行动引导，不能把主题改成另一个选题。",
    record.videoTitle ? `对标标题：${record.videoTitle}` : null,
    `来源链接：${record.sourceUrl}`,
    transcript,
    analysisBlock,
  ].filter(Boolean).join("\n")
}

export async function buildRawInputWithMarketViralContext(
  userId: string,
  rawInput: string,
  enabled?: boolean,
) {
  if (enabled === false) return rawInput

  const accounts = await prisma.watchAccount.findMany({
    where: { userId },
    select: {
      nickname: true,
      targetUrl: true,
      viralVideos: true,
    },
    orderBy: { lastRefreshedAt: "desc" },
    take: 10,
  })

  const lines = accounts.flatMap((account) => {
    const videos = Array.isArray(account.viralVideos) ? account.viralVideos.slice(0, 20) : []
    return videos.map((video, index) => {
      const item = video as {
        title?: string
        videoUrl?: string
        likes?: number
        comments?: number
        shares?: number
        collects?: number
        engagementScore?: number
      }
      return [
        `账号：${account.nickname || account.targetUrl}`,
        `排名：TOP ${index + 1}`,
        `标题：${item.title || "无标题"}`,
        `互动：赞${item.likes ?? 0} / 评${item.comments ?? 0} / 转${item.shares ?? 0} / 藏${item.collects ?? 0} / 热度${item.engagementScore ?? 0}`,
        item.videoUrl ? `链接：${item.videoUrl}` : null,
      ].filter(Boolean).join("；")
    })
  })

  if (lines.length === 0) return rawInput

  return [
    rawInput,
    "",
    "=== 市场洞察爆款作品上下文（选题定位必须参考） ===",
    "硬规则：不得照搬对标账号标题；只能复用观点结构、钩子逻辑和表达方式。",
    "生成选题时必须输出：客户经历资产、匹配爆款观点、人设转译、选题建议、爆款依据。",
    ...lines.slice(0, 60),
  ].join("\n")
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    const body = await request.json()
    const parsed = parseGenerateBody(body)

    const validationError = validateGenerateInput(parsed)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const rawInput = await buildRawInputWithMarketViralContext(
      user.id,
      await buildRawInputWithVideoCopyContext(
        user.id,
        parsed.rawInput,
        parsed.videoCopyExtractionId
      ),
      parsed.useMarketViralVideos,
    )

    const result = await generateAimContent({
      userId: user.id,
      projectId: parsed.projectId,
      rawInput,
      agentId: parsed.agentId,
      targetFormats: parsed.targetFormats,
      taskType: parsed.taskType,
      topicTitle: parsed.topicTitle,
      topicRationale: parsed.topicRationale,
      topicType: parsed.topicType,
      hotTopic: parsed.hotTopic,
      polishInstruction: parsed.polishInstruction,
      videoCopyExtractionId: parsed.videoCopyExtractionId,
    })
    return NextResponse.json(result)
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("[aim/generate] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成失败" },
      { status: 500 }
    )
  }
}
