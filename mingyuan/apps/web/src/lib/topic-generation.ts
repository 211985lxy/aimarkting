import { LLMClient } from "@/lib/llm"
import {
  TopicCardsSchema,
  VALID_TOPIC_SOURCE_TYPES,
  VALID_TOPIC_TYPES,
} from "@/lib/topic-validation"
import type { TopicCard } from "@/lib/topic-validation"
import { sampleElements, sampleWithHistory, pickStrategy } from "@/lib/topic-element-logic"
import type { DerivationStrategy } from "@/lib/topic-element-logic"
import type { TopicElement } from "@/generated/prisma/client"

const TOPIC_MODEL = process.env.TOPIC_GENERATION_MODEL || "openai/gpt-5.4"

export type RecommendationMode = "normal" | "daily" | "weekly"

export interface TopicGenerationInput {
  ipProfile?: {
    id?: string
    displayName?: string | null
    nickname?: string | null
    industry?: string | null
    primaryOffer?: string | null
    targetAudience?: string | null
    ipTraits?: string | null
    toneOfVoice?: string | null
    proofPoints?: string | null
    callToAction?: string | null
    profileVersion?: number | null
    business?: unknown | null
    persona?: unknown | null
    content?: unknown | null
    promptSnapshot?: string | null
  } | null
  elements: Pick<
    TopicElement,
    "code" | "name" | "typeLabel" | "description"
  >[]
  topicSources?: Array<{
    category: string
    title: string
    content: string
  }>
  recommendationMode?: RecommendationMode
  forcedElementCodes?: string[]
  /** Recent element sets from previous generations (newest first) */
  recentElementSets?: string[][]
  /** Recent topic titles from previous generations (for dedup) */
  recentTitles?: string[]
  /** How many times the user has refreshed (0 = first time) */
  refreshCount?: number
}

const TOPIC_SOURCE_LABELS: Record<string, string> = {
  daily_inspiration: "日常灵感",
  benchmark_reference: "对标参考",
  user_insight: "用户洞察",
  boss_experience: "老板经验",
  product_usp: "产品卖点",
  customer_pain: "客户痛点",
  project_case: "成交案例",
  customer_qa: "客户问答",
  client_project: "全案资料",
  industry_hot: "行业热点",
}

function truncateTopicSourceContent(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim()
  if (normalized.length <= 180) return normalized
  return `${normalized.slice(0, 180)}...`
}

function buildTopicSourceSection(
  topicSources: TopicGenerationInput["topicSources"],
): string {
  if (!topicSources || topicSources.length === 0) return ""

  const lines = topicSources.map((source) => {
    const label = TOPIC_SOURCE_LABELS[source.category] ?? "补充素材"
    return `- ${label}：${source.title}\n  ${truncateTopicSourceContent(source.content)}`
  })

  return ["## 本次选题素材", ...lines].join("\n")
}

export type TopicGenerationResult =
  | {
      success: true
      cards: TopicCard[]
      elementCodes: string[]
      promptText: string
      model: string
      strategy: DerivationStrategy
    }
  | {
      success: false
      error: string
    }

