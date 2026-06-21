import { NextResponse } from "next/server"
import { withAdminAuth } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { parseDocument } from "@/lib/document-parser"
import { ensureKnowledgeEmbedding } from "@/lib/llm/embeddings"

export const POST = withAdminAuth(async (request, { admin }) => {
  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const category = (formData.get("category") as string) || "product_usp"

  if (!file) {
    return NextResponse.json({ error: "请上传文件" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { email: admin.email },
    select: { id: true },
  })

  if (!user) {
    return NextResponse.json({ error: "未找到同邮箱前台用户，无法绑定知识条目" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const chunks = await parseDocument(buffer, file.name)

  const entries: unknown[] = []
  for (const content of chunks) {
    const title: string = file.name.replace(/\.[^.]+$/, "") + (chunks.length > 1 ? ` (${entries.length + 1}/${chunks.length})` : "")
    const entry = await prisma.knowledgeEntry.create({
      data: {
        userId: user.id,
        category,
        title,
        content: content.slice(0, 50000),
        sourceType: "import",
        tags: [],
        status: "active",
      },
    })
    entries.push(entry)
  }

  // Fire-and-forget: generate embeddings for uploaded entries
  for (const entry of entries) {
    const e = entry as { id: string }
    ensureKnowledgeEmbedding(e.id).catch(() => {})
  }

  return NextResponse.json({ data: { created: entries.length, entries } }, { status: 201 })
})
