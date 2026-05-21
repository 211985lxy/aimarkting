import { prisma } from "@/lib/prisma"
import { LLMClient } from "@/lib/llm/client"
import { buildIpProfilePromptSnapshot } from "@/lib/ip-profile"

export type ContentFormat = "video_script" | "wechat_article" | "moments_post"

interface AimInput {
  userId: string
  rawInput: string
  targetFormats: ContentFormat[]
  topicTitle?: string
  topicRationale?: string
  hotTopic?: string
  polishInstruction?: string
}

const CATEGORY_LABELS: Record<string, string> = {
  boss_experience: "老板经验",
  product_usp: "产品卖点",
  customer_pain: "客户痛点",
  project_case: "项目案例",
  customer_qa: "客户问答",
}

const FORMAT_INSTRUCTIONS: Record<ContentFormat, string> = {
  video_script: `【视频口播脚本】
要求：
- 200-500字，适合口播录制
- 开头3秒必须使用下方「爆款开头库」中的一种公式思路，不能平铺直叙
- 正文必须使用下方「爆款文案结构库」中的一种结构节拍
- 结尾必须使用下方「结尾类型库」中的一种方式
- 用口语化表达，禁止书面语
- 结尾有明确行动号召
- 禁止使用以下词汇：赋能、闭环、抓手、颗粒度、对齐、拉通、打通、沉淀、复盘、迭代、链路、触达、心智、赛道`,

  wechat_article: `【公众号文章】
要求：
- 800-1500字纯文本
- 有吸引人的标题（放在第一行，格式：标题：xxx）
- 开头必须用下方「爆款开头库」中的一种思路做引子
- 正文必须参考下方「爆款文案结构库」组织，但输出时不要写结构标签
- 结尾必须用下方「结尾类型库」中的一种方式完成总结或互动
- 语言专业但易懂
- 适合微信公众号阅读习惯`,

  moments_post: `【朋友圈文案】
要求：
- 50-200字
- 简洁有力，适合朋友圈阅读
- 第一行必须有钩子，优先使用痛点、反差、利益输送或好奇开场
- 内容结构必须有「冲突/洞察/行动」三段感，但不要写小标题
- 可以用emoji但不要过多
- 最后一句引导互动（提问/评论/私信）
- 不要用#话题标签`,
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : []
}

function asBeatArray(value: unknown): Array<{ label: string; instruction: string }> {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const record = item as Record<string, unknown>
    const label = typeof record.label === "string" ? record.label : ""
    const instruction = typeof record.instruction === "string" ? record.instruction : ""
    return label && instruction ? [{ label, instruction }] : []
  })
}

async function buildViralStructureBlock(): Promise<string> {
  const [openingTypes, copyStructures, endingTypes] = await Promise.all([
    prisma.openingType.findMany({
      where: { status: "published" },
      orderBy: { sortOrder: "asc" },
      select: { name: true, description: true, formulas: true },
    }),
    prisma.copyStructure.findMany({
      where: { status: "published" },
      orderBy: { sortOrder: "asc" },
      select: { name: true, description: true, beats: true },
    }),
    prisma.endingType.findMany({
      where: { status: "published" },
      orderBy: { sortOrder: "asc" },
      select: { name: true, guidance: true, patterns: true },
    }),
  ])

  if (openingTypes.length + copyStructures.length + endingTypes.length === 0) {
    return ""
  }

  let block = "\n\n=== 专业爆款结构库 ===\n"

  if (openingTypes.length > 0) {
    block += "\n【爆款开头库】\n"
    for (const item of openingTypes) {
      const formulas = asStringArray(item.formulas)
      block += `- ${item.name}：${item.description}`
      if (formulas.length > 0) block += `；公式：${formulas.join(" / ")}`
      block += "\n"
    }
  }

  if (copyStructures.length > 0) {
    block += "\n【爆款文案结构库】\n"
    for (const item of copyStructures) {
      const beats = asBeatArray(item.beats)
      block += `- ${item.name}：${item.description}`
      if (beats.length > 0) {
        block += `；节拍：${beats.map((beat) => `${beat.label}(${beat.instruction})`).join(" → ")}`
      }
      block += "\n"
    }
  }

  if (endingTypes.length > 0) {
    block += "\n【结尾类型库】\n"
    for (const item of endingTypes) {
      const patterns = asStringArray(item.patterns)
      block += `- ${item.name}：${item.guidance}`
      if (patterns.length > 0) block += `；模式：${patterns.join(" / ")}`
      block += "\n"
    }
  }

  return block
}

function buildKnowledgeBlock(
  entries: Array<{ category: string; title: string; content: string }>
): string {
  if (entries.length === 0) return ""

  const grouped = new Map<string, typeof entries>()
  for (const entry of entries) {
    const list = grouped.get(entry.category) || []
    list.push(entry)
    grouped.set(entry.category, list)
  }

  let block = "\n\n=== 企业知识库 ===\n"
  for (const [category, items] of grouped) {
    block += `\n【${CATEGORY_LABELS[category] || category}】\n`
    for (const item of items) {
      block += `- ${item.title}：${item.content}\n`
    }
  }
  return block
}

