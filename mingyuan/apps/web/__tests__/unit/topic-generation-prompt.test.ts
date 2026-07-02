import { describe, expect, it } from "vitest"
import { buildTopicUserPrompt } from "@/lib/topic-generation"

describe("buildTopicUserPrompt", () => {
  it("requires benchmark rewrites to follow the current IP profile", () => {
    const prompt = buildTopicUserPrompt({
      ipProfile: {
        displayName: "相宇",
        industry: "AI 商业咨询",
        primaryOffer: "AI 智能体陪跑",
        targetAudience: "中小企业老板",
        ipTraits: "反常识、实战派",
        toneOfVoice: "直接、口语化",
      },
      elements: [
        { code: "practical", name: "实用", typeLabel: "价值", description: "给具体方法" },
        { code: "contrast", name: "反差", typeLabel: "钩子", description: "制造认知反差" },
      ],
      topicSources: [
        {
          category: "benchmark_reference",
          title: "健身对标文案",
          content: "多去跟AI吵架，少跟健身博主扯皮。",
        },
      ],
    }, ["practical", "contrast"])

    expect(prompt).toContain("对标文案迁移规则")
    expect(prompt).toContain("基于上方 IP 档案")
    expect(prompt).toContain("行业、人设、产品、目标受众、说话风格")
    expect(prompt).toContain("写法开启方向")
  })
})
