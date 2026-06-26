import { describe, expect, it } from "vitest"

import { buildKnowledgeBlock, rankKnowledgeEntriesForAgent } from "@/lib/aim-knowledge-context"

describe("AIM knowledge cleanup tags", () => {
  const ipEntry = {
    id: "ip-1",
    title: "创始人失败教训",
    content: "失败之后形成了新的做事原则。",
    category: "boss_experience",
    score: 1,
    tags: ["kb_scope:ip", "asset_role:story", "confidence:user_claim"],
  }
  const projectEntry = {
    id: "project-1",
    title: "产品成交卖点",
    content: "这个服务能减少老板重复沟通成本。",
    category: "product_usp",
    score: 1,
    tags: ["kb_scope:project", "asset_role:usp", "confidence:confirmed"],
  }

  it("prioritizes IP knowledge for deep copywriting", () => {
    const ranked = rankKnowledgeEntriesForAgent("deep_copywriter", [projectEntry, ipEntry])
    expect(ranked[0].id).toBe("ip-1")
  })

  it("prioritizes project knowledge for content production", () => {
    const ranked = rankKnowledgeEntriesForAgent("content_producer", [ipEntry, projectEntry])
    expect(ranked[0].id).toBe("project-1")
  })

  it("marks pending verification knowledge in the context block", () => {
    const block = buildKnowledgeBlock([
      {
        category: "boss_experience",
        title: "待核验履历",
        content: "曾服务过某头部客户。",
        tags: ["confidence:pending_verify"],
      },
    ])

    expect(block).toContain("待核验履历（待核验）")
  })
})

describe("AIM evolved preferences retrieval", () => {
  it("keeps user_insight visible for deep copywriter ranking", () => {
    const ranked = rankKnowledgeEntriesForAgent("deep_copywriter", [
      { id: "product", category: "product_usp", title: "产品", content: "产品卖点", score: 0.8, tags: [] },
      { id: "preference", category: "user_insight", title: "偏好", content: "用户喜欢短句", score: 0.8, tags: ["kb_scope:project"] },
    ])

    expect(ranked.some((entry) => entry.category === "user_insight")).toBe(true)
  })
})
