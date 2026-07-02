import { createHash } from "crypto"
import OpenAI from "openai"
import { prisma } from "@/lib/prisma"

// ─── Config ──────────────────────────────────────────────────────────────────

export interface EmbeddingConfig {
  enabled: boolean
  baseURL: string
  apiKey: string
  model: string
  dimensions: number
}

function readConfig(): EmbeddingConfig {
  const enabled = process.env.EMBEDDING_ENABLED === "true"
  const baseURL =
    process.env.EMBEDDING_BASE_URL || "https://api.siliconflow.cn/v1"
  const apiKey =
    process.env.EMBEDDING_API_KEY || process.env.SILICONFLOW_API_KEY || ""
  const model = process.env.EMBEDDING_MODEL || "BAAI/bge-large-zh-v1.5"
  const dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || "1024", 10)

  return { enabled, baseURL, apiKey, model, dimensions }
}

// ─── OpenAI-compatible embedding client ─────────────────────────────────────

let _client: OpenAI | null = null

function getClient(): OpenAI | null {
  const config = readConfig()
  if (!config.enabled || !config.apiKey) return null

  if (!_client) {
    _client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: 30000,
    })
  }
  return _client
}

// ─── Vector math ────────────────────────────────────────────────────────────

/** Compute cosine similarity between two vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, nA = 0, nB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    nA += a[i] * a[i]
    nB += b[i] * b[i]
  }
  const denom = Math.sqrt(nA) * Math.sqrt(nB)
  return denom === 0 ? 0 : dot / denom
}

/** L2-normalize a vector in place (modifies the array). */
export function normalizeVector(v: number[]): number[] {
  let norm = 0
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i]
  norm = Math.sqrt(norm)
  if (norm === 0) return v
  for (let i = 0; i < v.length; i++) v[i] /= norm
  return v
}

// ─── Content hash ───────────────────────────────────────────────────────────

export function computeContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 64)
}

// ─── Embedding generation ───────────────────────────────────────────────────

export interface EmbeddingResult {
  vector: number[]
  model: string
  dimensions: number
  tokensUsed: number
}

/**
 * Generate an embedding vector for the given text.
 * Returns null if embedding service is unavailable.
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult | null> {
  const client = getClient()
  if (!client) return null

  const config = readConfig()

  try {
    const response = await client.embeddings.create({
      model: config.model,
      input: text.slice(0, 8000), // safety truncation
      // 部分模型（如 OpenAI ada-002）支持 dimensions 参数，部分（如 BGE）不支持
      // 仅当模型名以 text-embedding 开头时传递 dimensions
      ...(config.model.startsWith("text-embedding") ? { dimensions: config.dimensions } : {}),
    })

    const data = response.data[0]
    if (!data) return null

    return {
      vector: data.embedding,
      model: response.model,
      dimensions: config.dimensions,
      tokensUsed: response.usage?.prompt_tokens ?? 0,
    }
  } catch (error) {
    console.warn("[embedding] generation failed:", error)
    return null
  }
}

// ─── Database operations ────────────────────────────────────────────────────

/**
 * Ensure a KnowledgeEmbedding row exists for the given knowledge entry.
 * - Skips if the content hasn't changed (contentHash matches).
 * - Gracefully handles missing entry, disabled embedding.
 */
export async function ensureKnowledgeEmbedding(entryId: string): Promise<void> {
  const config = readConfig()
  if (!config.enabled) return

  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id: entryId },
    select: { id: true, content: true, title: true },
  })
  if (!entry) return

  const contentHash = computeContentHash(entry.content)

  // Check existing embedding — skip if content hasn't changed
  const existing = await prisma.knowledgeEmbedding.findUnique({
    where: { entryId },
    select: { contentHash: true, status: true },
  })
  if (existing && existing.contentHash === contentHash && existing.status === "completed") {
    return
  }

  // Generate embedding
  const text = `${entry.title}\n${entry.content}`
  const result = await generateEmbedding(text)

  if (!result) {
    // Mark as failed if we have an existing row, otherwise leave it
    if (existing) {
      await prisma.knowledgeEmbedding.update({
        where: { entryId },
        data: { status: "failed", errorMessage: "Embedding service unavailable" },
      })
    }
    return
  }

  await prisma.knowledgeEmbedding.upsert({
    where: { entryId },
    create: {
      entryId,
      embedding: result.vector,
      dimensions: result.dimensions,
      model: result.model,
      contentHash,
      status: "completed",
    },
    update: {
      embedding: result.vector,
      dimensions: result.dimensions,
      model: result.model,
      contentHash,
      status: "completed",
      errorMessage: null,
    },
  })
}

