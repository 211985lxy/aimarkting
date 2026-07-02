import { describe, expect, it } from "vitest"
import { AIM_AGENT_OPTIONS } from "@/lib/aim-ui-config"
import { parseMultiFormatResponse } from "@/lib/aim-generator"
import { buildKnowledgeBlock } from "@/lib/aim-knowledge-context"
import { buildXhsVisualDirectorInstruction } from "@/lib/aim-agent-handlers"

describe("AIM content production positioning", () => {
  it("keeps the required standalone content agents", () => {
    const titles = AIM_AGENT_OPTIONS.map((agent) => agent.title)

    expect(titles).toContain("内容生产官")
    expect(titles).toContain("定位策划官")
    expect(titles).toContain("商业诊断官")
  })

  it("positions the deep copywriter as framework-first", () => {
    const deepCopywriter = AIM_AGENT_OPTIONS.find((agent) => agent.id === "deep_copywriter")

    expect(deepCopywriter?.description).toContain("先出框架")
  })

  it("labels Feishu-importable content knowledge categories in prompts", () => {
    const block = buildKnowledgeBlock([
      { category: "hot_topic", title: "行业热点", content: "飞书多维表格 AI 能力升级。" },
      { category: "positioning_material", title: "客户定位", content: "目标客户是传统企业老板。" },
      { category: "private_domain_material", title: "私域素材", content: "朋友圈需要承接咨询。" },
    ])

    expect(block).toContain("【热点素材】")
    expect(block).toContain("【定位素材】")
    expect(block).toContain("【私域素材】")
  })
})

describe("xiaohongshu_post visual director", () => {
  const instruction = buildXhsVisualDirectorInstruction()

  it("locks the canvas to strict 3:4 vertical portrait", () => {
    expect(instruction).toContain("1080x1440px")
    expect(instruction).toContain("strict 3:4")
  })

  it("includes the fixed output sections", () => {
    expect(instruction).toContain("统一视觉母版")
    expect(instruction).toContain("8 页图文结构")
    expect(instruction).toContain("逐页视觉提示词")
    expect(instruction).toContain("发布前自检")
  })

  it("maps content types to AIM visual styles", () => {
    expect(instruction).toContain("深色科技杂志风")
    expect(instruction).toContain("高级商业提案风")
    expect(instruction).toContain("个人品牌宣言风")
    expect(instruction).toContain("Notion 高级卡片风")
  })

  it("requires per-page negative prompts for visual consistency", () => {
    expect(instruction).toContain("no square image")
    expect(instruction).toContain("no inconsistent margins")
  })

  it("still parses ===FORMAT:xiaohongshu_post=== from raw output", () => {
    const raw =
      "===FORMAT:xiaohongshu_post===\n# 风格判断报告\n深色科技杂志风\n# 统一视觉母版\n1080x1440px"
    const result = parseMultiFormatResponse(raw, ["xiaohongshu_post"])
    expect(result.xiaohongshu_post ?? "").toContain("深色科技杂志风")
    expect(result.xiaohongshu_post ?? "").toContain("1080x1440px")
  })
})
