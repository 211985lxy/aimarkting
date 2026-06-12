import { LLMClient } from "@/lib/llm/client"

/**
 * 分发 Agent
 * 从已有脚本派生朋友圈、公众号、封面文案等分发物料。
 */
export type DistributionFormat = "moments_post" | "wechat_article" | "cover_text"

export async function repurposeContent(input: {
  script: string
  formats: DistributionFormat[]
  instruction?: string
}): Promise<Array<{ format: DistributionFormat; content: string; wordCount: number }>> {
  const results: Array<{ format: DistributionFormat; content: string; wordCount: number }> = []

  for (const format of input.formats) {
    const { systemPrompt, userPrompt } = buildPrompt(format, input.script, input.instruction)
    const completion = await LLMClient.shared().complete({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 2000,
    })
    const content = completion.content.trim()
    results.push({ format, content, wordCount: content.length })
  }

  return results
}

function buildPrompt(
  format: DistributionFormat,
  script: string,
  instruction?: string
): { systemPrompt: string; userPrompt: string } {
  const baseSystem = "你是一个企业营销内容专家。根据提供的短视频脚本，派生适合其他渠道的内容。"

  switch (format) {
    case "moments_post":
      return {
        systemPrompt: `${baseSystem}

朋友圈文案要求：
- 50-200字
- 简洁有力，第一行必须有钩子
- 有「冲突/洞察/行动」三段感，但不写小标题
- 可以用emoji但不要过多
- 最后一句引导互动
- 不要用#话题标签
- 输出纯文本`,
        userPrompt: `请根据以下脚本生成一条朋友圈文案：${instruction ? `\n补充要求：${instruction}` : ""}\n\n---\n${script}\n---`,
      }
    case "wechat_article":
      return {
        systemPrompt: `${baseSystem}

公众号文章要求：
- 800-1500字纯文本
- 有吸引人的标题（放在第一行，格式：标题：xxx）
- 语言专业但易懂
- 适合微信公众号阅读习惯
- 输出纯文本，不加格式标记`,
        userPrompt: `请根据以下脚本扩展为一篇公众号文章：${instruction ? `\n补充要求：${instruction}` : ""}\n\n---\n${script}\n---`,
      }
    case "cover_text":
      return {
        systemPrompt: `${baseSystem}

封面文案要求：
- 10-20字，适合视频封面大字展示
- 必须是脚本核心观点的精炼
- 有冲突感或利益点
- 输出纯文本，只输出封面文案本身`,
        userPrompt: `请根据以下脚本生成一条封面文案：\n\n---\n${script}\n---`,
      }
  }
}