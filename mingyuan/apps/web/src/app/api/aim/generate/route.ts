import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, authErrorResponse } from "@/lib/user-auth"
import { generateAimContent } from "@/lib/aim-generator"
import { parseGenerateBody, validateGenerateInput } from "@/lib/aim-generate-validate"
import {
  resolveAimRuntimeTask,
  shouldUseKnowledgeContextForTask,
  shouldUseMarketViralContextForTask,
} from "@/lib/aim-knowledge-strategy"
import {
  buildRawInputWithMarketViralContext,
  buildRawInputWithVideoCopyContext,
} from "@/lib/aim-generate-context"
import {
  addAimTraceStep,
  createAimTrace,
  failAimTrace,
  runAimTraceStep,
  summarizeText,
  type AimTraceRecorder,
} from "@/lib/aim-observability"
import { enforceDailyBetaLimit } from "@/lib/internal-beta-limits"

export async function POST(request: NextRequest) {
  let trace: AimTraceRecorder | undefined
  try {
    const user = await authenticateRequest(request)
    const quotaResponse = await enforceDailyBetaLimit(user.id, "aim_generate")
    if (quotaResponse) return quotaResponse

    const body = await request.json()
    const parsed = parseGenerateBody(body)
    trace = await createAimTrace({
      userId: user.id,
      projectId: parsed.projectId || null,
      agentId: parsed.agentId || null,
      action: "generate",
      inputSummary: parsed.rawInput,
    })
    await addAimTraceStep(trace, {
      key: "parse_request",
      label: "请求解析",
      status: "success",
      summary: "生成请求已解析",
      inputSummary: summarizeText(body),
      metadata: { agentId: parsed.agentId, targetFormats: parsed.targetFormats },
    })

    const validationError = await runAimTraceStep(
      trace,
      "validate_input",
      "输入校验",
      () => validateGenerateInput(parsed),
      (error) => ({ summary: error ? "校验失败" : "校验通过", error: error || undefined }),
    )
    if (validationError) {
      await failAimTrace(trace, validationError)
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const runtimeTask = await runAimTraceStep(
      trace,
      "resolve_runtime_task",
      "任务类型识别",
      () => resolveAimRuntimeTask({
        agentId: parsed.agentId,
        input: parsed.rawInput,
        taskType: parsed.taskType,
        polishInstruction: parsed.polishInstruction,
        targetFormats: parsed.targetFormats,
      }),
      (task) => ({ summary: task, metadata: { runtimeTask: task } }),
    )
    const withVideoCopyContext = shouldUseKnowledgeContextForTask(runtimeTask)
      ? await runAimTraceStep(
          trace,
          "video_copy_context",
          "爆款拆解上下文注入",
          () => buildRawInputWithVideoCopyContext(
            user.id,
            parsed.rawInput,
            parsed.videoCopyExtractionId,
          ),
          (value) => ({
            summary: value === parsed.rawInput ? "未注入爆款拆解" : "已注入爆款拆解",
            metadata: { chars: value.length },
          }),
        )
      : parsed.rawInput

    if (!shouldUseKnowledgeContextForTask(runtimeTask)) {
      await addAimTraceStep(trace, {
        key: "video_copy_context",
        label: "爆款拆解上下文注入",
        status: "skipped",
        summary: "轻改任务跳过爆款拆解",
      })
    }

    const rawInput = await runAimTraceStep(
      trace,
      "market_viral_context",
      "市场爆款上下文注入",
      () => buildRawInputWithMarketViralContext(
        user.id,
        withVideoCopyContext,
        parsed.useMarketViralVideos !== false && shouldUseMarketViralContextForTask(runtimeTask),
      ),
      (value) => ({
        summary: value === withVideoCopyContext ? "未注入市场爆款" : "已注入市场爆款",
        metadata: { chars: value.length },
      }),
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
      existingGenerationId: parsed.existingGenerationId,
      runtimeTask,
      trace,
    })
    return NextResponse.json(result)
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse

    console.error("[aim/generate] Error:", error)
    await failAimTrace(trace, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成失败" },
      { status: 500 }
    )
  }
}
