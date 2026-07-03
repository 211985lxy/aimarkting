import { LLMClient } from "@/lib/llm/client"
import { prisma } from "@/lib/prisma"
import { buildIpCopywritingMethodologyBlock } from "@/lib/ip-copywriting-methodology"
import { getStylePromptBlock, type StyleGuideId } from "@/lib/style-guide-config"

/**
 * 改文案 Agent
 * 输入原始文案 + 可选优化指令 + 可选风格指令，输出精修文案。
 * 短期复用 aim-generator 的 prompt 思路，独立为 Agent 边界。
 */
export async function polishCopy(input: {
  userId: string
  projectId?: string
  rawInput: string
  instruction?: string
  styleId?: StyleGuideId
}): Promise<{ content: string; wordCount: number }> {
  const [knowledge, methodologyBlock] = await Promise.all([
    loadProjectKnowledge(input.userId, input.projectId),
    buildIpCopywritingMethodologyBlock(),
  ])

  const styleBlock = getStylePromptBlock(input.styleId)

  const systemPrompt = `你是一个企业营销文案专家。你的任务是对用户提供的文案进行精修和优化。

${knowledge}
${methodologyBlock}

优化原则：
- 保持原意，提升表达力和信息密度
- 去除空话、套话、营销黑话
- 开头必须有钩子（冲突/反差/痛点/利益/好奇）
- 结尾必须有明确行动号召
- 直接输出改好的文案，不要追问用户，不要让用户补充资料
- 禁止使用：赋能、闭环、抓手、颗粒度、对齐、拉通、打通、沉淀、复盘、迭代、链路、触达、心智、赛道
- 输出纯文本，不要加格式标记或解释${styleBlock}`

  const userPrompt = `请优化以下文案：${input.instruction ? `\n优化要求：${input.instruction}` : ""}

---
${input.rawInput}
---`

  const completion = await LLMClient.shared().complete({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    maxTokens: 2000,
  })

  return {
    content: completion.content.trim(),
    wordCount: completion.content.trim().length,
  }
}

/**
 * 写脚本 Agent
 * 输入主题/素材，输出短视频口播脚本。
 */
export async function writeScript(input: {
  userId: string
  projectId?: string
  rawInput: string
  instruction?: string
  structureCode?: string
}): Promise<{ content: string; wordCount: number }> {
  const [knowledge, viralBlock, methodologyBlock] = await Promise.all([
    loadProjectKnowledge(input.userId, input.projectId),
    buildViralStructureBlock(),
    buildIpCopywritingMethodologyBlock(),
  ])

  const systemPrompt = `你是一个企业短视频脚本专家。根据用户提供的信息，生成高质量的口播脚本。

${knowledge}
${methodologyBlock}
${viralBlock}

脚本要求：
- 200-500字，适合口播录制
- 开头3秒必须使用上方「爆款开头库」中的一种公式思路
- 正文必须使用上方「爆款文案结构库」中的一种结构节拍
- 结尾必须使用上方「结尾类型库」中的一种方式
- 用口语化表达，禁止书面语
- 结尾有明确行动号召
- 必须结合企业知识库中的产品卖点、客户痛点、老板经验
- 直接输出脚本成稿，不要追问用户，不要让用户补充资料
- 禁止使用：赋能、闭环、抓手、颗粒度、对齐、拉通、打通、沉淀、复盘、迭代、链路、触达、心智、赛道
- 输出纯脚本文本，不要加格式标记或解释
${input.structureCode
  ? `\n- 本次指定使用文案结构：${input.structureCode}，请严格按照该结构的节拍展开\n`
  : ""}`

  const userPrompt = `请根据以下信息写一条短视频口播脚本：${input.instruction ? `\n补充要求：${input.instruction}` : ""}

---
${input.rawInput}
---`

  const completion = await LLMClient.shared().complete({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.8,
    maxTokens: 2000,
  })

  return {
    content: completion.content.trim(),
    wordCount: completion.content.trim().length,
  }
}

// ── 内部工具函数 ──

async function loadProjectKnowledge(
  userId: string,
  projectId?: string
): Promise<string> {
  const entries = await prisma.knowledgeEntry.findMany({
    where: {
      userId,
      status: "active",
      ...(projectId
        ? { OR: [{ projectId }, { projectId: null }] }
        : {}),
    },
    orderBy: { sortOrder: "asc" },
    take: 200,
  })

  if (entries.length === 0) return ""

  const CATEGORY_LABELS: Record<string, string> = {
    boss_experience: "老板经验",
    product_usp: "产品卖点",
    customer_pain: "客户痛点",
    project_case: "项目案例",
    customer_qa: "客户问答",
  }

  const grouped = new Map<string, typeof entries>()
  for (const entry of entries) {
    const list = grouped.get(entry.category) || []
    list.push(entry)
    grouped.set(entry.category, list)
  }

  let block = "\n=== 企业知识库 ===\n"
  for (const [category, items] of grouped) {
    block += `\n【${CATEGORY_LABELS[category] || category}】\n`
    for (const item of items) {
      block += `- ${item.title}：${item.content}\n`
    }
  }
  return block
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

  let block = "\n=== 专业爆款结构库 ===\n"

  for (const item of openingTypes) {
    const formulas = (Array.isArray(item.formulas)
      ? item.formulas.filter((f): f is string => typeof f === "string")
      : []) as string[]
    block += `【开头】${item.name}：${item.description}`
    if (formulas.length > 0) block += `；公式：${formulas.join(" / ")}`
    block += "\n"
  }

  for (const item of copyStructures) {
    block += `【结构】${item.name}：${item.description}\n`
  }

  for (const item of endingTypes) {
    block += `【结尾】${item.name}：${item.guidance}\n`
  }

  return block
}
