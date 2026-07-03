"use client"

import { useEffect, useState, memo, useMemo, useRef, useCallback, startTransition } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Check,
  Clipboard,
  FileText,
  Image as ImageIcon,
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
  polishScript,
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
import {
  buildAimGuideTemplate,
  buildAimNextActionPrompt,
  getAimAgentGuide,
  type AimAgentGuide,
  type AimNextAction,
} from "@/lib/aim-agent-guides"
import { useAimWorkspaceStore } from "@/lib/aim-workspace-store"
import { buildBenchmarkLengthRule, buildBenchmarkRecreationSopBlock } from "@/lib/aim-benchmark-length"
import { assessBenchmarkRewrite } from "@/lib/aim-benchmark-quality"
import { shouldOpenDeepCopywriter } from "@/lib/video-copy-routing"
import { cleanVideoCopyAnalysisMarkdown } from "@/lib/video-copy-display"
import { detectAimWorkbenchCommand, type AimWorkbenchCommand } from "@/lib/aim-workbench-commands"
import {
  EDITOR_PANEL_DEFAULT_WIDTH,
  applyFirstMatchingStructureToReference,
  applySelectionReplacement,
  clampEditorPanelWidth,
  extractEditorDraftFromAssistantText,
  extractReplacementDraft,
  type AimEditorContext,
  type TextSelectionRange,
} from "@/lib/aim-editor"

interface AimAgentOption extends AimAgentMeta, AimAgentGuide {}

