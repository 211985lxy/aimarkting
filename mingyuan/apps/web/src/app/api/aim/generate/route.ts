import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, authErrorResponse } from "@/lib/user-auth"
import { generateAimContent } from "@/lib/aim-generator"
import { parseGenerateBody, validateGenerateInput } from "@/lib/aim-generate-validate"
import { buildBenchmarkLengthRule, buildBenchmarkRecreationSopBlock } from "@/lib/aim-benchmark-length"
import {
  resolveAimRuntimeTask,
  shouldUseKnowledgeContextForTask,
  shouldUseMarketViralContextForTask,
} from "@/lib/aim-knowledge-strategy"
import { prisma } from "@/lib/prisma"
import {
  addAimTraceStep,
  createAimTrace,
  failAimTrace,
  runAimTraceStep,
  summarizeText,
  type AimTraceRecorder,
} from "@/lib/aim-observability"
import { enforceDailyBetaLimit } from "@/lib/internal-beta-limits"

function formatAnalysisResultForPrompt(analysisResult: unknown) {
  if (!analysisResult) return ""
  if (typeof analysisResult === "object" && "markdown" in analysisResult) {
    const markdown = (analysisResult as { markdown?: unknown }).markdown
    if (typeof markdown === "string" && markdown.trim()) return markdown
  }
  return JSON.stringify(analysisResult, null, 2)
}

export async function buildRawInputWithVideoCopyContext(
  userId: string,
  rawInput: string,
  videoCopyExtractionId?: string,
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

  const analysis = formatAnalysisResultForPrompt(record.analysisResult)
  const transcript = record.transcript && !rawInput.includes(record.transcript)
    ? `对标原文：\n${record.transcript}`
    : null
  const analysisBlock = analysis && !rawInput.includes(analysis)
    ? `结构化拆解：\n${analysis}`
    : null
  const lengthRule = buildBenchmarkLengthRule(record.transcript)
  const recreationSop = buildBenchmarkRecreationSopBlock()

  return [
    rawInput,
    "",
    "=== 爆款文案拆解上下文（生成时必须参考） ===",
    "硬规则：生成内容不得偏离对标视频的核心选题。IP特色只能用于替换案例、身份表达、产品承接和行动引导，不能把主题改成另一个选题。",
    recreationSop,
    record.videoTitle ? `对标标题：${record.videoTitle}` : null,
    lengthRule,
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
    "账号分析参考来源：以下为用户已经分析/监控过的对标账号爆款作品，定位策划官必须把它们作为账号分析依据之一；如果没有足够数据，标明未提供/待补充。",
    "定位策划使用要求：输出账号分析时至少归纳对标账号的内容母题、爆款钩子、受众假设、表达风格和可迁移/不可迁移点。",
    "生成选题时必须输出：客户经历资产、匹配爆款观点、人设转译、选题建议、爆款依据。",
    ...lines.slice(0, 60),
  ].join("\n")
}

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
