import { describe, expect, it } from "vitest"

import { AIM_AGENT_OPTIONS } from "@/lib/aim-ui-config"
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

  it("keeps meeting-minutes asset pack grounded and non-generic", () => {
    const skill = getAimAgentGuide("business_diagnosis").skills.find((item) => item.id === "meeting_minutes_asset_pack")

    expect(skill?.prompt).toContain("高密度《会议纪要内容资产包》")
    expect(skill?.prompt).toContain("关键信息抽取表")
    expect(skill?.prompt).toContain("至少 12 条")
    expect(skill?.prompt).toContain("会议证据")
    expect(skill?.prompt).toContain("不要结尾反问")
  })

  it("builds next-action prompts with the original deliverable content", () => {
    const action = getAimAgentGuide("content_producer").nextActions.find((item) => item.id === "publish_package")
    const content = "这是一段已经生成好的口播文案。"

    expect(action).toBeTruthy()
    expect(buildAimNextActionPrompt(action!, content)).toContain(content)
  })

  it("resolves the legacy ip_video alias to the content_producer guide (backward compat)", () => {
    const canonical = getAimAgentGuide("content_producer")
    const aliased = getAimAgentGuide("ip_video")

    expect(aliased).toBe(canonical)
  })
})
