import { NextResponse } from "next/server"
import { withAdminAuth } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"
import { parseDocument } from "@/lib/document-parser"

export const POST = withAdminAuth(async (request) => {
  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const category = (formData.get("category") as string) || "product_usp"

  if (!file) {
    return NextResponse.json({ error: "请上传文件" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const chunks = await parseDocument(buffer, file.name)

  const entries: unknown[] = []
  for (const content of chunks) {
    const title: string = file.name.replace(/\.[^.]+$/, "") + (chunks.length > 1 ? ` (${entries.length + 1}/${chunks.length})` : "")
    const entry = await prisma.knowledgeEntry.create({
      data: {
        userId: "", // admin 上传暂时不关联用户，需要时后续补充
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

  return NextResponse.json({ data: { created: entries.length, entries } }, { status: 201 })
})
