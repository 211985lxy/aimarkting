import { LLMClient } from "@/lib/llm/client"

/**
 * 质检 Agent
 * 对生成的内容进行多维度质量评估，输出结构化报告。
 */

export interface AimQualityReport {
  totalScore: number
  hookScore: number
  logicScore: number
  humanToneScore: number
  shootabilityScore: number
  conversionScore: number
  risks: string[]
  rewriteSuggestions: string[]
  pass: boolean
}

const PASS_THRESHOLD = 70

export async function runQualityCheck(input: {
  content: string
  contentType?: "video_script" | "copy" | "article"
}): Promise<AimQualityReport> {
  const contentTypeLabel =
    input.contentType === "video_script"
      ? "短视频口播脚本"
      : input.contentType === "article"
        ? "公众号文章"
        : "营销文案"

  const systemPrompt = `你是一个内容质检专家。请对以下${contentTypeLabel}进行严格的质量评估。

评估维度（每项 0-100 分）：
1. hookScore（开头吸引力）：前3秒/前两行是否能抓住注意力？是否有冲突、反差、痛点或利益钩子？
2. logicScore（逻辑性）：内容是否有清晰的递进？论点是否有支撑？是否有逻辑跳跃？
3. humanToneScore（像人话程度）：是否像真人会说的话？是否有AI味（如"在这个xxx的时代""让我们一起来""总而言之"）？是否有营销黑话？
4. shootabilityScore（拍摄可行性）：是否可以实际拍摄执行？是否需要难以实现的场景？时长是否合理？
5. conversionScore（成交承接）：结尾是否有明确的行动号召？是否引导到私域/咨询/下单？承接是否自然不生硬？

事实风险检查：
- 是否有无法验证的数据或断言？
- 是否有夸大宣传、保证效果等合规风险？
- 是否有潜在的负面舆情风险？

请严格按以下 JSON 格式输出，不要输出任何其他内容：
{
  "hookScore": 0-100的整数,
  "logicScore": 0-100的整数,
  "humanToneScore": 0-100的整数,
  "shootabilityScore": 0-100的整数,
  "conversionScore": 0-100的整数,
  "risks": ["风险1", "风险2"],
  "rewriteSuggestions": ["建议1", "建议2"]
}`

  const userPrompt = `请质检以下内容：\n\n---\n${input.content}\n---`

  const completion = await LLMClient.shared().complete({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 1500,
  })

  try {
    const jsonStr = completion.content
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim()
    const parsed = JSON.parse(jsonStr) as Omit<AimQualityReport, "totalScore" | "pass">

    const hookScore = clampScore(parsed.hookScore)
    const logicScore = clampScore(parsed.logicScore)
    const humanToneScore = clampScore(parsed.humanToneScore)
    const shootabilityScore = clampScore(parsed.shootabilityScore)
    const conversionScore = clampScore(parsed.conversionScore)

    const totalScore = Math.round(
      (hookScore * 0.25 +
        logicScore * 0.2 +
        humanToneScore * 0.25 +
        shootabilityScore * 0.15 +
        conversionScore * 0.15)
    )

    return {
      totalScore,
      hookScore,
      logicScore,
      humanToneScore,
      shootabilityScore,
      conversionScore,
      risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 5) : [],
      rewriteSuggestions: Array.isArray(parsed.rewriteSuggestions)
        ? parsed.rewriteSuggestions.slice(0, 5)
        : [],
      pass: totalScore >= PASS_THRESHOLD,
    }
  } catch {
    return {
      totalScore: 0,
      hookScore: 0,
      logicScore: 0,
      humanToneScore: 0,
      shootabilityScore: 0,
      conversionScore: 0,
      risks: ["质检结果解析失败，请重新质检"],
      rewriteSuggestions: [],
      pass: false,
    }
  }
}

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? Math.round(value) : 0
  return Math.max(0, Math.min(100, n))
}