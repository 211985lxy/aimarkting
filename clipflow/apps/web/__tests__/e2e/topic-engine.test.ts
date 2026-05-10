import { describe, expect, it } from "vitest"
import { TOPIC_ELEMENTS, OPENING_TYPES, COPY_STRUCTURES, ENDING_TYPES } from "../../prisma/seed-topic-engine"
import { VALID_ELEMENT_CODES, VALID_OPENING_CODES, VALID_STRUCTURE_CODES, TopicCardSchema, TopicCardsSchema } from "../../src/lib/topic-validation"
import { COPY_TO_VIDEO_STRUCTURE_MAP, FALLBACK_VIDEO_STRUCTURE, mapCopyToVideoStructure } from "../../src/lib/copy-structure-mapping"
import { CONFLICT_PAIRS, hasConflict, sampleElements } from "../../src/lib/topic-element-logic"
import { buildTopicSystemPrompt, buildTopicUserPrompt } from "../../src/lib/topic-generation"
import { VIDEO_STRUCTURES } from "../../prisma/seed-structures"

// ─── Seed Data Integrity ───────────────────────────────

describe("Topic Engine Seed Data", () => {
  it("has exactly 12 topic elements", () => {
    expect(TOPIC_ELEMENTS).toHaveLength(12)
  })

  it("has exactly 7 opening types", () => {
    expect(OPENING_TYPES).toHaveLength(7)
  })

  it("has exactly 9 copy structures (8 + universal)", () => {
    expect(COPY_STRUCTURES).toHaveLength(9)
    expect(COPY_STRUCTURES.find(s => s.code === "universal")).toBeTruthy()
  })

  it("has exactly 4 ending types", () => {
    expect(ENDING_TYPES).toHaveLength(4)
  })

  it("all element codes are unique", () => {
    const codes = TOPIC_ELEMENTS.map(e => e.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it("all opening codes are unique", () => {
    const codes = OPENING_TYPES.map(o => o.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it("all structure codes are unique", () => {
    const codes = COPY_STRUCTURES.map(s => s.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it("all ending codes are unique", () => {
    const codes = ENDING_TYPES.map(e => e.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it("every element has required fields", () => {
    for (const el of TOPIC_ELEMENTS) {
      expect(el.code).toBeTruthy()
      expect(el.name).toBeTruthy()
      expect(el.typeLabel).toBeTruthy()
      expect(el.description.length).toBeGreaterThan(10)
      expect(Array.isArray(el.conflictCodes)).toBe(true)
      expect(typeof el.sortOrder).toBe("number")
    }
  })

  it("every opening type has formulas and examples", () => {
    for (const ot of OPENING_TYPES) {
      expect(ot.formulas.length).toBeGreaterThanOrEqual(2)
      expect(ot.examples.length).toBeGreaterThanOrEqual(1)
      for (const ex of ot.examples) {
        expect(ex.title).toBeTruthy()
        expect(ex.script).toBeTruthy()
      }
    }
  })

  it("every copy structure has beats with label+instruction", () => {
    for (const cs of COPY_STRUCTURES) {
      expect(cs.beats.length).toBeGreaterThanOrEqual(3)
      for (const beat of cs.beats) {
        expect(beat.label).toBeTruthy()
        expect(beat.instruction).toBeTruthy()
      }
    }
  })

  it("every ending type has guidance and patterns", () => {
    for (const et of ENDING_TYPES) {
      expect(et.guidance.length).toBeGreaterThan(20)
      expect(et.patterns.length).toBeGreaterThanOrEqual(2)
    }
  })
})

// ─── Validation Schema Sync ────────────────────────────

describe("Validation Code Sync with Seed Data", () => {
  it("VALID_ELEMENT_CODES matches seed element codes", () => {
    const seedCodes = TOPIC_ELEMENTS.map(e => e.code).sort()
    const validCodes = [...VALID_ELEMENT_CODES].sort()
    expect(validCodes).toEqual(seedCodes)
  })

  it("VALID_OPENING_CODES matches seed opening codes", () => {
    const seedCodes = OPENING_TYPES.map(o => o.code).sort()
    const validCodes = [...VALID_OPENING_CODES].sort()
    expect(validCodes).toEqual(seedCodes)
  })

  it("VALID_STRUCTURE_CODES matches seed structure codes", () => {
    const seedCodes = COPY_STRUCTURES.map(s => s.code).sort()
    const validCodes = [...VALID_STRUCTURE_CODES].sort()
    expect(validCodes).toEqual(seedCodes)
  })
})

// ─── Zod Validation ────────────────────────────────────

describe("TopicCard Zod Schema", () => {
  it("accepts a valid topic card", () => {
    const card = {
      title: "空调省电的3个秘诀",
      elementCodes: ["cost", "practical"],
      openingTypeCode: "curiosity_open",
      structureCode: "three_beat_ramp",
    }
    const result = TopicCardSchema.safeParse(card)
    expect(result.success).toBe(true)
  })

  it("rejects title over 20 chars", () => {
    const card = {
      title: "这是一个超过二十个字符的标题测试用例不应该通过验证",
      elementCodes: ["cost"],
      openingTypeCode: "curiosity_open",
      structureCode: "universal",
    }
    const result = TopicCardSchema.safeParse(card)
    expect(result.success).toBe(false)
  })

  it("rejects invalid element code", () => {
    const card = {
      title: "测试选题",
      elementCodes: ["nonexistent_code"],
      openingTypeCode: "curiosity_open",
      structureCode: "universal",
    }
    const result = TopicCardSchema.safeParse(card)
    expect(result.success).toBe(false)
  })

  it("rejects invalid opening type code", () => {
    const card = {
      title: "测试选题",
      elementCodes: ["cost"],
      openingTypeCode: "fake_opening",
      structureCode: "universal",
    }
    const result = TopicCardSchema.safeParse(card)
    expect(result.success).toBe(false)
  })

  it("rejects invalid structure code", () => {
    const card = {
      title: "测试选题",
      elementCodes: ["cost"],
      openingTypeCode: "curiosity_open",
      structureCode: "fake_structure",
    }
    const result = TopicCardSchema.safeParse(card)
    expect(result.success).toBe(false)
  })
})

describe("TopicCards (array of 4) Zod Schema", () => {
  const makeCard = (title: string) => ({
    title,
    elementCodes: ["cost", "practical"] as const,
    openingTypeCode: "curiosity_open" as const,
    structureCode: "universal" as const,
  })

  it("accepts exactly 4 unique cards", () => {
    const cards = [
      makeCard("选题一测试"),
      makeCard("选题二测试"),
      makeCard("选题三测试"),
      makeCard("选题四测试"),
    ]
    const result = TopicCardsSchema.safeParse(cards)
    expect(result.success).toBe(true)
  })

  it("rejects fewer than 4 cards", () => {
    const cards = [makeCard("选题一"), makeCard("选题二"), makeCard("选题三")]
    const result = TopicCardsSchema.safeParse(cards)
    expect(result.success).toBe(false)
  })

  it("rejects duplicate titles", () => {
    const cards = [
      makeCard("相同标题"),
      makeCard("相同标题"),
      makeCard("选题三测试"),
      makeCard("选题四测试"),
    ]
    const result = TopicCardsSchema.safeParse(cards)
    expect(result.success).toBe(false)
  })
})

// ─── CopyStructure→VideoStructure Mapping ──────────────

describe("CopyStructure to VideoStructure Mapping", () => {
  const videoStructureNames = VIDEO_STRUCTURES.map(vs => vs.name)

  it("maps all 9 CopyStructure codes", () => {
    const mappedCodes = Object.keys(COPY_TO_VIDEO_STRUCTURE_MAP)
    expect(mappedCodes.sort()).toEqual([...VALID_STRUCTURE_CODES].sort())
  })

  it("every mapping target is a real VideoStructure name", () => {
    for (const [copyCode, vsName] of Object.entries(COPY_TO_VIDEO_STRUCTURE_MAP)) {
      expect(videoStructureNames).toContain(vsName)
    }
  })

  it("fallback is a valid VideoStructure", () => {
    expect(videoStructureNames).toContain(FALLBACK_VIDEO_STRUCTURE)
  })

  it("mapCopyToVideoStructure returns correct mapping", () => {
    expect(mapCopyToVideoStructure("suspense_reveal")).toBe("suspense-reveal")
    expect(mapCopyToVideoStructure("universal")).toBe("contrast-hook")
    expect(mapCopyToVideoStructure("pain_solution")).toBe("pain-resonance")
  })

  it("mapCopyToVideoStructure falls back for unknown codes", () => {
    expect(mapCopyToVideoStructure("totally_fake")).toBe(FALLBACK_VIDEO_STRUCTURE)
    expect(mapCopyToVideoStructure("")).toBe(FALLBACK_VIDEO_STRUCTURE)
  })
})

// ─── Element Conflict Logic ────────────────────────────

describe("Element Conflict Matrix", () => {
  it("has defined conflict pairs", () => {
    expect(CONFLICT_PAIRS.length).toBeGreaterThanOrEqual(4)
  })

  it("detects known conflicts", () => {
    expect(hasConflict("cost", "authority")).toBe(true)
    expect(hasConflict("authority", "cost")).toBe(true) // bidirectional
    expect(hasConflict("curiosity", "trust")).toBe(true)
    expect(hasConflict("cost", "emotion")).toBe(true)
    expect(hasConflict("authority", "identity")).toBe(true)
  })

  it("allows non-conflicting pairs", () => {
    expect(hasConflict("cost", "practical")).toBe(false)
    expect(hasConflict("novelty", "story")).toBe(false)
    expect(hasConflict("social", "contrast")).toBe(false)
  })

  it("sampleElements returns 2-3 elements", () => {
    const allCodes = TOPIC_ELEMENTS.map(e => e.code)
    for (let i = 0; i < 20; i++) {
      const sampled = sampleElements(allCodes, 2 + Math.round(Math.random()))
      expect(sampled.length).toBeGreaterThanOrEqual(2)
      expect(sampled.length).toBeLessThanOrEqual(3)
    }
  })

  it("sampleElements never returns conflicting pairs", () => {
    const allCodes = TOPIC_ELEMENTS.map(e => e.code)
    for (let i = 0; i < 50; i++) {
      const sampled = sampleElements(allCodes, 3)
      for (let a = 0; a < sampled.length; a++) {
        for (let b = a + 1; b < sampled.length; b++) {
          expect(hasConflict(sampled[a], sampled[b])).toBe(false)
        }
      }
    }
  })

  it("conflict codes in seed data match CONFLICT_PAIRS", () => {
    for (const [a, b] of CONFLICT_PAIRS) {
      const elA = TOPIC_ELEMENTS.find(e => e.code === a)
      const elB = TOPIC_ELEMENTS.find(e => e.code === b)
      expect(elA).toBeTruthy()
      expect(elB).toBeTruthy()
      expect(elA!.conflictCodes).toContain(b)
      expect(elB!.conflictCodes).toContain(a)
    }
  })
})

// ─── Topic Generation Prompts ──────────────────────────

describe("Topic Generation Prompts", () => {
  it("system prompt includes all valid opening codes", () => {
    const prompt = buildTopicSystemPrompt("fresh", [])
    for (const code of VALID_OPENING_CODES) {
      expect(prompt).toContain(code)
    }
  })

  it("system prompt includes all valid structure codes", () => {
    const prompt = buildTopicSystemPrompt("fresh", [])
    for (const code of VALID_STRUCTURE_CODES) {
      expect(prompt).toContain(code)
    }
  })

  it("system prompt specifies 4 cards", () => {
    const prompt = buildTopicSystemPrompt("fresh", [])
    expect(prompt).toContain("4")
  })

  it("user prompt includes IP profile fields", () => {
    const prompt = buildTopicUserPrompt(
      {
        ipProfile: {
          id: "test",
          displayName: "测试用户",
          nickname: null,
          industry: "教育培训",
          primaryOffer: "在线课程",
          targetAudience: "职场新人",
          ipTraits: "专业可信",
          toneOfVoice: "温和专业",
          proofPoints: "10年经验",
          callToAction: "咨询报名",
          profileVersion: 1,
          business: null,
          persona: null,
          content: null,
          promptSnapshot: null,
        },
        elements: TOPIC_ELEMENTS.map(e => ({
          code: e.code,
          name: e.name,
          typeLabel: e.typeLabel,
          description: e.description,
        })),
      },
      ["cost", "practical"],
    )

    expect(prompt).toContain("测试用户")
    expect(prompt).toContain("教育培训")
    expect(prompt).toContain("在线课程")
    expect(prompt).toContain("职场新人")
    expect(prompt).toContain("低成本")
    expect(prompt).toContain("实用干货")
  })

  it("user prompt omits null IP fields", () => {
    const prompt = buildTopicUserPrompt(
      {
        ipProfile: {
          id: "test",
          displayName: null,
          nickname: null,
          industry: "测试行业",
          primaryOffer: null,
          targetAudience: null,
          ipTraits: null,
          toneOfVoice: null,
          proofPoints: null,
          callToAction: null,
          profileVersion: 1,
          business: null,
          persona: null,
          content: null,
          promptSnapshot: null,
        },
        elements: TOPIC_ELEMENTS.map(e => ({
          code: e.code,
          name: e.name,
          typeLabel: e.typeLabel,
          description: e.description,
        })),
      },
      ["novelty"],
    )

    expect(prompt).toContain("测试行业")
    expect(prompt).not.toContain("名称")
    expect(prompt).toContain("新奇刺激")
  })
})
