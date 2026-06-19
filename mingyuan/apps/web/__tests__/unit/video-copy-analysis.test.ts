import { describe, expect, it } from "vitest"

import {
  analyzeVideoCopy,
  buildVideoCopyAnalysisMessages,
  buildFallbackVideoCopyAnalysis,
  parseVideoCopyAnalysis,
  type VideoCopyAnalysis,
} from "@/lib/video-copy-analysis"
import type { LLMProvider } from "@/lib/llm"

function provider(content: string): LLMProvider {
  return {
    name: "test",
    isAvailable: () => true,
    complete: async () => ({
      content,
      model: "test-model",
      provider: "test",
    }),
  }
}

describe("video copy analysis", () => {
  it("builds a grounded prompt from video metadata and transcript", () => {
    const messages = buildVideoCopyAnalysisMessages({
      title: "视频标题",
      platform: "bilibili",
      transcript: "这是视频文案。",
    })

    expect(messages[0].content).toContain("不要编造")
    expect(messages[1].content).toContain("视频标题")
    expect(messages[1].content).toContain("bilibili")
    expect(messages[1].content).toContain("这是视频文案。")
  })

  it("parses a complete structured analysis", () => {
    const analysis = parseVideoCopyAnalysis(JSON.stringify({
      hook: "用强冲突开头",
      structure: ["提出问题", "解释原因"],
      emotionConflict: "焦虑到解决",
      expressionSkills: ["短句", "反问"],
      conversionAction: "引导评论",
      reusableTemplate: "先指出问题，再给方案",
      imitationSuggestions: ["保留冲突", "换成自己的案例"],
      riskNotes: ["避免夸大"],
    })) satisfies VideoCopyAnalysis

    expect(analysis.hook).toBe("用强冲突开头")
    expect(analysis.structure).toEqual(["提出问题", "解释原因"])
    expect(analysis.riskNotes).toEqual(["避免夸大"])
  })

  it("runs analysis through an injected LLM provider", async () => {
    const analysis = await analyzeVideoCopy(
      {
        title: "标题",
        platform: "douyin",
        transcript: "原始文案",
      },
      provider(JSON.stringify({
        hook: "开门见山",
        structure: ["开头", "正文", "结尾"],
        emotionConflict: "痛点到行动",
        expressionSkills: ["对比"],
        conversionAction: "关注账号",
        reusableTemplate: "痛点 + 案例 + 行动",
        imitationSuggestions: ["替换行业案例"],
        riskNotes: ["不要照搬"],
      }))
    )

    expect(analysis.reusableTemplate).toBe("痛点 + 案例 + 行动")
    expect(analysis.imitationSuggestions).toEqual(["替换行业案例"])
  })

  it("falls back when the model output is not usable", async () => {
    const analysis = await analyzeVideoCopy(
      {
        title: "标题",
        platform: "douyin",
        transcript: "第一句。第二句。第三句。第四句。第五句。",
      },
      provider("not json")
    )

    expect(analysis.hook).toBe("第一句。")
    expect(analysis.structure.length).toBeGreaterThan(0)
    expect(analysis.reusableTemplate).toContain("第一句。")
  })

  it("builds a fallback analysis from transcript text", () => {
    const analysis = buildFallbackVideoCopyAnalysis({
      transcript: "第一句。第二句。第三句。第四句。第五句。",
    })

    expect(analysis.hook).toBe("第一句。")
    expect(analysis.structure).toContain("第一句。")
  })
})