export function buildTopicSystemPrompt(
  strategy: DerivationStrategy,
  recentTitles: string[],
  recommendationMode: RecommendationMode = "normal",
): string {
  const basePrompt = `你是一位短视频选题策划专家，精通用户心理和内容运营。你的任务是根据 IP 档案和指定的营销元素，生成4个差异化的短视频选题。

输出要求：
- 严格返回 JSON 格式，结构为 {"topics": [card1, card2, card3, card4]}
- 每张卡片包含：title (选题标题，2-20字), elementCodes (使用的元素代码数组), openingTypeCode (推荐开场类型代码), structureCode (推荐文案结构代码), rationale (一句话理由，20-60字), topicType, sourceType, score, scoreReason
- topicType 必须从以下选择：${VALID_TOPIC_TYPES.join("、")}
- sourceType 必须从以下选择：${VALID_TOPIC_SOURCE_TYPES.join("、")}
- score 为 0-100 的整数，scoreReason 用一句话说明评分原因
- 4个选题必须标题各不相同，角度各异
- 每个选题使用指定的营销元素代码
- openingTypeCode 必须从以下选择：curiosity_open, leverage_open, pain_open, extreme_open, fear_open, contrast_open, benefit_open
- structureCode 必须从以下选择：suspense_reveal, contrast_hook, three_beat_ramp, proof_first, pain_solution, pov_walkthrough, objection_dialogue, before_after, universal
- 开场类型和文案结构的推荐要与选题内容和使用的元素逻辑匹配`

  // Strategy-specific instructions
  const strategyInstructions: Record<DerivationStrategy, string> = {
    fresh: `
选题差异化策略：
1. 第1张：最安全、最容易引起共鸣的角度
2. 第2张：有反差感或新奇度的角度
3. 第3张：聚焦实用干货或方法论的角度
4. 第4张：情感驱动或故事化的角度`,

    adjacent: `
选题差异化策略（邻域探索模式）：
你正在帮用户从一个已有方向延伸出新角度。保留核心元素的基调，但换一个切入点。
1. 第1张：从用户视角出发的痛点切入
2. 第2张：从行业内幕/专业知识切入
3. 第3张：从具体场景/案例切入
4. 第4张：从时效性/季节性/趋势切入
每个选题要像是"同一棵树的不同分支"，而不是完全不同的树。`,

    niche: `
选题差异化策略（纵深挖掘模式）：
用户已经看过宽泛的选题了，现在需要更垂直、更细分、更具体的角度。
把大选题拆成小选题，把通用建议变成具体场景。
1. 第1张：针对特定人群细分（比如"新手"、"老手"、"被坑过的人"）
2. 第2张：针对特定场景细分（比如"夏天"、"装修前"、"搬新家"）
3. 第3张：针对特定问题细分（比如"最贵的那个坑"、"最容易忽略的点"）
4. 第4张：争议性/反常识的细分角度（比如"其实不需要XXX"、"90%的人搞反了"）
每个标题要足够具体，让用户一看就知道讲的是什么场景。`,

    remix: `
选题差异化策略（跨界混搭模式）：
用户已经看过几组选题了。现在需要把不同维度的元素重新组合，产生化学反应。
1. 第1张：把"信任"和"实用"结合，做一个有干货有说服力的选题
2. 第2张：把"情感"和"对比"结合，做一个有冲击力的选题
3. 第3张：把"好奇"和"故事"结合，做一个让人想看完的选题
4. 第4张：出其不意的组合，打破用户的预期
每个选题应该让用户觉得"这个角度我没想到，但确实有道理"。`,
  }

  let prompt = basePrompt + strategyInstructions[strategy]

  if (recommendationMode === "daily") {
    prompt += `\n\n【今日推荐模式】优先结合最近 24 小时热点、客户资料和执行可行性，推荐今天最适合拍摄或发布的选题。评分维度固定为：账号适配度、转化价值、流量潜力、素材支撑、执行难度。每张卡片优先补充 hook（开头钩子）、angle（展开角度）、cta（结尾行动）。`
  } else if (recommendationMode === "weekly") {
    prompt += `\n\n【本周选题模式】生成一组适合作为本周内容池的选题，热点只作为角度参考，不要过度依赖单日新闻。评分维度固定为：账号适配度、转化价值、流量潜力、素材支撑、执行难度。`
  }

  // Anti-repetition: inject recent titles for dedup
  if (recentTitles.length > 0) {
    prompt += `\n\n【去重要求】以下选题用户已经看过了，请务必避免相同或高度相似的标题：\n${recentTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n生成的4个标题不能与上述标题语义重复。`
  }

  return prompt
}

