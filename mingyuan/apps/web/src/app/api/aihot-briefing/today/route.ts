import { NextResponse } from "next/server"
import { getTodayAiHotBriefing } from "@/lib/aihot-briefing"

export async function GET() {
  try {
    const briefing = await getTodayAiHotBriefing()
    return NextResponse.json({ data: briefing })
  } catch (error) {
    console.error("[aihot-briefing/today] failed:", error)
    return NextResponse.json(
      { error: "AI HOT 简报暂时不可用，请稍后重试" },
      { status: 502 }
    )
  }
}
