import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, authErrorResponse } from "@/lib/user-auth"
import {
  generateAimContent,
  type ContentFormat,
  type AimTaskType,
} from "@/lib/aim-generator"

const VALID_FORMATS = new Set([
  "video_script",
  "wechat_article",
  "moments_post",
  "community_message",
  "shooting_brief",
  "raw_copy",
])

const VALID_TASK_TYPES = new Set<string>([
  "polish_copy",
  "write_script",
  "quality_check",
  "repurpose",
])

const TASK_DEFAULT_FORMATS: Record<string, ContentFormat[]> = {
  polish_copy: ["raw_copy"],
  write_script: ["video_script", "moments_post", "community_message"],
  quality_check: [],
  repurpose: ["moments_post", "wechat_article"],
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    const body = await request.json()
    const rawInput = typeof body.rawInput === "string" ? body.rawInput.trim() : ""

    // 解析 taskType
    const taskType: AimTaskType | undefined =
      typeof body.taskType === "string" && VALID_TASK_TYPES.has(body.taskType)
        ? (body.taskType as AimTaskType)
        : undefined

    // 解析 targetFormats：优先用显式传入的，否则根据 taskType 推断
    let targetFormats = Array.isArray(body.targetFormats)
      ? body.targetFormats.filter((format: unknown): format is ContentFormat =>
          typeof format === "string" && VALID_FORMATS.has(format)
        )
      : []

    if (targetFormats.length === 0 && taskType) {
      targetFormats = TASK_DEFAULT_FORMATS[taskType] || []
    }

    if (!rawInput) {
      return NextResponse.json({ error: "请输入内容" }, { status: 400 })
    }
    if (typeof body.projectId !== "string" || !body.projectId.trim()) {
      return NextResponse.json({ error: "请选择 IP 营销全案" }, { status: 400 })
    }
    if (targetFormats.length === 0) {
      return NextResponse.json({ error: "请选择至少一种生成格式" }, { status: 400 })
    }

    const result = await generateAimContent({
      userId: user.id,
      projectId: body.projectId.trim(),
      rawInput,
      targetFormats,
      taskType,
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
