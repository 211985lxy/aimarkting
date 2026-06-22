import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, authErrorResponse } from "@/lib/user-auth"
import { generateAimContent } from "@/lib/aim-generator"
import { parseGenerateBody, validateGenerateInput } from "@/lib/aim-generate-validate"

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    const body = await request.json()
    const parsed = parseGenerateBody(body)

    const validationError = validateGenerateInput(parsed)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const result = await generateAimContent({
      userId: user.id,
      projectId: parsed.projectId,
      rawInput: parsed.rawInput,
      agentId: parsed.agentId,
      targetFormats: parsed.targetFormats,
      taskType: parsed.taskType,
      topicTitle: parsed.topicTitle,
      topicRationale: parsed.topicRationale,
      hotTopic: parsed.hotTopic,
      polishInstruction: parsed.polishInstruction,
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
