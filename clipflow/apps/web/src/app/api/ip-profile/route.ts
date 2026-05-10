import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withUserAuth } from "@/lib/user-auth"
import {
  buildIpProfilePromptSnapshot,
  buildIpProfileView,
  getIpProfileMissingFields,
  isIpProfileComplete,
  normalizeIpProfileInput,
} from "@/lib/ip-profile"
import { ThreeDPositioningSchema } from "@/lib/ip-profile-v2-validation"

export const GET = withUserAuth(async (_request, { user }) => {
  const profile = await prisma.ipProfile.findUnique({
    where: { userId: user.id },
  })

  const view = buildIpProfileView(profile)

  // Return all fields (v1 + v2)
  return NextResponse.json({
    data: {
      ...view,
      profileVersion: profile?.profileVersion ?? 1,
      // v2 survey fields
      surveyIndustry: profile?.surveyIndustry,
      surveyTargetCustomer: profile?.surveyTargetCustomer,
      surveyMonetization: profile?.surveyMonetization,
      surveyPersonalTraits: profile?.surveyPersonalTraits,
      surveyContentGoal: profile?.surveyContentGoal,
      // v2 positioning fields
      business: profile?.business,
      persona: profile?.persona,
      content: profile?.content,
    },
  })
})

export const PUT = withUserAuth(async (request, { user }) => {
  const body = await request.json()

  // Determine version from request body
  const version = body.profileVersion ?? 1

  let updateData: any
  let isComplete: boolean
  let promptSnapshot: string | null = null

  if (version === 1) {
    // v1 update: use existing logic
    const normalized = normalizeIpProfileInput(body)
    isComplete = isIpProfileComplete(normalized as any)
    promptSnapshot = buildIpProfilePromptSnapshot(normalized as any)

    updateData = {
      ...normalized,
      profileVersion: 1,
      isComplete,
      promptSnapshot,
      isActive: true,
    }
  } else if (version === 2) {
    // v2 update: accept survey + positioning fields
    // Validate 3D positioning structure if provided
    if (body.business && body.persona && body.content) {
      const positioningValidation = ThreeDPositioningSchema.safeParse({
        business: body.business,
        persona: body.persona,
        content: body.content,
      })
      if (!positioningValidation.success) {
        return NextResponse.json(
          {
            error: "三维定位数据格式无效",
            details: positioningValidation.error.issues.map((i) =>
              `${i.path.join(".")}: ${i.message}`
            ),
          },
          { status: 400 },
        )
      }
    }

    // Derive flat fields from v2 3D structure using correct v2 field names.
    // BusinessPositioning: core, audience, value, differentiator
    // PersonaDesign: expertiseLevel, expressionStyle, traits
    // ContentStrategy: themes, formats, rhythm
    const biz = body.business as Record<string, unknown> | undefined
    const per = body.persona as Record<string, unknown> | undefined
    const traits = Array.isArray(per?.traits) ? (per.traits as string[]).join("、") : null

    const profileData = {
      profileVersion: 2,
      displayName: body.displayName,
      nickname: body.nickname,
      industry: body.surveyIndustry ?? body.industry ?? null,
      primaryOffer: (biz?.core as string) ?? body.primaryOffer ?? null,
      targetAudience: (biz?.audience as string) ?? body.targetAudience ?? null,
      ipTraits: traits ?? body.ipTraits ?? null,
      toneOfVoice: (per?.expressionStyle as string) ?? body.toneOfVoice ?? null,
      proofPoints: (biz?.differentiator as string) ?? traits ?? body.proofPoints ?? null,
      callToAction: (biz?.value as string) ?? body.callToAction ?? null,
      surveyIndustry: body.surveyIndustry,
      surveyTargetCustomer: body.surveyTargetCustomer,
      surveyMonetization: body.surveyMonetization,
      surveyPersonalTraits: body.surveyPersonalTraits,
      surveyContentGoal: body.surveyContentGoal,
      business: body.business,
      persona: body.persona,
      content: body.content,
    }

    isComplete = isIpProfileComplete(profileData as any)
    promptSnapshot = isComplete ? buildIpProfilePromptSnapshot(profileData as any) : null

    updateData = {
      ...profileData,
      isComplete,
      promptSnapshot,
      isActive: true,
    }
  } else {
    return NextResponse.json(
      { error: "Invalid profileVersion" },
      { status: 400 }
    )
  }

  const profile = await prisma.ipProfile.upsert({
    where: { userId: user.id },
    update: updateData,
    create: {
      userId: user.id,
      ...updateData,
    },
  })

  const missingFields = getIpProfileMissingFields(profile as any)

  return NextResponse.json({
    data: {
      profile,
      isComplete,
      missingFields,
      promptSnapshot,
    },
  })
})
