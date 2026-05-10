import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildIpProfileView } from "@/lib/ip-profile"
import { withUserAuth } from "@/lib/user-auth"
import {
  HotTopicIntelligenceError,
  evaluateHotTopicFit,
  getOrGenerateHotTopicInsight,
} from "@/lib/hot-topic-intelligence"
import type { ExpressionBlueprint } from "@/types/content-template"

export const POST = withUserAuth(async (request, { user, params }) => {
  const topicId = params?.id
  if (!topicId) {
    return NextResponse.json({ error: "Missing topic id" }, { status: 400 })
  }

  const body = await request.json()
  const templateId = typeof body.templateId === "string" ? body.templateId : ""
  const structureId = typeof body.structureId === "string" ? body.structureId : ""
  const inputs =
    body.inputs && typeof body.inputs === "object"
      ? (body.inputs as Record<string, string>)
      : {}

  if (!templateId || !structureId) {
    return NextResponse.json(
      { error: "templateId and structureId are required" },
      { status: 400 },
    )
  }

  const [{ topic, insight }, template, structure, ipProfile] = await Promise.all([
    getOrGenerateHotTopicInsight(topicId),
    prisma.contentTemplate.findUnique({
      where: { id: templateId, status: "published" },
      select: {
        id: true,
        displayName: true,
        description: true,
        hookType: true,
        scriptTemplate: true,
        expressionBlueprint: true,
      },
    }),
    prisma.videoStructure.findFirst({
      where: {
        OR: [{ id: structureId }, { name: structureId }],
        status: "published",
      },
      select: {
        id: true,
        displayName: true,
        blueprint: true,
      },
    }),
    prisma.ipProfile.findUnique({
      where: { userId: user.id },
    }),
  ])

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }

  if (!structure) {
    return NextResponse.json({ error: "Video structure not found" }, { status: 400 })
  }

  const profileView = buildIpProfileView(ipProfile)
  if (!profileView.profile || !profileView.isComplete) {
    return NextResponse.json(
      {
        error: "IP profile is incomplete",
        data: {
          profile: profileView.profile,
          isComplete: profileView.isComplete,
          missingFields: profileView.missingFields,
        },
      },
      { status: 412 },
    )
  }

  try {
    const expressionBlueprint = template.expressionBlueprint as ExpressionBlueprint | null
    const fit = await evaluateHotTopicFit({
      topicTitle: topic.title,
      insight,
      ipProfile: profileView.profile,
      template: {
        ...template,
        expressionBlueprint,
      },
      structure: {
        id: structure.id,
        displayName: structure.displayName,
        blueprint: structure.blueprint as {
          openingPattern: string
          narrativeBeats: string[]
          evidenceSlots: number
          ctaSlot: string
          durationRange: { min: number; max: number }
        },
      },
      inputs,
    })

    return NextResponse.json({
      data: {
        topic,
        insight,
        fit,
      },
    })
  } catch (error) {
    if (error instanceof HotTopicIntelligenceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      )
    }

    console.error("[hot-topics/fit] unexpected error:", error)
    return NextResponse.json(
      { error: "热点适配评估失败" },
      { status: 500 },
    )
  }
})
