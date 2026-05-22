"use client"

/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Building2,
  Users,
  Coins,
  UserCircle,
  Target,
  Utensils,
  ShoppingCart,
  GraduationCap,
  Dumbbell,
  Palette,
  Home,
  Car,
  Scale,
  Calculator,
  Camera,
  HelpCircle,
  Wrench,
  DollarSign,
  BookOpen,
  Megaphone,
  Network,
  MessageSquare,
  Crown,
  MapPin,
  Pencil,
  X,
  Plus,
  Check,
  RotateCcw,
  Mic,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createKnowledge,
  deleteKnowledge,
  getIpProfile,
  generatePositioning,
  listKnowledge,
  updateKnowledge,
  upsertIpProfile,
  transcribeAudio,
  ApiError,
  type KnowledgeEntry,
} from "@/lib/api/client"
import { useAudioRecorder } from "@/hooks/use-audio-recorder"
import type {
  ApiIpProfile,
  GeneratePositioningRequest,
  ThreeDPositioning,
  BusinessPositioning,
  PersonaDesign,
  ContentStrategy,
} from "@/types/api"
import { isV2Profile, hasCompletePositioning } from "@/types/ip-profile-v2"
import { toast } from "sonner"

// ─── Types ───────────────────────────────────────────────

type PageView = "loading" | "wizard" | "generating" | "result" | "dashboard"

interface WizardStepDef {
  id: number
  field: string
  type: "cards" | "textarea"
  label: string
  sublabel: string
  icon: React.ComponentType<{ className?: string }>
  placeholder?: string
  options?: { value: string; label: string; icon: React.ComponentType<{ className?: string }> }[]
}

interface SurveyAnswers {
  surveyIndustry: string
  surveyTargetCustomer: string
  surveyMonetization: string[]
  surveyPersonalTraits: string
  surveyContentGoal: string
}

// ─── Constants ───────────────────────────────────────────

const WIZARD_STEPS: WizardStepDef[] = [
  {
    id: 1,
    field: "surveyIndustry",
    type: "cards",
    label: "你的行业",
    sublabel: "选择最能代表你的领域",
    icon: Building2,
    options: [
      { value: "空调维修", label: "空调维修", icon: Wrench },
      { value: "餐饮美食", label: "餐饮美食", icon: Utensils },
      { value: "电商零售", label: "电商零售", icon: ShoppingCart },
      { value: "教育培训", label: "教育培训", icon: GraduationCap },
      { value: "健身运动", label: "健身运动", icon: Dumbbell },
      { value: "美容护肤", label: "美容护肤", icon: Palette },
      { value: "房产中介", label: "房产中介", icon: Home },
      { value: "汽车服务", label: "汽车服务", icon: Car },
      { value: "法律咨询", label: "法律咨询", icon: Scale },
      { value: "财务记账", label: "财务记账", icon: Calculator },
      { value: "摄影摄像", label: "摄影摄像", icon: Camera },
      { value: "其他", label: "其他", icon: HelpCircle },
    ],
  },
  {
    id: 2,
    field: "surveyTargetCustomer",
    type: "textarea",
    label: "你的目标客户",
    sublabel: "描述你的理想客户是谁",
    icon: Users,
    placeholder: "例如：25-45岁的中小商户老板，有制冷设备维护需求，注重服务速度和质量",
  },
  {
    id: 3,
    field: "surveyMonetization",
    type: "cards",
    label: "你的变现方式",
    sublabel: "可以选择多个",
    icon: Coins,
    options: [
      { value: "服务收费", label: "服务收费", icon: DollarSign },
      { value: "产品销售", label: "产品销售", icon: ShoppingCart },
      { value: "课程/培训", label: "课程/培训", icon: BookOpen },
      { value: "广告接单", label: "广告接单", icon: Megaphone },
      { value: "加盟/代理", label: "加盟/代理", icon: Network },
      { value: "咨询顾问", label: "咨询顾问", icon: MessageSquare },
      { value: "会员订阅", label: "会员订阅", icon: Crown },
      { value: "其他", label: "其他", icon: HelpCircle },
    ],
  },
  {
    id: 4,
    field: "surveyPersonalTraits",
    type: "textarea",
    label: "你的个人特质",
    sublabel: "你有什么独特的优势或经历",
    icon: UserCircle,
    placeholder: "例如：15年从业经验，维修过3000+台设备，在当地口碑很好",
  },
  {
    id: 5,
    field: "surveyContentGoal",
    type: "cards",
    label: "你的内容目标",
    sublabel: "你最想通过短视频实现什么",
    icon: Target,
    options: [
      { value: "获取客户线索", label: "获取客户线索", icon: Users },
      { value: "打造个人品牌", label: "打造个人品牌", icon: Crown },
      { value: "直接带货成交", label: "直接带货成交", icon: ShoppingCart },
      { value: "行业影响力", label: "行业影响力", icon: Megaphone },
      { value: "知识付费变现", label: "知识付费变现", icon: BookOpen },
      { value: "本地引流到店", label: "本地引流到店", icon: MapPin },
    ],
  },
]

