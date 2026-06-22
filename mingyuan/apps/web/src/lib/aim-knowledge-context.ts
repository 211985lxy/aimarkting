import { retrieveRelevantKnowledge, ensureKnowledgeEmbedding } from "@/lib/llm/embeddings"
import type { ScoredKnowledgeEntry } from "@/lib/llm/embeddings"

// ─── 类型定义 ──────────────────────────────────────────────

export interface AimKnowledgeContextInput {
  userId: string
  projectId: string
  agentId: string
  query: string
  topicTitle?: string
  topicRationale?: string
}

export interface AimKnowledgeContextResult {
  knowledgeBlock: string
  entries: ScoredKnowledgeEntry[]
  source: "embedding" | "raw"
}

// ─── 常量 ──────────────────────────────────────────────────

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

/** 默认最多检索条数 */
const DEFAULT_TOP_K = 12

/** 知识块总字符上限 */
const MAX_KNOWLEDGE_BLOCK_CHARS = 8000

/** 单条知识最长字符数 */
const MAX_ENTRY_CHARS = 1200

/**
 * 智能体分类优先级（影响排序但不过滤）
 * 按语义搜索得分排序后，每类知识：
 * - 命中的优先级分类 → 得分 × 1.15（优先靠前）
 * - 其余 → 得分 × 0.85（后移）
 * 保留所有类别，避免信息缺失。
 */
const AGENT_PRIORITY_CATEGORIES: Record<string, string[]> = {
  deep_copywriter: [
    "boss_experience",
    "product_usp",
    "user_insight",
    "benchmark_reference",
    "positioning_material",
  ],
  business_system_diagnosis: [
    "product_usp",
    "customer_pain",
    "project_case",
    "customer_qa",
    "user_insight",
  ],
  business_diagnosis: [
    "positioning_material",
    "boss_experience",
    "product_usp",
    "customer_pain",
  ],
  content_producer: [
    "product_usp",
    "project_case",
    "private_domain_material",
    "hot_topic",
    "benchmark_reference",
  ],
  content_review: [
    "project_case",
    "benchmark_reference",
    "user_insight",
    "hot_topic",
  ],
}

/** 默认优先级（未匹配到具体 agent 时的兜底） */
const DEFAULT_PRIORITY_CATEGORIES = [
  "product_usp",
  "boss_experience",
  "customer_pain",
  "project_case",
]

// ─── 截断函数 ──────────────────────────────────────────────

function truncateContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content
  return content.slice(0, maxChars) + "..."
}

// ─── 公开函数 ──────────────────────────────────────────────

/**
 * 构建知识上下文块
 *
 * 统一 AIM 知识检索入口，对所有智能体共用同一条上下文构建链路。
 * 内部步骤：
 * 1. 调用 retrieveRelevantKnowledge() 语义检索
 * 2. 按 agentId 优先级做轻量重排
 * 3. 截断超长条目
 * 4. 拼接成知识块字符串（不超过预算）
 *
 * Embedding 不可用时自动回退到项目级 fallback。
 */
export async function buildAimKnowledgeContext(
  input: AimKnowledgeContextInput
): Promise<AimKnowledgeContextResult> {
  const { userId, projectId, agentId, query, topicTitle, topicRationale } = input

  // 1. 语义检索
  const retrieved = await retrieveRelevantKnowledge({
    userId,
    projectId,
    query,
    topicTitle,
    topicRationale,
    topK: DEFAULT_TOP_K,
  })

  let entries = retrieved.entries

  // 2. 按智能体分类优先级重排（仅影响排序，不过滤）
  if (entries.length > 0) {
    const prioritySet = new Set(
      AGENT_PRIORITY_CATEGORIES[agentId] ?? DEFAULT_PRIORITY_CATEGORIES
    )

    // 高优先级 × 1.15，低优先级 × 0.85，再按调整后得分降序
    entries = entries
      .map((entry) => ({
        ...entry,
        score: prioritySet.has(entry.category)
          ? entry.score * 1.15
          : entry.score * 0.85,
      }))
      .sort((a, b) => b.score - a.score)
  }

  // 3. 截断超长条目
  const needTruncation = entries.some((e) => e.content.length > MAX_ENTRY_CHARS)
  if (needTruncation) {
    entries = entries.map((e) => ({
      ...e,
      content: truncateContent(e.content, MAX_ENTRY_CHARS),
    }))
  }

  // 4. 拼接知识块，控制总字符预算
  const knowledgeBlock = buildKnowledgeBlockWithBudget(entries, MAX_KNOWLEDGE_BLOCK_CHARS)

  return {
    knowledgeBlock,
    entries,
    source: retrieved.source,
  }
}

/**
 * 构建知识块（共享，替代 aim-tool-actions 和 aim-generator 中的重复实现）
 *
 * @param maxChars 总字符上限，超出则跳过后续知识
 */
export function buildKnowledgeBlock(
  entries: Array<{ category: string; title: string; content: string }>
): string {
  return buildKnowledgeBlockWithBudget(entries, Infinity)
}

function buildKnowledgeBlockWithBudget(
  entries: Array<{ category: string; title: string; content: string }>,
  maxChars: number
): string {
  if (entries.length === 0) return ""

  const grouped = new Map<string, typeof entries>()
  for (const entry of entries) {
    const list = grouped.get(entry.category) || []
    list.push(entry)
    grouped.set(entry.category, list)
  }

  let block = "\n\n=== 企业知识库 ===\n"
  let totalChars = block.length

  for (const [category, items] of grouped) {
    let categoryBlock = `\n【${CATEGORY_LABELS[category] || category}】\n`
    for (const item of items) {
      const entryLine = `- ${item.title}：${item.content}\n`
      categoryBlock += entryLine
    }

    // 如果加入本分类会超出预算，跳过剩余知识
    if (totalChars + categoryBlock.length > maxChars) {
      // 只记录一条提示
      const remaining = entries.length - items.length - [...grouped.keys()].indexOf(category)
      if (remaining > 0 && block.length < maxChars) {
        block += `\n（剩余 ${remaining} 条知识已跳过，达到上下文预算上限）\n`
      }
      break
    }

    block += categoryBlock
    totalChars += categoryBlock.length
  }

  return block
}

/**
 * 触发 embedding 后置更新（Fire-and-forget）
 */
export function fireKnowledgeEmbedding(entries: Array<{ id: string }>, source: string): void {
  if (source === "raw") {
    for (const entry of entries) {
      ensureKnowledgeEmbedding(entry.id).catch(() => {})
    }
  }
}