export function buildTopicUserPrompt(
  input: TopicGenerationInput,
  selectedCodes: string[],
): string {
  const { ipProfile, topicSources, recommendationMode = "normal" } = input
  const selectedElements = input.elements.filter((e) =>
    selectedCodes.includes(e.code),
  )

  let profileSection = ""
  if (ipProfile?.promptSnapshot) {
    profileSection = `## IP 档案\n${ipProfile.promptSnapshot}`
  } else if (ipProfile) {
    profileSection = [
      "## IP 档案",
      ipProfile.displayName ? `- 名称：${ipProfile.displayName}` : null,
      ipProfile.industry ? `- 行业：${ipProfile.industry}` : null,
      ipProfile.primaryOffer
        ? `- 核心产品/服务：${ipProfile.primaryOffer}`
        : null,
      ipProfile.targetAudience
        ? `- 目标受众：${ipProfile.targetAudience}`
        : null,
      ipProfile.ipTraits ? `- IP 特质：${ipProfile.ipTraits}` : null,
      ipProfile.toneOfVoice ? `- 说话风格：${ipProfile.toneOfVoice}` : null,
      ipProfile.proofPoints ? `- 信任背书：${ipProfile.proofPoints}` : null,
      ipProfile.callToAction
        ? `- 行动号召：${ipProfile.callToAction}`
        : null,
    ]
      .filter(Boolean)
      .join("\n")
  }

  const elementSection = [
    `## 本次使用的营销元素 (${selectedCodes.length}个)`,
    ...selectedElements.map(
      (e) => `- **${e.name}** (${e.code}): ${e.description}`,
    ),
  ].join("\n")

  const sourceSection = buildTopicSourceSection(topicSources)
  const modeInstruction =
    recommendationMode === "daily"
      ? "这是今日推荐，请优先考虑当天能发、能拍、能承接的选题。"
      : recommendationMode === "weekly"
        ? "这是本周选题池，请兼顾人设、转化和流量，不要只追逐短期热点。"
        : ""

  return `${profileSection ? profileSection + "\n\n" : ""}${sourceSection ? sourceSection + "\n\n" : ""}${elementSection}\n\n请基于以上${profileSection ? " IP 档案、" : ""}${sourceSection ? "选题素材和" : ""}营销元素，生成4个差异化的短视频选题卡片。每个选题都要巧妙融入指定的营销元素，并推荐最匹配的开场类型和文案结构。${modeInstruction}`
}

function inferTopicType(card: TopicCard, index: number): TopicCard["topicType"] {
  if (card.topicType) return card.topicType
  if (card.elementCodes.some((code) => ["authority", "trust", "identity", "story"].includes(code))) return "人设型"
  if (card.elementCodes.some((code) => ["cost", "practical", "scarcity"].includes(code))) return "转化型"
  return index % 3 === 0 ? "流量型" : index % 3 === 1 ? "转化型" : "人设型"
}

function inferSourceType(
  card: TopicCard,
  topicSources: TopicGenerationInput["topicSources"],
  recommendationMode: RecommendationMode,
): TopicCard["sourceType"] {
  if (card.sourceType) return card.sourceType
  const categories = new Set((topicSources ?? []).map((source) => source.category))
  if ((recommendationMode === "daily" || recommendationMode === "weekly") && categories.has("industry_hot")) return "行业热点"
  if (categories.has("benchmark_reference")) return "对标参考"
  if (categories.has("daily_inspiration")) return "个人灵感"
  if (categories.has("product_usp")) return "公司卖点"
  return "客户资料"
}

export function normalizeTopicCards(
  cards: TopicCard[],
  input: Pick<TopicGenerationInput, "topicSources" | "recommendationMode">,
): TopicCard[] {
  const recommendationMode = input.recommendationMode ?? "normal"
  return cards.map((card, index) => {
    const score = typeof card.score === "number"
      ? Math.max(0, Math.min(100, Math.round(card.score)))
      : Math.max(72, 88 - index * 4)

    return {
      ...card,
      topicType: inferTopicType(card, index),
      sourceType: inferSourceType(card, input.topicSources, recommendationMode),
      score,
      scoreReason: card.scoreReason || "账号适配、内容价值和执行可行性综合评分。",
    }
  })
}

