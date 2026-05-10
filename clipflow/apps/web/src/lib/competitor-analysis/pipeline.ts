import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getAdapter } from '@/lib/tikhub/adapters'
import type { NormalizedVideo } from '@/lib/tikhub/types'
import { calculateMetrics } from './metrics'
import { analyzeCompetitor } from './analyzer'

/**
 * Runs the full competitor analysis pipeline for a given analysisId.
 *
 * Flow: pending → scraping → enriching → analyzing → completed (or failed)
 *
 * This function is designed to be triggered WITHOUT await from the API route:
 *   runCompetitorAnalysisPipeline(id).catch(err => logger.error({ err }, '...'))
 *
 * All DB status transitions are atomic updates. On any error, the record is
 * marked as 'failed' with the error message stored.
 */
export async function runCompetitorAnalysisPipeline(analysisId: string): Promise<void> {
  const log = logger.child({ analysisId })

  try {
    const analysis = await prisma.competitorAnalysis.findUniqueOrThrow({
      where: { id: analysisId },
    })

    const adapter = getAdapter(analysis.platform as 'douyin' | 'xiaohongshu')

    // ── Step 1: SCRAPE ────────────────────────────────────────
    await updateStatus(analysisId, 'scraping')
    log.info('Step 1: Scraping account data')

    const platformUserId = analysis.platformUserId
      ?? await adapter.resolveUrl(analysis.targetUrl)

    const [account, videos] = await Promise.all([
      adapter.fetchAccount(platformUserId),
      adapter.fetchVideos(platformUserId, 50),
    ])

    // Batch-fetch stats and merge into videos (non-fatal — gracefully degrade if stats API fails)
    const videoIds = videos.map(v => v.videoId)
    let statsMap = new Map<string, import('@/lib/tikhub/types').VideoStats>()
    try {
      statsMap = await adapter.fetchVideoStats(videoIds)
    } catch (statsErr) {
      log.warn({ statsErr }, 'fetchVideoStats failed — proceeding with video list stats only')
    }
    const videosWithStats: NormalizedVideo[] = videos.map(v => {
      const s = statsMap.get(v.videoId)
      if (!s) return v
      return { ...v, views: s.views, likes: s.likes, comments: s.comments, shares: s.shares, collects: s.collects }
    })

    await prisma.competitorAnalysis.update({
      where: { id: analysisId },
      data: {
        platformUserId,
        rawAccountData: account as never,
        rawVideoData: videosWithStats as never,
        accountName: account.nickname,
        accountAvatar: account.avatar,
        followerCount: account.followerCount,
        videoCount: account.videoCount,
      },
    })

    // ── Step 2: ENRICH ────────────────────────────────────────
    await updateStatus(analysisId, 'enriching')
    log.info('Step 2: Enriching with comments + metrics')

    // Sample comments from top 5 videos by likes
    const top5 = [...videosWithStats]
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 5)

    // Fetch comments per video (non-fatal per video — skip failures)
    const allComments: Array<import('@/lib/tikhub/types').NormalizedComment & { videoId: string }> = []
    for (const v of top5) {
      try {
        const comments = await adapter.fetchComments(v.videoId, 20)
        allComments.push(...comments.map(c => ({ ...c, videoId: v.videoId })))
      } catch (commentErr) {
        log.warn({ commentErr, videoId: v.videoId }, 'fetchComments failed — skipping')
      }
    }

    const metrics = calculateMetrics(account, videosWithStats)

    await prisma.competitorAnalysis.update({
      where: { id: analysisId },
      data: {
        rawCommentData: allComments as never,
        metricsData: metrics as never,
      },
    })

    // ── Step 3: ANALYZE ───────────────────────────────────────
    await updateStatus(analysisId, 'analyzing')
    log.info('Step 3: AI analysis')

    const result = await analyzeCompetitor(
      account,
      videosWithStats,
      allComments,
      metrics,
    )

    await prisma.competitorAnalysis.update({
      where: { id: analysisId },
      data: {
        status: 'completed',
        currentStep: 'completed',
        analysisResult: result as never,
        overallScore: result.scores.overall,
        completedAt: new Date(),
      },
    })

    log.info({ overallScore: result.scores.overall }, 'Pipeline completed')

  } catch (err) {
    log.error({ err }, 'Pipeline failed')
    // Best-effort: update status to failed. Ignore secondary DB errors.
    await prisma.competitorAnalysis.update({
      where: { id: analysisId },
      data: {
        status: 'failed',
        currentStep: 'failed',
        errorMessage: sanitizeErrorForUser(err),
      },
    }).catch((dbErr: unknown) => {
      log.error({ dbErr }, 'Failed to write error status to DB')
    })
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function updateStatus(id: string, status: string): Promise<void> {
  await prisma.competitorAnalysis.update({
    where: { id },
    data: { status, currentStep: status },
  })
}

function sanitizeErrorForUser(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  // User-safe messages from analyzer pass through
  if (msg.startsWith('AI 分析')) return msg
  // Classify common errors into user-friendly messages
  if (msg.includes('TikHub') || msg.includes('HTTP 4') || msg.includes('HTTP 5')) {
    return '数据采集失败，请稍后重试'
  }
  if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('504')) {
    return 'AI 分析超时，请稍后重试'
  }
  return '分析过程中发生错误，请重试'
}
