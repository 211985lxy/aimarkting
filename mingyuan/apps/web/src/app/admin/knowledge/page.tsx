"use client"

import React from "react"
import {
  BookOpen,
  Search,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  Archive,
  Trash2,
  Tag,
  Upload,
  Plus,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// ─── 类型定义 ──────────────────────────────────────────────

interface KnowledgeEntry {
  id: string
  userId: string
  category: string
  title: string
  content: string
  tags: string[]
  sourceType: string
  status: string
  sortOrder: number
  createdAt: string
  updatedAt: string
  user?: { id: string; name: string; email: string }
}

interface StatsData {
  totalEntries: number
  categoryDistribution: { category: string; count: number }[]
  sourceTypeDistribution: { sourceType: string; count: number }[]
  topUsers: { userId: string; count: number; user: { name: string; email: string } | null }[]
}

interface DistillResult {
  distilled: Array<{
    index: number
    suggestedTitle: string
    suggestedContent: string
    suggestedCategory: string
    tags: string[]
    action: "keep" | "merge" | "archive"
  }>
  duplicates: number[][]
  suggestions: string
}

// ─── 常量 ──────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  boss_experience: "老板经验",
  product_usp: "产品卖点",
  customer_pain: "客户痛点",
  project_case: "项目案例",
  customer_qa: "客户问答",
  daily_inspiration: "日常灵感",
  benchmark_reference: "竞品/对标参考",
  user_insight: "用户洞察",
  hot_topic: "热点素材",
  positioning_material: "定位素材",
  private_domain_material: "私域素材",
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  manual: "手动录入",
  voice_transcribe: "语音转写",
  import: "文件导入",
  obsidian: "Obsidian 同步",
}

// ─── API 调用 ──────────────────────────────────────────────

function getAdminToken(): string {
  if (typeof window === "undefined") return ""
  try {
    const authStr = localStorage.getItem("mingyuan-admin-auth")
    if (!authStr) return ""
    const authObj = JSON.parse(authStr)
    return authObj.state?.token || ""
  } catch {
    return ""
  }
}

async function fetchKnowledge(params: {
  page?: number
  pageSize?: number
  search?: string
  category?: string
  userId?: string
  sourceType?: string
}) {
  const qs = new URLSearchParams()
  if (params.page) qs.set("page", String(params.page))
  if (params.pageSize) qs.set("pageSize", String(params.pageSize))
  if (params.search) qs.set("search", params.search)
  if (params.category) qs.set("category", params.category)
  if (params.userId) qs.set("userId", params.userId)
  if (params.sourceType) qs.set("sourceType", params.sourceType)
  
  const token = getAdminToken()
  const res = await fetch(`/api/admin/knowledge?${qs}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return res.json() as Promise<{
    data: { results: KnowledgeEntry[]; total: number; page: number; pageSize: number }
  }>
}

async function fetchStats() {
  const token = getAdminToken()
  const res = await fetch("/api/admin/knowledge/stats", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return res.json() as Promise<{ data: StatsData }>
}

async function batchAction(
  ids: string[],
  action: string,
  value?: string
) {
  const token = getAdminToken()
  const res = await fetch("/api/admin/knowledge", {
    method: "PUT",
    headers: { 
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ids, action, value }),
  })
  if (!res.ok) throw new Error("操作失败")
  return res.json()
}

async function deleteEntries(ids: string[]) {
  const token = getAdminToken()
  const res = await fetch(`/api/admin/knowledge?ids=${ids.join(",")}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) throw new Error("删除失败")
  return res.json()
}

