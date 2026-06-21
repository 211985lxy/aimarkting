import { describe, expect, it } from "vitest"
import { buildBusinessDiagnosisMethodologyBlock } from "@/lib/business-diagnosis-methodology"

describe("business-diagnosis-methodology", () => {
  it("loads the project business diagnosis methodology without external framework traces", async () => {
    const block = await buildBusinessDiagnosisMethodologyBlock()

    expect(block).toContain("信息校准")
    expect(block).toContain("概念澄清")
    expect(block).toContain("生意系统诊断")
    expect(block).toContain("行业参照校验")
    expect(block).toContain("多视角复核")
    for (const hiddenTrace of [
      ["D", "BS"].join(""),
      ["六顶", "思考帽"].join(""),
      ["斜杠", "命令"].join(""),
      ["同行", "框架"].join(""),
    ]) {
      expect(block).not.toContain(hiddenTrace)
    }
  })
})
