"use client"

import { useEffect, useState, memo, useMemo, useRef, useCallback, startTransition } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Check,
  Clipboard,
  FileText,
  Image,
  Loader2,
  MessageCircle,
  Mic,
  Sparkles,
  ShieldCheck,
  Plus,
  ArrowRight,
  BookOpen,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { KNOWLEDGE_STRATEGY_PROFILES } from "@/lib/aim-knowledge-strategy"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { IpWikiDialog, type IpWikiDialogContext } from "./ip-wiki-dialog"
import { AimPromptComposer } from "@/components/aim/aim-prompt-composer"
import { ActionStrip } from "@/components/workbench/action-strip"
import { AiResultPanel } from "@/components/workbench/ai-result-panel"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  generateAimContent,
  getVideoCopyExtraction,
  checkScriptQuality,
  chatAim,
  chatAimStream,
  createKnowledge,
  evolveAimConversation,
  evolveStyleConversation,
  ApiError,
  listClientProjects,
  updateAimWorkflowStatus,
  type AimEvolutionSuggestion,
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
import { shouldOpenDeepCopywriter } from "@/lib/video-copy-routing"

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
    intro: "我是你的内容生产官。选题、脚本、朋友圈、长文和发布前质检都在这里处理，先把素材、主题或老板口述丢进来。",
    placeholder: "说说今天要生产什么内容：选题、原始想法、老板口述、客户问题都可以…",
    defaultInstruction: "去 AI 味，保留真人表达的犹豫、判断和具体细节，少用套话。先判断内容类型，再输出适合发布的内容交付物。",
    quickPrompts: [
      "把这个选题写成短视频口播，并顺手给一版朋友圈承接。",
      "粘贴老板在会上的金句片段，整理成可拍脚本和拍摄交接单。",
    ],
    primaryActionLabel: "生成内容",
  },
  deep_copywriter: {
    intro: "我是你的深度文案官。把想法、视频原文、老板口述或对标文案给我，我只做纯粹的长篇文案创作，先搭框架，再写成一篇完整长文。",
    placeholder: "粘贴想法、视频原文、老板口述、对标文案或想借势的热点，我先帮你搭文案框架…",
    defaultInstruction: "只做长篇文案创作。先输出文案框架，包含核心观点、目标读者、情绪入口、正文推进结构、开头方向；再用2-3个半开放选择题挖出用户真实观点。每题选项必须按 A. / B. / C. / D. 独立成行输出，方便用户点击。用户确认框架后，只输出一篇完整长文正文，正文结束立刻停止；不输出拆分方向、私域话术、任何平台分发内容或“你看是否符合”这类确认尾句。热点只能自然融合，禁止硬蹭或编造。",
    quickPrompts: [
      "根据这段视频原文，先搭文案框架，再打磨成适合我表达的一篇长文。",
      "我有一个观点，先帮我挖出真实态度，再写成开头有力量、结构完整的一篇长文。",
    ],
    primaryActionLabel: "生成长篇文案",
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
  business_system_diagnosis: {
    intro: "我是你的商业诊断官。告诉我业务类型、现状数据、卡点和目标，我会诊断商业模式、流量转化、交付结构和核心矛盾。",
    placeholder: "说说你的业务、目前数据、卡在哪、想达到什么结果…",
    defaultInstruction: "按商业诊断官结构输出：业务现状说明、模糊概念澄清、生意系统四层诊断、核心矛盾判断、行业参照校验、多视角复核、三条调整路径、本周最小动作。",
    quickPrompts: [
      "老板 IP 做了三个月没成交，帮我诊断问题。",
      "工程服务账号有播放但没客户，帮我找核心矛盾。",
      "我有产品但不知道怎么获客和成交，帮我做生意体检。",
    ],
    primaryActionLabel: "生成诊断报告",
  },
  content_review: {
    intro: "我是你的数据复盘官。把已发布内容、播放互动数据、评论和转化情况发给我，我会判断这条内容为什么有效或失效，并给出下一轮优化和复用方向。",
    placeholder: "贴一条已发布内容的数据、评论、脚本或链接复盘记录…",
    defaultInstruction: "按发布后复盘结构输出：表现判断、成功或失败原因、下一轮优化动作、可复用资产、可延展新选题、是否沉淀进知识库。不要泛泛夸奖，必须给明确判断。",
    quickPrompts: [
      "这条视频播放高但咨询少，帮我复盘问题并给下一条优化方向。",
      "这条内容评论区反馈不错，帮我拆成可复用选题和朋友圈文案方向。",
    ],
    primaryActionLabel: "生成复盘报告",
  },
  persona: {
    intro: "我来一步步帮你梳理来时路：经历成就 → 低谷转折 → 顿悟 → 现在的产品 → 目标用户 → 标志案例。聊完直接给你置顶视频脚本，还能逐句改。",
    placeholder: "想到什么说什么，乱也没关系。从『某年某月，我…』开始最省事…",
    defaultInstruction: "引导式：每轮只追问一个最关键的缺口并给回答示例，回复必须以【进度 XX%】开头；6 维收齐（100%）后产出『来时路总结 + 逐句口播与配图的置顶视频脚本』；用户说『第N句改X』时只改对应句。口语真诚，避免 AI 腔和过时热点。",
    quickPrompts: [
      "从『某年某月，我出生在…』开始讲我的来时路",
      "我想做一条置顶视频讲清楚我是谁、为什么做现在这件事",
    ],
    primaryActionLabel: "梳理来时路",
  },
}

