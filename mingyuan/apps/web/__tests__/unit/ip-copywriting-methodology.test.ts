import { describe, expect, it } from "vitest"
import { buildIpCopywritingMethodologyBlock } from "@/lib/ip-copywriting-methodology"

describe("ip-copywriting-methodology", () => {
  it("loads the project methodology document", async () => {
    const block = await buildIpCopywritingMethodologyBlock()

    expect(block).toContain("IP操盘方法论库")
    expect(block).toContain("流量型视频")
    expect(block).toContain("线索获客视频")
  })

  it("contains IP账号定位与内容策略策划 methodology card", async () => {
    const block = await buildIpCopywritingMethodologyBlock()

    // IP定位层
    expect(block).toContain("IP账号定位与内容策略策划阶段")
    expect(block).toContain("网红型")
    expect(block).toContain("个人IP型")
    expect(block).toContain("生态位")
    expect(block).toContain("性格与命理辅助建模")

    // 内容策略层
    expect(block).toContain("话题分布")
    expect(block).toContain("内容形式")
    expect(block).toContain("钩子模式")
    expect(block).toContain("发布频率")
    expect(block).toContain("最佳发布时段")
    expect(block).toContain("爆款公式")
  })

  it("contains the four copywriting content routes", async () => {
    const block = await buildIpCopywritingMethodologyBlock()

    expect(block).toContain("人设信任型")
    expect(block).toContain("观点立场型")
    expect(block).toContain("问题解决型")
    expect(block).toContain("案例转化型")
    expect(block).toContain("干货方法并入问题解决型")
    expect(block).toContain("成交转化并入案例转化型")
    expect(block).toContain("内容路由 = 这条内容为什么拍")
    expect(block).toContain("内容形式 = 这条内容怎么拍")
    expect(block).toContain("局部优化指令路由")
    expect(block).toContain("开头、前3秒、第一句话、钩子")
    expect(block).toContain("调用爆款开头库")
  })
})
