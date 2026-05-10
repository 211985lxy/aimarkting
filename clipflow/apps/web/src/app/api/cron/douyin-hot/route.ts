import { NextRequest, NextResponse } from "next/server"
import { validateCronSecret } from "@/lib/admin-auth"
import { fetchAndStore } from "@/lib/douyin-hot"

export const runtime = "nodejs"
export const maxDuration = 30

export async function GET(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await fetchAndStore()
  return NextResponse.json({ data: result })
}
