import { describe, expect, it } from "vitest"

import { getApiErrorMessage } from "@/lib/api/client"

describe("api client error messages", () => {
  it("keeps the status code when an error response has no body", () => {
    expect(getApiErrorMessage(null, 404, "Not Found")).toBe("404 Not Found")
  })
})
