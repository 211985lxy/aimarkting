import { tikhubGet } from '../client'
import type {
  PlatformAdapter,
  NormalizedAccount,
  NormalizedVideo,
  NormalizedComment,
  VideoStats,
} from '../types'

// ─── Internal Wire Types (not exported) ─────────────────

interface DouyinSecUserIdData {
  sec_user_id: string
}

interface DouyinAvatarThumb {
  url_list: string[]
}

interface DouyinUser {
  uid: string
  nickname: string
  avatar_thumb: DouyinAvatarThumb
  signature?: string
  follower_count?: number
  following_count?: number
  total_favorited?: number | string
  aweme_count?: number
  custom_verify?: string
  enterprise_verify_reason?: string
}

interface DouyinProfileData {
  user: DouyinUser
}

interface DouyinVideoAddress {
  url_list?: string[]
}

interface DouyinVideoCover {
  url_list?: string[]
}

interface DouyinVideoMedia {
  cover?: DouyinVideoCover
  play_addr?: DouyinVideoAddress
  duration?: number
}

interface DouyinVideoStatistics {
  play_count?: number
  digg_count?: number
  comment_count?: number
  share_count?: number
  collect_count?: number
}

interface DouyinAwemeItem {
  aweme_id: string
  desc?: string
  video?: DouyinVideoMedia
  create_time: number
  statistics?: DouyinVideoStatistics
}

interface DouyinPostVideosData {
  aweme_list: DouyinAwemeItem[]
  max_cursor: number
  has_more: 0 | 1
}

interface DouyinVideoStatItem {
  aweme_id: string
  statistics: DouyinVideoStatistics
}

interface DouyinMultiVideoStatsData {
  aweme_details: DouyinVideoStatItem[]
}

interface DouyinCommentItem {
  cid: string
  text?: string
  digg_count?: number
  create_time: number
  stick_position?: number
}

interface DouyinCommentsData {
  comments: DouyinCommentItem[]
}

// ─── DouyinAdapter ───────────────────────────────────────

export class DouyinAdapter implements PlatformAdapter {
  /**
   * Resolves any Douyin URL to its canonical sec_user_id.
   * Always calls the TikHub resolver endpoint regardless of URL form.
   */
  async resolveUrl(url: string): Promise<string> {
    const data = await tikhubGet<DouyinSecUserIdData>(
      '/api/v1/douyin/web/get_sec_user_id',
      { url },
    )
    return data.sec_user_id
  }

  /**
   * Fetches the Douyin user profile and normalizes it to NormalizedAccount.
   */
  async fetchAccount(userId: string): Promise<NormalizedAccount> {
    const data = await tikhubGet<DouyinProfileData>(
      '/api/v1/douyin/app/v3/handler_user_profile',
      { sec_user_id: userId },
    )

    const user = data.user

    return {
      platformUserId: user.uid,
      nickname: user.nickname,
      avatar: user.avatar_thumb?.url_list?.[0] ?? '',
      signature: user.signature ?? '',
      followerCount: user.follower_count ?? 0,
      followingCount: user.following_count ?? 0,
      totalLikes: Number(user.total_favorited) || 0,
      videoCount: user.aweme_count ?? 0,
      isVerified: Boolean(user.custom_verify || user.enterprise_verify_reason),
      verifyInfo: user.custom_verify ?? user.enterprise_verify_reason ?? '',
    }
  }

  /**
   * Fetches up to `count` videos for the given sec_user_id using cursor-based
   * pagination. Stops when results >= count or the API signals no more pages.
   */
  async fetchVideos(userId: string, count: number): Promise<NormalizedVideo[]> {
    const PAGE_SIZE = 20
    const results: NormalizedVideo[] = []
    let maxCursor = 0
    let hasMore = 1 as 0 | 1

    while (results.length < count && hasMore === 1) {
      const data = await tikhubGet<DouyinPostVideosData>(
        '/api/v1/douyin/app/v3/fetch_user_post_videos',
        {
          sec_user_id: userId,
          count: PAGE_SIZE,
          max_cursor: maxCursor,
        },
      )

      const items = data.aweme_list ?? []

      for (const item of items) {
        results.push({
          videoId: item.aweme_id,
          title: item.desc ?? '',
          coverUrl: item.video?.cover?.url_list?.[0] ?? '',
          videoUrl: item.video?.play_addr?.url_list?.[0] ?? '',
          createTime: item.create_time,
          duration: Math.round((item.video?.duration ?? 0) / 1000),
          views: item.statistics?.play_count ?? 0,
          likes: item.statistics?.digg_count ?? 0,
          comments: item.statistics?.comment_count ?? 0,
          shares: item.statistics?.share_count ?? 0,
          collects: item.statistics?.collect_count ?? 0,
        })
      }

      hasMore = data.has_more
      maxCursor = data.max_cursor
    }

    return results.slice(0, count)
  }

  /**
   * Fetches batch video statistics. Splits into chunks of 50 IDs per request.
   * Returns a Map keyed by video ID.
   */
  async fetchVideoStats(videoIds: string[]): Promise<Map<string, VideoStats>> {
    const statsMap = new Map<string, VideoStats>()

    if (videoIds.length === 0) {
      return statsMap
    }

    const BATCH_SIZE = 50
    const chunks: string[][] = []

    for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
      chunks.push(videoIds.slice(i, i + BATCH_SIZE))
    }

    for (const chunk of chunks) {
      const data = await tikhubGet<DouyinMultiVideoStatsData>(
        '/api/v1/douyin/app/v3/fetch_multi_video_statistics',
        { aweme_ids: chunk.join(',') },
      )

      for (const item of data.aweme_details ?? []) {
        statsMap.set(item.aweme_id, {
          views: item.statistics?.play_count ?? 0,
          likes: item.statistics?.digg_count ?? 0,
          comments: item.statistics?.comment_count ?? 0,
          shares: item.statistics?.share_count ?? 0,
          collects: item.statistics?.collect_count ?? 0,
        })
      }
    }

    return statsMap
  }

  /**
   * Fetches up to `count` comments for a video (single page, max 20).
   */
  async fetchComments(videoId: string, count: number): Promise<NormalizedComment[]> {
    const data = await tikhubGet<DouyinCommentsData>(
      '/api/v1/douyin/web/fetch_video_comments',
      {
        aweme_id: videoId,
        count: Math.min(count, 20),
        cursor: 0,
      },
    )

    const comments = data.comments ?? []

    return comments
      .map(
        (item): NormalizedComment => ({
          commentId: item.cid,
          text: item.text ?? '',
          likes: item.digg_count ?? 0,
          createTime: item.create_time,
          isTop: (item.stick_position ?? 0) > 0,
        }),
      )
      .slice(0, count)
  }
}