// ─── Semantic retrieval ─────────────────────────────────────────────────────

export interface ScoredKnowledgeEntry {
  id: string
  title: string
  content: string
  category: string
  tags: unknown
  valueGrade: string | null
  score: number
}

/**
 * Retrieve top-K relevant knowledge entries by cosine similarity.
 * Falls back to entry-only (no embedding) when embedding is disabled or empty.
 */
export async function retrieveRelevantKnowledge(input: {
  userId: string
  projectId: string
  query: string
  topicTitle?: string
  topicRationale?: string
  topK?: number
}): Promise<{
  entries: ScoredKnowledgeEntry[]
  source: "embedding" | "raw"
}> {
  const config = readConfig()
  const topK = input.topK ?? 12

  // Build the query text: combine input + topic context for richer embedding
  const queryParts = [input.query]
  if (input.topicTitle) queryParts.push(`选题：${input.topicTitle}`)
  if (input.topicRationale) queryParts.push(`选题理由：${input.topicRationale}`)
  const queryText = queryParts.join("\n")

  // When embedding is enabled, try semantic retrieval
  if (config.enabled) {
    const queryVector = await generateEmbedding(queryText)
    if (queryVector) {
      // Fetch top active embeddings for this project
      // 加 take 上限,防止知识库膨胀后全量加载到内存算余弦导致 OOM/事件循环阻塞
      const rows = await prisma.knowledgeEmbedding.findMany({
        where: {
          status: "completed",
          entry: {
            userId: input.userId,
            projectId: input.projectId,
            status: "active",
          },
        },
        select: {
          embedding: true,
          entry: {
            select: { id: true, title: true, content: true, category: true, tags: true, valueGrade: true },
          },
        },
        take: 200,
      })

      if (rows.length > 0) {
        const scored: ScoredKnowledgeEntry[] = rows
          .map((row) => {
            const embeddingArr = row.embedding as number[]
            return {
              id: row.entry.id,
              title: row.entry.title,
              content: row.entry.content,
              category: row.entry.category,
              tags: row.entry.tags,
              valueGrade: row.entry.valueGrade,
              score: cosineSimilarity(queryVector.vector, embeddingArr),
            }
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, topK)

        return { entries: scored, source: "embedding" }
      }
    }
  }

  // Fallback: return recent active entries (matching old behavior)
  const fallback = await prisma.knowledgeEntry.findMany({
    where: {
      userId: input.userId,
      projectId: input.projectId,
      status: "active",
    },
    orderBy: { sortOrder: "asc" },
    take: topK,
    select: { id: true, title: true, content: true, category: true, tags: true, valueGrade: true },
  })

  return {
    entries: fallback.map((e) => ({ ...e, score: 0 })),
    source: "raw",
  }
}

// ─── Sync command ───────────────────────────────────────────────────────────

/**
 * Batch sync: ensure embeddings for all active knowledge entries for a user/project.
 * Returns counts. Useful for admin UI "re-embed" button or script.
 */
export async function syncProjectEmbeddings(input: {
  userId?: string
  projectId?: string
  entryIds?: string[]
}): Promise<{ attempted: number; succeeded: number; failed: number }> {
  const config = readConfig()
  if (!config.enabled) return { attempted: 0, succeeded: 0, failed: 0 }

  const where: Record<string, unknown> = { status: "active" }
  if (input.userId) where.userId = input.userId
  if (input.projectId) where.projectId = input.projectId
  if (input.entryIds) where.id = { in: input.entryIds }

  const entries = await prisma.knowledgeEntry.findMany({
    where,
    select: { id: true },
  })

  let succeeded = 0
  let failed = 0

  for (const entry of entries) {
    try {
      await ensureKnowledgeEmbedding(entry.id)
      succeeded++
    } catch (error) {
      console.warn(`[embedding] sync failed for entry ${entry.id}:`, error)
      failed++
    }
  }

  return { attempted: entries.length, succeeded, failed }
}
