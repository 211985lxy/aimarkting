import { describe, expect, it, vi } from 'vitest'
import { collectDouyinCompetitorData } from '@/lib/competitor-analysis/collector'
import type {
  NormalizedAccount,
  NormalizedComment,
  NormalizedVideo,
  PlatformAdapter,
} from '@/lib/competitor-analysis/types'

function makeAccount(overrides: Partial<NormalizedAccount> = {}): NormalizedAccount {
  return {
    platformUserId: 'sec_user_001',
    nickname: 'Douyin Account',
    avatar: 'https://example.com/avatar.jpg',
    signature: 'bio',
    followerCount: 10000,
    followingCount: 12,
    totalLikes: 50000,
    videoCount: 3,
    isVerified: false,
    verifyInfo: '',
    ...overrides,
  }
}

function makeVideo(overrides: Partial<NormalizedVideo> = {}): NormalizedVideo {
  return {
    videoId: 'video_001',
    title: 'sample video',
    coverUrl: 'https://example.com/cover.jpg',
    videoUrl: 'https://example.com/video.mp4',
    createTime: 1700000000,
    duration: 30,
    views: 1000,
    likes: 100,
    comments: 10,
    shares: 5,
    collects: 20,
    ...overrides,
  }
}

function makeComment(overrides: Partial<NormalizedComment> = {}): NormalizedComment {
  return {
    commentId: 'comment_001',
    text: 'good',
    likes: 3,
    createTime: 1700000000,
    isTop: false,
    ...overrides,
  }
}

function makeAdapter(overrides: Partial<PlatformAdapter> = {}): PlatformAdapter {
  return {
    resolveUrl: vi.fn(async () => 'api_sec_user'),
    fetchAccount: vi.fn(async () => makeAccount({ platformUserId: 'api_sec_user' })),
    fetchVideos: vi.fn(async () => [makeVideo({ videoId: 'api_video_001' })]),
    fetchVideoStats: vi.fn(async () => new Map()),
    fetchComments: vi.fn(async () => [makeComment({ commentId: 'api_comment_001' })]),
    ...overrides,
  }
}

describe('collectDouyinCompetitorData', () => {
  it('uses the configured external API before local browser and TikHub', async () => {
    const apiAdapter = makeAdapter()
    const fetchFromLocalCrawler = vi.fn(async () => {
      throw new Error('local browser should not run')
    })
    const fetchFromExternalApi = vi.fn(async () => ({
      platformUserId: 'external_sec_user',
      account: makeAccount({ platformUserId: 'external_sec_user', nickname: 'External Account' }),
      videos: [makeVideo({ videoId: 'external_video_001' })],
      comments: [makeComment({ commentId: 'external_comment_001' })],
    }))

    const result = await collectDouyinCompetitorData(
      { targetUrl: 'https://www.douyin.com/user/external_sec_user', platformUserId: null, count: 50 },
      {
        fetchFromExternalApi,
        fetchFromLocalCrawler,
        apiAdapter,
        hasExternalApi: () => true,
        hasTikHubApiKey: () => true,
      },
    )

    expect(result.collectionSource).toBe('external_api')
    expect(result.fallbackUsed).toBe(false)
    expect(result.platformUserId).toBe('external_sec_user')
    expect(result.account.nickname).toBe('External Account')
    expect(fetchFromExternalApi).toHaveBeenCalledWith({
      targetUrl: 'https://www.douyin.com/user/external_sec_user',
      platformUserId: null,
      count: 50,
    })
    expect(fetchFromLocalCrawler).not.toHaveBeenCalled()
    expect(apiAdapter.fetchAccount).not.toHaveBeenCalled()
  })

  it('uses local browser data first and does not call the API adapter', async () => {
    const apiAdapter = makeAdapter()
    const fetchFromLocalCrawler = vi.fn(async () => ({
      account: makeAccount(),
      videos: [makeVideo()],
      comments: [makeComment()],
    }))

    const result = await collectDouyinCompetitorData(
      { targetUrl: 'https://www.douyin.com/user/sec_user_001', platformUserId: 'sec_user_001', count: 50 },
      { fetchFromLocalCrawler, apiAdapter, hasTikHubApiKey: () => false, hasLocalCrawler: () => true },
    )

    expect(result.collectionSource).toBe('local_browser')
    expect(result.fallbackUsed).toBe(false)
    expect(result.platformUserId).toBe('sec_user_001')
    expect(result.videos).toHaveLength(1)
    expect(fetchFromLocalCrawler).toHaveBeenCalledWith('douyin', 'https://www.douyin.com/user/sec_user_001', 50)
    expect(apiAdapter.fetchAccount).not.toHaveBeenCalled()
    expect(apiAdapter.fetchVideos).not.toHaveBeenCalled()
  })

  it('uses the API adapter directly when TikHub is configured', async () => {
    const apiAdapter = makeAdapter({
      fetchVideoStats: vi.fn(async () => new Map([
        ['api_video_001', { views: 2000, likes: 200, comments: 20, shares: 10, collects: 40 }],
      ])),
    })
    const fetchFromLocalCrawler = vi.fn()

    const result = await collectDouyinCompetitorData(
      { targetUrl: 'https://www.douyin.com/user/api_sec_user', platformUserId: 'api_sec_user', count: 50 },
      { fetchFromLocalCrawler, apiAdapter, hasTikHubApiKey: () => true },
    )

    expect(result.collectionSource).toBe('tikhub_api')
    expect(result.fallbackUsed).toBe(false)
    expect(result.fallbackReason).toBeNull()
    expect(result.account.platformUserId).toBe('api_sec_user')
    expect(result.videos[0]?.views).toBe(2000)
    expect(result.comments[0]?.commentId).toBe('api_comment_001')
    expect(fetchFromLocalCrawler).not.toHaveBeenCalled()
  })

  it('surfaces the local browser error when explicitly enabled and no API fallback is configured', async () => {
    const fetchFromLocalCrawler = vi.fn(async () => {
      throw new Error('local browser failed')
    })

    await expect(collectDouyinCompetitorData(
      { targetUrl: 'https://www.douyin.com/user/sec_user_001', platformUserId: 'sec_user_001', count: 50 },
      {
        fetchFromLocalCrawler,
        apiAdapter: makeAdapter(),
        hasTikHubApiKey: () => false,
        hasLocalCrawler: () => true,
      },
    )).rejects.toThrow('local browser failed')
  })

  it('fails fast when no real collection provider is configured', async () => {
    await expect(collectDouyinCompetitorData(
      { targetUrl: 'https://www.douyin.com/user/sec_user_001', platformUserId: 'sec_user_001', count: 50 },
      {
        fetchFromLocalCrawler: vi.fn(),
        apiAdapter: makeAdapter(),
        hasExternalApi: () => false,
        hasTikHubApiKey: () => false,
        hasLocalCrawler: () => false,
      },
    )).rejects.toThrow('未配置真实对标账号抓取服务')
  })
})
