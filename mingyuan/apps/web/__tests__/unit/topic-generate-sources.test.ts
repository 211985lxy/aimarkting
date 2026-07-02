import { describe, expect, it } from "vitest"
import {
  buildBenchmarkAccountSources,
  buildVideoCopyExtractionSources,
} from "@/app/api/topics/generate/route"

describe("topic generate sources", () => {
  it("builds benchmark sources from watched account videos", () => {
    const sources = buildBenchmarkAccountSources([
      {
        nickname: "对标账号",
        targetUrl: "https://example.com/u",
        viralVideos: [{ title: "爆款标题", likes: 100, comments: 2, shares: 3, collects: 4 }],
        latestVideos: [{ title: "近期标题", likes: 10, comments: 1, shares: 0, collects: 2 }],
      },
    ])

    expect(sources[0]).toMatchObject({
      category: "benchmark_reference",
      title: "对标账号",
    })
    expect(sources[0].content).toContain("爆款标题")
    expect(sources[0].content).toContain("近期标题")
  })

  it("builds benchmark sources from extracted copy analysis", () => {
    const sources = buildVideoCopyExtractionSources([
      {
        videoTitle: "拆解标题",
        sourceUrl: "https://example.com/video",
        transcript: "这是原文开头，里面有钩子和结构。",
        analysisResult: { hook: "反差开头", structure: "痛点到方案" },
      },
    ])

    expect(sources[0]).toMatchObject({
      category: "benchmark_reference",
      title: "拆解标题",
    })
    expect(sources[0].content).toContain("结构化拆解")
    expect(sources[0].content).toContain("原文摘要")
    expect(sources[0].content).toContain("反差开头")
  })
})
