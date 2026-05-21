import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, authErrorResponse } from "@/lib/user-auth"
import {
  generateAimContent,
  type ContentFormat,
} from "@/lib/aim-generator"

const VALID_FORMATS = new Set(["video_script", "wechat_article", "moments_post"])

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    const body = await request.json()
    const rawInput = typeof body.rawInput === "string" ? body.rawInput.trim() : ""
    const targetFormats = Array.isArray(body.targetFormats)
      ? body.targetFormats.filter((format: unknown): format is ContentFormat =>
          typeof format === "string" && VALID_FORMATS.has(format)
        )
      : []

    if (!rawInput) {
      return NextResponse.json({ error: "请输入内容" }, { status: 400 })
    }
    if (targetFormats.length === 0) {
      return NextResponse.json({ error: "请选择至少一种生成格式" }, { status: 400 })
    }

    const result = await generateAimContent({
      userId: user.id,
      rawInput,
      targetFormats,
      topicTitle: typeof body.topicTitle === "string" ? body.topicTitle : undefined,
      topicRationale: typeof body.topicRationale === "string" ? body.topicRationale : undefined,
      hotTopic: typeof body.hotTopic === "string" ? body.hotTopic : undefined,
      polishInstruction: typeof body.polishInstruction === "string" ? body.polishInstruction : undefined,
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
