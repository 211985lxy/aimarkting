import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withUserAuth } from "@/lib/user-auth"
import { generateTopicCards } from "@/lib/topic-generation"
import { VALID_ELEMENT_CODES } from "@/lib/topic-validation"
import type { TopicCard } from "@/lib/topic-validation"
import { hasConflict } from "@/lib/topic-element-logic"
import type { Prisma } from "@/generated/prisma/client"

export const maxDuration = 60

export const POST = withUserAuth(async (request, { user }) => {
  const requestId = `topic-gen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  console.log(`[${requestId}] Topic generation initiated by user ${user.id}`)

  const body = await request.json()
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

  const [elements, recentSelections] = await Promise.all([
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
  ])

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

  const result = await generateTopicCards({
    ipProfile: null,
    elements,
    forcedElementCodes,
    recentElementSets,
    recentTitles,
    refreshCount,
  })

  const duration = Date.now() - startTime
  console.log(
    `[${requestId}] Generation completed in ${duration}ms, success=${result.success}`,
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  const selection = await prisma.topicSelection.create({
    data: {
      userId: user.id,
      ipProfileId: "",
      elementCodes: result.elementCodes as unknown as Prisma.InputJsonValue,
      candidates: result.cards as unknown as Prisma.InputJsonValue,
      promptText: result.promptText,
      model: result.model,
      status: "pending",
    },
  })

  console.log(`[${requestId}] TopicSelection created: ${selection.id}, strategy=${result.strategy}`)

  return NextResponse.json({
    data: {
      topicSelectionId: selection.id,
      cards: result.cards,
      elementCodes: result.elementCodes,
      strategy: result.strategy,
    },
  })
})
