"use client"

import { useEffect, useState, memo, useMemo, useRef, useCallback, startTransition } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Check,
  Clipboard,
  FileText,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  Video,
  ShieldCheck,
  Wand2,
  Plus,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  generateAimContent,
  checkScriptQuality,
  chatAim,
  listClientProjects,
  updateAimWorkflowStatus,
  type AimGenerateResponse,
  type AimGeneration,
  type AimChatToolAction,
  type ClientProject,
  type ContentFormat,
  type QualityCheckReport,
} from "@/lib/api/client"
import { useAudioRecorder } from "@/hooks/use-audio-recorder"
import { transcribeAudio } from "@/lib/api/client"
import {
  AIM_AGENT_OPTIONS,
  DEFAULT_AIM_AGENT,
  isValidAimAgent,
  type AimAgentId,
  type AimAgentMeta,
} from "@/lib/aim-ui-config"
import { useAimWorkspaceStore } from "@/lib/aim-workspace-store"

interface AimAgentOption extends AimAgentMeta {
  intro: string
  placeholder: string
  defaultInstruction: string
  quickPrompts: string[]
  primaryActionLabel: string
}

/** 各智能体的运行时扩展字段（id/title/description/icon/defaultFormats 来自共享配置 aim-ui-config） */
const AGENT_EXTRAS: Record<AimAgentId, Omit<AimAgentOption, keyof AimAgentMeta>> = {
  ip_video: {
    intro: "我是你的脚本创作官。把公众号文章、客户问题、产品卖点或老板口述丢给我，我会生成短视频脚本、口播稿和拍摄交接单。",
    placeholder: "和我说说：你想做什么内容？素材、目标人群、卖点都可以贴进来…",
    defaultInstruction: "去 AI 味，保留真人表达的犹豫、判断和具体细节，少用套话。视频脚本采用痛点-钩子-干货-行动号召的经典IP获客结构。",
    quickPrompts: [
      "少儿美术机构同城获客：想通过短视频招募学员，目前粉丝少，怎么重新做口播？",
      "老板会议即兴表达：粘贴老板在会上的金句片段，快速整理为干货口播脚本。",
    ],
    primaryActionLabel: "生成文案交付物",
  },
  business_diagnosis: {
    intro: "我是你的定位策划官。告诉我你的产品、卖给谁、目前怎么获客、卡在哪，我会输出 IP 定位、内容定位和成交路径建议。",
    placeholder: "说说你的主营业务、目标客户，以及当前获卡在哪…",
    defaultInstruction: "从定位清晰度、痛点匹配度、成交链路顺畅度三个维度进行诊断，给出具体且可落地的改进建议，采用诊断报告格式。",
    quickPrompts: [
      "ERP 软件定位诊断：客单价 5 万，目前依赖熟人转介绍，怎么开启线上精准获客？",
      "社区宠物店引流：周边有竞品竞争，客单价和复购率双低，如何破局？",
    ],
    primaryActionLabel: "生成诊断报告",
  },
  wechat_article: {
    intro: "我是你的长文写作官。给我一个主题、核心观点或案例大纲，我会先帮你把立意和结构打磨清楚，再拓展成一篇结构完整、论证有力的深度长文。",
    placeholder: "想写什么主题？核心观点、案例、提纲都可以…",
    defaultInstruction: "保持客观专业但不失温度的笔触，使用‘痛点引入 - 核心论点 - 经典案例拆解 - 行动建议’的结构，多用短句，避免空洞说教。",
    quickPrompts: [
      "企业数字化转型：传统外贸企业如何通过数字化工具提升 3 倍效率的案例拆解。",
      "中小企业落地大模型：避开大模型在中小企业落地时的 3 个核心误区与对策。",
    ],
    primaryActionLabel: "生成公众号文章",
  },
  moments_conversion: {
    intro: "我是你的私域转化官。把客户反馈、成交喜报或限时福利发我，我会生成朋友圈文案和私域承接话术。",
    placeholder: "客户反馈、成交喜报、限时福利都可以贴进来…",
    defaultInstruction: "像真实的朋友在分享，包含‘真实场景 + 痛点唤醒 + 成交事实 + 评论区引流钩子’，严防微商套路。",
    quickPrompts: [
      "学员喜报：刚收到一个学员的喜报，通过我们指导拿到了大厂 offer，做咨询引导。",
      "分享会门票：今晚 8 点线上闭门分享会，写一条朋友圈吸引精准客户私信报名。",
    ],
    primaryActionLabel: "生成朋友圈文案",
  },
}

