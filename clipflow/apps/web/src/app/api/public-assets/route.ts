import { NextResponse } from "next/server"
import { getPublicVoices, getPublicVirtualmen } from "@/lib/shanjian"

export async function GET() {
  try {
    const [voices, virtualmen] = await Promise.all([getPublicVoices(), getPublicVirtualmen()])

    return NextResponse.json({
      data: {
        voices,
        virtualmen,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch public assets",
      },
      { status: 502 }
    )
  }
}
