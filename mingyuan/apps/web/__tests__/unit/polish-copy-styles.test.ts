import { describe, expect, it, vi, beforeEach } from "vitest"

// Mock dependencies BEFORE any imports that use them
vi.mock("@/lib/prisma", () => ({
  prisma: {
    knowledgeEntry: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock("@/lib/ip-copywriting-methodology", () => ({
  buildIpCopywritingMethodologyBlock: vi.fn().mockResolvedValue(""),
}))

vi.mock("@/lib/llm/client", () => ({
  LLMClient: {
    shared: vi.fn().mockReturnValue({
      complete: vi.fn().mockResolvedValue({
        content: "这是一段精修后的文案。",
      }),
    }),
  },
}))

// ── 1. Style guide config exports ──
import {
  STYLE_GUIDE_IDS,
  STYLE_GUIDE_LABELS,
  getStylePromptBlock,
  type StyleGuideId,
} from "@/lib/style-guide-config"

describe("style-guide-config", () => {
  it("exports exactly 12 built-in style IDs", () => {
    expect(STYLE_GUIDE_IDS).toHaveLength(12)
  })

  it("STYLE_GUIDE_LABELS has exactly 12 keys matching STYLE_GUIDE_IDS", () => {
    const labelKeys = Object.keys(STYLE_GUIDE_LABELS)
    expect(labelKeys).toHaveLength(12)
    for (const id of STYLE_GUIDE_IDS) {
      expect(labelKeys).toContain(id)
    }
  })

  it("getStylePromptBlock returns non-empty string (>20 chars) for each of the 12 styles", () => {
    for (const id of STYLE_GUIDE_IDS) {
      const block = getStylePromptBlock(id)
      expect(typeof block).toBe("string")
      expect(block.length).toBeGreaterThan(20)
      expect(block).toContain(STYLE_GUIDE_LABELS[id])
    }
  })

  it("getStylePromptBlock returns empty string for undefined", () => {
    expect(getStylePromptBlock(undefined)).toBe("")
  })

  it("getStylePromptBlock returns empty string for unknown style", () => {
    expect(getStylePromptBlock("nonexistent" as StyleGuideId)).toBe("")
  })

  it("getStylePromptBlock returns empty string for empty string", () => {
    expect(getStylePromptBlock("" as StyleGuideId)).toBe("")
  })
})

// ── 2. polishCopy accepts styleId parameter ──
describe("polishCopy styleId integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("polishCopy does not throw when styleId is provided", async () => {
    const { polishCopy } = await import("@/lib/aim-agents/script-agent")

    await expect(
      polishCopy({
        userId: "test-user",
        rawInput: "原始文案内容",
        styleId: "sharp",
      })
    ).resolves.toBeDefined()
  })

  it("polishCopy works without styleId (backwards compatible)", async () => {
    const { polishCopy } = await import("@/lib/aim-agents/script-agent")

    const result = await polishCopy({
      userId: "test-user",
      rawInput: "原始文案内容",
    })

    expect(result).toHaveProperty("content")
    expect(result).toHaveProperty("wordCount")
  })

  it("polishCopy works with any valid styleId", async () => {
    const { polishCopy } = await import("@/lib/aim-agents/script-agent")

    for (const styleId of STYLE_GUIDE_IDS) {
      await expect(
        polishCopy({
          userId: "test-user",
          rawInput: "原始文案内容",
          styleId,
        })
      ).resolves.toBeDefined()
    }
  })
})