const AGENT_OPTIONS: AimAgentOption[] = AIM_AGENT_OPTIONS.map((meta) => ({
  ...meta,
  ...getAimAgentGuide(meta.id),
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
const SOFT_ACTION_CLASS = "h-7 rounded-md border-0 bg-muted/45 px-2 text-xs text-muted-foreground shadow-none hover:bg-muted hover:text-foreground"
const ACTIVE_SOFT_ACTION_CLASS = "h-7 rounded-md border-0 bg-primary/10 px-2 text-xs text-primary shadow-none hover:bg-primary/15"

interface EditorPanelLabels {
  title: string
  collapsedTitle: string
  referenceTitle: string
  referencePlaceholder: string
  draftTitle: string
  draftPlaceholder: string
  currentLabel: string
  selectActionLabel: string
  documentType: "copy" | "plan"
}

const COPY_EDITOR_LABELS: EditorPanelLabels = {
  title: "文案编辑",
  collapsedTitle: "展开文案编辑",
  referenceTitle: "对标文案",
  referencePlaceholder: "暂无对标原文案",
  draftTitle: "我的稿子",
  draftPlaceholder: "AI 生成的稿子会出现在这里，也可以直接粘贴/编辑。",
  currentLabel: "当前稿",
  selectActionLabel: "修改选中文案",
  documentType: "copy",
}

function getEditorPanelLabels(agentId: AimAgentId): EditorPanelLabels {
  if (agentId === "ip_video" || agentId === "deep_copywriter") return COPY_EDITOR_LABELS

  if (agentId === "business_system_diagnosis") {
    return {
      title: "诊断案编辑",
      collapsedTitle: "展开诊断案编辑",
      referenceTitle: "业务材料",
      referencePlaceholder: "暂无业务材料",
      draftTitle: "我的诊断案",
      draftPlaceholder: "AI 生成的诊断案会出现在这里，也可以直接粘贴/编辑。",
      currentLabel: "当前诊断案",
      selectActionLabel: "修改选中诊断案",
      documentType: "plan",
    }
  }

  if (agentId === "persona") {
    return {
      title: "人设策划案编辑",
      collapsedTitle: "展开人设策划案编辑",
      referenceTitle: "人物材料",
      referencePlaceholder: "暂无人物材料",
      draftTitle: "我的人设策划案",
      draftPlaceholder: "AI 生成的人设策划案会出现在这里，也可以直接粘贴/编辑。",
      currentLabel: "当前人设策划案",
      selectActionLabel: "修改选中策划案",
      documentType: "plan",
    }
  }

  if (agentId === "business_diagnosis") {
    return {
      title: "策划案编辑",
      collapsedTitle: "展开策划案编辑",
      referenceTitle: "参考材料",
      referencePlaceholder: "暂无参考材料",
      draftTitle: "我的策划案",
      draftPlaceholder: "AI 生成的定位策划案会出现在这里，也可以直接粘贴/编辑。",
      currentLabel: "当前策划案",
      selectActionLabel: "修改选中策划案",
      documentType: "plan",
    }
  }

  return {
    title: "策划案编辑",
    collapsedTitle: "展开策划案编辑",
    referenceTitle: "参考材料",
    referencePlaceholder: "暂无参考材料",
    draftTitle: "我的策划案",
    draftPlaceholder: "AI 生成的策划案会出现在这里，也可以直接粘贴/编辑。",
    currentLabel: "当前策划案",
    selectActionLabel: "修改选中策划案",
    documentType: "plan",
  }
}

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
  editorApply?: { range: TextSelectionRange } | null
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

function AgentGuidePanel({
  agent,
  onUseTemplate,
  onUseVariant,
}: {
  agent: AimAgentOption
  onUseTemplate: () => void
  onUseVariant: (prompt: string) => void
}) {
  return (
    <div className="w-full space-y-3 rounded-xl border bg-card/50 p-3 text-left">
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">适合场景</p>
        <div className="flex flex-wrap gap-1.5">
          {agent.scenarios.map((item) => (
            <Badge key={item} variant="secondary" className="text-[10px]">{item}</Badge>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">输入模板</p>
            <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onUseTemplate}>
              填入
            </Button>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            {agent.inputTemplate.map((field) => (
              <p key={field.label}><span className="text-foreground/80">{field.label}</span>：{field.placeholder}</p>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">输出资产</p>
          <div className="space-y-1 text-xs text-muted-foreground">
            {agent.outputAssets.map((item) => <p key={item}>- {item}</p>)}
          </div>
          {agent.copyVariants && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {agent.copyVariants.map((variant) => (
                <Button
                  key={variant.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => onUseVariant(variant.prompt)}
                >
                  {variant.label}
                </Button>
              ))}
            </div>
          )}
        </div>
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
  sourceOriginalText?: string
  sourceAnalysisText?: string
  editorText?: string
  editorFormat?: ContentFormat
  editorSourceMessageId?: string
  editorPanelWidth?: number
  editorPanelOpen?: boolean
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
      sourceOriginalText: typeof draft.sourceOriginalText === "string" ? draft.sourceOriginalText : undefined,
      sourceAnalysisText: typeof draft.sourceAnalysisText === "string" ? draft.sourceAnalysisText : undefined,
      editorText: typeof draft.editorText === "string" ? draft.editorText : undefined,
      editorFormat: typeof draft.editorFormat === "string" ? draft.editorFormat as ContentFormat : undefined,
      editorSourceMessageId: typeof draft.editorSourceMessageId === "string" ? draft.editorSourceMessageId : undefined,
      editorPanelWidth: typeof draft.editorPanelWidth === "number" ? clampEditorPanelWidth(draft.editorPanelWidth) : undefined,
      editorPanelOpen: typeof draft.editorPanelOpen === "boolean" ? draft.editorPanelOpen : undefined,
    }
  } catch {
    return null
  }
}

function saveAimDraft(draft: AimDraft) {
  if (typeof window === "undefined") return
  try {
    if (
      !draft.input.trim()
      && draft.messages.length === 0
      && !draft.editorText?.trim()
      && !draft.sourceOriginalText?.trim()
      && !draft.sourceAnalysisText?.trim()
    ) {
      window.sessionStorage.removeItem(AIM_DRAFT_STORAGE_KEY)
      return
    }
    window.sessionStorage.setItem(AIM_DRAFT_STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // ponytail: losing a browser draft is better than breaking the editor.
  }
}

function formatAnalysisResultForPrompt(analysisResult: unknown) {
  if (!analysisResult) return null
  if (typeof analysisResult === "object" && "markdown" in analysisResult) {
    const markdown = (analysisResult as { markdown?: unknown }).markdown
    if (typeof markdown === "string" && markdown.trim()) return cleanVideoCopyAnalysisMarkdown(markdown)
  }
  return JSON.stringify(analysisResult, null, 2)
}

function extractBenchmarkOriginalText(text: string) {
  const marker = text.match(/对标原文[：:]/)
  if (marker?.index == null) return ""
  const start = marker.index + marker[0].length
  const rest = text.slice(start).trim()
  const nextSection = rest.search(/\n(?:已有拆解|结构化拆解|改写原则|创作原则|===|来源链接|硬规则)[：:：]?/)
  return (nextSection >= 0 ? rest.slice(0, nextSection) : rest).trim()
}

function extractBenchmarkAnalysisText(text: string) {
  const marker = text.match(/(?:已有拆解|结构化拆解)[：:]/)
  if (marker?.index != null) return text.slice(marker.index + marker[0].length).trim()
  const numberedStructure = text.match(/(?:^|\n)\d+[.、]\s*.+\n内容[：:]/)
  return numberedStructure?.index == null ? "" : text.slice(numberedStructure.index).trim()
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

interface EditorSelection {
  text: string
  range: TextSelectionRange
}

function readTextareaSelection(element: HTMLTextAreaElement): EditorSelection {
  const range = { start: element.selectionStart, end: element.selectionEnd }
  return { text: element.value.slice(range.start, range.end), range }
}

function BenchmarkEditorPanel({
  open,
  width,
  labels,
  referenceText,
  editorText,
  editorFormat,
  onOpen,
  onClose,
  onWidthChange,
  onEditorTextChange,
  onReferenceSelection,
  onDraftSelection,
  onSave,
}: {
  open: boolean
  width: number
  labels: EditorPanelLabels
  referenceText: string
  editorText: string
  editorFormat?: ContentFormat
  onOpen: () => void
  onClose: () => void
  onWidthChange: (width: number) => void
  onEditorTextChange: (text: string) => void
  onReferenceSelection: (selection: EditorSelection) => void
  onDraftSelection: (selection: EditorSelection) => void
  onSave: () => void
}) {
  const splitRef = useRef<HTMLDivElement>(null)
  const [referencePercent, setReferencePercent] = useState(50)

  if (!open) {
    return (
      <button
        type="button"
        className="flex w-9 shrink-0 flex-col items-center justify-center gap-2 border-l bg-background text-xs text-muted-foreground hover:bg-muted/40"
        onClick={onOpen}
        title={labels.collapsedTitle}
      >
        <FileText className="h-4 w-4" />
        <span className="[writing-mode:vertical-rl]">{editorText.length}字</span>
      </button>
    )
  }

  return (
    <aside
      className="relative flex shrink-0 flex-col border-l bg-background"
      style={{ width }}
    >
      <div
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/30"
        onPointerDown={(event) => {
          event.preventDefault()
          const move = (moveEvent: PointerEvent) => {
            onWidthChange(clampEditorPanelWidth(window.innerWidth - moveEvent.clientX))
          }
          const up = () => {
            window.removeEventListener("pointermove", move)
            window.removeEventListener("pointerup", up)
          }
          window.addEventListener("pointermove", move)
          window.addEventListener("pointerup", up)
        }}
      />
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{labels.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {editorFormat ? FORMAT_LABELS[editorFormat] : labels.currentLabel} · {editorText.length} 字
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className={ACTIVE_SOFT_ACTION_CLASS} onClick={onSave}>
            保存
          </Button>
          <Button size="sm" variant="ghost" className={SOFT_ACTION_CLASS} onClick={onClose}>
            隐藏
          </Button>
        </div>
      </div>
      <div
        ref={splitRef}
        className="grid min-h-0 flex-1 bg-muted/15"
        style={{ gridTemplateRows: `${referencePercent}% 6px minmax(0, 1fr)` }}
      >
        <section className="flex min-h-0 flex-col px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{labels.referenceTitle}</span>
            {referenceText ? <span className="text-[11px] text-muted-foreground">{referenceText.length} 字</span> : null}
          </div>
          <textarea
            readOnly
            className="min-h-0 flex-1 resize-none rounded-md border border-transparent bg-background/70 p-3 text-sm leading-6 outline-none focus:border-primary/25"
            value={referenceText}
            placeholder={labels.referencePlaceholder}
            onSelect={(event) => onReferenceSelection(readTextareaSelection(event.currentTarget))}
          />
        </section>
        <div
          className="group flex cursor-row-resize items-center bg-transparent transition-colors hover:bg-primary/5"
          title="拖动调整上下区域高度"
          onPointerDown={(event) => {
            event.preventDefault()
            const box = splitRef.current?.getBoundingClientRect()
            if (!box) return
            const move = (moveEvent: PointerEvent) => {
              const next = ((moveEvent.clientY - box.top) / box.height) * 100
              setReferencePercent(Math.min(80, Math.max(20, next)))
            }
            const up = () => {
              window.removeEventListener("pointermove", move)
              window.removeEventListener("pointerup", up)
            }
            window.addEventListener("pointermove", move)
            window.addEventListener("pointerup", up)
          }}
        >
          <div className="h-px w-full bg-border/60 transition-colors group-hover:bg-primary/35" />
        </div>
        <section className="flex min-h-0 flex-col px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{labels.draftTitle}</span>
            <span className="text-[11px] text-muted-foreground">{editorText.length} 字</span>
          </div>
          <textarea
            className="min-h-0 flex-1 resize-none rounded-md border border-transparent bg-background p-3 text-sm leading-6 outline-none focus:border-primary/25"
            value={editorText}
            onChange={(event) => onEditorTextChange(event.target.value)}
            onSelect={(event) => onDraftSelection(readTextareaSelection(event.currentTarget))}
            placeholder={labels.draftPlaceholder}
          />
        </section>
      </div>
    </aside>
  )
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
  nextActions,
  onRepurpose,
  onQuality,
  onMarkStatus,
  onNextAction,
  isBusy,
  onEditResult,
  onCompileToWiki,
}: {
  deliverables: AimGenerateResponse
  nextActions?: AimNextAction[]
  onRepurpose: (format: ContentFormat) => void
  onQuality: () => void
  onMarkStatus: (status: string) => void
  onNextAction?: (action: AimNextAction, content: string) => void
  isBusy: boolean
  onEditResult?: (format: ContentFormat, content: string) => void
  onCompileToWiki?: () => void
}) {
  const [activeTab, setActiveTab] = useState<ContentFormat>(deliverables.results[0]?.format || "raw_copy")
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null)

  const activeFormat = deliverables.results.some((r) => r.format === activeTab)
    ? activeTab
    : deliverables.results[0]?.format || "raw_copy"
  const activeResult = deliverables.results.find((r) => r.format === activeFormat) || deliverables.results[0]

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
  const hasPublishScript = hasVideo || hasKoubo
  const hasXiaohongshu = deliverables.results.some((r) => r.format === "xiaohongshu_post")
  const hasCommunity = deliverables.results.some((r) => r.format === "community_message")
  const hasShooting = deliverables.results.some((r) => r.format === "shooting_brief")

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
          <TabsList className="mb-3 flex h-auto flex-wrap justify-start gap-1 rounded-none bg-transparent p-0">
            {deliverables.results.map((item) => (
              <TabsTrigger
                key={item.format}
                value={item.format}
                className="rounded-md px-2.5 py-1.5 text-xs text-muted-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                {FORMAT_LABELS[item.format]}
              </TabsTrigger>
            ))}
          </TabsList>
          {deliverables.results.map((item) => (
            <TabsContent key={item.format} value={item.format} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{FORMAT_LABELS[item.format]} · {item.wordCount} 字</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {onEditResult && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className={SOFT_ACTION_CLASS}
                      onClick={() => onEditResult(item.format, item.content)}
                    >
                      编辑
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className={SOFT_ACTION_CLASS} onClick={() => copyText(item.content, item.format)}>
                    {copiedFormat === item.format ? <Check className="h-3.5 w-3.5 mr-1" /> : <Clipboard className="h-3.5 w-3.5 mr-1" />}
                    复制
                  </Button>
                </div>
              </div>
              <div className="max-h-[600px] overflow-y-auto py-1">
                {item.format === "video_script" ? (
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
            <Button size="sm" variant="ghost" className={SOFT_ACTION_CLASS} onClick={() => onRepurpose("koubo_script")} disabled={isBusy}>
              <Mic className="h-3.5 w-3.5 mr-1" /> 口播文案
            </Button>
          )}
          {!hasXiaohongshu && hasVideo && (
            <Button size="sm" variant="ghost" className={SOFT_ACTION_CLASS} onClick={() => onRepurpose("xiaohongshu_post")} disabled={isBusy}>
              <ImageIcon className="h-3.5 w-3.5 mr-1" /> 小红书图文
            </Button>
          )}
          {!hasShooting && hasVideo && (
            <Button size="sm" variant="ghost" className={SOFT_ACTION_CLASS} onClick={() => onRepurpose("shooting_brief")} disabled={isBusy}>
              <FileText className="h-3.5 w-3.5 mr-1" /> 拍摄交接单
            </Button>
          )}
          {!hasMoments && hasVideo && (
            <Button size="sm" variant="ghost" className={SOFT_ACTION_CLASS} onClick={() => onRepurpose("moments_post")} disabled={isBusy}>
              <MessageCircle className="h-3.5 w-3.5 mr-1" /> 朋友圈文案
            </Button>
          )}
          {!hasCommunity && hasVideo && (
            <Button size="sm" variant="ghost" className={SOFT_ACTION_CLASS} onClick={() => onRepurpose("community_message")} disabled={isBusy}>
              <MessageCircle className="h-3.5 w-3.5 mr-1" /> 社群运营
            </Button>
          )}
          {!hasWechat && hasVideo && (
            <Button size="sm" variant="ghost" className={SOFT_ACTION_CLASS} onClick={() => onRepurpose("wechat_article")} disabled={isBusy}>
              <FileText className="h-3.5 w-3.5 mr-1" /> 公众号文章
            </Button>
          )}
          {onCompileToWiki && (
            <Button size="sm" variant="ghost" className={SOFT_ACTION_CLASS} onClick={onCompileToWiki} disabled={isBusy}>
              <BookOpen className="h-3.5 w-3.5 mr-1" /> 编译进 IP 维基
            </Button>
          )}
          {nextActions?.map((action) => (
            <Button
              key={action.id}
              size="sm"
              variant="ghost"
              className={SOFT_ACTION_CLASS}
              onClick={() => {
                if (action.id === "publish_check") {
                  onQuality()
                  return
                }
                if (activeResult) onNextAction?.(action, activeResult.content)
              }}
              disabled={isBusy || !activeResult?.content.trim() || (action.id === "publish_check" && !hasPublishScript)}
            >
              {action.id === "publish_check" && <ShieldCheck className="h-3.5 w-3.5 mr-1" />}
              {action.label}
            </Button>
          ))}
          {!nextActions?.some((action) => action.id === "publish_check") && (
            <Button size="sm" variant="ghost" className={SOFT_ACTION_CLASS} onClick={onQuality} disabled={isBusy || !hasPublishScript}>
              <ShieldCheck className="h-3.5 w-3.5 mr-1" /> 发布前自查
            </Button>
          )}
          <Select onValueChange={(value) => { if (typeof value === "string") onMarkStatus(value) }}>
            <SelectTrigger className="h-7 w-[88px] border-0 bg-muted/45 text-xs text-muted-foreground shadow-none hover:bg-muted">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              {WORKFLOW_STATUS_OPTIONS.map((item) => (
                <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
  const [sourceOriginalText, setSourceOriginalText] = useState(() => initialDraft?.sourceOriginalText || "")
  const [sourceAnalysisText, setSourceAnalysisText] = useState(() => initialDraft?.sourceAnalysisText || "")
  const [editorText, setEditorText] = useState(() => initialDraft?.editorText || "")
  const [editorFormat, setEditorFormat] = useState<ContentFormat | undefined>(() => initialDraft?.editorFormat)
  const [editorSourceMessageId, setEditorSourceMessageId] = useState<string | undefined>(() => initialDraft?.editorSourceMessageId)
  const [editorPanelWidth, setEditorPanelWidth] = useState(() => initialDraft?.editorPanelWidth ?? EDITOR_PANEL_DEFAULT_WIDTH)
  const [editorPanelOpen, setEditorPanelOpen] = useState(() => initialDraft?.editorPanelOpen ?? true)
  const [referenceSelection, setReferenceSelection] = useState<EditorSelection>({ text: "", range: { start: 0, end: 0 } })
  const [draftSelection, setDraftSelection] = useState<EditorSelection>({ text: "", range: { start: 0, end: 0 } })
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
  const [projectEnabled, setProjectEnabled] = useState(false)
  const [isEvolving, setIsEvolving] = useState(false)
  const [evolutionSuggestions, setEvolutionSuggestions] = useState<AimEvolutionSuggestion[]>([])

  // 历史记录由侧边栏共享 store 管理（侧边栏渲染列表、生成成功后刷新、点击后触发加载）
  const storeHistory = useAimWorkspaceStore((s) => s.history)
  const loadTargetId = useAimWorkspaceStore((s) => s.loadTargetId)
  const refreshHistory = useAimWorkspaceStore((s) => s.fetchHistory)
  const clearLoadTarget = useAimWorkspaceStore((s) => s.clearLoadTarget)

  const scrollRef = useRef<HTMLDivElement>(null)
  const requestAbortRef = useRef<AbortController | null>(null)
  const pendingScrollMessageIdRef = useRef<string | null>(null)

  const agent = useMemo(() => {
    const baseAgent = AGENT_OPTIONS.find((a) => a.id === selectedAgentId)!
    if (selectedAgentId === "ip_video" && modeParam === "asset_pack") {
      return {
        ...baseAgent,
        title: "内容生产官 · 内容资产包",
        intro: "我是内容生产官的内容资产包模式。先生成短视频脚本，拍摄交接单、朋友圈、社群运营、公众号文章可按需点击派生。",
        placeholder: "说说今天要生产什么内容：选题、原始想法、对标文案、老板口述均可，我先生成主脚本...",
        defaultFormats: ["video_script" as const],
        quickPrompts: [
          "把这个选题先生成短视频脚本。",
          "基于老板的这段金句，先输出一版可拍脚本。",
        ],
        primaryActionLabel: "生成口播文案",
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

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId],
  )

  const editorPanelLabels = useMemo(
    () => getEditorPanelLabels(selectedAgentId),
    [selectedAgentId],
  )

  const workStage = selectedAgentId === "business_diagnosis"
    ? "选题定位策划"
    : selectedAgentId === "persona"
      ? "来时路梳理"
      : selectedAgentId === "content_review"
        ? "发布质检"
        : selectedAgentId === "business_system_diagnosis"
          ? "商业诊断"
          : selectedAgentId === "deep_copywriter"
            ? "深度文案"
            : "内容生产"

  const hasEditorSelection = Boolean(referenceSelection.text.trim() || draftSelection.text.trim())

  const materialStatus = [
    projectEnabled && selectedProject ? "客户资料已读取" : projectEnabled ? "客户资料待选择" : "纯文案模式",
    selectedAgentId === "business_diagnosis" ? "市场洞察可匹配" : null,
    sourceVideoCopyExtractionId ? `${editorPanelLabels.referenceTitle}已带入` : null,
    editorText.trim() ? `${editorPanelLabels.currentLabel}可编辑` : null,
  ].filter(Boolean) as string[]

  const analysisTextCandidates = useMemo(() => {
    const candidates = []
    if (sourceAnalysisText.trim()) candidates.push(sourceAnalysisText)
    const inputAnalysis = extractBenchmarkAnalysisText(input)
    if (inputAnalysis) candidates.push(inputAnalysis)
    for (const message of [...messages].reverse()) {
      if (message.role !== "user") continue
      const messageAnalysis = extractBenchmarkAnalysisText(message.content)
      if (messageAnalysis) candidates.push(messageAnalysis)
    }
    return candidates
  }, [input, messages, sourceAnalysisText])

  const annotatedReferenceText = useMemo(
    () => applyFirstMatchingStructureToReference(sourceOriginalText, analysisTextCandidates),
    [analysisTextCandidates, sourceOriginalText],
  )

  const { isRecording, isTranscribing, startRecording, stopRecording } = useAudioRecorder({
    transcribeFn: transcribeAudio,
    onTranscribeSuccess: (text) => setInput((prev) => (prev ? `${prev}\n${text}` : text)),
  })

  useEffect(() => {
    listClientProjects()
      .then((items) => {
        setProjects(items)
        setSelectedProjectId((current) => current || items[0]?.id || "")
        setProjectEnabled(items.length > 0)
      })
      .catch(() => setProjectEnabled(false))
  }, [])

  const lastAgentParamRef = useRef(agentParam)

  useEffect(() => {
    saveAimDraft({
      selectedAgentId,
      selectedProjectId,
      input,
      messages,
      videoCopyExtractionId: sourceVideoCopyExtractionId,
      sourceOriginalText,
      sourceAnalysisText,
      editorText,
      editorFormat,
      editorSourceMessageId,
      editorPanelWidth,
      editorPanelOpen,
    })
  }, [
    editorFormat,
    editorPanelOpen,
    editorPanelWidth,
    editorSourceMessageId,
    editorText,
    input,
    messages,
    selectedAgentId,
    selectedProjectId,
    sourceOriginalText,
    sourceAnalysisText,
    sourceVideoCopyExtractionId,
  ])

  useEffect(() => {
    if (!sourceVideoCopyExtractionId || (sourceOriginalText.trim() && sourceAnalysisText.trim())) return
    getVideoCopyExtraction(sourceVideoCopyExtractionId)
      .then((record) => {
        const analysisText = formatAnalysisResultForPrompt(record.analysisResult) || ""
        if (!sourceOriginalText.trim()) setSourceOriginalText(record.transcript || "")
        if (!sourceAnalysisText.trim()) setSourceAnalysisText(analysisText)
      })
      .catch(() => {})
  }, [sourceAnalysisText, sourceOriginalText, sourceVideoCopyExtractionId])

  // 切换智能体（由全局侧边栏的 ?agent= 驱动）：同步选中态并重置当前对话
  useEffect(() => {
    if (lastAgentParamRef.current === agentParam) return
    lastAgentParamRef.current = agentParam
    startTransition(() => {
      setSelectedAgentId(activeAgentId)
      setMessages([])
      setInput("")
      setSourceOriginalText("")
      setSourceAnalysisText("")
      setEditorText("")
      setEditorFormat(undefined)
      setEditorSourceMessageId(undefined)
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
      setSourceOriginalText("")
      setSourceAnalysisText("")
      setEditorText("")
      setEditorFormat(undefined)
      setEditorSourceMessageId(undefined)
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
        const lengthRule = buildBenchmarkLengthRule(record.transcript)
        const recreationSop = buildBenchmarkRecreationSopBlock()
        const prefill = [
          isDeepCopy
            ? "请基于下面这条长对标文案和已有拆解，按爆款选题再创作 SOP，创作一篇适合我自己的完整长篇文案。"
            : "请基于下面这条对标文案，按爆款选题再创作 SOP，创作成适合我自己的口播文案。",
          "",
          "创作原则：",
          recreationSop,
          isDeepCopy
            ? "1. 先参考拆解里的开头类型和情绪入口，重新设计适合我的长文开头。"
            : "1. 开头机制可以借，但第一句话必须重写成我的身份和业务场景里的话。",
          isDeepCopy
            ? "2. 参考拆解里的正文结构、转折节奏和心理推进，但表达至少 30% 可感知重写。"
            : "2. 结构节奏可以保留，但表达至少 30% 可感知重写：案例、转折、句式和行动引导不能贴原文。",
          isDeepCopy
            ? "3. 用我的产品、案例、用户痛点和人设表达重新完成创作，除专有名词外不要连续沿用原文 12 个字以上。"
            : "3. 除专有名词外，不要连续沿用原文 12 个字以上，最终稿要像我的内容，不像原文换皮。",
          lengthRule ? `4. ${lengthRule}` : null,
          "",
          record.videoTitle ? `对标标题：${record.videoTitle}` : null,
          "对标原文：",
          record.transcript || "",
          record.analysisResult ? "\n已有拆解：" : null,
          formatAnalysisResultForPrompt(record.analysisResult),
        ].filter(Boolean).join("\n")

        startTransition(() => {
          if (isDeepCopy) setSelectedAgentId("deep_copywriter")
          setMessages([])
          setInput(prefill)
          setSourceVideoCopyExtractionId(record.id)
          setSourceOriginalText(record.transcript || "")
          setSourceAnalysisText(formatAnalysisResultForPrompt(record.analysisResult) || "")
          setEditorText("")
          setEditorFormat(undefined)
          setEditorSourceMessageId(undefined)
          setEditorPanelOpen(true)
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

  const openEditorFromResult = useCallback((messageId: string, format: ContentFormat, content: string) => {
    setEditorText(content)
    setEditorFormat(format)
    setEditorSourceMessageId(messageId)
    setEditorPanelOpen(true)
    setDraftSelection({ text: "", range: { start: 0, end: 0 } })
  }, [])

  // 侧边栏点击「最近内容」：把记录加载为一次对话（数据来自共享 store，无需额外请求）
  useEffect(() => {
    if (!loadTargetId) return
    const item = storeHistory.find((h) => h.id === loadTargetId)
    if (!item) return // 列表尚未拉取到，等 storeHistory 更新后由本 effect 重试
    const contents = getHistoryContents(item)
    const assistantId = nextId()
    const itemAgentId = isValidAimAgent(item.agentId) ? item.agentId : DEFAULT_AIM_AGENT
    const historyOriginalText = extractBenchmarkOriginalText(item.rawInput)
    const historyAnalysisText = extractBenchmarkAnalysisText(item.rawInput)
    startTransition(() => {
      setSelectedAgentId(itemAgentId)
      setSelectedProjectId(item.projectId || "")
      setSourceOriginalText(historyOriginalText)
      setSourceAnalysisText(historyAnalysisText)
      setMessages([
        { id: nextId(), role: "user", content: item.rawInput || "（历史素材）" },
        ...(contents.length
          ? [{
              id: assistantId,
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
      if (contents[0]) openEditorFromResult(assistantId, contents[0].format, contents[0].content)
    })
    if (itemAgentId !== selectedAgentId) {
      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.set("agent", itemAgentId)
      lastAgentParamRef.current = itemAgentId
      router.replace(`/aim?${nextParams.toString()}`)
    }
    toast.success("已加载历史记录")
    clearLoadTarget()
  }, [clearLoadTarget, loadTargetId, openEditorFromResult, router, searchParams, selectedAgentId, storeHistory])

  useEffect(() => {
    if (!isGenerating) return
    const timer = setInterval(() => setLoadingIndex((v) => (v + 1) % LOADING_MESSAGES.length), 1400)
    return () => clearInterval(timer)
  }, [isGenerating])

  // 自动滚到底部
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const targetId = pendingScrollMessageIdRef.current
    if (targetId) {
      pendingScrollMessageIdRef.current = null
      requestAnimationFrame(() => {
        el.querySelector<HTMLElement>(`[data-message-id="${targetId}"]`)?.scrollIntoView({
          block: "start",
        })
      })
      return
    }
    el.scrollTop = el.scrollHeight
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
    setSourceOriginalText("")
    setSourceAnalysisText("")
    setEditorText("")
    setEditorFormat(undefined)
    setEditorSourceMessageId(undefined)
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

  function latestDeliverableMessageId() {
    return [...messages]
      .reverse()
      .find((message) => message.deliverables?.results.some((result) => result.format === "video_script"))
      ?.id
  }

  function latestDeliverableText() {
    const latest = [...messages].reverse().find((message) => message.deliverables?.results.length)
    return latest?.deliverables?.results[0]?.content.trim() || ""
  }

  function fillReferenceTextFromConversation() {
    const source = [...messages]
      .reverse()
      .map((message) => extractBenchmarkOriginalText(message.content))
      .find((content) => content.trim())
    if (!source) {
      toast.error(`当前对话里没有可识别的${editorPanelLabels.referenceTitle}`)
      return true
    }
    setSourceOriginalText(source)
    setEditorPanelOpen(true)
    setInput("")
    toast.success(`已填入右侧${editorPanelLabels.referenceTitle}`)
    return true
  }

  function integrateLatestAssistantDraftToEditor() {
    const draft = [...messages]
      .reverse()
      .filter((message) => message.role === "assistant")
      .map((message) => extractEditorDraftFromAssistantText(message.content))
      .find((content) => content.trim())

    if (!draft) {
      toast.error(`没有找到可整合的最新版${editorPanelLabels.draftTitle}`)
      return true
    }

    setEditorText(draft)
    setEditorPanelOpen(true)
    setInput("")
    toast.success(`已整合到右侧${editorPanelLabels.title}`)
    return true
  }

  function buildBenchmarkRewriteInput() {
    const original = sourceOriginalText.trim() || [...messages]
      .reverse()
      .map((message) => extractBenchmarkOriginalText(message.content))
      .find((content) => content.trim()) || ""

    if (!original) {
      toast.error("请先带入对标原文")
      return null
    }

    const currentDraft = editorText.trim() || latestDeliverableText()
    const lengthRule = buildBenchmarkLengthRule(original)

    return [
      "请按对标原文重新生成一版文案，直接输出最终稿。",
      "硬性要求：",
      buildBenchmarkRecreationSopBlock(),
      "1. 目标字数必须和对标原文基本一致，允许 95%-105% 波动。",
      "2. 整体至少 30% 可感知重写，不能只是替换少数字。",
      "3. 除专有名词外，不要连续沿用原文 12 个字以上。",
      lengthRule ? `4. ${lengthRule}` : null,
      sourceAnalysisText.trim() ? `已有拆解：\n${sourceAnalysisText.trim()}` : null,
      `对标原文：\n${original}`,
      currentDraft ? `我当前不满意的稿子：\n${currentDraft}` : null,
    ].filter(Boolean).join("\n\n")
  }

  function buildBenchmarkQualityMessage() {
    const original = sourceOriginalText.trim() || [...messages]
      .reverse()
      .map((message) => extractBenchmarkOriginalText(message.content))
      .find((content) => content.trim()) || ""
    const draft = editorText.trim() || latestDeliverableText()

    if (!original || !draft) return null

    const report = assessBenchmarkRewrite(original, draft)
    const lengthRatio = report.lengthRatio == null ? "无法计算" : `${Math.round(report.lengthRatio * 100)}%`
    const lengthStatus = report.lengthPassed
      ? "通过"
      : report.outputChars < report.originalChars
        ? "偏短"
        : "偏长"
    const copyStatus = report.tooSimilar ? "风险高，需要继续重写" : "通过"

    return [
      "## 对标自检结果",
      `- 字数：当前 ${report.outputChars} 字 / 原文 ${report.originalChars} 字，比例 ${lengthRatio}，判定：${lengthStatus}。`,
      `- 12字连续复用：${Math.round(report.reuseRatio * 100)}%，判定：${copyStatus}。`,
      report.reusedSamples.length
        ? `- 复用片段示例：${report.reusedSamples.map((sample) => `「${sample}」`).join("、")}`
        : "- 复用片段示例：未发现明显连续复用。",
      report.lengthPassed && !report.tooSimilar
        ? "- 结论：这版在字数和照抄风险上基本合格，可以继续看表达质量。"
        : "- 结论：这版还不合格，优先按原文字数重写，并替换开头、案例、过渡句或行动引导。",
    ].join("\n\n")
  }

  function rememberWorkbenchPreference(input: string) {
    const contextMessages = [
      ...messages.map((message) => ({ role: message.role, content: message.content })),
      { role: "user" as const, content: input },
    ].filter((message) => message.content.trim()).slice(-8)

    if (contextMessages.length === 0) {
      toast.error("没有可沉淀的偏好内容")
      return
    }

    setIsEvolving(true)
    void evolveStyleConversation({ messages: contextMessages })
      .then((result) => {
        if (result.profile) {
          toast.success(result.created ? "已建立全局写作风格档案" : "全局写作风格档案已更新")
        } else if (result.reason === "no_style") {
          toast.info("这句话还没有形成稳定偏好")
        } else {
          toast.info(result.reason || "这句话没有形成稳定偏好")
        }
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "偏好沉淀失败")
      })
      .finally(() => setIsEvolving(false))
  }

  function saveEditorToDeliverable() {
    if (!editorSourceMessageId || !editorFormat) {
      toast.error("当前编辑稿还没有关联交付物")
      return false
    }
    setMessages((prev) =>
      prev.map((message) =>
        message.id === editorSourceMessageId && message.deliverables
          ? {
              ...message,
              deliverables: {
                ...message.deliverables,
                results: message.deliverables.results.map((result) =>
                  result.format === editorFormat
                    ? { ...result, content: editorText, wordCount: editorText.length }
                    : result
                ),
              },
            }
          : message
      )
    )
    toast.success("已保存到交付物")
    return true
  }

  function runWorkbenchCommand(command: AimWorkbenchCommand) {
    setInput("")

    if (command.id === "integrate_editor") return integrateLatestAssistantDraftToEditor()
    if (command.id === "fill_reference") return fillReferenceTextFromConversation()
    if (command.id === "open_editor") {
      setEditorPanelOpen(true)
      toast.success(`已打开右侧${editorPanelLabels.title}`)
      return true
    }
    if (command.id === "close_editor") {
      setEditorPanelOpen(false)
      toast.success(`已隐藏右侧${editorPanelLabels.title}`)
      return true
    }
    if (command.id === "save_editor") return saveEditorToDeliverable()
    if (command.id === "reset_conversation") {
      resetConversation()
      toast.success("已清空当前对话")
      return true
    }
    if (command.id === "regenerate") {
      void generateWithInput("")
      return true
    }
    if (command.id === "rewrite_benchmark") {
      const rewriteInput = buildBenchmarkRewriteInput()
      if (rewriteInput) void generateWithInput(rewriteInput)
      return true
    }
    if (command.id === "run_quality_check") {
      const localCheckMessage = buildBenchmarkQualityMessage()
      const messageId = latestDeliverableMessageId()
      if (localCheckMessage) {
        setMessages((prev) => [...prev, { id: nextId(), role: "assistant", content: localCheckMessage }])
      }
      if (messageId) {
        void handleQuality(messageId)()
        toast.success(localCheckMessage ? "已完成对标自检，并开始脚本质检" : "已开始脚本质检")
        return true
      }
      if (localCheckMessage) {
        toast.success("对标自检完成")
        return true
      }
      toast.error("当前没有可质检的生成结果")
      return true
    }
    if (command.id === "remember_preference") {
      rememberWorkbenchPreference(command.input)
      return true
    }
    return false
  }

  function buildEditorContext(action: string): AimEditorContext {
    return {
      action,
      referenceSelection: referenceSelection.text.trim() || undefined,
      draftSelection: draftSelection.text.trim() || undefined,
      draftText: editorText.trim() || undefined,
      documentType: editorPanelLabels.documentType,
      referenceLabel: editorPanelLabels.referenceTitle,
      draftLabel: editorPanelLabels.draftTitle,
    }
  }

  function applyEditorReplacement(message: ChatMessage) {
    const replacement = extractReplacementDraft(message.content)
    const range = message.editorApply?.range
    if (!replacement || !range) return
    setEditorText((current) => applySelectionReplacement(current, range, replacement))
    toast.success("已应用到右侧选区")
  }

  async function sendText(
    text: string,
    options?: {
      editorContext?: AimEditorContext
      editorApplyRange?: TextSelectionRange
    }
  ) {
    if (!text) return
    const workbenchCommand = detectAimWorkbenchCommand(text)
    if (workbenchCommand && runWorkbenchCommand(workbenchCommand)) return
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
          editorContext: options?.editorContext,
          signal: controller.signal,
        })
        setMessages((prev) => [...prev, { id: nextId(), role: "assistant", content }])
        return
      }

      const assistantId = nextId()
      let hasContent = false
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          editorApply: options?.editorApplyRange ? { range: options.editorApplyRange } : null,
        },
      ])
      await chatAimStream(chatMessages, {
        agentId: selectedAgentId,
        projectId: projectEnabled ? selectedProjectId || undefined : undefined,
        editorContext: options?.editorContext,
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

  const handleAimNextAction = useCallback(
    async (action: AimNextAction, content: string) => {
      const cleanContent = content.trim()
      if (!cleanContent) return

      if (action.id === "save_knowledge") {
        if (!selectedProjectId) {
          toast.error("请先选择 IP 营销全案")
          return
        }
        try {
          await createKnowledge({
            projectId: selectedProjectId,
            category: "positioning_material",
            title: `AIM交付物 · ${agent.title}`,
            content: cleanContent,
            tags: ["aim_delivery", action.id],
            sourceType: "manual",
          })
          toast.success("已保存为档案素材")
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "保存失败")
        }
        return
      }

      if (action.targetAgentId && action.targetAgentId !== selectedAgentId) {
        const nextParams = new URLSearchParams(searchParams.toString())
        nextParams.set("agent", action.targetAgentId)
        lastAgentParamRef.current = action.targetAgentId
        setSelectedAgentId(action.targetAgentId)
        router.replace(`/aim?${nextParams.toString()}`)
      }
      setInput(buildAimNextActionPrompt(action, cleanContent))
      toast.success("已带入聊天框")
    },
    [agent.title, router, searchParams, selectedAgentId, selectedProjectId],
  )

  async function handleSend() {
    await sendText(input.trim(), hasEditorSelection ? {
      editorContext: buildEditorContext("用户追问"),
      editorApplyRange: draftSelection.text.trim() ? draftSelection.range : undefined,
    } : undefined)
  }

  async function generateWithInput(currentInput: string) {
    const rawInput = buildRawInputForGenerate(currentInput || undefined)
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
      const proofreadFormats = new Set<ContentFormat>(["raw_copy", "video_script", "koubo_script"])
      const proofreadResults = await Promise.all(
        response.results.map(async (result) => {
          if (!proofreadFormats.has(result.format) || result.content.trim().length < 30) return result
          try {
            const polished = await polishScript({
              content: result.content,
              persona: agent.defaultInstruction,
              mode: "proofread",
            })
            return {
              ...result,
              content: polished.polished,
              wordCount: polished.polished.length,
            }
          } catch {
            return result
          }
        }),
      )
      const correctedResponse = { ...response, results: proofreadResults }
      const extractedOriginalText = extractBenchmarkOriginalText(currentInput)
      const extractedAnalysisText = extractBenchmarkAnalysisText(currentInput)
      if (extractedOriginalText) setSourceOriginalText(extractedOriginalText)
      if (extractedAnalysisText) setSourceAnalysisText(extractedAnalysisText)
      const assistantMessageId = nextId()
      const mainResult = response.results[0]
      pendingScrollMessageIdRef.current = assistantMessageId
      setMessages((prev) => [
        ...prev,
        ...(currentInput ? [{ id: nextId(), role: "user" as const, content: currentInput }] : []),
        {
          id: assistantMessageId,
          role: "assistant",
          content: `${agent.title} 交付物已生成，可直接复制使用，也能继续在下方对话里让我改写。`,
          agentId: agent.id,
          deliverables: correctedResponse,
        },
      ])
      if (mainResult) {
        const correctedMainResult = correctedResponse.results[0] ?? mainResult
        openEditorFromResult(
          assistantMessageId,
          correctedMainResult.format,
          correctedMainResult.content,
        )
      }
      if (currentInput) setInput("")
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

  async function handleGenerate() {
    if (hasEditorSelection) {
      await handleSend()
      return
    }
    await generateWithInput(input.trim())
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
    [messages, projectEnabled, refreshHistory, selectedProjectId],
  )

  const handleQuality = useCallback(
    (msgId: string) => async () => {
      const base = messages.find((m) => m.id === msgId)?.deliverables
      const mainContent =
        base?.results.find((r) => r.format === "video_script")?.content
        || base?.results.find((r) => r.format === "koubo_script")?.content
      if (!mainContent) return
      setIsQualityChecking(true)
      try {
        const report = await checkScriptQuality({
          content: mainContent,
          persona: agent.defaultInstruction,
          publishPlatform: "douyin",
        })
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, qualityReport: report } : m)),
        )
        toast.success("发布前自查完成")
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
  const hasEditor = Boolean(sourceOriginalText.trim() || editorText.trim())

  return (
    <div className="-mx-4 -my-4 flex h-[calc(100dvh-3.5rem)] min-h-115 overflow-hidden md:-mx-6 md:-my-6">
      {/* 对话区（智能体列表与最近内容已移至全局侧边栏） */}
      <section className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-card px-4 md:px-6">
        {/* 头部：AIM 业务工作台 */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
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
            <div className="min-w-0 flex-1 mr-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">AIM 工作台</span>
                <span className="text-xs text-muted-foreground">/</span>
                <p className="truncate text-sm font-semibold text-foreground">{agent.title}</p>
                <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[10px] font-medium">
                  {workStage}
                </Badge>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {selectedProject?.name || (projectEnabled ? "未选择 IP 全案" : "未绑定项目")} · {agent.description}
              </p>
              <div className="mt-1 hidden flex-wrap gap-1.5 sm:flex">
                {materialStatus.map((item) => (
                  <span key={item} className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {item}
                  </span>
                ))}
              </div>
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
              <AgentGuidePanel
                agent={agent}
                onUseTemplate={() => setInput(buildAimGuideTemplate(agent.inputTemplate))}
                onUseVariant={(prompt) => setInput((prev) => prev.trim() ? `${prev.trim()}\n${prompt}` : prompt)}
              />
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
                <div key={m.id} data-message-id={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
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

                    {m.role === "assistant" && m.editorApply?.range && extractReplacementDraft(m.content) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7 px-2 text-xs"
                        onClick={() => applyEditorReplacement(m)}
                      >
                        应用到右侧选区
                      </Button>
                    )}

                    {/* 交付物气泡 */}
                    {m.deliverables && (
                      <div className="w-full mt-2">
                        <DeliverableBubble
                          deliverables={m.deliverables}
                          nextActions={getAimAgentGuide(isValidAimAgent(m.agentId) ? m.agentId : selectedAgentId).nextActions}
                          onRepurpose={handleRepurpose(m.id)}
                          onQuality={handleQuality(m.id)}
                          onMarkStatus={handleMarkStatus(m.id)}
                          onNextAction={handleAimNextAction}
                          isBusy={busy}
                          onEditResult={(format, content) => openEditorFromResult(m.id, format, content)}
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
                        {m.qualityReport.publishCheck && (
                          <div className="mt-4 space-y-3 border-t pt-4">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              抖音发布前自查
                              <Badge
                                variant={m.qualityReport.publishCheck.verdict === "可发" ? "default" : "destructive"}
                                className="ml-auto"
                              >
                                {m.qualityReport.publishCheck.verdict}
                              </Badge>
                            </div>
                            {m.qualityReport.publishCheck.violations.length > 0 ? (
                              <div className="space-y-2">
                                {m.qualityReport.publishCheck.violations.map((violation) => (
                                  <div key={`${violation.text}-${violation.category}`} className="rounded-lg border p-3 text-sm">
                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                      <span className="font-medium">「{violation.text}」</span>
                                      <Badge variant={violation.severity === "high" ? "destructive" : "secondary"} className="text-[10px]">
                                        {violation.category}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{violation.reason}</p>
                                    <p className="mt-1 text-xs text-foreground">{violation.suggest}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">未发现明显发布违规风险。</p>
                            )}
                            <div className="rounded-lg border p-3">
                              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                                流量潜力评分
                                <Badge variant={m.qualityReport.publishCheck.trafficScore.score >= 80 ? "default" : "secondary"} className="ml-auto">
                                  {m.qualityReport.publishCheck.trafficScore.score}分 · {m.qualityReport.publishCheck.trafficScore.level}
                                </Badge>
                              </div>
                              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                                {m.qualityReport.publishCheck.trafficScore.reasons.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                            <p className="text-xs text-muted-foreground">{m.qualityReport.publishCheck.aiLabelReminder}</p>
                            {m.qualityReport.publishCheck.trafficWeakness.length > 0 && (
                              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                                {m.qualityReport.publishCheck.trafficWeakness.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            )}
                            {m.qualityReport.publishCheck.violations.length > 0 && m.qualityReport.publishCheck.minimalRewrite !== "" && (
                              <div className="rounded-lg bg-muted/40 p-3">
                                <p className="mb-1 text-xs font-medium text-muted-foreground">最小改法</p>
                                <p className="whitespace-pre-wrap text-sm leading-6">{m.qualityReport.publishCheck.minimalRewrite}</p>
                              </div>
                            )}
                          </div>
                        )}
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
            canGenerate={
              Boolean(selectedProjectId) &&
              (hasEditorSelection ? input.trim().length > 0 : messages.some((m) => m.role === "user") || input.trim().length > 0)
            }
            primaryActionLabel={hasEditorSelection ? editorPanelLabels.selectActionLabel : agent.primaryActionLabel}
            onChange={setInput}
            onSend={handleSend}
            onGenerate={handleGenerate}
            onStop={handleStop}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
          />
        </footer>
      </section>

      {hasEditor && (
        <BenchmarkEditorPanel
          open={editorPanelOpen}
          width={editorPanelWidth}
          labels={editorPanelLabels}
          referenceText={annotatedReferenceText}
          editorText={editorText}
          editorFormat={editorFormat}
          onOpen={() => setEditorPanelOpen(true)}
          onClose={() => setEditorPanelOpen(false)}
          onWidthChange={setEditorPanelWidth}
          onEditorTextChange={setEditorText}
          onReferenceSelection={setReferenceSelection}
          onDraftSelection={setDraftSelection}
          onSave={saveEditorToDeliverable}
        />
      )}

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
