import { VALID_TOPIC_TYPES } from "@/lib/topic-validation"

/**
 * 知识调用策略（resolved）
 *
 * 这是与「智能体（人设/文风）」正交的第二个维度：
 * 决定「这一次文案生成，到底要从知识库调用多少知识、侧重哪类知识」。
 *
 * 策略键复用定位策划官产出的人设型/转化型/流量型内容类型，
 * 让「定位官定内容方向」与「内容官产出文案」之间共享同一套心智模型——
 * 定位官确定的 topicType 直接成为文案产出时知识调用的钥匙。
 *
 * 执行层放在共享的 buildAimGeneration（中央执行），
 * 这样 content_producer / deep_copywriter 等所有产出智能体都受益。
 */
export type ResolvedKnowledgeStrategy =
  | "light_edit" // 轻改润色：少调/几乎不调知识
  | "hot_topic" // 热点创作：少调，突出热点 + 对标
  | "persona" // 人设型：偏中量，突出老板经验/定位素材
  | "conversion" // 转化型：偏大量，突出产品卖点/痛点/问答
  | "traffic" // 流量型：中少量，突出用户洞察/热点
  | "deep" // 深度创作：全量（=现状，默认，保证向后兼容）

/** 单档策略的检索画像 */
export interface KnowledgeStrategyProfile {
  /** 语义检索命中条数（top-K） */
  topK: number
  /** 知识块总字符上限 */
  maxBlockChars: number
  /** 单条知识最长字符数 */
  maxEntryChars: number
  /** 分类权重叠加（在 agent 优先级排序之外再乘），空对象表示不叠加 */
  categoryBoost: Record<string, number>
  /** 展示用中文标签 */
  label: string
  /** 展示用一句话说明 */
  description: string
}

/**
 * 六档策略画像。
 * deep 档完全等于改造前的行为（topK=12 / 8000 / 1200），保证未传信号时零回归。
 */
export const KNOWLEDGE_STRATEGY_PROFILES: Record<ResolvedKnowledgeStrategy, KnowledgeStrategyProfile> = {
  light_edit: {
    topK: 3,
    maxBlockChars: 1500,
    maxEntryChars: 400,
    categoryBoost: {},
    label: "轻改润色",
    description: "仅微改文案，知识库只兜底几句话",
  },
  hot_topic: {
    topK: 5,
    maxBlockChars: 3000,
    maxEntryChars: 600,
    categoryBoost: { hot_topic: 1.5, benchmark_reference: 1.5, user_insight: 1.2 },
    label: "热点创作",
    description: "结合热点与对标，知识库轻量调用并突出热点素材",
  },
  persona: {
    topK: 8,
    maxBlockChars: 5000,
    maxEntryChars: 1000,
    categoryBoost: { boss_experience: 1.3, positioning_material: 1.3, project_case: 1.25 },
    label: "人设型",
    description: "突出老板经验、定位素材与项目案例",
  },
  conversion: {
    topK: 10,
    maxBlockChars: 6500,
    maxEntryChars: 1100,
    categoryBoost: { product_usp: 1.3, customer_pain: 1.3, customer_qa: 1.3 },
    label: "转化型",
    description: "突出产品卖点、客户痛点与客户问答",
  },
  traffic: {
    topK: 6,
    maxBlockChars: 3500,
    maxEntryChars: 800,
    categoryBoost: { user_insight: 1.3, hot_topic: 1.2 },
    label: "流量型",
    description: "突出用户洞察与热点素材",
  },
  deep: {
    topK: 12,
    maxBlockChars: 8000,
    maxEntryChars: 1200,
    categoryBoost: {},
    label: "深度创作",
    description: "全量调用知识库（默认）",
  },
}

/** topicType（人设型/转化型/流量型）→ 策略档 的映射 */
const TOPIC_TYPE_STRATEGY: Record<string, ResolvedKnowledgeStrategy> = {
  人设型: "persona",
  转化型: "conversion",
  流量型: "traffic",
}

export interface ResolveKnowledgeStrategyInput {
  /** 定位策划官产出/前端传入的内容类型（人设型/转化型/流量型） */
  topicType?: string
  /** 当前热点（流量型 + 热点 → hot_topic 轻量档） */
  hotTopic?: string
  /** 对标爆款文案 id（有对标 → hot_topic） */
  videoCopyExtractionId?: string
  /** 任务类型（polish_copy → light_edit） */
  taskType?: string
  /** 润色/修改指令（有 → light_edit） */
  polishInstruction?: string
}

/**
 * 根据输入信号解析出最终的知识调用策略。
 *
 * 优先级（命中即止）：
 *   1. 轻改润色（polishInstruction 或 polish_copy）
 *   2. 热点创作（hotTopic 或对标文案）
 *   3. 内容类型档（人设型/转化型/流量型）
 *   4. 深度创作（默认，=现状）
 *
 * 注意：热点优先级高于 topicType，因为「流量型 + 热点」时
 * 用户更需要的是结合热点的轻量创作，而非全量知识。
 */
export function resolveKnowledgeStrategy(
  input: ResolveKnowledgeStrategyInput
): ResolvedKnowledgeStrategy {
  const { topicType, hotTopic, videoCopyExtractionId, taskType, polishInstruction } = input

  // 1. 轻改润色：用户只想改一段，没必要拉知识库
  if (polishInstruction?.trim() || taskType === "polish_copy") {
    return "light_edit"
  }

  // 2. 热点创作：有热点或对标文案，突出热点/对标，知识库轻量调用
  if (hotTopic?.trim() || videoCopyExtractionId?.trim()) {
    return "hot_topic"
  }

  // 3. 内容类型档：复用定位策划官的 topicType
  if (topicType && VALID_TOPIC_TYPES.includes(topicType as (typeof VALID_TOPIC_TYPES)[number])) {
    return TOPIC_TYPE_STRATEGY[topicType] ?? "deep"
  }

  // 4. 深度创作：默认全量（=改造前行为，保证向后兼容）
  return "deep"
}

/** 取某档策略的画像（非法值兜底到 deep） */
export function getStrategyProfile(strategy: ResolvedKnowledgeStrategy): KnowledgeStrategyProfile {
  return KNOWLEDGE_STRATEGY_PROFILES[strategy] ?? KNOWLEDGE_STRATEGY_PROFILES.deep
}
