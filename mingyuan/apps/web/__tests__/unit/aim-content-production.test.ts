import { describe, expect, it } from "vitest"
import { AIM_AGENT_OPTIONS } from "@/lib/aim-ui-config"
import { buildKnowledgeBlock } from "@/lib/aim-generator"

describe("AIM content production positioning", () => {
  it("keeps the required standalone content agents", () => {
    const titles = AIM_AGENT_OPTIONS.map((agent) => agent.title)

    expect(titles).toContain("内容生产官")
    expect(titles).toContain("定位策划官")
    expect(titles).toContain("商业诊断官")
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
