import { describe, expect, it, vi, beforeEach } from "vitest"

// Mock prisma to return controlled viral video data
const mockFindMany = vi.fn()
vi.mock("@/lib/prisma", () => ({
  prisma: {
    watchAccount: { findMany: mockFindMany },
  },
}))

const { buildRawInputWithMarketViralContext } = await import(
  "@/app/api/aim/generate/route"
)

describe("buildRawInputWithMarketViralContext", () => {
  beforeEach(() => {
    mockFindMany.mockReset()
  })

  it("returns rawInput unchanged when enabled=false", async () => {
    const result = await buildRawInputWithMarketViralContext("user-1", "帮我做定位", false)
    expect(result).toBe("帮我做定位")
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it("returns rawInput unchanged when no accounts have viral videos", async () => {
    mockFindMany.mockResolvedValue([
      { nickname: "账号A", targetUrl: "https://a.com", viralVideos: [] },
    ])

    const result = await buildRawInputWithMarketViralContext("user-1", "帮我做定位", true)
    expect(result).toBe("帮我做定位")
  })

  it("appends viral video context with required headings", async () => {
    mockFindMany.mockResolvedValue([
      {
        nickname: "对标账号",
        targetUrl: "https://douyin.com/user/1",
        viralVideos: [
          {
            title: "3个搞钱思路让你少走弯路",
            videoUrl: "https://douyin.com/video/1",
            likes: 5000,
            comments: 200,
            shares: 100,
            collects: 300,
            engagementScore: 6900,
          },
        ],
      },
    ])

    const result = await buildRawInputWithMarketViralContext("user-1", "IP定位方案", true)

    expect(result).toContain("市场洞察爆款作品上下文")
    expect(result).toContain("客户经历资产")
    expect(result).toContain("不得照搬对标账号标题")
    expect(result).toContain("TOP 1")
    expect(result).toContain("3个搞钱思路让你少走弯路")
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    )
  })

  it("queries with correct userId for data isolation", async () => {
    mockFindMany.mockResolvedValue([
      {
        nickname: "测试",
        targetUrl: "https://test.com",
        viralVideos: [
          { title: "视频A", likes: 100, engagementScore: 100 },
        ],
      },
    ])

    await buildRawInputWithMarketViralContext("user-42", "输入", true)

    expect(mockFindMany).toHaveBeenCalledTimes(1)
    const callArgs = mockFindMany.mock.calls[0][0] as Record<string, unknown>
    expect((callArgs.where as { userId: string }).userId).toBe("user-42")
  })
})
