import { describe, expect, it, vi, beforeEach } from "vitest"

// ── Mocks ──

const completeMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/llm/client", () => ({
  LLMClient: {
    shared: () => ({
      complete: completeMock,
    }),
  },
}))

const mockKnowledgeFindMany = vi.hoisted(() => vi.fn())
const mockOpeningTypeFindMany = vi.hoisted(() => vi.fn())
const mockCopyStructureFindMany = vi.hoisted(() => vi.fn())
const mockEndingTypeFindMany = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({
  prisma: {
    knowledgeEntry: { findMany: mockKnowledgeFindMany },
    openingType: { findMany: mockOpeningTypeFindMany },
    copyStructure: { findMany: mockCopyStructureFindMany },
    endingType: { findMany: mockEndingTypeFindMany },
  },
}))

const mockMethodologyBlock = vi.hoisted(() => "=== IP操盘方法论库 ===\n方法论内容")

vi.mock("@/lib/ip-copywriting-methodology", () => ({
  buildIpCopywritingMethodologyBlock: () => Promise.resolve(mockMethodologyBlock),
}))

// ── Import after mocks ──

const { writeScript } = await import("@/lib/aim-agents/script-agent")

// ── Helpers ──

const SCRIPT_CONTENT = "大家好，今天聊一下AI怎么帮企业降本增效。"

function setupDefaultMocks() {
  mockKnowledgeFindMany.mockResolvedValue([
    { title: "产品核心卖点", content: "AI降本30%", category: "product_usp", sortOrder: 0 },
  ])
  mockOpeningTypeFindMany.mockResolvedValue([
    { name: "痛点开头", description: "指出用户痛点", formulas: ["你还在为...发愁吗？"] },
  ])
  mockCopyStructureFindMany.mockResolvedValue([
    { name: "PAS结构", description: "问题-放大-解决", beats: [] },
  ])
  mockEndingTypeFindMany.mockResolvedValue([
    { name: "行动号召", guidance: "引导用户评论关注" },
  ])
  completeMock.mockResolvedValue({ content: SCRIPT_CONTENT })
}

// ── Tests ──

describe("writeScript structureCode parameter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  it("accepts structureCode parameter without throwing", async () => {
    const result = await writeScript({
      userId: "user-1",
      rawInput: "AI降本增效",
      structureCode: "PAS",
    })

    expect(result).toBeDefined()
    expect(result.content).toBe(SCRIPT_CONTENT)
    expect(result.wordCount).toBe(SCRIPT_CONTENT.length)
  })

  it("includes structureCode instruction in system prompt when provided", async () => {
    await writeScript({
      userId: "user-1",
      rawInput: "AI降本增效",
      structureCode: "PAS",
    })

    // The system prompt sent to LLM should mention the structure code
    const callArgs = completeMock.mock.calls[0][0]
    const systemMsg = callArgs.messages.find((m: { role: string }) => m.role === "system")
    expect(systemMsg.content).toContain("本次指定使用文案结构：PAS")
    expect(systemMsg.content).toContain("请严格按照该结构的节拍展开")
  })

  it("works without structureCode (backward compatibility)", async () => {
    const result = await writeScript({
      userId: "user-1",
      rawInput: "AI降本增效",
    })

    expect(result).toBeDefined()
    expect(result.content).toBe(SCRIPT_CONTENT)
    expect(result.wordCount).toBe(SCRIPT_CONTENT.length)
  })

  it("does not include structure instruction when structureCode is omitted", async () => {
    await writeScript({
      userId: "user-1",
      rawInput: "AI降本增效",
    })

    const callArgs = completeMock.mock.calls[0][0]
    const systemMsg = callArgs.messages.find((m: { role: string }) => m.role === "system")
    expect(systemMsg.content).not.toContain("本次指定使用文案结构")
    expect(systemMsg.content).not.toContain("请严格按照该结构的节拍展开")
  })
})