const AGENT_OPTIONS: AimAgentOption[] = AIM_AGENT_OPTIONS.map((meta) => ({
  ...meta,
  ...AGENT_EXTRAS[meta.id],
}))

const FORMAT_LABELS: Record<ContentFormat, string> = {
  video_script: "口播文案",
  wechat_article: "公众号文章",
  moments_post: "朋友圈文案",
  community_message: "社群运营文案",
  shooting_brief: "拍摄交接单",
  raw_copy: "诊断报告",
  koubo_script: "口播文案",
  xiaohongshu_post: "小红书图文",
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

interface ChoiceGroup {
  question: string
  options: Array<{ label: string; text: string }>
}

function cleanChoiceText(text: string) {
  return text.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim()
}

/** 从人设故事官的回复里解析【进度 XX%】，用于顶部进度条 */
function extractProgress(content: string): number | null {
  const m = content.match(/【进度\s*(\d+)\s*%】/)
  if (!m) return null
  const v = parseInt(m[1], 10)
  return Number.isNaN(v) ? null : Math.min(100, Math.max(0, v))
}

function extractChoiceGroups(content: string): ChoiceGroup[] {
  const lines = content.split("\n")
  const groups: ChoiceGroup[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const first = lines[i].trim().match(/^([A-D])[\s.、．)]\s*(.+)$/)
    if (!first) continue

    const options = []
    let j = i
    while (j < lines.length) {
      const match = lines[j].trim().match(/^([A-D])[\s.、．)]\s*(.+)$/)
      if (!match) break
      const text = cleanChoiceText(match[2])
      if (text.length > 0 && text.length <= 120) options.push({ label: match[1], text })
      j += 1
    }

    let question = "请选择一个方向"
    for (let k = i - 1; k >= 0; k -= 1) {
      const line = cleanChoiceText(lines[k])
      if (line && !/^([A-D])[\s.、．)]/.test(line)) {
        question = line
        break
      }
    }
    if (options.length > 1) groups.push({ question, options })
    i = j
  }
  return groups
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
  agentId?: string | null
  deliverables?: AimGenerateResponse | null
  qualityReport?: QualityCheckReport | null
}

