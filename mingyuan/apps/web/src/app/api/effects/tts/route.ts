import { NextResponse } from "next/server"
import { withUserAuth } from "@/lib/user-auth"
import { textToSpeech } from "@/lib/shanjian"

// ─── POST /api/effects/tts ─────────────────────────────

export const POST = withUserAuth(async (request) => {
  const { text, speakerId, language, speedRatio, volume, codec } =
    await request.json()

  if (!text || !speakerId) {
    return NextResponse.json(
      { error: "text and speakerId are required" },
      { status: 400 }
    )
  }

  const taskId = await textToSpeech({
    text,
    speakerId,
    ...(language && { language }),
    ...(speedRatio !== undefined && { speedRatio }),
    ...(volume !== undefined && { volume }),
    ...(codec && { codec }),
  })

  return NextResponse.json({ data: { taskId } }, { status: 201 })
})
