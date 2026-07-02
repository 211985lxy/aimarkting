import { describe, expect, it } from "vitest"

import { buildCompetitorReportsPath } from "@/lib/api/client"

describe("competitor report paths", () => {
  it("filters reports by target account url", () => {
    const path = buildCompetitorReportsPath(1, 10, "https://www.douyin.com/user/sec_user_1")

    expect(path).toBe(
      "/api/competitor/reports?page=1&limit=10&targetUrl=https%3A%2F%2Fwww.douyin.com%2Fuser%2Fsec_user_1",
    )
  })
})
