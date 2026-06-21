import { describe, expect, it } from "vitest"
import { buildIpCopywritingMethodologyBlock } from "@/lib/ip-copywriting-methodology"

describe("ip-copywriting-methodology", () => {
  it("loads the project methodology document", async () => {
    const block = await buildIpCopywritingMethodologyBlock()

    expect(block).toContain("IP操盘方法论库")
    expect(block).toContain("流量型视频")
    expect(block).toContain("线索获客视频")
  })
})

