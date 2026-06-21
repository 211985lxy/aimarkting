import { LLMClient, type ChatMessage, type LLMProvider } from "@/lib/llm"

export interface VideoCopyAnalysisInput {
  title?: string | null
  platform?: string | null
  transcript: string
}

export interface VideoCopyAnalysis {
  /** 纯 Markdown 格式的四维拆解，包含结构拆解、心理拆解、商业拆解、迁移应用 */
  markdown: string
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

  return {
    markdown: [
      "## 结构拆解",
      "",
      `### 开头\n${hook}`,
      "",
      `### 正文\n${sentences.slice(1, 5).join("\n") || "正文待分析"}`,
      "",
      `### 结尾\n${sentences.slice(-2).join("\n") || "结尾待分析"}`,
      "",
      "## 心理拆解",
      "",
      "围绕用户**痛点**、经验判断和**行动建议**展开心理驱动。",
      "",
      "## 商业拆解",
      "",
      "适合引导用户收藏、评论或继续查看完整方法。",
      "",
      "## 迁移应用",
      "",
      `### 可复用模板\n${hook}`,
      "",
      '按"结论→背景→步骤→提醒→行动"的顺序改写成自己的案例。',
      "",
      "### 模仿建议",
      "1. 保留开头判断",
      "2. 替换为自己的行业案例",
      "3. 把步骤改成可执行清单",
      "",
      "### 风险提醒",
      "> 不要照搬原文；涉及平台规则和收益判断时避免绝对化表达。",
    ].join("\n"),
  }
}

export function buildVideoCopyAnalysisMessages(input: VideoCopyAnalysisInput): ChatMessage[] {
  return [
    {
      role: "system",
      content: `你是"爆款内容商业拆解顾问"，擅长拆解短视频、图文、口播文案、销售文案和个人IP内容。

你的任务不是总结原文，而是分析这条内容为什么有效、它如何推动用户心理、它背后的商业目的是什么，以及用户如何把它迁移到自己的行业和账号中。

你必须始终围绕四个目标进行分析：

1. 结构拆解：拆出内容的开头、正文、转折、结尾、节奏和表达方式。
2. 心理拆解：拆出内容如何制造好奇、焦虑、信任、共鸣、期待和行动。
3. 商业拆解：判断这条内容吸引什么人、筛选什么人、建立什么信任、预埋什么产品、适合承接什么转化。
4. 迁移应用：把原文结构抽象成可复用模板，并根据用户的行业、人设、产品给出改写方向。

分析时必须遵守以下规则：

- 不要只总结原文。
- 不要只提炼金句。
- 不要泛泛而谈"这个开头很吸引人"。
- 每个判断都要说明"为什么有效"。
- 每个结构都要说明"它在用户心理上起什么作用"。
- 每个模仿建议都要说明"哪些能保留，哪些必须替换"。
- 如果原文有转化意图，必须指出它的成交路径。
- 如果原文不适合用户直接模仿，必须明确提醒风险。
- 输出要具体、可执行、适合内容创作者直接使用。

输出格式：纯 Markdown，不要 JSON 包裹。
全文以四个二级标题组织：

- ## 结构拆解
- ## 心理拆解
- ## 商业拆解
- ## 迁移应用

每个章节内可以使用 ### 三级标题、**加粗**、- 列表、> 引用等 Markdown 语法增强可读性。`,
    },
    {
      role: "user",
      content: [
        `平台：${input.platform || "unknown"}`,
        `标题：${input.title || "未提供"}`,
        "视频文案：",
        input.transcript,
        "",
        "请按照「爆款内容商业拆解顾问」的角色要求，输出完整的四维拆解。",
      ].join("\n"),
    },
  ]
}

export function parseVideoCopyAnalysis(content: string): VideoCopyAnalysis {
  // LLM 现在直接输出纯 Markdown，不再包裹 JSON
  const trimmed = content.trim()
  if (trimmed.length < 50) {
    throw new Error("结构化分析失败，请稍后重试。")
  }
  return { markdown: trimmed }
}

export async function analyzeVideoCopy(
  input: VideoCopyAnalysisInput,
  provider: LLMProvider | LLMClient = LLMClient.shared()
): Promise<VideoCopyAnalysis> {
  const result = await provider.complete({
    messages: buildVideoCopyAnalysisMessages(input),
    temperature: 0.2,
    maxTokens: 4000,
  })

  try {
    return parseVideoCopyAnalysis(result.content)
  } catch {
    return buildFallbackVideoCopyAnalysis(input)
  }
}
