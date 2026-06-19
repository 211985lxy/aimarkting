import type { Platform } from './types'

export interface CompetitorPlatformGate {
  supported: boolean
  code?: 'PLATFORM_NOT_OPEN'
  message?: string
}

export function getCompetitorPlatformGate(platform: Platform): CompetitorPlatformGate {
  if (platform === 'douyin') {
    return { supported: true }
  }

  return {
    supported: false,
    code: 'PLATFORM_NOT_OPEN',
    message: '第一版对标账号调查暂时只支持抖音主页链接',
  }
}