export async function generateTopicCards(
  input: TopicGenerationInput,
): Promise<TopicGenerationResult> {
  const llm = LLMClient.shared()
  const temperatures = [0.7, 0.5, 0.3]
  const maxAttempts = 3

  const allCodes = input.elements.map((e) => e.code)
  const refreshCount = input.refreshCount ?? 0
  const recentElementSets = input.recentElementSets ?? []
  const recentTitles = input.recentTitles ?? []

  // Pick derivation strategy based on refresh count
  const strategy = pickStrategy(refreshCount)

  // Sample elements using history-aware derivation
  let selectedCodes: string[]
  if (input.forcedElementCodes) {
    selectedCodes = input.forcedElementCodes
  } else if (recentElementSets.length > 0) {
    selectedCodes = sampleWithHistory(allCodes, recentElementSets, strategy)
  } else {
    const sampleCount = Math.random() < 0.5 ? 2 : 3
    selectedCodes = sampleElements(allCodes, sampleCount)
  }

  if (selectedCodes.length < 2) {
    return {
      success: false,
      error: "Could not sample enough non-conflicting elements",
    }
  }

  console.log(`[topic-gen] Strategy: ${strategy}, elements: [${selectedCodes.join(",")}], refresh: ${refreshCount}`)

  const systemPrompt = buildTopicSystemPrompt(strategy, recentTitles, input.recommendationMode)
  const userPrompt = buildTopicUserPrompt(input, selectedCodes)
  const fullPromptText = `[System]\n${systemPrompt}\n\n[User]\n${userPrompt}`

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      console.log(
        `[topic-gen] Attempt ${attempt + 1}/${maxAttempts}, temperature=${temperatures[attempt]}`,
      )

      const result = await llm.complete({
        model: TOPIC_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: temperatures[attempt],
        maxTokens: 2048,
        responseFormat: { type: "json_object" },
      })

      const parsed = JSON.parse(result.content.trim())
      const cards = Array.isArray(parsed?.topics)
        ? parsed.topics
        : Array.isArray(parsed?.cards)
          ? parsed.cards
          : Array.isArray(parsed)
            ? parsed
            : null

      if (!cards) {
        console.warn(
          `[topic-gen] Could not extract cards array from response on attempt ${attempt + 1}`,
        )
        continue
      }

      const validated = TopicCardsSchema.safeParse(normalizeTopicCards(cards, input))

      if (validated.success) {
        // Enforce card elementCodes ⊆ selectedCodes (LLM may hallucinate extra elements)
        const coercedCards = validated.data.map((card) => ({
          ...card,
          elementCodes: card.elementCodes.filter((c) =>
            selectedCodes.includes(c),
          ),
        }))
        // Ensure at least 1 element per card after filtering
        const allValid = coercedCards.every((c) => c.elementCodes.length >= 1)
        if (!allValid) {
          console.warn(`[topic-gen] Cards have elements outside selectedCodes, coercion left empty cards`)
          continue
        }

        console.log(
          `[topic-gen] Success on attempt ${attempt + 1}, model=${result.model}, strategy=${strategy}`,
        )
        return {
          success: true,
          cards: coercedCards,
          elementCodes: selectedCodes,
          promptText: fullPromptText,
          model: result.model,
          strategy,
        }
      }

      console.warn(
        `[topic-gen] Validation failed attempt ${attempt + 1}:`,
        validated.error.issues.map((e) => e.message).join(", "),
      )
    } catch (error) {
      console.error(
        `[topic-gen] LLM error attempt ${attempt + 1}:`,
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  return {
    success: false,
    error: "Failed to generate valid topic cards after 3 attempts",
  }
}
