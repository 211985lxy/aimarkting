import { NextResponse } from "next/server"
import { getLatestHotList } from "@/lib/douyin-hot"
import { matchTemplatesForHotTopic, matchSeasonalTemplates } from "@/lib/template-matching"

export async function GET() {
  const topics = await getLatestHotList()

  // Enrich with template recommendations
  const seasonalTemplates = await matchSeasonalTemplates()
  const enriched = await Promise.all(
    topics.map(async (topic) => {
      const keywordMatches = await matchTemplatesForHotTopic(topic.title)
      const combined = [...keywordMatches]
      for (const st of seasonalTemplates) {
        if (!combined.find((c) => c.id === st.id)) combined.push(st)
      }
      return {
        ...topic,
        recommendedTemplates: combined.slice(0, 3),
      }
    })
  )

  return NextResponse.json(
    { data: { topics: enriched, updatedAt: new Date().toISOString() } },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    }
  )
}
