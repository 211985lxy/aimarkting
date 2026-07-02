import { describe, expect, it, vi, beforeEach } from "vitest"

// 拦截 LLM 调用与数据库写入，避免真实外部依赖。
// business_diagnosis 的 chat 走 executeChatLLM，generate 走 executeGenerateLLM + saveAimGenerationRecord。
const completeMock = vi.fn()
vi.mock("@/lib/llm/agent-router", () => ({
  getAgentLLM: () => ({
    complete: completeMock,
    stream: vi.fn(),
  }),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    aimGeneration: { create: vi.fn().mockResolvedValue({ id: "rec-1" }) },
    clientProject: { findFirst: vi.fn() },
  },
}))
// 知识检索走空，避免触发 embedding
vi.mock("@/lib/aim-knowledge-context", () => ({
  buildAimKnowledgeContext: vi.fn().mockResolvedValue({
    knowledgeBlock: "",
    entries: [],
    source: "raw",
  }),
  fireKnowledgeEmbedding: vi.fn(),
}))

// 必须在 mock 之后导入
const { buildBusinessDiagnosisMethodologyBlock } = await import("@/lib/business-diagnosis-methodology")
const { getAgentHandler } = await import("@/lib/aim-agent-handlers")
type AimChatParams = Awaited<typeof import("@/lib/aim-agent-handlers")>["AimChatParams"]
type AimGenerateContext = Awaited<typeof import("@/lib/aim-agent-handlers")>["AimGenerateContext"]

describe("business-diagnosis-methodology", () => {
  it("loads the project business diagnosis methodology without external framework traces", async () => {
    const block = await buildBusinessDiagnosisMethodologyBlock()

    expect(block).toContain("信息校准")
    expect(block).toContain("概念澄清")
    expect(block).toContain("生意系统诊断")
    expect(block).toContain("行业参照校验")
    expect(block).toContain("多视角复核")
    for (const hiddenTrace of [
      ["D", "BS"].join(""),
      ["六顶", "思考帽"].join(""),
      ["斜杠", "命令"].join(""),
      ["同行", "框架"].join(""),
    ]) {
      expect(block).not.toContain(hiddenTrace)
    }
  })
})

function buildChatParams(overrides: Partial<AimChatParams> = {}): AimChatParams {
  return {
    userId: "test-user",
    messages: [{ role: "user", content: "帮我做 IP 定位" }],
    knowledgeBlock: "【知识库】示例知识",
    methodologyBlock: "【IP操盘方法论】IP账号定位与内容策略策划阶段",
    businessDiagnosisBlock: "",
    ipWikiBlock: "",
    ...overrides,
  }
}

function buildGenerateContext(overrides: Partial<AimGenerateContext> = {}): AimGenerateContext {
  return {
    userId: "test-user",
    rawInput: "AI 工具账号定位",
    targetFormats: ["raw_copy"],
    knowledgeBlock: "【知识库】示例知识",
    methodologyBlock: "【IP操盘方法论】IP账号定位与内容策略策划阶段",
    businessDiagnosisBlock: "",
    viralStructureBlock: "",
    ipWikiBlock: "",
    retrievedEntries: [],
    retrievedSource: "raw",
    ...overrides,
  }
}

/** 从 LLM complete 的入参里取出 systemPrompt（messages[0].content） */
function capturedSystemPrompt(): string {
  const call = completeMock.mock.calls[0]?.[0]
  return call?.messages?.[0]?.content ?? ""
}

describe("定位策划官 prompt 保护", () => {
  beforeEach(() => {
    completeMock.mockReset()
    completeMock.mockResolvedValue({ content: "ok", model: "test", usage: { totalTokens: 0 } })
  })

  it("chat prompt injects methodologyBlock", async () => {
    const handler = getAgentHandler("business_diagnosis")
    await handler.chat(buildChatParams())

    const systemPrompt = capturedSystemPrompt()
    expect(systemPrompt).toContain("【IP操盘方法论】IP账号定位与内容策略策划阶段")
    expect(systemPrompt).toContain("IP操盘方法论")
  })

  it("generate prompt includes 内容策略底盘", async () => {
    const handler = getAgentHandler("business_diagnosis")
    await handler.generate(buildGenerateContext())

    const systemPrompt = capturedSystemPrompt()
    expect(systemPrompt).toContain("内容策略底盘")
    expect(systemPrompt).toContain("【IP操盘方法论】IP账号定位与内容策略策划阶段")
  })

  it("generate prompt includes 指导后续选题和文案", async () => {
    const handler = getAgentHandler("business_diagnosis")
    await handler.generate(buildGenerateContext())

    const systemPrompt = capturedSystemPrompt()
    expect(systemPrompt).toContain("指导后续选题和文案")
  })

  it("generate prompt requires source-backed positioning evidence", async () => {
    const handler = getAgentHandler("business_diagnosis")
    await handler.generate(buildGenerateContext())

    const systemPrompt = capturedSystemPrompt()
    expect(systemPrompt).toContain("关键数据来源与依据")
    expect(systemPrompt).toContain("数据分析、数据来源、数据精选")
    expect(systemPrompt).toContain("人设特点的真正挖掘")
    expect(systemPrompt).toContain("对标综合判断")
    expect(systemPrompt).toContain("不得编造来源")
  })

  it("business diagnosis prompt supports three positioning routes", async () => {
    const handler = getAgentHandler("business_diagnosis")
    await handler.generate(buildGenerateContext())

    const systemPrompt = capturedSystemPrompt()
    expect(systemPrompt).toContain("选题策划路由")
    expect(systemPrompt).toContain("完整 IP 策划路由")
    expect(systemPrompt).toContain("人设卖点梳理路由")
    expect(systemPrompt).toContain("下一轮确认问题")
    expect(systemPrompt).toContain("人设卖点")
  })
})