async function distillEntries(ids: string[]) {
  const token = getAdminToken()
  const res = await fetch("/api/admin/knowledge/distill", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new Error("蒸馏失败")
  return res.json() as Promise<{ data: { entryCount: number; result: DistillResult } }>
}

// ─── 页面 ──────────────────────────────────────────────────

export default function AdminKnowledgePage() {
  // 列表状态
  const [entries, setEntries] = React.useState<KnowledgeEntry[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const pageSize = 20

  // 统计
  const [stats, setStats] = React.useState<StatsData | null>(null)

  // 选中
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

  // 蒸馏
  const [distillDialogOpen, setDistillDialogOpen] = React.useState(false)
  const [distillResult, setDistillResult] = React.useState<DistillResult | null>(null)
  const [distilling, setDistilling] = React.useState(false)

  // 新增/编辑
  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
  const [editForm, setEditForm] = React.useState({
    title: "",
    content: "",
    category: "product_usp",
    tags: "",
    sourceType: "manual" as string,
  })
  const [saving, setSaving] = React.useState(false)

  // 上传
  const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false)
  const [uploadFile, setUploadFile] = React.useState<File | null>(null)
  const [uploadCategory, setUploadCategory] = React.useState("product_usp")
  const [uploading, setUploading] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchKnowledge({
        page,
        pageSize,
        search,
        category: categoryFilter,
      })
      setEntries(res.data.results)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, search, categoryFilter])

  React.useEffect(() => {
    void Promise.resolve().then(fetchData)
  }, [fetchData])

  React.useEffect(() => {
    fetchStats().then((res) => setStats(res.data))
  }, [])

  const totalPages = Math.ceil(total / pageSize)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    fetchData()
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)))
    }
  }

  async function handleBatchArchive() {
    if (selectedIds.size === 0) return
    if (!confirm(`确定归档 ${selectedIds.size} 条知识条目？`)) return
    await batchAction([...selectedIds], "archive")
    setSelectedIds(new Set())
    fetchData()
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`确定永久删除 ${selectedIds.size} 条知识条目？此操作不可恢复！`)) return
    await deleteEntries([...selectedIds])
    setSelectedIds(new Set())
    fetchData()
  }

  async function handleDistill() {
    if (selectedIds.size === 0) return
    setDistilling(true)
    setDistillDialogOpen(true)
    try {
      const res = await distillEntries([...selectedIds])
      setDistillResult(res.data.result)
    } catch {
      setDistillResult(null)
    } finally {
      setDistilling(false)
    }
  }

  async function handleAddEntry() {
    if (!editForm.title || !editForm.content) return
    setSaving(true)
    try {
      const token = getAdminToken()
      const res = await fetch("/api/admin/knowledge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editForm.title,
          content: editForm.content,
          category: editForm.category,
          tags: editForm.tags ? editForm.tags.split(/[,，、]/).map((t: string) => t.trim()).filter(Boolean) : [],
          sourceType: editForm.sourceType,
        }),
      })
      if (!res.ok) throw new Error("创建失败")
      setAddDialogOpen(false)
      setEditForm({ title: "", content: "", category: "product_usp", tags: "", sourceType: "manual" })
      fetchData()
      fetchStats()
    } catch {
      alert("创建失败，请重试")
    } finally {
      setSaving(false)
    }
  }

  async function handleUploadFile() {
    if (!uploadFile) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", uploadFile)
      formData.append("category", uploadCategory)

      const token = getAdminToken()
      const res = await fetch("/api/admin/knowledge/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })
      if (!res.ok) throw new Error("上传失败")
      setUploadDialogOpen(false)
      setUploadFile(null)
      fetchData()
      fetchStats()
    } catch {
      alert("上传失败，请重试")
    } finally {
      setUploading(false)
    }
  }

  const categoryStatsMap = React.useMemo(() => {
    const map: Record<string, number> = {}
    if (stats) {
      for (const c of stats.categoryDistribution) {
        map[c.category] = c.count
      }
    }
    return map
  }, [stats])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">知识库管理</h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              知识库总量
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalEntries?.toLocaleString() ?? <Skeleton className="h-8 w-16" />}
            </div>
          </CardContent>
        </Card>
        {Object.entries(CATEGORY_LABELS).slice(0, 3).map(([key, label]) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {categoryStatsMap[key] ?? 0}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 操作栏 */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索标题或内容..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="secondary" className="cursor-pointer">
              搜索
            </Button>
          </form>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddDialogOpen(true)}
            className="cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-1" />
            手动录入
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUploadDialogOpen(true)}
            className="cursor-pointer"
          >
            <Upload className="h-4 w-4 mr-1" />
            上传文件
          </Button>
          <Select
            value={categoryFilter}
            onValueChange={(v) => {
              setCategoryFilter(v === "all" ? "" : (v ?? ""))
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="全部分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 批量操作 */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">
              已选 {selectedIds.size} 条
            </span>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={handleDistill}
              className="cursor-pointer"
            >
              <Sparkles className="h-4 w-4 mr-1" />
              知识蒸馏
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchArchive}
              className="cursor-pointer"
            >
              <Archive className="h-4 w-4 mr-1" />
              归档
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBatchDelete}
              className="cursor-pointer"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              删除
            </Button>
          </div>
        )}
      </div>

      {/* 表格 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-10 p-3 text-left">
                    <input
                      type="checkbox"
                      checked={entries.length > 0 && selectedIds.size === entries.length}
                      onChange={toggleSelectAll}
                      className="cursor-pointer"
                    />
                  </th>
                  <th className="text-left p-3 font-medium">标题</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">用户</th>
                  <th className="text-left p-3 font-medium">分类</th>
                  <th className="text-left p-3 font-medium hidden sm:table-cell">来源</th>
                  <th className="text-left p-3 font-medium">状态</th>
                  <th className="text-left p-3 font-medium hidden lg:table-cell">更新</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-3" colSpan={7}>
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      暂无知识库条目
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className={`border-b hover:bg-muted/30 transition-colors ${
                        selectedIds.has(entry.id) ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(entry.id)}
                          onChange={() => toggleSelect(entry.id)}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="p-3 max-w-[240px]">
                        <p className="truncate font-medium">{entry.title}</p>
                        <p className="truncate text-xs text-muted-foreground mt-0.5">
                          {entry.content.slice(0, 80)}...
                        </p>
                      </td>
                      <td className="p-3 hidden md:table-cell text-muted-foreground text-xs">
                        {entry.user?.name ?? entry.user?.email ?? "未知"}
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary" className="text-xs">
                          {CATEGORY_LABELS[entry.category] || entry.category}
                        </Badge>
                      </td>
                      <td className="p-3 hidden sm:table-cell text-muted-foreground text-xs">
                        {SOURCE_TYPE_LABELS[entry.sourceType] || entry.sourceType}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={entry.status === "active" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {entry.status === "active" ? "生效" : "已归档"}
                        </Badge>
                      </td>
                      <td className="p-3 hidden lg:table-cell text-muted-foreground text-xs">
                        {new Date(entry.updatedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            显示 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)}，共 {total} 条
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 知识蒸馏结果弹窗 */}
      <Dialog open={distillDialogOpen} onOpenChange={setDistillDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              知识蒸馏分析
            </DialogTitle>
            <DialogDescription>
              基于 DeepSeek 对选中知识的优化建议
            </DialogDescription>
          </DialogHeader>

          {distilling ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">正在分析知识条目...</p>
            </div>
          ) : distillResult ? (
            <div className="space-y-6">
              {/* 精炼建议 */}
              <div>
                <h3 className="font-semibold mb-3">精炼建议</h3>
                <div className="space-y-3">
                  {distillResult.distilled.map((item, i) => (
                    <Card key={i}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge
                            variant={
                              item.action === "keep"
                                ? "default"
                                : item.action === "merge"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {item.action === "keep" ? "保留" : item.action === "merge" ? "合并" : "归档"}
                          </Badge>
                          <Badge variant="outline">{item.suggestedCategory}</Badge>
                        </div>
                        <p className="font-medium">{item.suggestedTitle}</p>
                        <p className="text-sm text-muted-foreground">{item.suggestedContent}</p>
                        <div className="flex flex-wrap gap-1">
                          {item.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[10px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* 重复检测 */}
              {distillResult.duplicates.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">可能的重复条目</h3>
                  <div className="space-y-1">
                    {distillResult.duplicates.map((pair, i) => (
                      <p key={i} className="text-sm text-muted-foreground">
                        条目 #{pair[0]} 和 #{pair[1]} 可能重复
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* 总体建议 */}
              <div>
                <h3 className="font-semibold mb-2">优化建议</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {distillResult.suggestions}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-destructive">分析失败，请重试</p>
          )}
        </DialogContent>
      </Dialog>

      {/* 手动录入弹窗 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>手动录入知识条目</DialogTitle>
            <DialogDescription>手动添加一条知识到知识库</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>分类</Label>
                      <Select value={editForm.category} onValueChange={(v) => setEditForm((f) => ({ ...f, category: v ?? "" }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>标题</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="知识条目标题"
              />
            </div>
            <div>
              <Label>内容</Label>
              <Textarea
                value={editForm.content}
                onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="知识条目内容"
                rows={6}
              />
            </div>
            <div>
              <Label>标签（用逗号分隔）</Label>
              <Input
                value={editForm.tags}
                onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="标签1, 标签2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="cursor-pointer">
                取消
              </Button>
              <Button onClick={handleAddEntry} disabled={saving || !editForm.title || !editForm.content} className="cursor-pointer">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 文件上传弹窗 */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>上传文件导入知识</DialogTitle>
            <DialogDescription>支持 PDF、TXT、MD、DOCX、CSV、XLSX 格式</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>分类</Label>
              <Select value={uploadCategory} onValueChange={(v) => setUploadCategory(v ?? "")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>选择文件</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pdf,.txt,.md,.csv,.docx,.xlsx"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="cursor-pointer"
                />
                {uploadFile && (
                  <Button variant="ghost" size="icon" onClick={() => setUploadFile(null)} className="cursor-pointer">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {uploadFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  已选: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)} className="cursor-pointer">
                取消
              </Button>
              <Button onClick={handleUploadFile} disabled={uploading || !uploadFile} className="cursor-pointer">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "上传中..." : "上传并导入"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
