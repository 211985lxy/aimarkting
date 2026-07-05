import { describe, expect, it } from "vitest"

import { AIM_AGENT_OPTIONS, getAimAgent } from "@/lib/aim-ui-config"
import {
  AIM_COPY_VARIANTS,
  buildAimNextActionPrompt,
  getAimAgentGuide,
} from "@/lib/aim-agent-guides"

describe("aim agent guides", () => {
  it("defines a guide for every AIM agent", () => {
    for (const agent of AIM_AGENT_OPTIONS) {
      const guide = getAimAgentGuide(agent.id)

      expect(guide.intro).toBeTruthy()
      expect(guide.inputTemplate.length).toBeGreaterThan(0)
      expect(guide.outputAssets.length).toBeGreaterThan(0)
      expect(guide.nextActions.length).toBeGreaterThan(0)
      expect(guide.skills.length).toBeGreaterThan(0)
    }
  })

  it("keeps content_review away from new-copy actions", () => {
    const guide = getAimAgentGuide("content_review")
    const actionText = guide.nextActions.map((action) => `${action.label} ${action.prompt}`).join("\n")

    expect(actionText).not.toContain("生成新文案")
    expect(actionText).toContain("复检")
    expect(actionText).toContain("保存")
  })

  it("offers the three visible content-production variants", () => {
    const labels = AIM_COPY_VARIANTS.map((variant) => variant.label)
    const guide = getAimAgentGuide("content_producer")

    expect(labels).toEqual(expect.arrayContaining(["独白流", "结论先行", "问答型"]))
    expect(guide.copyVariants?.map((variant) => variant.label)).toEqual(labels)
  })

  it("uses task-based workflow names on the visible agent list", () => {
    expect(getAimAgent("business_diagnosis").title).toBe("灵感选题策划")
    expect(getAimAgent("content_producer").title).toBe("内容文案创作")
    expect(getAimAgent("content_review").title).toBe("发布前质检")
    expect(getAimAgent("business_system_diagnosis").title).toBe("商业模式诊断")
  })

  it("keeps content pillars under topic planning instead of separate agents", () => {
    const guideText = [
      getAimAgentGuide("business_diagnosis").defaultInstruction,
      ...getAimAgentGuide("business_diagnosis").outputAssets,
    ].join("\n")

    expect(guideText).toContain("热点类")
    expect(guideText).toContain("人设类")
    expect(guideText).toContain("问题解答类")
  })

  it("surfaces high-frequency creation tasks under content writing", () => {
    const guideText = [
      getAimAgentGuide("content_producer").defaultInstruction,
      ...getAimAgentGuide("content_producer").quickPrompts,
      ...getAimAgentGuide("content_producer").outputAssets,
    ].join("\n")

    expect(guideText).toContain("改写")
    expect(guideText).toContain("对标再创作")
    expect(guideText).toContain("追热点")
    expect(guideText).toContain("获客文案")
    expect(guideText).toContain("公众号文章/深度长文")
    expect(guideText).toContain("Vlog 分镜脚本")
  })

  it("builds next-action prompts with the original deliverable content", () => {
    const action = getAimAgentGuide("content_producer").nextActions.find((item) => item.id === "publish_package")
    const content = "这是一段已经生成好的口播文案。"

    expect(action).toBeTruthy()
    expect(buildAimNextActionPrompt(action!, content)).toContain(content)
  })

  it("turns the publishing action into a 12-item publishing plan", () => {
    const action = getAimAgentGuide("content_producer").nextActions.find((item) => item.id === "publish_package")

    expect(action?.label).toBe("生成发布计划")
    expect(action?.prompt).toContain("12 条内容排产表")
    expect(action?.prompt).toContain("序号、选题标题、核心钩子、内容角度、适合平台/形式、发布话题、承接动作")
    expect(action?.prompt).toContain("品牌/IP/账号相关话题")
  })

  it("resolves the legacy ip_video alias to the content_producer guide (backward compat)", () => {
    const canonical = getAimAgentGuide("content_producer")
    const aliased = getAimAgentGuide("ip_video")

    expect(aliased).toBe(canonical)
  })

  it("defines the high-frequency content producer skills", () => {
    const labels = getAimAgentGuide("content_producer").skills.map((skill) => skill.label)

    expect(labels).toEqual(expect.arrayContaining([
      "优化开头",
      "改写现有文案",
      "对标爆款再创作",
      "生成视频日记",
      "小红书图文笔记",
      "核心内容一键拆解",
      "生成 12 条发布计划",
    ]))
  })

  it("keeps video diary and xiaohongshu skills tied to their methodology", () => {
    const guide = getAimAgentGuide("content_producer")
    const videoDiary = guide.skills.find((item) => item.id === "video_diary")
    const xhs = guide.skills.find((item) => item.id === "xiaohongshu_image_text")

    expect(videoDiary?.prompt).toContain("事件内容化五步法")
    expect(videoDiary?.prompt).toContain("真实事件 -> 关键矛盾 -> 核心观点 -> 用户价值 -> 内容表达")
    expect(videoDiary?.prompt).toContain("不写流水账")
    expect(xhs?.prompt).toContain("小红书图文视觉导演结构")
    expect(xhs?.prompt).toContain("8 页图文结构")
    expect(xhs?.prompt).toContain("品牌/IP/账号相关标签")
  })

  it("defines topic planning and review skills", () => {
    expect(getAimAgentGuide("business_diagnosis").skills.map((skill) => skill.label)).toContain("选择内容主线")

    const reviewLabels = getAimAgentGuide("content_review").skills.map((skill) => skill.label)
    expect(reviewLabels).toEqual(expect.arrayContaining([
      "标题质检",
      "开头钩子质检",
      "内容结构质检",
      "人设一致性质检",
      "平台适配质检",
      "转化路径质检",
      "风险表达质检",
    ]))
  })

  it("keeps meeting-minutes asset pack grounded and non-generic", () => {
    const skill = getAimAgentGuide("business_diagnosis").skills.find((item) => item.id === "meeting_minutes_asset_pack")

    expect(skill?.prompt).toContain("高密度《会议纪要内容资产包》")
    expect(skill?.prompt).toContain("关键信息抽取表")
    expect(skill?.prompt).toContain("至少 12 条")
    expect(skill?.prompt).toContain("会议证据")
    expect(skill?.prompt).toContain("不要结尾反问")
  })

  it("keeps skill prompts actionable and aligned with labels", () => {
    for (const agent of AIM_AGENT_OPTIONS) {
      for (const skill of getAimAgentGuide(agent.id).skills) {
        expect(skill.prompt.trim()).toBeTruthy()
        expect(skill.prompt).toContain("请")
      }
    }
  })
})
