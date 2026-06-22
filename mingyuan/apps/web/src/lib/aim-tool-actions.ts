import { prisma } from "@/lib/prisma"
import { exportLarkBaseResult, importLarkBaseKnowledge, setEmbeddingHook } from "@/lib/lark-base-tool"
import { ensureKnowledgeEmbedding } from "@/lib/llm/embeddings"

// Register embedding hook for lark imports through chat
setEmbeddingHook(ensureKnowledgeEmbedding)

const CATEGORY_LABELS: Record<string, string> = {
  boss_experience: "老板经验",
  product_usp: "产品卖点",
  customer_pain: "客户痛点",
  project_case: "项目案例",
  customer_qa: "客户问答",
}

export function buildKnowledgeBlock(
  entries: Array<{ category: string; title: string; content: string }>
): string {
  if (entries.length === 0) return ""

  const grouped = new Map<string, typeof entries>()
  for (const entry of entries) {
    const list = grouped.get(entry.category) || []
    list.push(entry)
    grouped.set(entry.category, list)
  }

  let block = "\n\n=== 企业知识库 ===\n"
  for (const [category, items] of grouped) {
    block += `\n【${CATEGORY_LABELS[category] || category}】\n`
    for (const item of items) {
      block += `- ${item.title}：${item.content}\n`
    }
  }
  return block
}

export interface LarkToolActionParams {
  userId: string
  projectId: string
  resultId: string
}

export async function handleLarkToolAction(
  toolAction: string,
  params: LarkToolActionParams
): Promise<{ content: string; toolResult?: unknown }> {
  const { userId, projectId, resultId } = params

  if (toolAction === "import_lark_topics") {
    const result = await importLarkBaseKnowledge({
      userId,
      projectId,
      tableType: "topic_review",
      db: prisma,
    })
    return {
      content: `已同步飞书选题：新增 ${result.created} 条，更新 ${result.updated} 条。`,
      toolResult: result,
    }
  }

  if (toolAction === "import_lark_project_data" || toolAction === "import_lark_archive_data") {
    const result = await importLarkBaseKnowledge({
      userId,
      projectId,
      tableType: toolAction === "import_lark_project_data" ? "project_management" : "data_archive",
      db: prisma,
    })
    return {
      content: `已导入飞书数据：新增 ${result.created} 条，更新 ${result.updated} 条。`,
      toolResult: result,
    }
  }

  if (toolAction === "export_lark_generation") {
    if (!resultId) {
      throw new Error("缺少要回写的 AIM 结果")
    }
    await exportLarkBaseResult({
      userId,
      projectId,
      resultType: "script",
      resultId,
      db: prisma,
    })
    return { content: "已把这条 AIM 内容回写到飞书。" }
  }

  throw new Error("不支持的工具动作")
}
