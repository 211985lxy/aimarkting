import { prisma } from "@/lib/prisma"
import { LLMClient } from "@/lib/llm/client"
import { buildIpCopywritingMethodologyBlock } from "@/lib/ip-copywriting-methodology"
import { buildBusinessDiagnosisMethodologyBlock } from "@/lib/business-diagnosis-methodology"
import { retrieveRelevantKnowledge, ensureKnowledgeEmbedding } from "@/lib/llm/embeddings"

export type ContentFormat =
  | "video_script"
  | "wechat_article"
  | "moments_post"
  | "community_message"
  | "shooting_brief"
  | "raw_copy"

export type AimTaskType =
  | "polish_copy"
  | "write_script"
  | "quality_check"
  | "repurpose"

interface AimInput {
  userId: string
  agentId?: string
  projectId?: string
  rawInput: string
  targetFormats: ContentFormat[]
  taskType?: AimTaskType
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
  daily_inspiration: "日常灵感",
  benchmark_reference: "对标参考",
  user_insight: "用户洞察",
  hot_topic: "热点素材",
  positioning_material: "定位素材",
  private_domain_material: "私域素材",
}

const FORMAT_INSTRUCTIONS: Record<ContentFormat, string> = {
  video_script: `【视频口播脚本】
要求：
- 200-500字，适合口播录制
- 开头3秒必须使用下方「爆款开头库」中的一种公式思路，不能平铺直叙
- 正文必须使用下方「爆款文案结构库」中的一种结构节拍
- 结尾必须使用下方「结尾类型库」中的一种方式
- 必须使用 M 档格式（即双栏/分镜脚本格式）输出：每一行必须以 【画面】 或 【旁白】 作为前缀，交替出现。例如：
  【画面】老板在办公室面露难色，指着电脑上的表格
  【旁白】其实大部分创业公司，都是死在现金流断裂上
- 用口语化表达，禁止书面语

- 禁止使用以下词汇：赋能、闭环、抓手、颗粒度、对齐、拉通、打通、沉淀、复盘、迭代、链路、触达、心智、赛道`,

  wechat_article: `【公众号文章】
要求：
- 800-1500字纯文本
- 有吸引人的标题（放在第一行，格式：标题：xxx）
- 开头必须用下方「爆款开头库」中的一种思路做引子
- 正文必须参考下方「爆款文案结构库」组织，但输出时不要写结构标签
- 结尾必须用下方「结尾类型库」中的一种方式完成总结或互动
- 语言专业但易懂
- 适合微信公众号阅读习惯
- 【GEO引用锚点规则】当文章中出现政策红利支持、行业趋势断言、数据性结论或统计数字时，在该句末尾以括号追加引用建议，优先建议引用政府官方政策或权威报告，格式为：（信息参考：建议引用[政策文件名称/权威机构报告]）。例如："随着数字化转型在企业中的深水区推进（信息参考：建议引用国务院《数字中国建设整体布局规划》或工信部企业数字化转型指导意见），这一能力已成为企业核心资产。"。引用建议每篇文章出现1-2处即可，优先以国家部委/政府部门发布的政策、规划、统计数据为最高权重信源，其次选择行业头部研究机构（如QuestMobile、艾瑞咨询）的白皮书，只在有真实公信力或宏观依据的断言处添加。`,

  moments_post: `【朋友圈文案】
要求：
- 50-200字
- 简洁有力，适合朋友圈阅读
- 第一行必须有钩子，优先使用痛点、反差、利益输送或好奇开场
- 内容结构必须有「冲突/洞察/行动」三段感，但不要写小标题
- 可以用emoji但不要过多
- 最后一句引导互动（提问/评论/私信）
- 不要用#话题标签`,

  community_message: `【社群运营文案】
要求：
- 80-220字，适合微信群/企微群发布
- 第一行先说明和群成员有关的痛点、机会或提醒，不能像广告
- 正文用「共情/洞察/行动」结构，但不要写小标题
- 语气自然，像群主或运营负责人在群里提醒大家
- 必须有一个轻量互动动作，例如回复关键词、评论问题、私信领取、报名咨询
- 不要承诺结果，不要制造暴富焦虑，不要使用夸张符号刷屏`,

  raw_copy: `【原始文案】
要求：
- 300-800字纯文本
- 不套用任何爆款开头、文案结构或结尾模板
- 不做去AI味处理，保持自然流畅
- 围绕用户输入的核心信息展开，保留信息密度
- 可以适当分段，但不要加小标题
- 适合作为后续精修、改编的基础初稿`,

  shooting_brief: `【拍摄交接单】
要求：
- 输出给拍摄、剪辑、运营执行，必须具体、清楚、可落地
- 必须包含以下字段，字段名不能省略：
视频标题：
核心观点：
目标客户：
视频目标：涨粉 / 建信任 / 引流 / 成交 / 客户教育 / 招商加盟（选择最适合的一项）
拍摄形式：口播 / 访谈 / 场景展示 / 混剪（选择最适合的一项）
建议时长：
脚本正文：
必拍镜头：
补充素材：
封面文案：
评论区引导：
私域承接话术：
事实风险提醒：
- 必拍镜头至少给 3 条，评论区引导和私域承接话术必须能直接复制使用
- 不承诺效果，不写保证涨粉、保证成交、月入多少等高风险表达`,
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

  if (openingTypes.length >import { buildAimGeneration } from "./aim-agent-handlers"

export async function generateAimContent(input: AimInput) {
  if (!input.projectId) {
    throw new Error("请选择 IP 营销全案后再生成内容")
  }
  return buildAimGeneration(input.agentId || "content_producer", {
    userId: input.userId,
    projectId: input.projectId,
    rawInput: input.rawInput,
    targetFormats: input.targetFormats,
    taskType: input.taskType,
    topicTitle: input.topicTitle,
    topicRationale: input.topicRationale,
    hotTopic: input.hotTopic,
    polishInstruction: input.polishInstruction,
  })
}��付模块。
- 热点只能基于用户提供的热点、已有上下文或明确行业趋势自然融合，禁止硬蹭或编造。
- 先保住人的位置、代价和手迹，再清理 AI 腔、宣传腔、整齐排比和万能结尾。
- 不暴露外部参考来源细节。`
  : `你是一个企业营销内容专家。根据用户提供的信息，结合企业知识库，生成高质量的营销内容。`

const systemPrompt = `${agentPrompt}

${knowledgeBlock}
${methodologyBlock}
${businessDiagnosisBlock}
${viralStructureBlock}

内部工作流程：
1. 先判断输入内容类型：公众号长文、老板口述、原始文案、客户问题、产品卖点、对标文案或热点选题。
2. 如果用户提供对标文案，只学习它的开头方式、结构节奏、表达密度和转化设计，不照抄具体表达。
3. 如果用户提供公众号长文，优先提炼其中最适合短视频传播的一个核心观点，不要把整篇文章压缩成流水账。
4. 开头必须单独优化：用冲突、反差、痛点、利益或好奇心打开，避免平铺直叙。
5. 正文必须单独优化结构：按问题、判断、案例、行动或反差递进组织，让用户能听懂、能拍摄、能转化。
6. 必须结合企业知识库中的产品卖点、客户痛点、老板经验和项目案例，让内容适合当下企业，而不是生成通用文案。
7. 如果上下文包含垂类行业热点，只能自然融合和业务相关的部分，禁止硬蹭热点。

创作规则：
- 先判断用户输入最适合哪一种开头、文案结构和结尾类型，再开始写。
- 必须把专业结构融进最终文案里，但不要输出「使用了某某结构」这类解释。
- 开头要具体、有信息量、有冲突或利益点，禁止「今天给大家分享」「很多人不知道」这类空泛起手。
- 正文每一段都要推进信息，不要堆形容词，不要写营销黑话。
- 先保住人的位置、代价和手迹，再清理 AI 腔、宣传腔、整齐排比和万能结尾。
- 保留必要的口语、停顿、重复和语气词；不要为了显得高级主动加金句、宏大比喻或整齐三段式。
- 文案生成必须直接交付成稿，不要反问用户、不要让用户补充资料、不要输出开放式问题。
- 如果信息不足，基于企业知识库、用户输入和现有上下文做合理假设，并在文案里自然处理。

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
  const knowledgeUsed = retrieved.entries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    category: entry.category,
  }))

  const record = await prisma.aimGeneration.create({
    data: {
      userId: input.userId,
      projectId: input.projectId || null,
      rawInput: input.rawInput,
      inputSource: "text",
      videoScript: parsed.video_script || null,
      wechatArticle: parsed.wechat_article || null,
      momentsPost: parsed.moments_post || null,
      communityMessage: parsed.community_message || null,
      shootingBrief: parsed.shooting_brief || null,
      rawCopy: parsed.raw_copy || null,
      formatsRequested: input.targetFormats,
      knowledgeUsed,
      topicTitle: input.topicTitle || null,
      hotTopic: input.hotTopic || null,
      polishInstruction: input.polishInstruction || null,
      model: completion.model,
      totalTokens: completion.usage?.totalTokens || null,
      status: "completed",
    },
  })

  // Fire-and-forget: generate embedding for newly used entries
  if (retrieved.source === "raw") {
    for (const entry of retrieved.entries) {
      ensureKnowledgeEmbedding(entry.id).catch(() => {})
    }
  }

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
