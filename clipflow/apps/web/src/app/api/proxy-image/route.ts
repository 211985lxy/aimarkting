import { NextRequest, NextResponse } from "next/server"

const ALLOWED_DOMAINS = [
  "douyinpic.com",
  "douyinpics.com",
  "douyincdn.com",
  "douyinstatic.com",
  "byteimg.com",
  "xiaohongshu.com",
  "xhscdn.com",
  "xhslink.com",
]

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024 // 5MB

function isDomainAllowed(hostname: string): boolean {
  return ALLOWED_DOMAINS.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  )
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (!url) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 },
    )
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "Invalid protocol" }, { status: 400 })
  }

  if (!isDomainAllowed(parsed.hostname)) {
    return NextResponse.json({ error: "Domain not allowed" }, { status: 403 })
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        Referer: "",
        "User-Agent":
          "Mozilla/5.0 (compatible; ClipFlow/1.0; +https://clipflow.app)",
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream responded with ${upstream.status}` },
        { status: 502 },
      )
    }

    const contentType = upstream.headers.get("content-type") ?? ""
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "Response is not an image" },
        { status: 422 },
      )
    }

    const contentLength = upstream.headers.get("content-length")
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
      return NextResponse.json(
        { error: "Image exceeds maximum size" },
        { status: 413 },
      )
    }

    const buffer = await upstream.arrayBuffer()

    if (buffer.byteLength > MAX_RESPONSE_SIZE) {
      return NextResponse.json(
        { error: "Image exceeds maximum size" },
        { status: 413 },
      )
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch image"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