const AGENT_OPTIONS: AimAgentOption[] = AIM_AGENT_OPTIONS.map((meta) => ({
  ...meta,
  ...AGENT_EXTRAS[meta.id],
}))

const FORMAT_LABELS: Record<ContentFormat, string> = {
  video_script: "视频脚本",
  wechat_article: "公众号文章",
  moments_post: "朋友圈文案",
  community_message: "社群运营文案",
  shooting_brief: "拍摄交接单",
  raw_copy: "诊断报告",
}

const LOADING_MESSAGES = ["分析输入...", "检索知识库...", "生成内容..."]

const WORKFLOW_STATUS_OPTIONS = [
  { value: "draft", label: "草稿" },
  { value: "pending_review", label: "待审核" },
  { value: "ready_to_shoot", label: "待拍摄" },
  { value: "shooting", label: "拍摄中" },
  { value: "editing", label: "剪辑中" },
  { value: "ready_to_publish", label: "待发布" },
  { value: "published", label: "已发布" },
  { value: "archived", label: "已归档" },
]

function workflowStatusLabel(status?: string | null) {
  return WORKFLOW_STATUS_OPTIONS.find((item) => item.value === status)?.label || "草稿"
}

/** 生成一个稳定的临时 id（组件内使用，避免 Math.random 之外的库依赖） */
let _seq = 0
function nextId(prefix = "m") {
  _seq += 1
  return `${prefix}-${Date.now()}-${_seq}`
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  deliverables?: AimGenerateResponse | null
  qualityReport?: QualityCheckReport | null
}

function getHistoryContents(item: AimGeneration) {
  return [
    item.videoScript ? { format: "video_script" as const, content: item.videoScript } : null,
    item.wechatArticle ? { format: "wechat_article" as const, content: item.wechatArticle } : null,
    item.momentsPost ? { format: "moments_post" as const, content: item.momentsPost } : null,
    item.communityMessage ? { format: "community_message" as const, content: item.communityMessage } : null,
    item.shootingBrief ? { format: "shooting_brief" as const, content: item.shootingBrief } : null,
    item.rawCopy ? { format: "raw_copy" as const, content: item.rawCopy } : null,
  ].filter(Boolean) as Array<{ format: ContentFormat; content: string }>
}

const ZhuJianContent = memo(function ZhuJianContent({ text }: { text: string }) {
  const lines = useMemo(() => (text ? text.split("\n") : []), [text])
  return (
    <div className="space-y-3 select-text font-serif leading-loose tracking-wider text-foreground/95 antialiased">
      {lines.map((line, index) => {
        const regex = /(【[^】]+】)/g
        const parts = line.split(regex)
        if (parts.length > 1) {
          return (
            <p key={index} className="text-sm sm:text-[15px] leading-loose my-2 text-[#2c2b2a] dark:text-[#f3ede2]">
              {parts.map((part, pIdx) => {
                if (part.startsWith("【") && part.endsWith("】")) {
                  if (part === "【画面】") {
                    return (
                      <span key={pIdx} className="inline-block mx-1 px-2 py-0.5 rounded-xs text-xs font-serif font-bold bamboo-scene-tag">
                        {part}
                      </span>
                    )
                  }
                  if (part === "【旁白】") {
                    return (
                      <span key={pIdx} className="inline-block mx-1 px-2 py-0.5 rounded-xs text-xs font-serif font-bold gold-ink-narration border border-amber-700/20 dark:border-amber-500/20">
                        {part}
                      </span>
                    )
                  }
                  return (
                    <span key={pIdx} className="inline-block mx-1 px-2 py-0.5 rounded-xs text-xs font-serif font-bold badge-gold border border-primary/30">
                      {part}
                    </span>
                  )
                }
                return <span key={pIdx}>{part}</span>
              })}
            </p>
          )
        }
        return (
          <p key={index} className="text-sm sm:text-[15px] leading-loose my-2 text-[#2c2b2a] dark:text-[#f3ede2] min-h-6">
            {line}
          </p>
        )
      })}
    </div>
  )
})

