import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ensureKnowledgeEmbedding } from "@/lib/llm/embeddings"

const SYNC_TOKEN = process.env.OBSIDIAN_SYNC_TOKEN || "mingyuan-obsidian-sync-secret"

interface ObsidianSyncEntry {
  id: string // 由 CLI 根据文件相对路径或者内容哈希生成的唯一 ID，如 obsidian_xxxx
  title: string
  content: string
  category: "boss_experience" | "product_usp" | "customer_pain" | "project_case" | "customer_qa"
  tags: string[]
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("x-obsidian-token")

  if (!authHeader || authHeader !== SYNC_TOKEN) {
    if (SYNC_TOKEN === "mingyuan-obsidian-sync-secret") {
      console.warn(
        "Obsidian Sync API warning: Using default insecure SYNC_TOKEN. Please set OBSIDIAN_SYNC_TOKEN in environment variables."
      )
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { entries, userId } = body as { entries: ObsidianSyncEntry[]; userId?: string }

    if (!Array.isArray(entries)) {
      return NextResponse.json({ error: "Invalid payload: entries must be an array" }, { status: 400 })
    }

    let targetUserId = userId

    // 如果未显式提供 userId，则兜底关联系统中的第一个 User
    if (!targetUserId) {
      const firstUser = await prisma.user.findFirst({
        orderBy: { createdAt: "asc" },
      })
      if (!firstUser) {
        return NextResponse.json({ error: "No user found in the system to bind knowledge" }, { status: 404 })
      }
      targetUserId = firstUser.id
    } else {
      // 校验该 userId 是否真实存在
      const userExists = await prisma.user.findUnique({
        where: { id: targetUserId },
      })
      if (!userExists) {
        return NextResponse.json({ error: `User with ID ${targetUserId} does not exist` }, { status: 404 })
      }
    }

    const results = []

    for (const entry of entries) {
      if (!entry.id || !entry.title || !entry.content) {
        continue
      }

      // 保证分类合法，不合法时默认归入 boss_experience
      const validCategories = [
        "boss_experience",
        "product_usp",
        "customer_pain",
        "project_case",
        "customer_qa",
      ]
      const finalCategory = validCategories.includes(entry.category)
        ? entry.category
        : "boss_experience"

      const upserted = await prisma.knowledgeEntry.upsert({
        where: { id: entry.id },
        update: {
          title: entry.title,
          content: entry.content,
          category: finalCategory,
          tags: entry.tags,
          sourceType: "obsidian",
          status: "active",
          updatedAt: new Date(),
        },
        create: {
          id: entry.id,
          userId: targetUserId,
          title: entry.title,
          content: entry.content,
          category: finalCategory,
          tags: entry.tags,
          sourceType: "obsidian",
          status: "active",
        },
      })
      results.push({ id: upserted.id, title: upserted.title })
    }

    // Fire-and-forget: generate embeddings for synced entries
    for (const result of results) {
      ensureKnowledgeEmbedding(result.id).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      syncedCount: results.length,
      syncedEntries: results,
    })
  } catch (error) {
    console.error("Obsidian sync error:", error)
    return NextResponse.json(
      { error: "Internal Server Error", details: (error as Error).message },
      { status: 500 }
    )
  }
}
