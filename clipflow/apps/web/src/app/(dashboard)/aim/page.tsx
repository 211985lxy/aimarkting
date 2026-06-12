"use client"

import { useEffect, useState, memo, useMemo } from "react"
import Link from "next/link"
import {
  Check,
  Clipboard,
  FileText,
  History,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  Video,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  generateAimContent,
  checkScriptQuality,
  listAimHistory,
  listClientProjects,
  updateAimWorkflowStatus,
  type AimGenerateResponse,
  type AimGeneration,
  type ClientProject,
  type ContentFormat,
  type QualityCheckReport,
} from "@/lib/api/client"
import { useAudioRecorder } from "@/hooks/use-audio-recorder"
import { transcribeAudio } from "@/lib/api/client"

type AimAgentId = "business_diagnosis" | "ip_video" | "wechat_article" | "moments_conversion"

interface AimAgentOption {
  id: AimAgentId
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  defaultFormats: ContentFormat[]
  inputLabel: string
  placeholder: string
  defaultInstruction: string
  quickPrompts: string[]
  primaryActionLabel: string
}

const AGENT_OPTIONS: AimAgentOption[] = [
  {
    id: "ip_video",
    title: "IP 短视频获客智能体",
    description: "输出视频脚本、朋友圈及社群文案",
    icon: Video,
    defaultFormats: ["video_script", "moments_post", "community_message"],
    inputLabel: "粘贴公众号文章、客户问题、产品卖点或老板口述素材",
    placeholder: "把一篇公众号文案、文章段落、产品卖点或老板口述粘贴到这里，AI会一键生成短视频脚本、朋友圈成交文案和社群运营文案。",
    defaultInstruction: "去 AI 味，保留真人表达的犹豫、判断和具体细节，少用套话。视频脚本采用痛点-钩子-干货-行动号召的经典IP获客结构。",
    quickPrompts: [
      "少儿美术机构同城获客：想通过短视频招募学员，目前粉丝少，怎么重新做口播？",
      "老板会议即兴表达：粘贴老板在会上的金句片段，快速整理为干货口播脚本。"
    ],
    primaryActionLabel: "生成短视频获客包"
  },
  {
    id: "business_diagnosis",
    title: "商业定位诊断智能体",
    description: "输出定位诊断、客群与成交链路建议",
    icon: ShieldCheck,
    defaultFormats: ["raw_copy"],
    inputLabel: "输入企业基本情况（主营业务、目标客户或当前获客困惑）",
    placeholder: "请详细描述你的产品是什么、卖给谁、目前通过什么渠道获客，以及遇到的主要瓶颈。AI 将为你进行深度诊断并输出定位诊断与成交链路建议。",
    defaultInstruction: "从定位清晰度、痛点匹配度、成交链路顺畅度三个维度进行诊断，给出具体且可落地的改进建议，采用诊断报告格式。",
    quickPrompts: [
      "ERP软件定位诊断：客单价5万，目前依赖熟人转介绍，怎么开启线上精准获客？",
      "社区宠物店引流：周边有竞品竞争，客单价和复购率双低，如何破局？"
    ],
    primaryActionLabel: "生成诊断报告"
  },
  {
    id: "wechat_article",
    title: "公众号深度内容智能体",
    description: "撰写深度文章，把观点与方法论讲透",
    icon: FileText,
    defaultFormats: ["wechat_article"],
    inputLabel: "输入文章主题、核心观点、支持案例或提纲大纲",
    placeholder: "请输入您想分享的观点、行业洞察或客户成功案例大纲，AI 将为您拓展成一篇结构完整、论证有力的公众号深度文章。",
    defaultInstruction: "保持客观专业但不失温度的笔触，使用‘痛点引入 - 核心论点 - 经典案例拆解 - 行动建议’的结构，多用短句，避免空洞说教。",
    quickPrompts: [
      "企业数字化转型：传统外贸企业如何通过数字化工具提升 3 倍效率的案例拆解。",
      "中小企业落地大模型：避开大模型在中小企业落地时的 3 个核心误区与对策。"
    ],
    primaryActionLabel: "生成公众号文章"
  },
  {
    id: "moments_conversion",
    title: "朋友圈成交智能体",
    description: "输出高转化的私域朋友圈互动文案",
    icon: MessageCircle,
    defaultFormats: ["moments_post"],
    inputLabel: "输入客户反馈、成交喜报或限时福利信息",
    placeholder: "请输入客户给您的反馈好评、成交故事、新客加入喜报或即将开始的优惠活动，AI 将为您转化为符合微信朋友圈生态的互动成交文案。",
    defaultInstruction: "像真实的朋友在分享，包含‘真实场景 + 痛点唤醒 + 成交事实 + 评论区引流钩子’，严防微商套路。",
    quickPrompts: [
      "学员喜报：刚收到一个学员的喜报，通过我们指导拿到了大厂 offer，做咨询引导。",
      "分享会门票：今晚 8 点线上闭门分享会，写一条朋友圈吸引精准客户私信报名。"
    ],
    primaryActionLabel: "生成朋友圈文案"
  }
]

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

