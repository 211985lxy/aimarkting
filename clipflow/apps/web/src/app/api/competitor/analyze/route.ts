import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withUserAuth } from '@/lib/user-auth'
import { parseUrl } from '@/lib/tikhub/url-parser'
import { runCompetitorAnalysisPipeline } from '@/lib/competitor-analysis/pipeline'
import { logger } from '@/lib/logger'

// Pipeline can take up to 5 minutes (scrape + comments + AI)
export const maxDuration = 300

export const POST = withUserAuth(async (request, { user }) => {
  let body: { url?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_URL' }, { status: 400 })
  }

  const rawUrl = typeof body.url === 'string' ? body.url.trim() : ''
  if (!rawUrl) {
    return NextResponse.json({ error: 'INVALID_URL' }, { status: 400 })
  }

  const parsed = parseUrl(rawUrl)
  if (!parsed) {
    return NextResponse.json({ error: 'UNSUPPORTED_PLATFORM' }, { status: 400 })
  }

  // bilibili and kuaishou are deferred to Phase 2
  if (parsed.platform === 'bilibili' || parsed.platform === 'kuaishou') {
    return NextResponse.json({ error: 'UNSUPPORTED_PLATFORM' }, { status: 400 })
  }

  // Create the analysis record in pending state
  const analysis = await prisma.competitorAnalysis.create({
    data: {
      userId: user.id,
      targetUrl: rawUrl,
      platform: parsed.platform,
      platformUserId: parsed.rawUserId ?? null,
      status: 'pending',
      currentStep: 'pending',
    },
  })

  // Trigger pipeline non-blocking (same pattern as marketing-analysis.ts)
  runCompetitorAnalysisPipeline(analysis.id).catch((err: unknown) => {
    logger.error({ err, analysisId: analysis.id }, 'Competitor analysis pipeline failed')
  })

  return NextResponse.json({
    id: analysis.id,
    status: 'pending',
    platform: analysis.platform,
  })
})
