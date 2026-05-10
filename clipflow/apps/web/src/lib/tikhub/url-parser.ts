import type { Platform } from './types'

export interface ParsedUrl {
  platform: Platform
  rawUserId: string | null // extracted from URL path; may need resolveUrl() for final platformUserId
}

/**
 * Detects which social platform a URL belongs to.
 *
 * Supported platforms (MVP):
 *   - douyin:      douyin.com, iesdouyin.com, v.douyin.com
 *   - xiaohongshu: xiaohongshu.com, xhslink.com, xhs.cn
 *
 * Deferred (Phase 2):
 *   - bilibili, kuaishou
 *
 * Never throws — returns null for any unrecognised or unparseable input.
 */
export function detectPlatform(url: string): Platform | null {
  try {
    const lower = url.toLowerCase()

    if (lower.includes('douyin.com') || lower.includes('iesdouyin.com')) {
      return 'douyin'
    }

    if (
      lower.includes('xiaohongshu.com') ||
      lower.includes('xhslink.com') ||
      lower.includes('xhs.cn')
    ) {
      return 'xiaohongshu'
    }

    return null
  } catch {
    return null
  }
}

/**
 * Extracts the raw user identifier from the URL path segment.
 *
 * - Douyin:      /user/<userId>
 * - Xiaohongshu: /user/profile/<userId>
 *
 * Returns null if the expected path structure is absent or the URL is
 * unparseable. Never throws.
 */
export function extractUserId(url: string): string | null {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean)

    // Douyin: /user/<userId>
    const userIdx = segments.indexOf('user')
    if (userIdx !== -1) {
      // XHS: /user/profile/<userId>
      if (segments[userIdx + 1] === 'profile') {
        const userId = segments[userIdx + 2]
        return userId ?? null
      }
      // Douyin: /user/<userId>
      const userId = segments[userIdx + 1]
      return userId ?? null
    }

    return null
  } catch {
    return null
  }
}

/**
 * Parses a URL and returns both the detected platform and the raw user
 * identifier extracted from the URL path. Returns null if the platform
 * cannot be determined.
 */
export function parseUrl(url: string): ParsedUrl | null {
  const platform = detectPlatform(url)
  if (platform === null) {
    return null
  }

  const rawUserId = extractUserId(url)
  return { platform, rawUserId }
}
