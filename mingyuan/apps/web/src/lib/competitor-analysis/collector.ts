import { DouyinAdapter } from '@/lib/tikhub/adapters'
import {
  fetchFromExternalDouyinApi,
  hasExternalDouyinApi,
} from './external-douyin-api'
import { fetchFromLocalCrawler } from './local-crawler'
import type {
  NormalizedAccount,
  NormalizedComment,
  NormalizedVideo,
  PlatformAdapter,
  VideoStats,
} from '@/lib/tikhub/types'

export type CompetitorCollectionSource = 'external_api' | 'local_browser' | 'tikhub_api'

export interface CompetitorCollectionResult {
  platformUserId: string
  account: NormalizedAccount
  videos: NormalizedVideo[]
  comments: NormalizedComment[]
  collectionSource: CompetitorCollectionSource
  fallbackUsed: boolean
  fallbackReason: string | null
}

interface CollectDouyinInput {
  targetUrl: string
  platformUserId: string | null
  count?: number
}

interface CollectDouyinDeps {
  fetchFromLocalCrawler?: typeof fetchFromLocalCrawler
  fetchFromExternalApi?: typeof fetchFromExternalDouyinApi
  apiAdapter?: PlatformAdapter
  hasExternalApi?: () => boolean
  hasTikHubApiKey?: () => boolean
  hasLocalCrawler?: () => boolean
}

export async function collectDouyinCompetitorData(
  input: CollectDouyinInput,
  deps: CollectDouyinDeps = {},
): Promise<CompetitorCollectionResult> {
  const count = input.count ?? 50
  const externalApi = deps.fetchFromExternalApi ?? fetchFromExternalDouyinApi
  const canUseExternalApi = deps.hasExternalApi ?? hasExternalDouyinApi
  const localCrawler = deps.fetchFromLocalCrawler ?? fetchFromLocalCrawler
  const apiAdapter = deps.apiAdapter ?? new DouyinAdapter({ localFallback: false })
  const hasTikHubApiKey = deps.hasTikHubApiKey ?? (() => Boolean(process.env.TIKHUB_API_KEY))
  const hasLocalCrawler = deps.hasLocalCrawler ?? (() => process.env.LOCAL_CRAWLER_ENABLED === 'true')

  if (canUseExternalApi()) {
    const external = await externalApi({
      targetUrl: input.targetUrl,
      platformUserId: input.platformUserId,
      count,
    })
    return {
      platformUserId: external.platformUserId,
      account: external.account,
      videos: external.videos.slice(0, count),
      comments: external.comments,
      collectionSource: 'external_api',
      fallbackUsed: false,
      fallbackReason: null,
    }
  }

  if (hasTikHubApiKey()) {
    return collectFromApiAdapter(apiAdapter, input, count, false, null)
  }

  if (hasLocalCrawler()) {
    try {
      const local = await localCrawler('douyin', input.targetUrl, count)
      return {
        platformUserId: local.account.platformUserId || input.platformUserId || '',
        account: local.account,
        videos: local.videos.slice(0, count),
        comments: local.comments,
        collectionSource: 'local_browser',
        fallbackUsed: false,
        fallbackReason: null,
      }
    } catch (err) {
      const fallbackReason = errorMessage(err)

      if (!hasTikHubApiKey()) {
        throw err
      }

      return collectFromApiAdapter(apiAdapter, input, count, true, fallbackReason)
    }
  }

  throw new Error('未配置真实对标账号抓取服务：请配置 COMPETITOR_DOUYIN_API_URL 或 TIKHUB_API_KEY。本地浏览器爬虫仅用于调试，可设置 LOCAL_CRAWLER_ENABLED=true。')
}

async function collectFromApiAdapter(
  apiAdapter: PlatformAdapter,
  input: CollectDouyinInput,
  count: number,
  fallbackUsed: boolean,
  fallbackReason: string | null,
): Promise<CompetitorCollectionResult> {
  const platformUserId = input.platformUserId ?? await apiAdapter.resolveUrl(input.targetUrl)
  const [account, videos] = await Promise.all([
    apiAdapter.fetchAccount(platformUserId),
    apiAdapter.fetchVideos(platformUserId, count),
  ])

  const videosWithStats = await mergeVideoStats(apiAdapter, videos)
  const comments = await fetchTopVideoComments(apiAdapter, videosWithStats)

  return {
    platformUserId,
    account,
    videos: videosWithStats,
    comments,
    collectionSource: 'tikhub_api',
    fallbackUsed,
    fallbackReason,
  }
}

async function mergeVideoStats(
  apiAdapter: PlatformAdapter,
  videos: NormalizedVideo[],
): Promise<NormalizedVideo[]> {
  const videoIds = videos.map(v => v.videoId)
  if (videoIds.length === 0) {
    return videos
  }

  let statsMap = new Map<string, VideoStats>()
  try {
    statsMap = await apiAdapter.fetchVideoStats(videoIds)
  } catch {
    return videos
  }

  return videos.map(v => {
    const s = statsMap.get(v.videoId)
    if (!s) return v
    return {
      ...v,
      views: s.views,
      likes: s.likes,
      comments: s.comments,
      shares: s.shares,
      collects: s.collects,
    }
  })
}

async function fetchTopVideoComments(
  apiAdapter: PlatformAdapter,
  videos: NormalizedVideo[],
): Promise<NormalizedComment[]> {
  const top5 = [...videos]
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 5)

  const comments: NormalizedComment[] = []
  for (const video of top5) {
    try {
      comments.push(...await apiAdapter.fetchComments(video.videoId, 20))
    } catch {
      // Comment collection is helpful but non-fatal for the report.
    }
  }

  return comments
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
