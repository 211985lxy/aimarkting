import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const source = readFileSync(join(process.cwd(), "src/components/aim/aim-prompt-composer.tsx"), "utf8")

describe("AIM prompt composer Enter behavior", () => {
  it("keeps Enter as newline instead of send", () => {
    expect(source).not.toContain("onKeyDown")
    expect(source).toContain("回车换行")
    expect(source).toContain("点击发送按钮发送")
  })
})
