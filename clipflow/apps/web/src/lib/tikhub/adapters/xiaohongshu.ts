import { tikhubGet } from '../client'
import type {
  PlatformAdapter,
  NormalizedAccount,
  NormalizedVideo,
  NormalizedComment,
  VideoStats,
} from '../types'

// ─── Internal Wire Types ─────────────────────────────────

interface XhsResolveUrlData {
  user_id: string
  xsec_token: string
}

interface XhsTagItem {
  name: string
}

interface XhsUserInfoData {
  user_id: string
  nickname?: string
  avatar?: string
  desc?: string
  follows?: string | number
  fans?: string | number
  interaction?: string | number
  tag_list?: XhsTagItem[]
}

interface XhsCoverItem {
  url?: string
  url_default?: string
}

interface XhsInteractInfo {
  liked_count?: number
  comment_count?: number
  share_count?: number
  collected_count?: number
}

interface XhsNoteItem {
  note_id: string
  display_title?: string
  title?: string
  cover?: XhsCoverItem
  time: number
  interact_info?: XhsInteractInfo
}

interface XhsNotesPageData {
  notes: XhsNoteItem[]
  cursor: string
  has_more: boolean
}

interface XhsFeedNoteInteractInfo {
  viewed_count?: number
  liked_count?: number
  comment_count?: number
  shared_count?: number
  collected_count?: number
}

interface XhsFeedNoteItem {
  note_id: string
  interact_info?: XhsFeedNoteInteractInfo
}

interface XhsFeedNotesData {
  notes: XhsFeedNoteItem[]
}

interface XhsCommentItem {
  id: string
  content?: string
  like_count?: number
  create_time: number
  pinned?: boolean
}

interface XhsCommentsData {
  comments: XhsCommentItem[]
}

// ─── XiaohongshuAdapter ──────────────────────────────────

export class XiaohongshuAdapter implements PlatformAdapter {
  /**
   * Resolve a Xiaohongshu profile URL to a user_id.
   * Calls GET /api/v1/xiaohongshu/app/get_user_id_and_xsec_token
   */
  async resolveUrl(url: string): Promise<string> {
    const data = await tikhubGet<XhsResolveUrlData>(
      '/api/v1/xiaohongshu/app/get_user_id_and_xsec_token',
      { url },
    )
    return data.user_id
  }

  /**
   * Fetch account profile and normalize to NormalizedAccount.
   * Calls GET /api/v1/xiaohongshu/app_v2/get_user_info
   */
  async fetchAccount(userId: string): Promise<NormalizedAccount> {
    const data = await tikhubGet<XhsUserInfoData>(
      '/api/v1/xiaohongshu/app_v2/get_user_info',
      { user_id: userId },
    )

    return {
      platformUserId: data.user_id,
      nickname: data.nickname ?? '',
      avatar: data.avatar ?? '',
      signature: data.desc ?? '',
      followerCount: Number(data.fans) || 0,
      followingCount: Number(data.follows) || 0,
      totalLikes: Number(data.interaction) || 0,
      videoCount: 0, // XHS does not expose note count in profile API
      isVerified: Array.isArray(data.tag_list) && data.tag_list.length > 0,
      verifyInfo: data.tag_list?.[0]?.name ?? '',
    }
  }

  /**
   * Fetch published notes for a user, cursor-paginated up to count.
   * Calls GET /api/v1/xiaohongshu/app_v2/get_user_posted_notes
   */
  async fetchVideos(userId: string, count: number): Promise<NormalizedVideo[]> {
    const results: NormalizedVideo[] = []
    let cursor = ''

    while (results.length < count) {
      const data = await tikhubGet<XhsNotesPageData>(
        '/api/v1/xiaohongshu/app_v2/get_user_posted_notes',
        { user_id: userId, cursor, num: 20 },
      )

      // Guard against empty page with has_more: true (infinite loop prevention)
      if (!data.notes || data.notes.length === 0) break

      for (const item of data.notes) {
        results.push({
          videoId: item.note_id,
          title: item.display_title ?? item.title ?? '',
          coverUrl: item.cover?.url ?? item.cover?.url_default ?? '',
          videoUrl: '', // XHS notes API does not return video URL directly
          createTime: item.time,
          duration: 0, // XHS notes API does not include duration
          views: 0, // Notes list API does not include view count; fetchVideoStats will fill this
          likes: item.interact_info?.liked_count ?? 0,
          comments: item.interact_info?.comment_count ?? 0,
          shares: item.interact_info?.share_count ?? 0,
          collects: item.interact_info?.collected_count ?? 0,
        })
      }

      if (!data.has_more || results.length >= count) {
        break
      }

      cursor = data.cursor
    }

    return results.slice(0, count)
  }

  /**
   * Fetch note stats for a batch of note IDs.
   * Calls GET /api/v1/xiaohongshu/web_v2/fetch_feed_notes_v2 in batches of 20.
   */
  async fetchVideoStats(videoIds: string[]): Promise<Map<string, VideoStats>> {
    const statsMap = new Map<string, VideoStats>()

    if (videoIds.length === 0) {
      return statsMap
    }

    const BATCH_SIZE = 20
    for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
      const batch = videoIds.slice(i, i + BATCH_SIZE)
      const data = await tikhubGet<XhsFeedNotesData>(
        '/api/v1/xiaohongshu/web_v2/fetch_feed_notes_v2',
        { note_ids: batch.join(',') },
      )

      for (const item of data.notes) {
        statsMap.set(item.note_id, {
          views: item.interact_info?.viewed_count ?? 0,
          likes: item.interact_info?.liked_count ?? 0,
          comments: item.interact_info?.comment_count ?? 0,
          shares: item.interact_info?.shared_count ?? 0,
          collects: item.interact_info?.collected_count ?? 0,
        })
      }
    }

    return statsMap
  }

  /**
   * Fetch comments for a note (single page).
   * Calls GET /api/v1/xiaohongshu/app_v2/get_note_comments
   */
  async fetchComments(videoId: string, count: number): Promise<NormalizedComment[]> {
    const data = await tikhubGet<XhsCommentsData>(
      '/api/v1/xiaohongshu/app_v2/get_note_comments',
      { note_id: videoId, cursor: '' },
    )

    const results: NormalizedComment[] = data.comments.map((item) => ({
      commentId: item.id,
      text: item.content ?? '',
      likes: item.like_count ?? 0,
      createTime: item.create_time,
      isTop: item.pinned === true,
    }))

    return results.slice(0, count)
  }
}
