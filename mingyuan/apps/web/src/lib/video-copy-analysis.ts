import { LLMClient, type ChatMessage, type LLMProvider } from "@/lib/llm"

export interface VideoCopyAnalysisInput {
  title?: string | null
  platform?: string | null
  transcript: string
}

export interface VideoCopyAnalysis {
  hook: string
  structure: string[]
  emotionConflict: string
  expressionSkills: string[]
  conversionAction: string
  reusableTemplate: string
  imitationSuggestions: string[]
  riskNotes: string[]
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => stringValue(item)).filter(Boolean)
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?])\s*/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function buildFallbackVideoCopyAnalysis(input: VideoCopyAnalysisInput): VideoCopyAnalysis {
  const sentences = splitSentences(input.transcript)
  const hook = sentences[0] ?? input.transcript.slice(0, 80)
  const structure = sentences.slice(0, 6)

  return {
    hook,
    structure: structure.length > 0 ? structure : [hook],
    emotionConflict: "围绕用户痛点、经验判断和行动建议展开。",
    expressionSkills: ["直接给结论", "分步骤说明", "用个人经验增强可信度"],
    conversionAction: "适合引导用户收藏、评论或继续查看完整方法。",
    reusableTemplate: `${hook}\n\n按“结论/背景/步骤/提醒/行动”的顺序改写成自己的案例。`,
    imitationSuggestions: ["保留开头判断", "替换为自己的行业案例", "把步骤改成可执行清单"],
    riskNotes: ["不要照搬原文", "涉及平台规则和收益判断时避免绝对化表达"],
  }
}

export function buildVideoCopyAnalysisMessages(input: VideoCopyAnalysisInput): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "你是短视频文案分析师。只基于用户提供的视频标题、平台和文案做结构化分析，不要编造视频里没有的信息。输出严格 JSON。",
    },
    {
      role: "user",
      content: [
        `平台：${input.platform || "unknown"}`,
        `标题：${input.title || "未提供"}`,
        "视频文案：",
        input.transcript,
        "",
        "请输出 JSON，字段固定为：hook, structure, emotionConflict, expressionSkills, conversionAction, reusableTemplate, imitationSuggestions, riskNotes。",
      ].join("\n"),
    },
  ]
}

export function parseVideoCopyAnalysis(content: string): VideoCopyAnalysis {
  let data: unknown
  try {
    data = JSON.parse(content)
  } catch {
    throw new Error("结构化分析失败，请稍后重试。")
  }

  if (!data || typeof data !== "object") {
    throw new Error("结构化分析失败，请稍后重试。")
  }

  const record = data as Record<string, unknown>
  const analysis: VideoCopyAnalysis = {
    hook: stringValue(record.hook),
    structure: stringArray(record.structure),
    emotionConflict: stringValue(record.emotionConflict),
    expressionSkills: stringArray(record.expressionSkills),
    conversionAction: stringValue(record.conversionAction),
    reusableTemplate: stringValue(record.reusableTemplate),
    imitationSuggestions: stringArray(record.imitationSuggestions),
    riskNotes: stringArray(record.riskNotes),
  }

  if (!analysis.hook || analysis.structure.length === 0 || !analysis.reusableTemplate) {
    throw new Error("结构化分析失败，请稍后重试。")
  }

  return analysis
}

export async function analyzeVideoCopy(
  input: VideoCopyAnalysisInput,
  provider: LLMProvider | LLMClient = LLMClient.shared()
): Promise<VideoCopyAnalysis> {
  const result = await provider.complete({
    messages: buildVideoCopyAnalysisMessages(input),
    temperature: 0.2,
    maxTokens: 1600,
    responseFormat: { type: "json_object" },
  })

  try {
    return parseVideoCopyAnalysis(result.content)
  } catch {
    return buildFallbackVideoCopyAnalysis(input)
  }
}