function ChoiceStepper({
  groups,
  busy,
  onSubmit,
}: {
  groups: ChoiceGroup[]
  busy: boolean
  onSubmit: (text: string) => void
}) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const group = groups[step]
  if (!group) return null

  const selected = answers[step]
  const isLast = step === groups.length - 1

  function next() {
    if (!selected) return
    if (!isLast) {
      setStep((current) => current + 1)
      return
    }
    onSubmit(groups.map((item, index) => `${index + 1}. ${item.question}\n${answers[index]}`).join("\n\n"))
  }

  return (
    <div className="mt-3 max-w-xl rounded-xl border bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">
          {step + 1}/{groups.length} · {group.question}
        </p>
        <Button size="sm" variant="ghost" className="h-7 px-2" disabled={busy || !selected} onClick={next}>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-2">
        {group.options.map((option) => {
          const value = `${option.label}. ${option.text}`
          return (
            <Button
              key={value}
              type="button"
              variant={selected === value ? "default" : "outline"}
              className="h-auto justify-start whitespace-normal px-3 py-2 text-left text-xs"
              disabled={busy}
              onClick={() => setAnswers((current) => ({ ...current, [step]: value }))}
            >
              <span className="mr-1 font-semibold">{option.label}</span>
              {option.text}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

const AIM_DRAFT_STORAGE_KEY = "aim-workbench-draft-v1"

interface AimDraft {
  selectedAgentId: AimAgentId
  selectedProjectId: string
  input: string
  messages: ChatMessage[]
  videoCopyExtractionId?: string
}

function loadAimDraft(): AimDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(AIM_DRAFT_STORAGE_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw) as Partial<AimDraft>
    if (!isValidAimAgent(draft.selectedAgentId) || !Array.isArray(draft.messages)) return null
    return {
      selectedAgentId: draft.selectedAgentId,
      selectedProjectId: typeof draft.selectedProjectId === "string" ? draft.selectedProjectId : "",
      input: typeof draft.input === "string" ? draft.input : "",
      messages: draft.messages,
      videoCopyExtractionId: typeof draft.videoCopyExtractionId === "string" ? draft.videoCopyExtractionId : undefined,
    }
  } catch {
    return null
  }
}

function saveAimDraft(draft: AimDraft) {
  if (typeof window === "undefined") return
  try {
    if (!draft.input.trim() && draft.messages.length === 0) {
      window.sessionStorage.removeItem(AIM_DRAFT_STORAGE_KEY)
      return
    }
    window.sessionStorage.setItem(AIM_DRAFT_STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // ponytail: losing a browser draft is better than breaking the editor.
  }
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
        const displayLine = line.replace(/\*\*/g, "")
        const regex = /(【[^】]+】)/g
        const parts = displayLine.split(regex)
        if (parts.length > 1) {
          return (
            <p key={index} className="text-sm sm:text-base leading-loose my-2 text-[#2c2b2a] dark:text-[#f3ede2]">
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
          <p key={index} className="text-sm sm:text-base leading-loose my-2 text-[#2c2b2a] dark:text-[#f3ede2] min-h-6">
            {displayLine}
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
  onUpdateResults,
  onCompileToWiki,
}: {
  deliverables: AimGenerateResponse
  onRepurpose: (format: ContentFormat) => void
  onQuality: () => void
  onMarkStatus: (status: string) => void
  isBusy: boolean
  onUpdateResults?: (newResults: AimGenerateResponse["results"]) => void
  onCompileToWiki?: () => void
}) {
  const [activeTab, setActiveTab] = useState<ContentFormat>(deliverables.results[0]?.format || "raw_copy")
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null)
  
  const [isEditing, setIsEditing] = useState(false)
  const [editingText, setEditingText] = useState("")

  const activeFormat = deliverables.results.some((r) => r.format === activeTab)
    ? activeTab
    : deliverables.results[0]?.format || "raw_copy"

  useEffect(() => {
    startTransition(() => setIsEditing(false))
  }, [activeTab, deliverables])

  const handleStartEdit = (content: string) => {
    setEditingText(content)
    setIsEditing(true)
  }

  const handleSaveEdit = (format: ContentFormat) => {
    if (!onUpdateResults) return
    const newResults = deliverables.results.map((r) =>
      r.format === format
        ? { ...r, content: editingText, wordCount: editingText.length }
        : r
    )
    onUpdateResults(newResults)
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
  }

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
  const hasVideo = deliverables.results.some((r) => r.format === "video_script")
  const hasKoubo = deliverables.results.some((r) => r.format === "koubo_script")
  const hasXiaohongshu = deliverables.results.some((r) => r.format === "xiaohongshu_post")

  return (
    <div className="mt-2 w-full">
      <AiResultPanel
        title="AI 交付物"
        icon={<Sparkles className="h-4 w-4 text-primary animate-pulse" />}
        meta={
          <div className="flex items-center gap-1.5">
            {deliverables.knowledgeStrategy && (
              <Badge variant="outline" className="text-[10px]">
                {KNOWLEDGE_STRATEGY_PROFILES[deliverables.knowledgeStrategy as keyof typeof KNOWLEDGE_STRATEGY_PROFILES]?.label ?? deliverables.knowledgeStrategy}
              </Badge>
            )}
            {deliverables.knowledgeUsed?.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">已用知识库 {deliverables.knowledgeUsed.length} 条</Badge>
            )}
          </div>
        }
        flat
      >
        <Tabs value={activeFormat} onValueChange={(v) => setActiveTab(v as ContentFormat)} className="w-full">
          <TabsList className="flex h-auto flex-wrap justify-start bg-transparent p-0 gap-1 mb-4 border-b border-border/40 pb-1 rounded-none">
            {deliverables.results.map((item) => (
              <TabsTrigger
                key={item.format}
                value={item.format}
                className="text-xs px-3 py-1.5 rounded-md data-[state=active]:bg-muted/80 data-[state=active]:shadow-none"
              >
                {FORMAT_LABELS[item.format]}
              </TabsTrigger>
            ))}
          </TabsList>
          {deliverables.results.map((item) => (
            <TabsContent key={item.format} value={item.format} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-muted/50 text-[11px]">{FORMAT_LABELS[item.format]} · {item.wordCount} 字</Badge>
                  {isEditing && item.format === activeFormat && (
                    <span className="text-[10px] text-primary animate-pulse font-medium">编辑中...</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {isEditing && item.format === activeFormat ? (
                    <>
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                        onClick={() => handleSaveEdit(item.format)}
                      >
                        保存
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs px-2 text-muted-foreground"
                        onClick={handleCancelEdit}
                      >
                        取消
                      </Button>
                    </>
                  ) : (
                    <>
                      {onUpdateResults && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2.5"
                          onClick={() => handleStartEdit(item.content)}
                        >
                          编辑
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => copyText(item.content, item.format)}>
                        {copiedFormat === item.format ? <Check className="h-3.5 w-3.5 mr-1" /> : <Clipboard className="h-3.5 w-3.5 mr-1" />}
                        复制
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="max-h-[600px] overflow-y-auto py-1">
                {isEditing && item.format === activeFormat ? (
                  <textarea
                    className="w-full min-h-[350px] max-h-[500px] p-3 text-sm sm:text-base leading-relaxed bg-muted/10 text-foreground border border-border/80 rounded-lg focus:ring-1 focus:ring-primary focus:border-transparent outline-none font-sans resize-y"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    placeholder="请输入并修改文案内容..."
                  />
                ) : item.format === "video_script" ? (
                  <ZhuJianContent text={item.content} />
                ) : (
                  <MarkdownRenderer content={item.content} />
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <ActionStrip>
          {!hasKoubo && hasVideo && (
            <Button size="sm" variant="outline" onClick={() => onRepurpose("koubo_script")} disabled={isBusy}>
              <Mic className="h-3.5 w-3.5 mr-1" /> 口播文案
            </Button>
          )}
          {!hasXiaohongshu && hasVideo && (
            <Button size="sm" variant="outline" onClick={() => onRepurpose("xiaohongshu_post")} disabled={isBusy}>
              <Image className="h-3.5 w-3.5 mr-1" /> 小红书图文
            </Button>
          )}
          {!hasMoments && hasVideo && (
            <Button size="sm" variant="outline" onClick={() => onRepurpose("moments_post")} disabled={isBusy}>
              <MessageCircle className="h-3.5 w-3.5 mr-1" /> 朋友圈文案
            </Button>
          )}
          {!hasWechat && hasVideo && (
            <Button size="sm" variant="outline" onClick={() => onRepurpose("wechat_article")} disabled={isBusy}>
              <FileText className="h-3.5 w-3.5 mr-1" /> 公众号文章
            </Button>
          )}
          {onCompileToWiki && (
            <Button size="sm" variant="outline" onClick={onCompileToWiki} disabled={isBusy}>
              <BookOpen className="h-3.5 w-3.5 mr-1" /> 编译进 IP 维基
            </Button>
          )}
        </ActionStrip>
      </AiResultPanel>
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
  const videoCopyExtractionIdParam = searchParams.get("videoCopyExtractionId")
  const modeParam = searchParams.get("mode")
  const ideaParam = searchParams.get("idea")
  const activeAgentId: AimAgentId = isValidAimAgent(agentParam) ? agentParam : DEFAULT_AIM_AGENT
  const [initialDraft] = useState<AimDraft | null>(() => loadAimDraft())
  const [selectedAgentId, setSelectedAgentId] = useState<AimAgentId>(() => agentParam ? activeAgentId : initialDraft?.selectedAgentId || activeAgentId)
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialDraft?.messages || [])
  const [input, setInput] = useState(() => initialDraft?.input || "")
  const [sourceVideoCopyExtractionId, setSourceVideoCopyExtractionId] = useState<string | undefined>(() => initialDraft?.videoCopyExtractionId)
  const [isThinking, setIsThinking] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isQualityChecking, setIsQualityChecking] = useState(false)
  const [loadingIndex, setLoadingIndex] = useState(0)
  const [projects, setProjects] = useState<ClientProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState(() => initialDraft?.selectedProjectId || "")
  const [wikiDialog, setWikiDialog] = useState<{ open: boolean; context: IpWikiDialogContext | null }>({
    open: false,
    context: null,
  })
  const [projectEnabled, setProjectEnabled] = useState(true)
  const [isEvolving, setIsEvolving] = useState(false)
  const [evolutionSuggestions, setEvolutionSuggestions] = useState<AimEvolutionSuggestion[]>([])

  // 历史记录由侧边栏共享 store 管理（侧边栏渲染列表、生成成功后刷新、点击后触发加载）
  const storeHistory = useAimWorkspaceStore((s) => s.history)
  const loadTargetId = useAimWorkspaceStore((s) => s.loadTargetId)
  const refreshHistory = useAimWorkspaceStore((s) => s.fetchHistory)
  const clearLoadTarget = useAimWorkspaceStore((s) => s.clearLoadTarget)

  const scrollRef = useRef<HTMLDivElement>(null)
  const requestAbortRef = useRef<AbortController | null>(null)

  const agent = useMemo(() => {
    const baseAgent = AGENT_OPTIONS.find((a) => a.id === selectedAgentId)!
    if (selectedAgentId === "ip_video" && modeParam === "asset_pack") {
      return {
        ...baseAgent,
        title: "内容生产官 · 内容资产包",
        intro: "我是内容生产官的内容资产包模式。一键为你的选题、对标文案或原始想法生成短视频脚本、拍摄交接单、朋友圈、社群运营、公众号文章全套宣发资产。",
        placeholder: "说说今天要生产什么内容：选题、原始想法、对标文案、老板口述均可，我将为您一键生成全套内容资产包...",
        defaultFormats: [
          "video_script" as const,
          "shooting_brief" as const,
          "moments_post" as const,
          "community_message" as const,
          "wechat_article" as const,
        ],
        quickPrompts: [
          "把这个选题生成全套内容资产包（含短视频脚本、朋友圈、公众号等）。",
          "基于老板的这段金句，一键输出全套宣发资产包。",
        ],
        primaryActionLabel: "生成全套资产包",
      }
    }
    if (selectedAgentId === "ip_video") {
      return {
        ...baseAgent,
        title: "内容生产官 · 单篇创作",
        defaultFormats: ["video_script" as const],
        placeholder: "说说今天要生产什么内容：选题、原始想法、老板口述、客户问题都可以…",
        primaryActionLabel: "生成口播文案",
      }
    }
    return baseAgent
  }, [selectedAgentId, modeParam])

  const { isRecording, isTranscribing, startRecording, stopRecording } = useAudioRecorder({
    transcribeFn: transcribeAudio,
    onTranscribeSuccess: (text) => setInput((prev) => (prev ? `${prev}\n${text}` : text)),
  })

  useEffect(() => {
    listClientProjects()
      .then((items) => {
        setProjects(items)
        setSelectedProjectId((current) => current || items[0]?.id || "")
      })
      .catch(() => {})
  }, [])

  const lastAgentParamRef = useRef(agentParam)

  useEffect(() => {
    saveAimDraft({ selectedAgentId, selectedProjectId, input, messages, videoCopyExtractionId: sourceVideoCopyExtractionId })
  }, [input, messages, selectedAgentId, selectedProjectId, sourceVideoCopyExtractionId])

  // 切换智能体（由全局侧边栏的 ?agent= 驱动）：同步选中态并重置当前对话
  useEffect(() => {
    if (lastAgentParamRef.current === agentParam) return
    lastAgentParamRef.current = agentParam
    startTransition(() => {
      setSelectedAgentId(activeAgentId)
      setMessages([])
      setInput("")
    })
  }, [activeAgentId, agentParam])

  useEffect(() => {
    if (!topicTitleParam && !topicRationaleParam && !projectIdParam && !ideaParam) return

    const prefillLines = [
      topicTitleParam ? `选题：${topicTitleParam}` : null,
      topicRationaleParam ? `选题依据：${topicRationaleParam}` : null,
      ideaParam ? `创作灵感：${ideaParam}` : null,
    ].filter(Boolean)

    startTransition(() => {
      if (projectIdParam) setSelectedProjectId(projectIdParam)
      setMessages([])
      setInput(prefillLines.join("\n"))
      setSourceVideoCopyExtractionId(undefined)
    })

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("topicTitle")
    nextParams.delete("topicRationale")
    nextParams.delete("projectId")
    nextParams.delete("idea")
    router.replace(nextParams.toString() ? `/aim?${nextParams.toString()}` : "/aim")
  }, [projectIdParam, router, searchParams, topicRationaleParam, topicTitleParam, ideaParam])

  useEffect(() => {
    if (!videoCopyExtractionIdParam) return

    getVideoCopyExtraction(videoCopyExtractionIdParam)
      .then((record) => {
        const isDeepCopy = shouldOpenDeepCopywriter(record)
        const prefill = [
          isDeepCopy
            ? "请基于下面这条长对标文案和已有拆解，提炼它的开头机制、结构节奏和心理推进方式，再结合我的知识库，创作一篇适合我自己的完整长篇文案。"
            : "请基于下面这条对标文案，结合我的知识库，改写成适合我自己的口播文案。",
          "",
          isDeepCopy ? "创作原则：" : "改写原则：",
          isDeepCopy
            ? "1. 先参考拆解里的开头类型和情绪入口，重新设计适合我的长文开头。"
            : "1. 开头第一句话不要轻易变，除非明显不适合我的产品和人设。",
          isDeepCopy
            ? "2. 参考拆解里的正文结构、转折节奏和心理推进，但不要照搬原文。"
            : "2. 中间结构框架不要轻易变，保留原文的信息推进顺序和节奏。",
          isDeepCopy
            ? "3. 用我的产品、案例、用户痛点和人设表达重新完成创作。"
            : "3. 只替换产品、案例、用户痛点、人设表达和行动引导。",
          "",
          record.videoTitle ? `对标标题：${record.videoTitle}` : null,
          "对标原文：",
          record.transcript || "",
          record.analysisResult ? "\n已有拆解：" : null,
          record.analysisResult ? JSON.stringify(record.analysisResult, null, 2) : null,
        ].filter(Boolean).join("\n")

        startTransition(() => {
          if (isDeepCopy) setSelectedAgentId("deep_copywriter")
          setMessages([])
          setInput(prefill)
          setSourceVideoCopyExtractionId(record.id)
        })
        toast.success("已带入对标文案")
      })
      .catch(() => toast.error("对标文案加载失败"))
      .finally(() => {
        const nextParams = new URLSearchParams(searchParams.toString())
        nextParams.delete("videoCopyExtractionId")
        router.replace(nextParams.toString() ? `/aim?${nextParams.toString()}` : "/aim")
      })
  }, [router, searchParams, videoCopyExtractionIdParam])

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
              agentId: item.agentId ?? undefined,
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

  /** 人设故事官：取最近一条助手回复的【进度 XX%】驱动顶部进度条 */
  const personaProgress = useMemo(() => {
    if (agent.id !== "persona") return null
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")
    return lastAssistant ? extractProgress(lastAssistant.content) : null
  }, [messages, agent.id])

  function resetConversation() {
    setMessages([])
    setInput("")
    setSourceVideoCopyExtractionId(undefined)
    if (typeof window !== "undefined") window.sessionStorage.removeItem(AIM_DRAFT_STORAGE_KEY)
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
    if (/热点|竞品|优质账号|参考|数据/.test(text) && /导入|同步/.test(text)) return "import_lark_archive_data"
    if (/项目/.test(text) && /导入|同步/.test(text)) return "import_lark_project_data"
    if (/回写|同步到飞书|同步.*脚本|同步.*内容/.test(text)) return "export_lark_generation"
    return null
  }

  function latestDeliverableId() {
    return [...messages].reverse().find((m) => m.deliverables?.id)?.deliverables?.id
  }

  async function sendText(text: string) {
    if (!text) return
    const controller = new AbortController()
    requestAbortRef.current = controller
    const userMsg: ChatMessage = { id: nextId(), role: "user", content: text }
    const thread = [...messages, userMsg]
    setMessages(thread)
    setInput("")
    setIsThinking(true)
    try {
      const toolAction = detectLarkToolAction(text)
      if (toolAction && projectEnabled && !selectedProjectId) {
        toast.error("你的 IP 营销全案还在配置中")
        return
      }
      const resultId = toolAction === "export_lark_generation" ? latestDeliverableId() : undefined
      if (toolAction === "export_lark_generation" && !resultId) {
        toast.error("当前没有可同步到飞书的 AIM 生成结果")
        return
      }
      const chatMessages = thread.map((m) => ({ role: m.role, content: m.content }))
      if (toolAction) {
        const { content } = await chatAim(chatMessages, {
          agentId: selectedAgentId,
          projectId: projectEnabled ? selectedProjectId || undefined : undefined,
          toolAction,
          resultId,
          signal: controller.signal,
        })
        setMessages((prev) => [...prev, { id: nextId(), role: "assistant", content }])
        return
      }

      const assistantId = nextId()
      let hasContent = false
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }])
      await chatAimStream(chatMessages, {
        agentId: selectedAgentId,
        projectId: projectEnabled ? selectedProjectId || undefined : undefined,
        signal: controller.signal,
        onDelta: (_delta, content) => {
          hasContent = content.length > 0
          setIsThinking(false)
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId ? { ...message, content } : message
            )
          )
        },
      })
      if (!hasContent) {
        setMessages((prev) => prev.filter((message) => message.id !== assistantId))
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 499) toast.info("已停止")
      else toast.error(error instanceof Error ? error.message : "对话失败，请稍后重试")
    } finally {
      if (requestAbortRef.current === controller) requestAbortRef.current = null
      setIsThinking(false)
    }
  }

  async function handleEvolveConversation() {
    const sourceMessages = messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({ role: message.role, content: message.content }))

    if (sourceMessages.length < 2) {
      toast.error("对话太少，还没有可沉淀的偏好")
      return
    }

    // 纯文案模式（未启用 IP 全案）也能沉淀全局写作风格；选了项目则同时提炼项目偏好
    const canEvolveProject = projectEnabled && !!selectedProjectId

    setIsEvolving(true)
    try {
      const results = await Promise.allSettled([
        evolveStyleConversation({ messages: sourceMessages }),
        canEvolveProject
          ? evolveAimConversation({ projectId: selectedProjectId, messages: sourceMessages })
          : Promise.resolve<AimEvolutionSuggestion[]>([]),
      ])

      const [styleOutcome, projectOutcome] = results

      if (styleOutcome.status === "fulfilled") {
        const r = styleOutcome.value
        if (r.profile) {
          toast.success(r.created ? "已建立全局写作风格档案" : "全局写作风格档案已更新")
        } else if (r.reason === "no_style") {
          toast.info("这轮对话还没有明显的写作风格可沉淀")
        }
      } else {
        toast.error("写作风格沉淀失败")
      }

      if (projectOutcome.status === "fulfilled") {
        setEvolutionSuggestions(projectOutcome.value)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "偏好提炼失败")
    } finally {
      setIsEvolving(false)
    }
  }

  async function handleSaveEvolutionSuggestion(suggestion: AimEvolutionSuggestion) {
    if (!selectedProjectId) {
      toast.error("请先选择 IP 营销全案")
      return
    }
    try {
      await createKnowledge({
        projectId: selectedProjectId,
        category: suggestion.category,
        title: suggestion.title,
        content: suggestion.content,
        tags: suggestion.tags,
        sourceType: "manual",
      })
      setEvolutionSuggestions((prev) => prev.filter((item) => item !== suggestion))
      toast.success("已沉淀进知识库")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "知识沉淀失败")
    }
  }

  async function handleSend() {
    await sendText(input.trim())
  }

  async function handleGenerate() {
    const rawInput = buildRawInputForGenerate(input.trim() || undefined)
    if (!rawInput) {
      toast.error("请先在对话框里说点素材或需求")
      return
    }
    if (projectEnabled && !selectedProjectId) {
      toast.error("你的 IP 营销全案还在配置中")
      return
    }
    const controller = new AbortController()
    requestAbortRef.current = controller
    setIsGenerating(true)
    setLoadingIndex(0)
    try {
      const response = await generateAimContent({
        agentId: selectedAgentId,
        rawInput,
        targetFormats: agent.defaultFormats,
        projectId: projectEnabled ? selectedProjectId || undefined : undefined,
        videoCopyExtractionId: sourceVideoCopyExtractionId,
        polishInstruction: agent.defaultInstruction,
        taskType: "write_script",
        useMarketViralVideos: selectedAgentId === "business_diagnosis",
      }, controller.signal)
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: `${agent.title} 交付物已生成，可直接复制使用，也能继续在下方对话里让我改写。`,
          agentId: agent.id,
          deliverables: response,
        },
      ])
      if (input.trim()) setInput("")
      refreshHistory({ force: true })
      toast.success(`${agent.primaryActionLabel}完毕`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 499) toast.info("已停止")
      else toast.error(error instanceof Error ? error.message : "生成失败，请稍后重试")
    } finally {
      if (requestAbortRef.current === controller) requestAbortRef.current = null
      setIsGenerating(false)
    }
  }

  function handleStop() {
    requestAbortRef.current?.abort()
  }

  const handleRepurpose = useCallback(
    (msgId: string) => async (fmt: ContentFormat) => {
        setIsGenerating(true)
        setLoadingIndex(0)
        try {
          if (projectEnabled && !selectedProjectId) {
          toast.error("你的 IP 营销全案还在配置中")
          return
        }
        const base = messages.find((m) => m.id === msgId)?.deliverables
        const mainContent = base?.results.find((r) => r.format === "video_script")?.content
        if (!mainContent) return
        const response = await generateAimContent({
          rawInput: `基于以下脚本，派生${FORMAT_LABELS[fmt]}：\n\n${mainContent}`,
          targetFormats: [fmt],
          projectId: projectEnabled ? selectedProjectId || undefined : undefined,
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
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {/* 小屏智能体切换 */}
            <div className="md:hidden">
              <Select value={selectedAgentId} onValueChange={(v) => { if (v !== selectedAgentId) router.push(`/aim?agent=${v}`) }}>
                <SelectTrigger className="h-9 w-[130px]">
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
            <div className="min-w-0 mr-1">
              <p className="truncate text-sm font-semibold text-foreground">{agent.title}</p>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">{agent.description}</p>
            </div>

          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={projectEnabled ? "secondary" : "outline"}
              className="hidden h-8 max-w-[220px] gap-1.5 truncate sm:inline-flex"
              onClick={() => setProjectEnabled((v) => !v)}
              title={projectEnabled ? "已启用 IP 全案上下文，点击切到纯文案模式" : "纯文案模式，点击启用 IP 全案上下文"}
            >
              {projectEnabled
                ? (projects.find((p) => p.id === selectedProjectId)?.name ?? "IP 全案")
                : "纯文案模式"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              onClick={() => void handleEvolveConversation()}
              disabled={isThinking || isGenerating || isEvolving || messages.length < 2}
              title="从当前对话提炼客户偏好 + 更新全局写作风格档案"
            >
              {isEvolving ? "提炼中" : "沉淀偏好与风格"}
            </Button>
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
            正在加载你的 IP 营销全案，请稍后再生成内容。
          </div>
        )}

        {personaProgress != null && (
          <div className="border-b bg-primary/5 px-3 py-2">
            <div className="mx-auto flex max-w-2xl items-center gap-2">
              <span className="shrink-0 text-[11px] font-medium text-primary">来时路信息收集</span>
              <Progress value={personaProgress} className="h-1.5 flex-1" />
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{personaProgress}%</span>
            </div>
          </div>
        )}

        {evolutionSuggestions.length > 0 && (
          <div className="border-b bg-muted/30 px-3 py-3">
            <div className="mx-auto max-w-2xl space-y-2">
              <p className="text-xs font-medium text-muted-foreground">发现可沉淀的客户偏好</p>
              {evolutionSuggestions.map((suggestion) => (
                <div key={`${suggestion.title}-${suggestion.content}`} className="rounded-md border bg-background p-3">
                  <p className="text-sm font-medium text-foreground">{suggestion.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{suggestion.content}</p>
                  <div className="mt-2 flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => setEvolutionSuggestions((prev) => prev.filter((item) => item !== suggestion))}
                    >
                      忽略
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => void handleSaveEvolutionSuggestion(suggestion)}
                    >
                      写入知识库
                    </Button>
                  </div>
                </div>
              ))}
            </div>
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
            <div className="mx-auto flex max-w-6xl w-full flex-col gap-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`${m.deliverables ? "w-full max-w-full" : "max-w-[88%]"} ${m.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                    <div
                      className={`leading-relaxed ${
                        m.role === "user"
                          ? "rounded-2xl rounded-tr-sm bg-muted px-4 py-2 text-sm text-foreground"
                          : "bg-transparent p-0 text-sm sm:text-base text-foreground/90 font-medium"
                      }`}
                    >
                      {m.role === "assistant" ? (
                        <MarkdownRenderer content={m.content} />
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      )}
                    </div>

                    {m.role === "assistant" && extractChoiceGroups(m.content).length > 0 && (
                      <ChoiceStepper
                        groups={extractChoiceGroups(m.content)}
                        busy={busy}
                        onSubmit={(text) => void sendText(text)}
                      />
                    )}

                    {/* 交付物气泡 */}
                    {m.deliverables && (
                      <div className="w-full mt-2">
                        <DeliverableBubble
                          deliverables={m.deliverables}
                          onRepurpose={handleRepurpose(m.id)}
                          onQuality={handleQuality(m.id)}
                          onMarkStatus={handleMarkStatus(m.id)}
                          isBusy={busy}
                          onUpdateResults={(newResults) => {
                            setMessages((prev) =>
                              prev.map((msg) =>
                                msg.id === m.id && msg.deliverables
                                  ? { ...msg, deliverables: { ...msg.deliverables, results: newResults } }
                                  : msg
                              )
                            )
                          }}
                          onCompileToWiki={
                            m.agentId === "business_diagnosis" &&
                            !!selectedProjectId &&
                            !!m.deliverables.results.some((r) => r.format === "raw_copy")
                              ? () => {
                                  const text =
                                    m.deliverables!.results.find((r) => r.format === "raw_copy")?.content ?? ""
                                  setWikiDialog({
                                    open: true,
                                    context: {
                                      projectId: selectedProjectId,
                                      sourceGenerationId: m.deliverables!.id,
                                      positioningText: text,
                                    },
                                  })
                                }
                              : undefined
                          }
                        />
                      </div>
                    )}

                    {/* 质检报告 */}
                    {m.qualityReport && (
                      <div className="mt-2 w-full rounded-xl border border-primary/20 bg-card p-4">
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
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-1 bg-transparent p-0">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    思考中…
                  </div>
                </div>
              )}
              {isGenerating && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-1 bg-transparent p-0">
                    <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                    {LOADING_MESSAGES[loadingIndex]}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 输入区 */}
        <footer className="border-t px-3 py-2 sm:px-5">
          <AimPromptComposer
            value={input}
            placeholder={agent.placeholder}
            busy={busy}
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            isGenerating={isGenerating}
            canGenerate={Boolean(selectedProjectId) && (messages.some((m) => m.role === "user") || input.trim().length > 0)}
            primaryActionLabel={agent.primaryActionLabel}
            onChange={setInput}
            onSend={handleSend}
            onGenerate={handleGenerate}
            onStop={handleStop}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
          />
        </footer>
      </section>

      {wikiDialog.open && wikiDialog.context && (
        <IpWikiDialog
          key={wikiDialog.context.sourceGenerationId ?? "ip-wiki"}
          context={wikiDialog.context}
          onClose={() => setWikiDialog((prev) => ({ ...prev, open: false }))}
        />
      )}
    </div>
  )
}
