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

    expect(messages[0].content).toContain("纯 Markdown")
    expect(messages[1].content).toContain("视频标题")
    expect(messages[1].content).toContain("bilibili")
    expect(messages[1].content).toContain("这是视频文案。")
  })

  it("parses a markdown analysis result directly", () => {
    const md = [
      "## 结构拆解",
      "",
      "### 开头",
      "用强冲突开头",
      "",
      "### 正文",
      "提出问题 → 解释原因",
      "",
      "## 心理拆解",
      "",
      "从焦虑到解决",
      "",
      "## 商业拆解",
      "",
      "引导评论转化",
      "",
      "## 迁移应用",
      "",
      "先指出问题，再给方案",
    ].join("\n")

    const analysis = parseVideoCopyAnalysis(md) satisfies VideoCopyAnalysis
    expect(analysis.markdown).toContain("用强冲突开头")
    expect(analysis.markdown).toContain("先指出问题，再给方案")
    expect(analysis.markdown).toContain("## 结构拆解")
  })

  it("runs analysis through an injected LLM provider", async () => {
    const md = [
      "## 结构拆解",
      "",
      "开门见山，痛点到行动",
      "",
      "## 心理拆解",
      "",
      "对比制造认知冲突",
      "",
      "## 商业拆解",
      "",
      "适合关注账号",
      "",
      "## 迁移应用",
      "",
      "痛点 + 案例 + 行动",
    ].join("\n")

    const analysis = await analyzeVideoCopy(
      {
        title: "标题",
        platform: "douyin",
        transcript: "原始文案",
      },
      provider(md)
    )

    expect(analysis.markdown).toContain("开门见山")
    expect(analysis.markdown).toContain("## 结构拆解")
    expect(analysis.markdown).toContain("## 迁移应用")
  })

  it("falls back when the model output is too short", async () => {
    const analysis = await analyzeVideoCopy(
      {
        title: "标题",
        platform: "douyin",
        transcript: "第一句。第二句。第三句。第四句。第五句。",
      },
      provider("?")
    )

    expect(analysis.markdown).toContain("## 结构拆解")
    expect(analysis.markdown).toContain("第一句。")
  })

  it("builds a fallback analysis from transcript text", () => {
    const analysis = buildFallbackVideoCopyAnalysis({
      transcript: "第一句。第二句。第三句。第四句。第五句。",
    })

    expect(analysis.markdown).toContain("## 结构拆解")
    expect(analysis.markdown).toContain("第一句。")
    expect(analysis.markdown).toContain("## 心理拆解")
    expect(analysis.markdown).toContain("## 商业拆解")
    expect(analysis.markdown).toContain("## 迁移应用")
  })
})