const ZhuJianContent = memo(function ZhuJianContent({ text }: { text: string }) {
  const lines = useMemo(() => {
    if (!text) return []
    return text.split("\n")
  }, [text])

  return (
    <div className="space-y-4 select-text font-serif leading-loose tracking-widest text-foreground/95 antialiased">
      {lines.map((line, index) => {
        const regex = /(【[^】]+】)/g
        const parts = line.split(regex)
        if (parts.length > 1) {
          return (
            <p key={index} className="text-sm sm:text-[16px] leading-loose tracking-widest my-3 text-[#2c2b2a] dark:text-[#f3ede2]">
              {parts.map((part, pIdx) => {
                if (part.startsWith("【") && part.endsWith("】")) {
                  if (part === "【画面】") {
                    return (
                      <span
                        key={pIdx}
                        className="inline-block mx-1 px-2.5 py-0.5 rounded-xs text-xs font-serif font-bold bamboo-scene-tag shadow-[1px_1px_3px_rgba(197,160,89,0.12)] transition-all duration-300"
                      >
                        {part}
                      </span>
                    )
                  }
                  if (part === "【旁白】") {
                    return (
                      <span
                        key={pIdx}
                        className="inline-block mx-1 px-2.5 py-0.5 rounded-xs text-xs font-serif font-bold gold-ink-narration shadow-[1px_1px_3px_rgba(197,160,89,0.15)] transition-all duration-300 border border-amber-700/20 dark:border-amber-500/20"
                      >
                        {part}
                      </span>
                    )
                  }
                  return (
                    <span
                      key={pIdx}
                      className="inline-block mx-1 px-2.5 py-0.5 rounded-xs text-xs font-serif font-bold shadow-[1px_1px_3px_rgba(179,50,38,0.15)] transition-all duration-300 badge-gold border border-primary/30"
                    >
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
          <p key={index} className="text-sm sm:text-[16px] leading-loose tracking-widest my-3 text-[#2c2b2a] dark:text-[#f3ede2] min-h-[1.5rem]">
            {line}
          </p>
        )
      })}
    </div>
  )
})

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

export default function AimPage() {
  const [rawInput, setRawInput] = useState("")
  const [selectedAgentId, setSelectedAgentId] = useState<AimAgentId>("ip_video")
  const [isGenerating, setIsGenerating] = useState(false)
  const [loadingIndex, setLoadingIndex] = useState(0)
  const [result, setResult] = useState<AimGenerateResponse | null>(null)
  const [activeResultTab, setActiveResultTab] = useState<ContentFormat>("video_script")
  const [qualityReport, setQualityReport] = useState<QualityCheckReport | null>(null)
  const [isQualityChecking, setIsQualityChecking] = useState(false)
  const [history, setHistory] = useState<AimGeneration[]>([])
  const [projects, setProjects] = useState<ClientProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [polishInstruction, setPolishInstruction] = useState(
    AGENT_OPTIONS.find((a) => a.id === "ip_video")?.defaultInstruction || ""
  )
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null)
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)

  function handleSelectAgent(agentId: AimAgentId) {
    setSelectedAgentId(agentId)
    const agent = AGENT_OPTIONS.find((a) => a.id === agentId)
    if (agent) {
      setPolishInstruction(agent.defaultInstruction)
    }
  }

  const {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
  } = useAudioRecorder({
    transcribeFn: transcribeAudio,
    onTranscribeSuccess: (text) => {
      setRawInput((prev) => (prev ? `${prev}\n${text}` : text))
    },
  })

  useEffect(() => {
    listAimHistory(1, 10).then(setHistory).catch(() => {})
    listClientProjects().then(setProjects).catch(() => {})
  }, [])

  useEffect(() => {
    listAimHistory(1, 10, selectedProjectId || undefined).then(setHistory).catch(() => {})
  }, [selectedProjectId])

  useEffect(() => {
    if (!isGenerating) return
    const timer = setInterval(() => {
      setLoadingIndex((value) => (value + 1) % LOADING_MESSAGES.length)
    }, 1400)
    return () => clearInterval(timer)
  }, [isGenerating])

  async function handleAgentGenerate() {
    const input = rawInput.trim()
    if (!input) {
      toast.error("请输入素材内容")
      return
    }

    const agent = AGENT_OPTIONS.find((a) => a.id === selectedAgentId)
    if (!agent) return

    setIsGenerating(true)
    setLoadingIndex(0)
    try {
      const response = await generateAimContent({
        rawInput: input,
        targetFormats: agent.defaultFormats,
        projectId: selectedProjectId || undefined,
        polishInstruction: polishInstruction.trim() || undefined,
        taskType: "write_script",
      })
      setResult(response)
      setActiveResultTab(response.results[0]?.format || agent.defaultFormats[0])
      setQualityReport(null)
      listAimHistory(1, 10, selectedProjectId || undefined).then(setHistory).catch(() => {})
      toast.success(`${agent.title}生成完毕`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成失败，请稍后重试")
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleRepurpose(format: ContentFormat) {
    if (!result) return
    const mainContent = result.results.find((r) => r.format === "video_script")?.content
    if (!mainContent) return

    setIsGenerating(true)
    setLoadingIndex(0)
    try {
      const response = await generateAimContent({
        rawInput: `基于以下脚本，派生${FORMAT_LABELS[format]}：\n\n${mainContent}`,
        targetFormats: [format],
        projectId: selectedProjectId || undefined,
        taskType: "repurpose",
      })
      setResult({
        ...response,
        results: [...result.results, ...response.results],
      })
      setActiveResultTab(format)
      listAimHistory(1, 10, selectedProjectId || undefined).then(setHistory).catch(() => {})
      toast.success(`${FORMAT_LABELS[format]}已生成`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成失败")
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleQualityFromResult() {
    const mainContent = result?.results.find((r) => r.format === "video_script")?.content
    if (!mainContent) return

    setIsQualityChecking(true)
    try {
      const report = await checkScriptQuality({
        content: mainContent,
        persona: polishInstruction.trim() || undefined,
      })
      setQualityReport(report)
      toast.success("质检完成")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "质检失败")
    } finally {
      setIsQualityChecking(false)
    }
  }

  async function handleMarkStatus(status: string) {
    if (!result?.id || result.id.startsWith("polish-")) {
      toast.error("只有已保存的生成内容才能推进状态")
      return
    }
    try {
      await updateAimWorkflowStatus(result.id, { workflowStatus: status })
      listAimHistory(1, 10, selectedProjectId || undefined).then(setHistory).catch(() => {})
      toast.success(`已标记为：${workflowStatusLabel(status)}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "状态更新失败")
    }
  }

  async function copyText(content: string, format?: string) {
    await navigator.clipboard.writeText(content)
    if (format) setCopiedFormat(format)
    toast.success("已复制")
    if (format) {
      setTimeout(() => setCopiedFormat(null), 600)
    }
  }

  function handleLoadHistory(item: AimGeneration) {
    setRawInput(item.rawInput)
    const contents = getHistoryContents(item)
    setResult({
      id: item.id,
      results: contents.map((c) => ({
        format: c.format,
        content: c.content,
        wordCount: c.content.length,
      })),
      knowledgeUsed: item.knowledgeUsed || [],
    })
    if (contents.length > 0) {
      setActiveResultTab(contents[0].format)
    }
    setQualityReport(null)
    const target = document.getElementById("aim-raw-input")
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" })
      target.focus()
    }
    toast.success("已加载历史记录")
  }

  async function handleUpdateWorkflowStatus(item: AimGeneration, workflowStatus: string) {
    try {
      const updated = await updateAimWorkflowStatus(item.id, { workflowStatus })
      setHistory((current) => current.map((record) => record.id === item.id ? updated : record))
      toast.success(`已更新为：${workflowStatusLabel(workflowStatus)}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "状态更新失败")
    }
  }

  const hasVideoScript = result?.results.some((r) => r.format === "video_script")
  const hasMomentsPost = result?.results.some((r) => r.format === "moments_post")
  const hasWechatArticle = result?.results.some((r) => r.format === "wechat_article")
  const hasShootingBrief = result?.results.some((r) => r.format === "shooting_brief")

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">AIM 智能体货架</h1>
          <Badge className="badge-gold border-none px-2.5 py-0.5 rounded-sm text-xs shadow-xs">V1 优化版</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          选择您的专属 AI 营销智能体，输入素材即可一键生成对应营销交付物。
        </p>
      </div>

      {/* 智能体选择货架 */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {AGENT_OPTIONS.map((agent) => {
          const Icon = agent.icon
          const isSelected = selectedAgentId === agent.id
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => handleSelectAgent(agent.id)}
              className={`flex flex-col text-left p-4 rounded-xl border transition-all duration-300 ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm scale-[1.01] ring-1 ring-primary/20"
                  : "border-border bg-card hover:border-primary/50 hover:bg-muted/10 hover:shadow-xs"
              }`}
            >
              <div className={`p-2 rounded-lg w-fit ${isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-sm mt-3 text-foreground">{agent.title}</h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{agent.description}</p>
            </button>
          )
        })}
      </div>

      <Card className="border border-border/80 shadow-xs">
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-[240px_1fr]">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">关联IP营销全案</p>
              <Select value={selectedProjectId || "none"} onValueChange={(value) => setSelectedProjectId(value === "none" ? "" : value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择IP营销全案" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不归属IP营销全案</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {projects.length === 0 && (
                <Button size="sm" variant="outline" className="w-full" nativeButton={false} render={<Link href="/projects" />}>
                  先创建IP营销全案
                </Button>
              )}
            </div>

            <div className="space-y-2 bg-muted/20 p-3 rounded-lg border border-dashed border-border flex flex-col justify-center">
              <p className="text-xs font-semibold text-muted-foreground">当前智能体配置</p>
              {(() => {
                const agent = AGENT_OPTIONS.find((a) => a.id === selectedAgentId)
                if (!agent) return null
                return (
                  <div className="mt-1">
                    <span className="inline-flex items-center text-xs font-semibold text-foreground bg-primary/15 text-primary px-2 py-0.5 rounded mr-2">
                      {agent.title}
                    </span>
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      将为您生成：{agent.defaultFormats.map(f => FORMAT_LABELS[f] || f).join('、')}
                    </span>
                  </div>
                )
              })()}
            </div>
          </div>

          {(() => {
            const agent = AGENT_OPTIONS.find((a) => a.id === selectedAgentId)
            if (!agent) return null
            return (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {agent.inputLabel}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isTranscribing || isGenerating || isQualityChecking}
                      className="h-8"
                    >
                      {isRecording ? "说完了" : "语音输入"}
                    </Button>
                  </div>
                  <Textarea
                    id="aim-raw-input"
                    value={rawInput}
                    onChange={(event) => setRawInput(event.target.value)}
                    rows={9}
                    placeholder={agent.placeholder}
                    className="min-h-56 resize-y text-sm leading-relaxed"
                    disabled={isTranscribing || isGenerating || isQualityChecking}
                  />
                  {isTranscribing && (
                    <p className="text-xs text-primary animate-pulse">语音转写中...</p>
                  )}
                </div>

                {/* 推荐问题 Quick Prompts */}
                {agent.quickPrompts && agent.quickPrompts.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-medium text-muted-foreground">输入素材模板推荐（点击一键填充）：</p>
                    <div className="flex flex-wrap gap-2">
                      {agent.quickPrompts.map((prompt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setRawInput(prompt)
                            toast.success("已填充推荐模板")
                          }}
                          className="text-xs text-left px-2.5 py-1.5 rounded-md border border-border bg-muted/40 text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all duration-200"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">修改要求 (可留空或自定义微调)</p>
            <Textarea
              value={polishInstruction}
              onChange={(event) => setPolishInstruction(event.target.value)}
              rows={2}
              className="min-h-16 resize-none text-xs"
              placeholder="例如：优化开头，参考对标文案结构，结合知识库卖点和客户痛点，改成适合这个企业的表达。"
            />
          </div>

          {(() => {
            const agent = AGENT_OPTIONS.find((a) => a.id === selectedAgentId)
            if (!agent) return null
            return (
              <Button
                id="aim-generate-btn"
                size="lg"
                onClick={handleAgentGenerate}
                disabled={isGenerating}
                className="w-full font-semibold shadow-xs transition-transform active:scale-[0.99]"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {LOADING_MESSAGES[loadingIndex]}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {agent.primaryActionLabel}
                  </>
                )}
              </Button>
            )
          })()}
        </CardContent>
      </Card>

      {/* 质检报告 */}
      {qualityReport && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              质检报告
              <Badge variant={qualityReport.overall.passed ? "default" : "destructive"} className="ml-auto">
                {qualityReport.overall.score}分 {qualityReport.overall.passed ? "通过" : "需修改"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { label: "开头吸引力", data: qualityReport.attraction },
                { label: "逻辑性", data: qualityReport.logic },
                { label: "去AI味", data: qualityReport.aiTaste },
                { label: "文笔质量", data: qualityReport.editorial },
              ].map((dim) => (
                <div key={dim.label} className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">{dim.label}</p>
                  <p className={`mt-1 text-2xl font-bold ${dim.data.passed ? "text-green-600" : "text-red-500"}`}>
                    {dim.data.score}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{dim.data.feedback}</p>
                </div>
              ))}
            </div>
            {qualityReport.overall.needsRewrite && (
              <p className="text-sm text-red-500 font-medium">
                建议重写（已自动重写 {qualityReport.rewriteCount} 次）
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 生成结果 */}
      {result && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              生成结果
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={activeResultTab} onValueChange={(value) => setActiveResultTab(value as ContentFormat)}>
              <TabsList className="flex h-auto flex-wrap justify-start">
                {result.results.map((item) => (
                  <TabsTrigger key={item.format} value={item.format}>
                    {FORMAT_LABELS[item.format]}
                  </TabsTrigger>
                ))}
              </TabsList>
              {result.results.map((item) => (
                <TabsContent key={item.format} value={item.format} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="secondary">{FORMAT_LABELS[item.format]} · {item.wordCount} 字</Badge>
                    <Button size="sm" variant="outline" onClick={() => copyText(item.content, item.format)}>
                      {copiedFormat === item.format ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                      复制
                    </Button>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-4">
                    {item.format === "video_script" ? (
                      <ZhuJianContent text={item.content} />
                    ) : (
                      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7">{item.content}</pre>
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            {/* 后续动作 */}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {!hasMomentsPost && (
                <Button size="sm" variant="outline" onClick={() => handleRepurpose("moments_post")} disabled={isGenerating}>
                  <MessageCircle className="h-3.5 w-3.5 mr-1" />
                  生成朋友圈
                </Button>
              )}
              {!hasWechatArticle && (
                <Button size="sm" variant="outline" onClick={() => handleRepurpose("wechat_article")} disabled={isGenerating}>
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  生成公众号
                </Button>
              )}
              {!hasShootingBrief && hasVideoScript && (
                <Button size="sm" variant="outline" onClick={() => handleRepurpose("shooting_brief")} disabled={isGenerating}>
                  <Video className="h-3.5 w-3.5 mr-1" />
                  生成拍摄交接单
                </Button>
              )}
              {!qualityReport && hasVideoScript && (
                <Button size="sm" variant="outline" onClick={handleQualityFromResult} disabled={isQualityChecking}>
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                  进入质检
                </Button>
              )}
              {result.id && !result.id.startsWith("polish-") && (
                <Button size="sm" variant="outline" onClick={() => handleMarkStatus("ready_to_shoot")} disabled={isGenerating}>
                  <Send className="h-3.5 w-3.5 mr-1" />
                  标记为待拍摄
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 最近内容 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            最近内容
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">还没有生成记录。</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {history.slice(0, 8).map((item) => (
                <div key={item.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    className="min-w-0 text-left flex-1"
                    onClick={() => handleLoadHistory(item)}
                  >
                    <p className="line-clamp-1 text-sm font-medium">{item.topicTitle || item.rawInput}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                      {getHistoryContents(item).length > 0 && (
                        <span className="ml-2">
                          {getHistoryContents(item).map((c) => FORMAT_LABELS[c.format]).join("、")}
                        </span>
                      )}
                    </p>
                  </button>
                  <div className="flex items-center gap-2">
                    <Select value={item.workflowStatus || "draft"} onValueChange={(value) => value && handleUpdateWorkflowStatus(item, value)}>
                      <SelectTrigger className="h-8 w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WORKFLOW_STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => handleLoadHistory(item)}>
                      复用
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedHistoryId(expandedHistoryId === item.id ? null : item.id)}
                    >
                      {expandedHistoryId === item.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 展开的历史详情 */}
          {expandedHistoryId && (() => {
            const item = history.find((h) => h.id === expandedHistoryId)
            if (!item) return null
            const contents = getHistoryContents(item)
            return contents.length > 0 ? (
              <div className="mt-3 rounded-lg border p-4 space-y-3">
                {contents.map((c) => (
                  <div key={c.format}>
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="secondary" className="text-xs">{FORMAT_LABELS[c.format]}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => copyText(c.content)}>
                        <Clipboard className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-6 text-muted-foreground bg-muted/20 rounded p-3 max-h-60 overflow-y-auto">
                      {c.content}
                    </pre>
                  </div>
                ))}
              </div>
            ) : null
          })()}
        </CardContent>
      </Card>
    </div>
  )
}
