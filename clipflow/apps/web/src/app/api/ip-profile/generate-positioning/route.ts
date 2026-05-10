import { NextResponse } from "next/server"
import { withUserAuth } from "@/lib/user-auth"
import { LLMClient } from "@/lib/llm/client"
import {
  ThreeDPositioningSchema,
  autoFixPositioning,
  type ThreeDPositioning,
} from "@/lib/ip-profile-v2-validation"
import { buildPositioningPrompt, type SurveyInput } from "@/lib/ip-profile-v2-prompt"

interface GenerateRequest {
  surveyIndustry: string
  surveyTargetCustomer: string
  surveyMonetization: string[]
  surveyPersonalTraits: string
  surveyContentGoal: string
}

/**
 * Generate 3D positioning with retry logic
 *
 * Attempt 1: temperature 0.7 (creative)
 * Attempt 2: temperature 0.3 (deterministic) with auto-fix
 *
 * @param survey Survey input from 5-question wizard
 * @param maxAttempts Maximum number of attempts (default 2)
 * @returns Success with positioning data, or failure with error message
 */
async function generateWithRetry(
  survey: SurveyInput,
  maxAttempts: number = 2
): Promise<{ success: true; data: ThreeDPositioning } | { success: false; error: string }> {
  const llm = LLMClient.shared()
  if (!llm.available) {
    return { success: false, error: "AI service unavailable" }
  }

  const { systemPrompt, userPrompt } = buildPositioningPrompt(survey)
  let lastError: string = ""

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const temperature = attempt === 1 ? 0.7 : 0.3 // Lower temperature on retry

    try {
      console.log(`[generate-positioning] Attempt ${attempt}/${maxAttempts} (temp: ${temperature})`)

      const result = await llm.complete({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature,
        maxTokens: 2048,
        responseFormat: { type: "json_object" },
      })

      // Parse LLM output
      let parsed: unknown
      try {
        let raw = result.content.trim()
        // Strip markdown code blocks if present
        const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
        if (fenced) raw = fenced[1].trim()
        parsed = JSON.parse(raw)
      } catch (parseError) {
        lastError = `JSON parsing failed: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        console.error(`[generate-positioning] ${lastError}`)
        continue // Retry
      }

      // Validate with Zod
      const validated = ThreeDPositioningSchema.safeParse(parsed)

      if (validated.success) {
        console.log(`[generate-positioning] Success on attempt ${attempt}`)
        return { success: true, data: validated.data }
      }

      // Validation failed - try auto-fix
      console.log(`[generate-positioning] Validation failed, attempting auto-fix`)
      const fixed = autoFixPositioning(parsed)

      if (fixed) {
        console.log(`[generate-positioning] Auto-fix successful on attempt ${attempt}`)
        return { success: true, data: fixed }
      }

      // Auto-fix failed
      lastError = validated.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")
      console.error(`[generate-positioning] Validation errors: ${lastError}`)

      // Continue to retry if attempts remain
    } catch (error) {
      lastError = `LLM error: ${error instanceof Error ? error.message : String(error)}`
      console.error(`[generate-positioning] ${lastError}`)
    }
  }

  return {
    success: false,
    error: `Failed to generate valid positioning after ${maxAttempts} attempts. Last error: ${lastError}`,
  }
}

/**
 * POST /api/ip-profile/generate-positioning
 *
 * Generate three-dimensional IP positioning from 5-question survey input
 *
 * Request body:
 * - surveyIndustry: string
 * - surveyTargetCustomer: string
 * - surveyMonetization: string[]
 * - surveyPersonalTraits: string
 * - surveyContentGoal: string
 *
 * Response:
 * - 200: { data: { business, persona, content } }
 * - 400: { error: "Missing required survey fields" }
 * - 500: { error: "Failed to generate..." }
 * - 503: { error: "AI service unavailable" }
 */
export const POST = withUserAuth(async (request) => {
  const body: GenerateRequest = await request.json()

  // Validate request
  if (
    !body.surveyIndustry ||
    !body.surveyTargetCustomer ||
    !body.surveyMonetization ||
    !Array.isArray(body.surveyMonetization) ||
    !body.surveyPersonalTraits ||
    !body.surveyContentGoal
  ) {
    return NextResponse.json(
      { error: "Missing required survey fields" },
      { status: 400 }
    )
  }

  const survey: SurveyInput = {
    surveyIndustry: body.surveyIndustry,
    surveyTargetCustomer: body.surveyTargetCustomer,
    surveyMonetization: body.surveyMonetization,
    surveyPersonalTraits: body.surveyPersonalTraits,
    surveyContentGoal: body.surveyContentGoal,
  }

  const result = await generateWithRetry(survey)

  if (!result.success) {
    const statusCode = result.error.includes("unavailable") ? 503 : 500
    return NextResponse.json(
      { error: result.error },
      { status: statusCode }
    )
  }

  return NextResponse.json({
    data: result.data,
  })
})
