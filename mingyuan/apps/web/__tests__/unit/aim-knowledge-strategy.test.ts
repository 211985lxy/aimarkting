import { describe, expect, it } from "vitest"

import {
  resolveKnowledgeStrategy,
  getStrategyProfile,
  KNOWLEDGE_STRATEGY_PROFILES,
  type ResolvedKnowledgeStrategy,
} from "@/lib/aim-knowledge-strategy"

// ─── resolveKnowledgeStrategy 优先级矩阵 ────────────────────────

describe("resolveKnowledgeStrategy priority chain", () => {
  it("defaults to deep when no signals are present", () => {
    expect(resolveKnowledgeStrategy({})).toBe("deep")
  })

  // ── 1. 轻改润色：最高优先级 ──

  it("returns light_edit when polishInstruction is present", () => {
    expect(
      resolveKnowledgeStrategy({ polishInstruction: "把结尾改成更有力" }),
    ).toBe("light_edit")
  })

  it("returns light_edit when taskType is polish_copy", () => {
    expect(
      resolveKnowledgeStrategy({ taskType: "polish_copy" }),
    ).toBe("light_edit")
  })

  it("light_edit takes priority over hotTopic", () => {
    expect(
      resolveKnowledgeStrategy({
        polishInstruction: "改一下标题",
        hotTopic: "某大事件",
      }),
    ).toBe("light_edit")
  })

  it("light_edit takes priority over topicType", () => {
    expect(
      resolveKnowledgeStrategy({
        taskType: "polish_copy",
        topicType: "转化型",
      }),
    ).toBe("light_edit")
  })

  // ── 2. 热点创作：第二优先级 ──

  it("returns hot_topic when hotTopic is present", () => {
    expect(
      resolveKnowledgeStrategy({ hotTopic: "某行业大事件" }),
    ).toBe("hot_topic")
  })

  it("returns hot_topic when videoCopyExtractionId is present", () => {
    expect(
      resolveKnowledgeStrategy({ videoCopyExtractionId: "ex-123" }),
    ).toBe("hot_topic")
  })

  it("hot_topic takes priority over topicType=人设型", () => {
    expect(
      resolveKnowledgeStrategy({
        hotTopic: "某热点",
        topicType: "人设型",
      }),
    ).toBe("hot_topic")
  })

  it("流量型 + 热点 → hot_topic（不是 traffic）", () => {
    expect(
      resolveKnowledgeStrategy({
        topicType: "流量型",
        hotTopic: "某事件",
      }),
    ).toBe("hot_topic")
  })

  // ── 3. topicType 档 ──

  it("maps 人设型 → persona", () => {
    expect(
      resolveKnowledgeStrategy({ topicType: "人设型" }),
    ).toBe("persona")
  })

  it("maps 转化型 → conversion", () => {
    expect(
      resolveKnowledgeStrategy({ topicType: "转化型" }),
    ).toBe("conversion")
  })

  it("maps 流量型 → traffic", () => {
    expect(
      resolveKnowledgeStrategy({ topicType: "流量型" }),
    ).toBe("traffic")
  })

  it("ignores invalid topicType and falls back to deep", () => {
    expect(
      resolveKnowledgeStrategy({ topicType: "不存在类型" }),
    ).toBe("deep")
  })

  // ── 4. 空值防御 ──

  it("handles empty strings gracefully → deep", () => {
    expect(
      resolveKnowledgeStrategy({
        polishInstruction: "  ",
        hotTopic: "",
        videoCopyExtractionId: "  ",
      }),
    ).toBe("deep")
  })

  it("handles undefined fields → deep", () => {
    expect(
      resolveKnowledgeStrategy({
        topicType: undefined,
        hotTopic: undefined,
        videoCopyExtractionId: undefined,
        taskType: undefined,
        polishInstruction: undefined,
      }),
    ).toBe("deep")
  })
})

// ─── KNOWLEDGE_STRATEGY_PROFILES 完整性 ────────────────────────

describe("KNOWLEDGE_STRATEGY_PROFILES completeness", () => {
  const ALL_STRATEGIES: ResolvedKnowledgeStrategy[] = [
    "light_edit", "hot_topic", "persona", "conversion", "traffic", "deep",
  ]

  it("has a profile for every strategy", () => {
    for (const strategy of ALL_STRATEGIES) {
      expect(KNOWLEDGE_STRATEGY_PROFILES[strategy]).toBeDefined()
    }
  })

  it("deep profile matches pre-refactor defaults (backward compatibility)", () => {
    const deep = KNOWLEDGE_STRATEGY_PROFILES.deep
    expect(deep.topK).toBe(12)
    expect(deep.maxBlockChars).toBe(8000)
    expect(deep.maxEntryChars).toBe(1200)
    expect(deep.categoryBoost).toEqual({})
  })

  it("every profile has a non-empty label", () => {
    for (const strategy of ALL_STRATEGIES) {
      const profile = KNOWLEDGE_STRATEGY_PROFILES[strategy]
      expect(profile.label.length).toBeGreaterThan(0)
    }
  })

  it("light_edit has the smallest retrieval budget", () => {
    const light = KNOWLEDGE_STRATEGY_PROFILES.light_edit
    const deep = KNOWLEDGE_STRATEGY_PROFILES.deep
    expect(light.topK).toBeLessThan(deep.topK)
    expect(light.maxBlockChars).toBeLessThan(deep.maxBlockChars)
  })

  it("hot_topic boosts hot_topic and benchmark_reference categories", () => {
    const hot = KNOWLEDGE_STRATEGY_PROFILES.hot_topic
    expect(hot.categoryBoost["hot_topic"]).toBeGreaterThan(1)
    expect(hot.categoryBoost["benchmark_reference"]).toBeGreaterThan(1)
  })

  it("conversion boosts product_usp, customer_pain, and customer_qa", () => {
    const conv = KNOWLEDGE_STRATEGY_PROFILES.conversion
    expect(conv.categoryBoost["product_usp"]).toBeGreaterThan(1)
    expect(conv.categoryBoost["customer_pain"]).toBeGreaterThan(1)
    expect(conv.categoryBoost["customer_qa"]).toBeGreaterThan(1)
  })

  it("persona boosts boss_experience and positioning_material", () => {
    const pers = KNOWLEDGE_STRATEGY_PROFILES.persona
    expect(pers.categoryBoost["boss_experience"]).toBeGreaterThan(1)
    expect(pers.categoryBoost["positioning_material"]).toBeGreaterThan(1)
  })
})

// ─── getStrategyProfile ────────────────────────────────────────

describe("getStrategyProfile", () => {
  it("returns correct profile for valid strategy", () => {
    const profile = getStrategyProfile("hot_topic")
    expect(profile.label).toBe("热点创作")
    expect(profile.topK).toBe(5)
  })

  it("falls back to deep for invalid strategy", () => {
    const profile = getStrategyProfile("invalid" as ResolvedKnowledgeStrategy)
    expect(profile).toBe(KNOWLEDGE_STRATEGY_PROFILES.deep)
  })
})
