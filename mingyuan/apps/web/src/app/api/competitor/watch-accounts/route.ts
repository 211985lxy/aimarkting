import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withUserAuth } from "@/lib/user-auth"
import { checkUrlType, parseUrl } from "@/lib/tikhub/url-parser"
import { getCompetitorPlatformGate } from "@/lib/competitor-analysis/platform-scope"

const MAX_WATCH_ACCOUNTS = 10

export const GET = withUserAuth(async (_request, { user }) => {
  const accounts = await prisma.watchAccount.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ items: accounts })
})

export const POST = withUserAuth(async (request, { user }) => {
  let body: { url?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 })
  }

  const rawUrl = typeof body.url === "string" ? body.url.trim() : ""
  if (!rawUrl) {
    return NextResponse.json({ error: "请输入抖音主页链接" }, { status: 400 })
  }

  const urlTypeError = checkUrlType(rawUrl)
  if (urlTypeError) {
    return NextResponse.json({ error: urlTypeError }, { status: 400 })
  }

  // Parse and validate URL
  const parsed = parseUrl(rawUrl)
  if (!parsed) {
    return NextResponse.json({ error: "不支持的平台" }, { status: 400 })
  }

  const platformGate = getCompetitorPlatformGate(parsed.platform)
  if (!platformGate.supported) {
    return NextResponse.json({
      error: platformGate.message ?? "第一版只支持抖音主页链接",
    }, { status: 400 })
  }

  // Check if already exists
  const existing = await prisma.watchAccount.findFirst({
    where: { userId: user.id, targetUrl: parsed.pureUrl },
  })
  if (existing) {
    return NextResponse.json({ error: "该账号已在监控列表中" }, { status: 409 })
  }

  // Count existing accounts
  const count = await prisma.watchAccount.count({ where: { userId: user.id } })
  if (count >= MAX_WATCH_ACCOUNTS) {
    return NextResponse.json({ error: `最多监控 ${MAX_WATCH_ACCOUNTS} 个账号` }, { status: 400 })
  }

  const account = await prisma.watchAccount.create({
    data: {
      userId: user.id,
      targetUrl: parsed.pureUrl,
      platform: parsed.platform,
    },
  })

  return NextResponse.json(account, { status: 201 })
})