/** 交付物气泡：在对话中渲染 generateAimContent 的多格式结果 */
function DeliverableBubble({
  deliverables,
  onRepurpose,
  onQuality,
  onMarkStatus,
  isBusy,
}: {
  deliverables: AimGenerateResponse
  onRepurpose: (format: ContentFormat) => void
  onQuality: () => void
  onMarkStatus: (status: string) => void
  isBusy: boolean
}) {
  const [activeTab, setActiveTab] = useState<ContentFormat>(deliverables.results[0]?.format || "raw_copy")
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null)

  async function copyText(content: string, format?: string) {
    await navigator.clipboard.writeText(content)
    if (format) {
      setCopiedFormat(format)
      setTimeout(() => setCopiedFormat(null), 600)
    }
    toast.success("已复制")
  }

  const hasMoments = deliverables.results.some((r) => r.format === "moments_post")
  const hasWechat = deliverables.results.some((r) => r.format === "wechat_article")
  const hasBrief = deliverables.results.some((r) => r.format === "shooting_brief")
  const hasVideo = deliverables.results.some((r) => r.format === "video_script")

  return (
    <div className="mt-3 rounded-xl border border-primary/20 bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">交付物</span>
        {deliverables.knowledgeUsed?.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">已用知识库 {deliverables.knowledgeUsed.length} 条</Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ContentFormat)}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          {deliverables.results.map((item) => (
            <TabsTrigger key={item.format} value={item.format}>
              {FORMAT_LABELS[item.format]}
            </TabsTrigger>
          ))}
        </TabsList>
        {deliverables.results.map((item) => (
          <TabsContent key={item.format} value={item.format} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="secondary">{FORMAT_LABELS[item.format]} · {item.wordCount} 字</Badge>
              <Button size="sm" variant="outline" onClick={() => copyText(item.content, item.format)}>
                {copiedFormat === item.format ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                复制
              </Button>
            </div>
            <div className="max-h-80 overflow-y-auto rounded-lg border bg-muted/20 p-3">
              {item.format === "video_script" ? (
                <ZhuJianContent text={item.content} />
              ) : (
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7">{item.content}</pre>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
        {!hasMoments && hasVideo && (
          <Button size="sm" variant="outline" onClick={() => onRepurpose("moments_post")} disabled={isBusy}>
            <MessageCircle className="h-3.5 w-3.5 mr-1" /> 生成朋友圈
          </Button>
        )}
        {!hasWechat && hasVideo && (
          <Button size="sm" variant="outline" onClick={() => onRepurpose("wechat_article")} disabled={isBusy}>
            <FileText className="h-3.5 w-3.5 mr-1" /> 生成公众号
          </Button>
        )}
        {!hasBrief && hasVideo && (
          <Button size="sm" variant="outline" onClick={() => onRepurpose("shooting_brief")} disabled={isBusy}>
            <Video className="h-3.5 w-3.5 mr-1" /> 拍摄交接单
          </Button>
        )}
        {hasVideo && (
          <Button size="sm" variant="outline" onClick={onQuality} disabled={isBusy}>
            <ShieldCheck className="h-3.5 w-3.5 mr-1" /> 进入质检
          </Button>
        )}
        {deliverables.id && !deliverables.id.startsWith("polish-") && (
          <Button size="sm" variant="outline" onClick={() => onMarkStatus("ready_to_shoot")} disabled={isBusy}>
            <Send className="h-3.5 w-3.5 mr-1" /> 标记待拍摄
          </Button>
        )}
      </div>
    </div>
  )
}

export default function AimPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const agentParam = searchParams.get("agent")
  const topicTitleParam = searchParams.get("topicTitle")
  const topicRationaleParam = searchParams.get("topicRationale")
  const projectIdParam = searchParams.get("projectId")
  const activeAgentId: AimAgentId = isValidAimAgent(agentParam) ? agentParam : DEFAULT_AIM_AGENT
  const [selectedAgentId, setSelectedAgentId] = useState<AimAgentId>(activeAgentId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isThinking, setIsThinking] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isQualityChecking, setIsQualityChecking] = useState(false)
  const [loadingIndex, setLoadingIndex] = useState(0)
  const [projects, setProjects] = useState<ClientProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState("")

  // 历史记录由侧边栏共享 store 管理（侧边栏渲染列表、生成成功后刷新、点击后触发加载）
  const storeHistory = useAimWorkspaceStore((s) => s.history)
  const loadTargetId = useAimWorkspaceStore((s) => s.loadTargetId)
  const refreshHistory = useAimWorkspaceStore((s) => s.fetchHistory)
  const clearLoadTarget = useAimWorkspaceStore((s) => s.clearLoadTarget)

  const scrollRef = useRef<HTMLDivElement>(null)

  const agent = AGENT_OPTIONS.find((a) => a.id === selectedAgentId)!

  const { isRecording, isTranscribing, startRecording, stopRecording } = useAudioRecorder({
    transcribeFn: transcribeAudio,
    onTranscribeSuccess: (text) => setInput((prev) => (prev ? `${prev}\n${text}` : text)),
  })

  useEffect(() => {
    listClientProjects().then(setProjects).catch(() => {})
  }, [])

  // 切换智能体（由全局侧边栏的 ?agent= 驱动）：同步选中态并重置当前对话
  useEffect(() => {
    startTransition(() => {
      setSelectedAgentId(activeAgentId)
      setMessages([])
      setInput("")
    })
  }, [activeAgentId])

  useEffect(() => {
    if (!topicTitleParam && !topicRationaleParam && !projectIdParam) return

    const prefillLines = [
      topicTitleParam ? `选题：${topicTitleParam}` : null,
      topicRationaleParam ? `选题依据：${topicRationaleParam}` : null,
    ].filter(Boolean)

    startTransition(() => {
      if (projectIdParam) setSelectedProjectId(projectIdParam)
      setMessages([])
      setInput(prefillLines.join("\n"))
    })

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("topicTitle")
    nextParams.delete("topicRationale")
    nextParams.delete("projectId")
    router.replace(nextParams.toString() ? `/aim?${nextParams.toString()}` : "/aim")
  }, [projectIdParam, router, searchParams, topicRationaleParam, topicTitleParam])

  // 侧边栏点击「最近内容」：把记录加载为一次对话（数据来自共享 store，无需额外请求）
  useEffect(() => {
    if (!loadTargetId) return
    const item = storeHistory.find((h) => h.id === loadTargetId)
    if (!item) return // 列表尚未拉取到，等 storeHistory 更新后由本 effect 重试
    const contents = getHistoryContents(item)
    startTransition(() => {
      setSelectedProjectId(item.projectId || "")
      setMessages([
        { id: nextId(), role: "user", content: item.rawInput || "（历史素材）" },
        ...(contents.length
          ? [{
              id: nextId(),
              role: "assistant" as const,
              content: `已加载历史记录${item.topicTitle ? `「${item.topicTitle}」` : ""}，可继续改写或追问。`,
              deliverables: {
                id: item.id,
                results: contents.map((c) => ({ format: c.format, content: c.content, wordCount: c.content.length })),
                knowledgeUsed: [],
              } as AimGenerateResponse,
            }]
          : [{ id: nextId(), role: "assistant" as const, content: "已加载历史素材，可直接让我改写。" }]),
      ])
    })
    toast.success("已加载历史记录")
    clearLoadTarget()
  }, [loadTargetId, storeHistory, clearLoadTarget])

  useEffect(() => {
    if (!isGenerating) return
    const timer = setInterval(() => setLoadingIndex((v) => (v + 1) % LOADING_MESSAGES.length), 1400)
    return () => clearInterval(timer)
  }, [isGenerating])

  // 自动滚到底部
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, isThinking, isGenerating])

  function resetConversation() {
    setMessages([])
    setInput("")
  }

  /** 把对话里的用户输入拼成生成素材 */
  function buildRawInputForGenerate(extra?: string) {
    const userTexts = messages.filter((m) => m.role === "user").map((m) => m.content)
    if (extra) userTexts.push(extra)
    return userTexts.filter(Boolean).join("\n\n")
  }

  function detectLarkToolAction(text: string): AimChatToolAction | null {
    if (!/飞书/.test(text)) return null
    if (/同步.*选题|导入.*选题/.test(text)) return "import_lark_topics"
    if (/热点|竞品|对标|数据/.test(text) && /导入|同步/.test(text)) return "import_lark_archive_data"
    if (/项目/.test(text) && /导入|同步/.test(text)) return "import_lark_project_data"
    if (/回写|同步到飞书|同步.*脚本|同步.*内容/.test(text)) return "export_lark_generation"
    return null
  }

  function latestDeliverableId() {
    return [...messages].reverse().find((m) => m.deliverables?.id)?.deliverables?.id
  }

  async function handleSend() {
    const text = input.trim()
    if (!text) return
    const userMsg: ChatMessage = { id: nextId(), role: "user", content: text }
    const thread = [...messages, userMsg]
    setMessages(thread)
    setInput("")
    setIsThinking(true)
    try {
      const toolAction = detectLarkToolAction(text)
      if (toolAction && !selectedProjectId) {
        toast.error("请先选择 IP 营销全案")
        return
      }
      const resultId = toolAction === "export_lark_generation" ? latestDeliverableId() : undefined
      if (toolAction === "export_lark_generation" && !resultId) {
        toast.error("当前没有可同步到飞书的 AIM 生成结果")
        return
      }
      const { content } = await chatAim(
        thread.map((m) => ({ role: m.role, content: m.content })),
        {
          projectId: selectedProjectId || undefined,
          toolAction: toolAction || undefined,
          resultId,
        },
      )
      setMessages((prev) => [...prev, { id: nextId(), role: "assistant", content }])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "对话失败，请稍后重试")
    } finally {
      setIsThinking(false)
    }
  }

  async function handleGenerate() {
    const rawInput = buildRawInputForGenerate(input.trim() || undefined)
    if (!rawInput) {
      toast.error("请先在对话框里说点素材或需求")
      return
    }
    if (!selectedProjectId) {
      toast.error("请先选择 IP 营销全案，避免内容和素材混到别的客户")
      return
    }
    setIsGenerating(true)
    setLoadingIndex(0)
    try {
      const response = await generateAimContent({
        rawInput,
        targetFormats: agent.defaultFormats,
        projectId: selectedProjectId || undefined,
        polishInstruction: agent.defaultInstruction,
        taskType: "write_script",
      })
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: `${agent.title} 交付物已生成，可直接复制使用，也能继续在下方对话里让我改写。`,
          deliverables: response,
        },
      ])
      if (input.trim()) setInput("")
      refreshHistory({ force: true })
      toast.success(`${agent.primaryActionLabel}完毕`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成失败，请稍后重试")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRepurpose = useCallback(
    (msgId: string) => async (fmt: ContentFormat) => {
      setIsGenerating(true)
      setLoadingIndex(0)
      try {
        if (!selectedProjectId) {
          toast.error("请先选择 IP 营销全案")
          return
        }
        const base = messages.find((m) => m.id === msgId)?.deliverables
        const mainContent = base?.results.find((r) => r.format === "video_script")?.content
        if (!mainContent) return
        const response = await generateAimContent({
          rawInput: `基于以下脚本，派生${FORMAT_LABELS[fmt]}：\n\n${mainContent}`,
          targetFormats: [fmt],
          projectId: selectedProjectId || undefined,
          taskType: "repurpose",
        })
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId && m.deliverables
              ? { ...m, deliverables: { ...m.deliverables, results: [...m.deliverables.results, ...response.results] } }
              : m,
          ),
        )
        refreshHistory({ force: true })
        toast.success(`${FORMAT_LABELS[fmt]}已生成`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "生成失败")
      } finally {
        setIsGenerating(false)
      }
    },
    [messages, refreshHistory, selectedProjectId],
  )

  const handleQuality = useCallback(
    (msgId: string) => async () => {
      const base = messages.find((m) => m.id === msgId)?.deliverables
      const mainContent = base?.results.find((r) => r.format === "video_script")?.content
      if (!mainContent) return
      setIsQualityChecking(true)
      try {
        const report = await checkScriptQuality({ content: mainContent, persona: agent.defaultInstruction })
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, qualityReport: report } : m)),
        )
        toast.success("质检完成")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "质检失败")
      } finally {
        setIsQualityChecking(false)
      }
    },
    [messages, agent],
  )

  const handleMarkStatus = useCallback(
    (msgId: string) => async (status: string) => {
      const base = messages.find((m) => m.id === msgId)?.deliverables
      if (!base?.id || base.id.startsWith("polish-")) {
        toast.error("只有已保存的内容才能推进状态")
        return
      }
      try {
        await updateAimWorkflowStatus(base.id, { workflowStatus: status })
        refreshHistory({ force: true })
        toast.success(`已标记为：${workflowStatusLabel(status)}`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "状态更新失败")
      }
    },
    [messages, refreshHistory],
  )

  const busy = isThinking || isGenerating || isQualityChecking || isTranscribing

  return (
    <div className="-mx-4 -my-4 h-[calc(100dvh-3.5rem)] min-h-115 md:-mx-6 md:-my-6">
      {/* 对话区（智能体列表与最近内容已移至全局侧边栏） */}
      <section className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-card px-4 md:px-6">
        {/* 头部：当前智能体 + 关联全案 */}
        <header className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <div className="flex min-w-0 items-center gap-2">
            {/* 小屏智能体切换 */}
            <div className="md:hidden">
              <Select value={selectedAgentId} onValueChange={(v) => { if (v !== selectedAgentId) router.push(`/aim?agent=${v}`) }}>
                <SelectTrigger className="h-9 w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_OPTIONS.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="hidden h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary md:flex">
              <agent.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{agent.title}</p>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">{agent.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedProjectId || "none"} onValueChange={(v) => setSelectedProjectId(v === "none" ? "" : (v || ""))}>
              <SelectTrigger className="h-8 w-[170px] text-xs">
                <SelectValue placeholder="选择全案" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">选择 IP 营销全案</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => resetConversation()} title="新对话">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {projects.length === 0 && (
          <div className="border-b bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
            还没有 IP 营销全案，
            <Link href="/projects" className="text-primary underline-offset-2 hover:underline">先创建一个</Link>
            ，生成内容可自动归属。
          </div>
        )}
        {projects.length > 0 && !selectedProjectId && (
          <div className="border-b bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
            请选择 IP 营销全案后再生成内容；飞书负责项目协作和评比，AIM 只负责当前全案的内容生产。
          </div>
        )}

        {/* 消息流 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
          {messages.length === 0 ? (
            <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <agent.icon className="h-6 w-6" />
              </span>
              <div>
                <p className="text-base font-semibold text-foreground">{agent.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{agent.intro}</p>
              </div>
              <div className="flex w-full flex-col gap-2">
                <p className="self-start text-xs font-medium text-muted-foreground">试试这样开头：</p>
                {agent.quickPrompts.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setInput(p)}
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-xs text-foreground/90 transition-colors hover:border-primary/30 hover:bg-primary/5"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] ${m.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "rounded-br-sm bg-primary text-primary-foreground"
                          : "rounded-bl-sm bg-muted/60 text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    </div>

                    {/* 交付物气泡 */}
                    {m.deliverables && (
                      <div className="w-[min(680px,92vw)]">
                        <DeliverableBubble
                          deliverables={m.deliverables}
                          onRepurpose={handleRepurpose(m.id)}
                          onQuality={handleQuality(m.id)}
                          onMarkStatus={handleMarkStatus(m.id)}
                          isBusy={busy}
                        />
                      </div>
                    )}

                    {/* 质检报告 */}
                    {m.qualityReport && (
                      <div className="mt-2 w-[min(680px,92vw)] rounded-xl border border-primary/20 bg-card p-4">
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                          <ShieldCheck className="h-4 w-4 text-primary" />
                          质检报告
                          <Badge variant={m.qualityReport.overall.passed ? "default" : "destructive"} className="ml-auto">
                            {m.qualityReport.overall.score}分 {m.qualityReport.overall.passed ? "通过" : "需修改"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {[
                            { label: "开头吸引力", data: m.qualityReport.attraction },
                            { label: "逻辑性", data: m.qualityReport.logic },
                            { label: "去AI味", data: m.qualityReport.aiTaste },
                            { label: "文笔质量", data: m.qualityReport.editorial },
                          ].map((dim) => (
                            <div key={dim.label} className="rounded-lg border p-2 text-center">
                              <p className="text-[10px] text-muted-foreground">{dim.label}</p>
                              <p className={`text-xl font-bold ${dim.data.passed ? "text-green-600" : "text-red-500"}`}>{dim.data.score}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* 思考中占位 */}
              {isThinking && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted/60 px-4 py-2.5 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    思考中…
                  </div>
                </div>
              )}
              {isGenerating && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted/60 px-4 py-2.5 text-sm text-muted-foreground">
                    <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                    {LOADING_MESSAGES[loadingIndex]}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 输入区 */}
        <footer className="border-t p-3">
          <div className="mx-auto max-w-3xl">
            {isTranscribing && (
              <p className="mb-1.5 text-xs text-primary animate-pulse">语音转写中…</p>
            )}
            <div className="flex items-end gap-2 rounded-2xl border bg-background p-2 focus-within:ring-1 focus-within:ring-primary/30">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    if (!busy && !isRecording) handleSend()
                  }
                }}
                rows={1}
                placeholder={agent.placeholder}
                disabled={busy}
                className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
              />
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 px-2.5"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={busy && !isRecording}
                  title="语音输入"
                >
                  {isRecording ? <span className="text-xs text-red-500">停止</span> : <MessageCircle className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 w-9 p-0"
                  onClick={handleSend}
                  disabled={busy || !input.trim() || isRecording}
                  title="发送"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                回车发送 · Shift+回车换行 · 对齐好素材后点右侧生成交付物
              </p>
              <Button
                type="button"
                size="sm"
                onClick={handleGenerate}
                disabled={busy || !selectedProjectId || (messages.filter((m) => m.role === "user").length === 0 && !input.trim())}
                className="h-9 gap-1.5 font-semibold shadow-xs"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {agent.primaryActionLabel}
              </Button>
            </div>
          </div>
        </footer>
      </section>
    </div>
  )
}