const EMPTY_SURVEY: SurveyAnswers = {
  surveyIndustry: "",
  surveyTargetCustomer: "",
  surveyMonetization: [],
  surveyPersonalTraits: "",
  surveyContentGoal: "",
}

const GENERATION_MESSAGES = [
  "分析你的答案...",
  "构建定位方案...",
  "完成收尾工作...",
]

const KNOWLEDGE_CATEGORIES = [
  { value: "boss_experience", label: "老板经验", wuxing: "尊贵紫气", colorClass: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/25" },
  { value: "product_usp", label: "产品卖点", wuxing: "苍穹玉蓝", colorClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25" },
  { value: "customer_pain", label: "客户痛点", wuxing: "熔岩烈红", colorClass: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25" },
  { value: "project_case", label: "项目案例", wuxing: "翡翠翠绿", colorClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25" },
  { value: "customer_qa", label: "客户问答", wuxing: "乾坤琥珀金", colorClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25" },
] as const

function getKnowledgeCategoryLabel(category: string) {
  return KNOWLEDGE_CATEGORIES.find((item) => item.value === category)?.label || category
}

// ─── Helper: check if current step has a valid answer ────

function isStepAnswered(stepIndex: number, answers: SurveyAnswers): boolean {
  switch (stepIndex) {
    case 0:
      return answers.surveyIndustry.trim() !== ""
    case 1:
      return answers.surveyTargetCustomer.trim() !== ""
    case 2:
      return answers.surveyMonetization.length > 0
    case 3:
      return answers.surveyPersonalTraits.trim() !== ""
    case 4:
      return answers.surveyContentGoal.trim() !== ""
    default:
      return false
  }
}

// ─── InlineStringField component ─────────────────────────

function InlineStringField({
  label,
  value,
  onSave,
}: {
  label: string
  value: string
  onSave: (newValue: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  // Sync draft when parent value changes externally
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  const commit = () => {
    const trimmed = draft.trim()
    setEditing(false)
    if (trimmed !== value) onSave(trimmed)
  }

  if (editing) {
    return (
      <div className="space-y-1">
        {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
        <Input
          id={`inline-input-${label ? label.replace(/\s+/g, "-") : "field"}`}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") { setDraft(value); setEditing(false) }
          }}
          className="h-8 text-sm"
        />
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <button
        type="button"
        className="w-full cursor-pointer rounded px-2 py-1 text-sm text-left hover:bg-muted transition-colors duration-150 flex items-center gap-1 group"
        onClick={() => { setDraft(value); setEditing(true) }}
        aria-label={label ? `编辑${label}` : "编辑"}
      >
        <span className="flex-1">{value || <span className="text-muted-foreground italic">点击添加</span>}</span>
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
      </button>
    </div>
  )
}

// ─── BadgeEditor component ────────────────────────────────

function BadgeEditor({
  label,
  values,
  onSave,
  maxItems,
}: {
  label: string
  values: string[]
  onSave: (newValues: string[]) => void
  maxItems?: number
}) {
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState("")

  const handleRemove = (index: number) => {
    const updated = values.filter((_, i) => i !== index)
    onSave(updated)
  }

  const handleAdd = () => {
    const trimmed = newItem.trim()
    if (!trimmed || values.includes(trimmed)) { setNewItem(""); return }
    if (maxItems && values.length >= maxItems) { setNewItem(""); setAdding(false); return }
    onSave([...values, trimmed])
    setNewItem("")
    setAdding(false)
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {values.map((item, i) => (
          <Badge
            key={i}
            variant="secondary"
            className="gap-1 cursor-pointer hover:bg-destructive/10 transition-colors duration-150"
          >
            {item}
            <button
              type="button"
              onClick={() => handleRemove(i)}
              className="inline-flex cursor-pointer"
              aria-label={`删除 ${item}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {adding ? (
          <Input
            id={`badge-editor-input-${label ? label.replace(/\s+/g, "-") : "tags"}`}
            autoFocus
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onBlur={() => { if (newItem.trim()) handleAdd(); else setAdding(false) }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd()
              if (e.key === "Escape") { setNewItem(""); setAdding(false) }
            }}
            className="h-7 w-32 text-xs"
            placeholder="输入并回车"
          />
        ) : (
          (!maxItems || values.length < maxItems) && (
            <Badge
              variant="outline"
              className="gap-1 cursor-pointer hover:bg-primary/5 transition-colors duration-150"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-3 w-3" /> 添加
            </Badge>
          )
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-8">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-1/2" />
        </CardContent>
      </Card>
    </div>
  )
}

interface WizardViewProps {
  stepIndex: number
  setStepIndex: React.Dispatch<React.SetStateAction<number>>
  surveyAnswers: SurveyAnswers
  setSurveyAnswers: React.Dispatch<React.SetStateAction<SurveyAnswers>>
  onGenerate: (answers: SurveyAnswers) => void
}

function WizardView({
  stepIndex,
  setStepIndex,
  surveyAnswers,
  setSurveyAnswers,
  onGenerate,
}: WizardViewProps) {
  const step = WIZARD_STEPS[stepIndex]
  const StepIcon = step.icon
  const answered = isStepAnswered(stepIndex, surveyAnswers)
  const isLastStep = stepIndex === WIZARD_STEPS.length - 1
  const progressValue = ((stepIndex + 1) / WIZARD_STEPS.length) * 100

  function handleCardClick(value: string) {
    if (step.field === "surveyMonetization") {
      // multi-select
      setSurveyAnswers((prev) => {
        const current = prev.surveyMonetization
        const next = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value]
        return { ...prev, surveyMonetization: next }
      })
    } else {
      // single-select
      setSurveyAnswers((prev) => ({
        ...prev,
        [step.field]: value,
      }))
    }
  }

  function handleTextareaChange(value: string) {
    setSurveyAnswers((prev) => ({
      ...prev,
      [step.field]: value,
    }))
  }

  function isCardSelected(value: string): boolean {
    if (step.field === "surveyMonetization") {
      return surveyAnswers.surveyMonetization.includes(value)
    }
    if (step.field === "surveyIndustry") return surveyAnswers.surveyIndustry === value
    if (step.field === "surveyContentGoal") return surveyAnswers.surveyContentGoal === value
    return false
  }

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] flex-col md:min-h-0 md:block">
      {/* Progress area */}
      <div className="mx-auto w-full max-w-2xl px-4 pb-4 pt-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StepIcon className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {step.label}
            </span>
          </div>
          <span className="text-sm text-muted-foreground">
            {stepIndex + 1} / {WIZARD_STEPS.length}
          </span>
        </div>
        <Progress value={progressValue} className="h-1.5 [&_[data-slot=progress-indicator]]:gold-flow-progress" />
        <p className="mt-2 text-xs text-muted-foreground">{step.sublabel}</p>
      </div>

      {/* Step content (scrollable on mobile) */}
      <div className="flex-1 overflow-y-auto pb-24 md:pb-8 overscroll-contain">
        <div className="mx-auto w-full max-w-2xl px-4">
          {step.type === "cards" && step.options ? (
            <div className="space-y-3">
              {step.field === "surveyMonetization" && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    已选 {surveyAnswers.surveyMonetization.length} 项
                  </Badge>
                  <span className="text-xs text-muted-foreground">（至少选1项）</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {step.options.map((option) => {
                  const OptionIcon = option.icon
                  const selected = isCardSelected(option.value)
                  return (
                    <Card
                      key={option.value}
                      onClick={() => handleCardClick(option.value)}
                      className={[
                        "cursor-pointer transition-all duration-300 select-none jade-emboss",
                        selected
                          ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(251,191,36,0.12)] dark:shadow-[0_0_15px_rgba(251,191,36,0.08)] scale-[1.02]"
                          : "border-border/60 hover:border-primary/40 hover:shadow-[0_0_12px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_0_12px_rgba(251,191,36,0.02)] active:scale-[0.98]",
                      ].join(" ")}
                    >
                      <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                        <OptionIcon
                          className={[
                            "h-6 w-6 transition-all duration-300",
                            selected ? "text-primary scale-110" : "text-muted-foreground",
                          ].join(" ")}
                        />
                        <span
                          className={[
                            "text-sm font-medium transition-colors duration-300",
                            selected ? "text-primary font-semibold" : "text-foreground",
                          ].join(" ")}
                        >
                          {option.label}
                        </span>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`wizard-textarea-${step.id}`} className="text-sm font-medium">
                {step.label}
              </Label>
              <Textarea
                id={`wizard-textarea-${step.id}`}
                rows={4}
                maxLength={500}
                placeholder={step.placeholder}
                value={
                  step.field === "surveyTargetCustomer"
                    ? surveyAnswers.surveyTargetCustomer
                    : surveyAnswers.surveyPersonalTraits
                }
                onChange={(e) => handleTextareaChange(e.target.value)}
                className="resize-none text-sm transition-all duration-300 hover:border-primary/50 focus:border-primary"
              />
              <p className="text-right text-xs text-muted-foreground">
                {(step.field === "surveyTargetCustomer"
                  ? surveyAnswers.surveyTargetCustomer
                  : surveyAnswers.surveyPersonalTraits
                ).length} / 500
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom sticky navigation */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:static md:mt-6 md:border-0 md:p-0">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
          {stepIndex > 0 ? (
            <Button
              variant="outline"
              onClick={() => setStepIndex((i) => i - 1)}
              className="cursor-pointer gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              上一步
            </Button>
          ) : (
            <div />
          )}

          {isLastStep ? (
            <Button
              onClick={() => onGenerate(surveyAnswers)}
              disabled={!answered}
              className="cursor-pointer gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              生成 IP 定位
            </Button>
          ) : (
            <Button
              onClick={() => setStepIndex((i) => i + 1)}
              disabled={!answered}
              className="cursor-pointer gap-1.5"
            >
              下一步
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function GeneratingView() {
  const [msgIndex, setMsgIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false

  useEffect(() => {
    if (prefersReducedMotion) return
    if (msgIndex >= GENERATION_MESSAGES.length - 1) return

    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => {
        setMsgIndex((i) => Math.min(i + 1, GENERATION_MESSAGES.length - 1))
        setVisible(true)
      }, 150)
    }, 2000)

    return () => clearTimeout(timer)
  }, [msgIndex, prefersReducedMotion])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
      {prefersReducedMotion ? (
        <div className="space-y-2 text-center">
          {GENERATION_MESSAGES.map((msg, i) => (
            <p
              key={i}
              className={i === GENERATION_MESSAGES.length - 1 ? "text-foreground font-medium animate-pulse" : "text-muted-foreground"}
            >
              {msg}
            </p>
          ))}
        </div>
      ) : (
        <>
          <svg className="h-14 w-14 text-primary tai-chi-rotate" viewBox="0 0 100 100" fill="currentColor">
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="3" />
            <path d="M 50 10 A 20 20 0 0 0 50 50 A 20 20 0 0 1 50 90 A 40 40 0 0 0 50 10 Z" fill="currentColor" />
            <circle cx="50" cy="30" r="6" className="fill-background" />
            <circle cx="50" cy="70" r="6" className="fill-primary" />
          </svg>
          <p
            className="text-base font-semibold text-foreground tracking-widest transition-opacity duration-300 animate-pulse"
            style={{ opacity: visible ? 1 : 0 }}
          >
            【乾坤定位】{GENERATION_MESSAGES[msgIndex]}
          </p>
        </>
      )}
    </div>
  )
}

// ─── ResultView ───────────────────────────────────────────

interface ResultViewProps {
  positioning: ThreeDPositioning
  surveyAnswers: SurveyAnswers
  saving: boolean
  onPositioningChange: (updated: ThreeDPositioning) => void
  onSaveField: (section: "business" | "persona" | "content", updatedSection: BusinessPositioning | PersonaDesign | ContentStrategy) => Promise<void>
  onConfirm: () => void
  onRegenerate: () => void
}

function ResultView({
  positioning,
  surveyAnswers,
  saving,
  onPositioningChange,
  onSaveField,
  onConfirm,
  onRegenerate,
}: ResultViewProps) {
  const summaryText = `你的 IP 定位：${positioning.business.core}，服务${positioning.business.audience}`

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      {/* AI Summary line */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-3 p-4">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <p className="text-sm font-medium text-foreground">{summaryText}</p>
        </CardContent>
      </Card>

      {/* Three cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Business Positioning */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              商业定位
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InlineStringField
              label="核心定位"
              value={positioning.business.core}
              onSave={(v) => {
                const updated = { ...positioning.business, core: v }
                onPositioningChange({ ...positioning, business: updated })
                onSaveField("business", updated)
              }}
            />
            <InlineStringField
              label="目标人群"
              value={positioning.business.audience}
              onSave={(v) => {
                const updated = { ...positioning.business, audience: v }
                onPositioningChange({ ...positioning, business: updated })
                onSaveField("business", updated)
              }}
            />
            <InlineStringField
              label="核心价值"
              value={positioning.business.value}
              onSave={(v) => {
                const updated = { ...positioning.business, value: v }
                onPositioningChange({ ...positioning, business: updated })
                onSaveField("business", updated)
              }}
            />
            <InlineStringField
              label="差异化优势"
              value={positioning.business.differentiator}
              onSave={(v) => {
                const updated = { ...positioning.business, differentiator: v }
                onPositioningChange({ ...positioning, business: updated })
                onSaveField("business", updated)
              }}
            />
          </CardContent>
        </Card>

        {/* Card 2: Persona Design */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCircle className="h-4 w-4 text-primary" />
              人设设计
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InlineStringField
              label="专业度"
              value={positioning.persona.expertiseLevel}
              onSave={(v) => {
                const updated = { ...positioning.persona, expertiseLevel: v }
                onPositioningChange({ ...positioning, persona: updated })
                onSaveField("persona", updated)
              }}
            />
            <InlineStringField
              label="表达风格"
              value={positioning.persona.expressionStyle}
              onSave={(v) => {
                const updated = { ...positioning.persona, expressionStyle: v }
                onPositioningChange({ ...positioning, persona: updated })
                onSaveField("persona", updated)
              }}
            />
            <BadgeEditor
              label="人设标签"
              values={positioning.persona.traits}
              maxItems={8}
              onSave={(newTraits) => {
                const updated = { ...positioning.persona, traits: newTraits }
                onPositioningChange({ ...positioning, persona: updated })
                onSaveField("persona", updated)
              }}
            />
          </CardContent>
        </Card>

        {/* Card 3: Content Strategy */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              内容策略
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Themes: name editable, ratio read-only */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">内容主题</Label>
              <div className="space-y-2">
                {positioning.content.themes.map((theme, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1">
                      <InlineStringField
                        label=""
                        value={theme.name}
                        onSave={(v) => {
                          const updatedThemes = positioning.content.themes.map((t, j) =>
                            j === i ? { ...t, name: v } : t
                          )
                          const updated = { ...positioning.content, themes: updatedThemes }
                          onPositioningChange({ ...positioning, content: updated })
                          onSaveField("content", updated)
                        }}
                      />
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {theme.ratio}%
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
            <Separator />
            <BadgeEditor
              label="内容形式"
              values={positioning.content.formats}
              maxItems={4}
              onSave={(newFormats) => {
                const updated = { ...positioning.content, formats: newFormats }
                onPositioningChange({ ...positioning, content: updated })
                onSaveField("content", updated)
              }}
            />
            <InlineStringField
              label="更新节奏"
              value={positioning.content.rhythm}
              onSave={(v) => {
                const updated = { ...positioning.content, rhythm: v }
                onPositioningChange({ ...positioning, content: updated })
                onSaveField("content", updated)
              }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <Button
          variant="outline"
          onClick={onRegenerate}
          className="cursor-pointer gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          重新生成
        </Button>
        <Button
          onClick={onConfirm}
          disabled={saving}
          className="cursor-pointer gap-2"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          确认并保存
        </Button>
      </div>
    </div>
  )
}

// ─── DashboardView ────────────────────────────────────────

interface DashboardViewProps {
  positioning: ThreeDPositioning
  savedProfile: ApiIpProfile | null
  onEdit: () => void
}

function DashboardView({ positioning, onEdit }: DashboardViewProps) {
  const summaryText = `你的 IP 定位：${positioning.business.core}，服务${positioning.business.audience}`

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">你的 IP 定位</h1>
        <Button
          variant="outline"
          onClick={onEdit}
          className="cursor-pointer gap-2"
        >
          <Pencil className="h-4 w-4" />
          编辑
        </Button>
      </div>

      {/* Summary line */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-3 p-4">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <p className="text-sm font-medium text-foreground">{summaryText}</p>
        </CardContent>
      </Card>

      {/* Three read-only cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Business Positioning (read-only) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              商业定位
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ReadOnlyField label="核心定位" value={positioning.business.core} />
            <ReadOnlyField label="目标人群" value={positioning.business.audience} />
            <ReadOnlyField label="核心价值" value={positioning.business.value} />
            <ReadOnlyField label="差异化优势" value={positioning.business.differentiator} />
          </CardContent>
        </Card>

        {/* Card 2: Persona Design (read-only) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCircle className="h-4 w-4 text-primary" />
              人设设计
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ReadOnlyField label="专业度" value={positioning.persona.expertiseLevel} />
            <ReadOnlyField label="表达风格" value={positioning.persona.expressionStyle} />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">人设标签</Label>
              <div className="flex flex-wrap gap-2">
                {positioning.persona.traits.map((trait, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {trait}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Content Strategy (read-only) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              内容策略
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">内容主题</Label>
              <div className="space-y-1">
                {positioning.content.themes.map((theme, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">{theme.name}</span>
                    <Badge variant="outline" className="text-xs">{theme.ratio}%</Badge>
                  </div>
                ))}
              </div>
            </div>
            <Separator />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">内容形式</Label>
              <div className="flex flex-wrap gap-2">
                {positioning.content.formats.map((fmt, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {fmt}
                  </Badge>
                ))}
              </div>
            </div>
            <ReadOnlyField label="更新节奏" value={positioning.content.rhythm} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ProfileTabs({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get("tab")
  const activeTab = requestedTab === "knowledge" ? "knowledge" : "ip-positioning"

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => router.replace(`/ip-profile?tab=${value}`, { scroll: false })}
      className="space-y-6"
    >
      <TabsList>
        <TabsTrigger value="ip-positioning">IP 定位</TabsTrigger>
        <TabsTrigger value="knowledge">知识库</TabsTrigger>
      </TabsList>
      <TabsContent value="ip-positioning" className="mt-0">
        {children}
      </TabsContent>
      <TabsContent value="knowledge" className="mt-0">
        <KnowledgeTab />
      </TabsContent>
    </Tabs>
  )
}

function KnowledgeTab() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [category, setCategory] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [entryCategory, setEntryCategory] = useState("boss_experience")
  const [saving, setSaving] = useState(false)

  // 统一的语音录制与智能转写管理 Hook
  const {
    isRecording,
    isTranscribing,
    recordDuration,
    volData,
    startRecording,
    stopRecording,
    formatTime,
  } = useAudioRecorder({
    transcribeFn: transcribeAudio,
    onTranscribeSuccess: (text) => setContent((prev) => (prev ? `${prev}\n${text}` : text)),
  })

  const loadEntries = useCallback(() => {
    setLoading(true)
    listKnowledge(category === "all" ? undefined : category)
      .then(setEntries)
      .catch((error) => toast.error(error instanceof Error ? error.message : "知识库加载失败"))
      .finally(() => setLoading(false))
  }, [category])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  function resetForm() {
    setEditingId(null)
    setTitle("")
    setContent("")
    setEntryCategory("boss_experience")
  }

  function startEdit(entry: KnowledgeEntry) {
    setEditingId(entry.id)
    setTitle(entry.title)
    setContent(entry.content)
    setEntryCategory(entry.category)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!title.trim() || !content.trim()) {
      toast.error("请填写标题和内容")
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        await updateKnowledge(editingId, {
          title: title.trim(),
          content: content.trim(),
          category: entryCategory,
        })
        toast.success("知识已更新")
      } else {
        await createKnowledge({
          title: title.trim(),
          content: content.trim(),
          category: entryCategory,
        })
        toast.success("知识已新增")
      }
      setDialogOpen(false)
      resetForm()
      loadEntries()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive(id: string) {
    try {
      await deleteKnowledge(id)
      toast.success("已归档")
      loadEntries()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "归档失败")
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={category === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setCategory("all")}
            className="cursor-pointer"
          >
            全部
          </Button>
          {KNOWLEDGE_CATEGORIES.map((item) => (
            <Button
              key={item.value}
              variant={category === item.value ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(item.value)}
              className="cursor-pointer"
            >
              {item.label}
            </Button>
          ))}
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger render={<Button className="cursor-pointer" />}>
            <Plus className="mr-2 h-4 w-4" />
            新增知识
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "编辑知识" : "新增知识"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>类别</Label>
                <Select
                  id="knowledge-category-select"
                  value={entryCategory}
                  onValueChange={(value) => {
                    if (value) setEntryCategory(value)
                  }}
                >
                  <SelectTrigger id="knowledge-category-select-trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KNOWLEDGE_CATEGORIES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="knowledge-title-input">标题</Label>
                <Input
                  id="knowledge-title-input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="例如：15年空调维修经验"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="knowledge-content-textarea">内容</Label>
                <div className="relative">
                  <Textarea
                    id="knowledge-content-textarea"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    rows={6}
                    placeholder="写下老板经验、产品卖点、客户问题、项目案例或问答素材。"
                    className={`min-h-36 resize-y pb-14 text-sm leading-relaxed transition-all duration-500 ${
                      isRecording
                        ? "border-primary shadow-[0_0_15px_rgba(239,68,68,0.25)] dark:shadow-[0_0_15px_rgba(239,68,68,0.15)] ring-1 ring-primary/30"
                        : "hover:border-primary/50 focus:border-primary"
                    }`}
                    disabled={isTranscribing || saving}
                  />
                  
                  {/* 智能语音转写 Loading 遮罩层 */}
                  {isTranscribing && (
                    <div className="absolute inset-0 ink-wash-mask flex flex-col items-center justify-center rounded-lg transition-all z-10">
                      <div className="flex flex-col items-center space-y-3">
                        <div className="relative flex items-center justify-center">
                          <svg className="h-12 w-12 text-primary tai-chi-rotate" viewBox="0 0 100 100" fill="currentColor">
                            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="3" />
                            <path d="M 50 10 A 20 20 0 0 0 50 50 A 20 20 0 0 1 50 90 A 40 40 0 0 0 50 10 Z" fill="currentColor" />
                            <circle cx="50" cy="30" r="6" className="fill-background" />
                            <circle cx="50" cy="70" r="6" className="fill-primary" />
                          </svg>
                        </div>
                        <p className="text-xs font-semibold text-foreground tracking-widest animate-pulse">
                          【乾坤流转】语音墨宝转写中...
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 浮动麦克风与声波控制栏 */}
                  <div className="absolute bottom-3 right-3 flex items-center gap-2 z-20">
                    {isRecording ? (
                      <div className="flex items-center gap-3 rounded-full border border-primary/20 bg-background/95 px-3 py-1.5 shadow-md backdrop-blur transition-all duration-300">
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                        <span className="font-mono text-xs text-foreground font-semibold">
                          {formatTime(recordDuration)} / 01:00
                        </span>
                        
                        {/* 薪火跳动音波 — 红莲熔岩赤金渐变 */}
                        <div className="flex items-center gap-1 h-3.5">
                          {volData.map((height, i) => (
                            <div
                              key={i}
                              className="w-[2.5px] bg-lava-waveform rounded-full transition-all duration-75 shadow-[0_0_4px_oklch(0.575_0.205_28.0/0.3)]"
                              style={{ height: `${Math.max(4, height / 6)}px` }}
                            />
                          ))}
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={stopRecording}
                          className="h-7 cursor-pointer px-2 text-[10px] font-semibold text-primary hover:bg-primary/10 transition-all duration-200"
                        >
                          说完了
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={startRecording}
                        disabled={isTranscribing || saving}
                        className="cursor-pointer gap-1.5 border-primary/30 hover:border-primary hover:bg-primary/5 shadow-sm text-xs h-9 rounded-md transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] badge-gold"
                      >
                        <Mic className="h-3.5 w-3.5 text-primary animate-pulse" />
                        语音输入
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  保存
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card>
          <CardContent className="space-y-3">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">还没有知识条目</p>
            <p className="mt-1 text-sm text-muted-foreground">
              点击右上角「新增知识」，开始沉淀企业营销资产。
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const getCategoryBadgeClass = (cat: string) => {
              return KNOWLEDGE_CATEGORIES.find((c) => c.value === cat)?.colorClass || "bg-muted text-muted-foreground border-muted-foreground/10"
            }

            return (
              <Card key={entry.id} className="border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(251,191,36,0.04)] dark:hover:shadow-[0_4px_20px_rgba(251,191,36,0.02)] hover:border-primary/30">
                <CardContent className="p-5 space-y-3">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1.5 flex-1">
                      <h3 className="font-semibold text-base text-foreground leading-snug">{entry.title}</h3>
                      <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap select-text">
                        {entry.content}
                      </p>
                      <div className="pt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <Badge variant="outline" className={getCategoryBadgeClass(entry.category)}>
                          {getKnowledgeCategoryLabel(entry.category)}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                          {entry.sourceType === "manual" ? "手动录入" : "ASR 语音"}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                          {new Date(entry.createdAt).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                    </div>
                    <div className="flex sm:flex-col shrink-0 gap-2 sm:items-end justify-end mt-2 sm:mt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(entry)}
                        className="cursor-pointer font-medium hover:border-primary/30 hover:bg-primary/[0.02]"
                      >
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleArchive(entry.id)}
                        className="cursor-pointer font-medium hover:bg-destructive/10 hover:text-destructive"
                      >
                        归档
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── ReadOnlyField helper ─────────────────────────────────

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="text-sm text-foreground px-2 py-1">{value || <span className="text-muted-foreground italic">未填写</span>}</p>
    </div>
  )
}

// ─── Main page component ─────────────────────────────────

export default function IpProfilePage() {
  const [view, setView] = useState<PageView>("loading")
  const [stepIndex, setStepIndex] = useState(0)
  const [surveyAnswers, setSurveyAnswers] = useState<SurveyAnswers>(EMPTY_SURVEY)
  const [positioning, setPositioning] = useState<ThreeDPositioning | null>(null)
  const [savedProfile, setSavedProfile] = useState<ApiIpProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [v1Profile, setV1Profile] = useState<ApiIpProfile | null>(null)

  useEffect(() => {
    getIpProfile()
      .then((response) => {
        if (
          response.profile &&
          isV2Profile(response.profile) &&
          hasCompletePositioning(response.profile)
        ) {
          setPositioning({
            business: response.profile.business,
            persona: response.profile.persona,
            content: response.profile.content,
          })
          setSavedProfile(response.profile)
          // Pre-fill survey answers from saved v2 profile
          if (response.profile.surveyIndustry) {
            setSurveyAnswers({
              surveyIndustry: response.profile.surveyIndustry || "",
              surveyTargetCustomer: response.profile.surveyTargetCustomer || "",
              surveyMonetization: Array.isArray(response.profile.surveyMonetization)
                ? response.profile.surveyMonetization
                : [],
              surveyPersonalTraits: response.profile.surveyPersonalTraits || "",
              surveyContentGoal: response.profile.surveyContentGoal || "",
            })
          }
          setView("dashboard")
        } else if (
          response.profile &&
          response.isComplete &&
          (response.profile.profileVersion ?? 1) === 1
        ) {
          // v1 complete user — go to wizard for upgrade
          setV1Profile(response.profile)
          setView("wizard")
        } else {
          setView("wizard")
        }
      })
      .catch(() => {
        setView("wizard")
      })
  }, [])

  const handleGenerate = useCallback(async (answers: SurveyAnswers) => {
    setView("generating")

    const request: GeneratePositioningRequest = {
      surveyIndustry: answers.surveyIndustry,
      surveyTargetCustomer: answers.surveyTargetCustomer,
      surveyMonetization: answers.surveyMonetization,
      surveyPersonalTraits: answers.surveyPersonalTraits,
      surveyContentGoal: answers.surveyContentGoal,
    }

    try {
      const response = await generatePositioning(request)
      setPositioning(response.data)
      setSurveyAnswers(answers)
      setView("result")
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "生成失败，请稍后重试"
      toast.error(message)
      setView("wizard")
    }
  }, [])

  const handleStartUpgrade = useCallback(() => {
    if (!v1Profile) return
    // Pre-fill mapping from v1 flat fields to wizard survey answers:
    // Q1 (surveyIndustry) <- industry
    // Q2 (surveyTargetCustomer) <- targetAudience (NOT displayName)
    // Q3 (surveyMonetization) <- cannot infer from v1; leave empty for user to select
    // Q4 (surveyPersonalTraits) <- ipTraits
    // Q5 (surveyContentGoal) <- cannot map CTA to goal; leave empty for user to select
    setSurveyAnswers({
      surveyIndustry: v1Profile.industry || "",
      surveyTargetCustomer: v1Profile.targetAudience || "",
      surveyMonetization: [],
      surveyPersonalTraits: v1Profile.ipTraits || "",
      surveyContentGoal: "",
    })
    setStepIndex(0)
    setView("wizard")
  }, [v1Profile])

  const handleSaveField = useCallback(async (
    section: "business" | "persona" | "content",
    updatedSection: BusinessPositioning | PersonaDesign | ContentStrategy
  ) => {
    if (!positioning) return
    const updatedPositioning = { ...positioning, [section]: updatedSection }
    try {
      await upsertIpProfile({
        profileVersion: 2,
        surveyIndustry: surveyAnswers.surveyIndustry,
        surveyTargetCustomer: surveyAnswers.surveyTargetCustomer,
        surveyMonetization: surveyAnswers.surveyMonetization,
        surveyPersonalTraits: surveyAnswers.surveyPersonalTraits,
        surveyContentGoal: surveyAnswers.surveyContentGoal,
        business: updatedPositioning.business,
        persona: updatedPositioning.persona,
        content: updatedPositioning.content,
      })
    } catch (err) {
      console.error("Save field error:", err)
      const message = err instanceof ApiError ? err.message : "保存失败，请检查网络连接"
      toast.error(message)
    }
  }, [positioning, surveyAnswers])

  const handleConfirm = useCallback(async () => {
    if (!positioning) return
    setSaving(true)
    try {
      const response = await upsertIpProfile({
        profileVersion: 2,
        surveyIndustry: surveyAnswers.surveyIndustry,
        surveyTargetCustomer: surveyAnswers.surveyTargetCustomer,
        surveyMonetization: surveyAnswers.surveyMonetization,
        surveyPersonalTraits: surveyAnswers.surveyPersonalTraits,
        surveyContentGoal: surveyAnswers.surveyContentGoal,
        business: positioning.business,
        persona: positioning.persona,
        content: positioning.content,
      })
      setSavedProfile(response.profile)
      toast.success("IP 定位已保存")
      setView("dashboard")
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "保存失败，请重试"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }, [positioning, surveyAnswers])

  const handleRegenerate = useCallback(async () => {
    setView("generating")

    const request: GeneratePositioningRequest = {
      surveyIndustry: surveyAnswers.surveyIndustry,
      surveyTargetCustomer: surveyAnswers.surveyTargetCustomer,
      surveyMonetization: surveyAnswers.surveyMonetization,
      surveyPersonalTraits: surveyAnswers.surveyPersonalTraits,
      surveyContentGoal: surveyAnswers.surveyContentGoal,
    }

    try {
      const response = await generatePositioning(request)
      setPositioning(response.data)
      setView("result")
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "重新生成失败，请重试"
      toast.error(message)
      setView("result")
    }
  }, [surveyAnswers])

  const handleEdit = useCallback(() => {
    setView("result")
  }, [])

  if (view === "loading") {
    return <LoadingSkeleton />
  }

  if (view === "wizard") {
    return (
      <ProfileTabs>
        <WizardView
          stepIndex={stepIndex}
          setStepIndex={setStepIndex}
          surveyAnswers={surveyAnswers}
          setSurveyAnswers={setSurveyAnswers}
          onGenerate={handleGenerate}
        />
      </ProfileTabs>
    )
  }

  if (view === "generating") {
    return <GeneratingView />
  }

  if (view === "result" && positioning) {
    return (
      <ProfileTabs>
        <ResultView
          positioning={positioning}
          surveyAnswers={surveyAnswers}
          saving={saving}
          onPositioningChange={setPositioning}
          onSaveField={handleSaveField}
          onConfirm={handleConfirm}
          onRegenerate={handleRegenerate}
        />
      </ProfileTabs>
    )
  }

  if (view === "dashboard" && positioning) {
    return (
      <ProfileTabs>
        <DashboardView
          positioning={positioning}
          savedProfile={savedProfile}
          onEdit={handleEdit}
        />
      </ProfileTabs>
    )
  }

  // Fallback if positioning not set yet (shouldn't happen in normal flow)
  return <LoadingSkeleton />
}