function parseMultiFormatResponse(
  raw: string,
  formats: ContentFormat[]
): Record<ContentFormat, string | undefined> {
  const result: Record<ContentFormat, string | undefined> = {
    video_script: undefined,
    wechat_article: undefined,
    moments_post: undefined,
  }

  for (let i = 0; i < formats.length; i++) {
    const format = formats[i]
    const marker = `===FORMAT:${format}===`
    const nextMarker = i + 1 < formats.length
      ? `===FORMAT:${formats[i + 1]}===`
      : null

    const start = raw.indexOf(marker)
    if (start === -1) continue

    const contentStart = start + marker.length
    const end = nextMarker ? raw.indexOf(nextMarker) : raw.length

    result[format] = raw.substring(
      contentStart,
      end === -1 ? undefined : end
    ).trim()
  }

  if (!Object.values(result).some(Boolean) && formats.length === 1) {
    result[formats[0]] = raw.trim()
  }

  return result
}

export async function generateAimContent(input: AimInput) {
  const llm = LLMClient.shared()

  const [ipProfile, knowledge, viralStructureBlock] = await Promise.all([
    prisma.ipProfile.findUnique({
      where: { userId: input.userId },
    }),
    prisma.knowledgeEntry.findMany({
      where: { userId: input.userId, status: "active" },
      orderBy: { sortOrder: "asc" },
      take: 200,
    }),
    buildViralStructureBlock(),
  ])

  const ipSnapshot = ipProfile
    ? ipProfile.promptSnapshot || buildIpProfilePromptSnapshot(ipProfile)
    : ""
  const knowledgeBlock = buildKnowledgeBlock(knowledge)

  const formatBlocks = input.targetFormats
    .map((format) => FORMAT_INSTRUCTIONS[format])
    .join("\n\n---\n\n")
  const workflowContext = [
    input.topicTitle
      ? `选定爆款选题：${input.topicTitle}${input.topicRationale ? `\n选题依据：${input.topicRationale}` : ""}`
      : null,
    input.hotTopic
      ? `需要结合的当前热点：${input.hotTopic}\n要求：只做自然融合，必须找到热点与客户需求、产品卖点或老板经验之间的真实关联，禁止硬蹭热点。`
      : null,
    input.polishInstruction
      ? `文案审核与优化要求：${input.polishInstruction}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n")

const systemPrompt = `你是一个企业营销内容专家。根据用户提供的信息，结合企业IP档案和知识库，生成高质量的营销内容。

${ipSnapshot}
${knowledgeBlock}
${viralStructureBlock}

创作规则：
- 先判断用户输入最适合哪一种开头、文案结构和结尾类型，再开始写。
- 必须把专业结构融进最终文案里，但不要输出「使用了某某结构」这类解释。
- 开头要具体、有信息量、有冲突或利益点，禁止「今天给大家分享」「很多人不知道」这类空泛起手。
- 正文每一段都要推进信息，不要堆形容词，不要写营销黑话。

请严格按照下方每种格式的要求，生成对应的内容。每种格式用 ===FORMAT:格式名=== 作为分隔标记。`

const userPrompt = `用户输入的原始内容：
"${input.rawInput}"

${workflowContext ? `工作流上下文：\n${workflowContext}\n\n` : ""}

请根据以上内容，结合企业知识库中的相关信息，生成以下格式的营销内容：

${formatBlocks}

输出格式要求：
${input.targetFormats.map((format) => `===FORMAT:${format}===\n（在这里输出${format}的内容）`).join("\n\n")}`

  const completion = await llm.complete({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.8,
    maxTokens: 4000,
  })

  const parsed = parseMultiFormatResponse(completion.content, input.targetFormats)
  const knowledgeUsed = knowledge.map((entry) => ({
    id: entry.id,
    title: entry.title,
    category: entry.category,
  }))

  const record = await prisma.aimGeneration.create({
    data: {
      userId: input.userId,
      rawInput: input.rawInput,
      inputSource: "text",
      videoScript: parsed.video_script || null,
      wechatArticle: parsed.wechat_article || null,
      momentsPost: parsed.moments_post || null,
      formatsRequested: input.targetFormats,
      knowledgeUsed,
      ipSnapshotUsed: ipSnapshot || null,
      model: completion.model,
      totalTokens: completion.usage?.totalTokens || null,
      status: "completed",
    },
  })

  return {
    id: record.id,
    results: input.targetFormats.map((format) => ({
      format,
      content: parsed[format] || "",
      wordCount: (parsed[format] || "").length,
    })),
    knowledgeUsed,
  }
}
