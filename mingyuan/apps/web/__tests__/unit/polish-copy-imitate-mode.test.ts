import { describe, expect, it, vi, beforeEach } from "vitest"

// Mock dependencies BEFORE any imports that use them
const mockComplete = vi.fn().mockResolvedValue({
  content: "这是仿写后的文案。",
  model: "test-model",
  provider: "test-provider",
})

vi.mock("@/lib/prisma", () => ({
  prisma: {
    knowledgeEntry: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "k1",
          category: "product_usp",
          title: "核心卖点",
          content: "产品A的独特优势",
          sortOrder: 1,
          userId: "test-user",
          status: "active",
          projectId: null,
        },
      ]),
    },
  },
}))

vi.mock("@/lib/ip-copywriting-methodology", () => ({
  buildIpCopywritingMethodologyBlock: vi
    .fn()
    .mockResolvedValue("=== IP操盘方法论库 ===\n方法论内容"),
}))

vi.mock("@/lib/llm/client", () => ({
  LLMClient: {
    shared: vi.fn().mockReturnValue({
      complete: mockComplete,
    }),
  },
}))

describe("polishCopy imitate mode", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockComplete.mockResolvedValue({
      content: "这是仿写后的文案。",
      model: "test-model",
      provider: "test-provider",
    })
  })

  it("polishCopy with mode: 'imitate' and viralSourceText does not throw", async () => {
    const { polishCopy } = await import(
      "@/lib/aim-agents/script-agent"
    )

    const result = await polishCopy({
      userId: "test-user",
      rawInput: "原始文案",
      mode: "imitate",
      viralSourceText: "这是一条爆款原文，很厉害的文案结构。",
    })

    expect(result).toBeDefined()
    expect(result).toHaveProperty("content")
    expect(result).toHaveProperty("wordCount")
    expect(typeof result.wordCount).toBe("number")
  })

  it("polishCopy imitate mode calls LLM with imitate-specific system prompt", async () => {
    const { polishCopy } = await import(
      "@/lib/aim-agents/script-agent"
    )

    await polishCopy({
      userId: "test-user",
      rawInput: "原始文案",
      mode: "imitate",
      viralSourceText: "这是一条爆款原文，很厉害的文案结构。",
    })

    // Verify LLM was called
    expect(mockComplete).toHaveBeenCalledOnce()

    const callArgs = mockComplete.mock.calls[0][0]
    expect(callArgs.messages[0].role).toBe("system")
    expect(callArgs.messages[0].content).toContain("爆款文案仿写专家")
    expect(callArgs.messages[1].role).toBe("user")
    expect(callArgs.messages[1].content).toContain("爆款原文")
    expect(callArgs.messages[1].content).toContain(
      "这是一条爆款原文，很厉害的文案结构。"
    )
  })

  it("polishCopy without mode (default polish) still works", async () => {
    const { polishCopy } = await import(
      "@/lib/aim-agents/script-agent"
    )

    const result = await polishCopy({
      userId: "test-user",
      rawInput: "原始文案内容",
    })

    expect(result).toBeDefined()
    expect(result).toHaveProperty("content")
    expect(result).toHaveProperty("wordCount")

    // Verify polish-mode system prompt was used (not imitate)
    expect(mockComplete).toHaveBeenCalledOnce()
    const callArgs = mockComplete.mock.calls[0][0]
    expect(callArgs.messages[0].content).toContain("企业营销文案专家")
    expect(callArgs.messages[0].content).not.toContain("爆款文案仿写专家")
  })

  it("polishCopy with mode: 'polish' explicitly still works", async () => {
    const { polishCopy } = await import(
      "@/lib/aim-agents/script-agent"
    )

    const result = await polishCopy({
      userId: "test-user",
      rawInput: "原始文案内容",
      mode: "polish",
    })

    expect(result).toBeDefined()
    expect(result).toHaveProperty("content")
    expect(result).toHaveProperty("wordCount")

    // Verify polish-mode system prompt was used
    expect(mockComplete).toHaveBeenCalledOnce()
    const callArgs = mockComplete.mock.calls[0][0]
    expect(callArgs.messages[0].content).toContain("企业营销文案专家")
  })
})
