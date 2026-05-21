"use client"

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  BookOpen,
  Check,
  Clipboard,
  FileText,
  History,
  Lightbulb,
  Loader2,
  MessageCircle,
  Mic,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  generateAimContent,
  generateTopics,
  getIpProfile,
  listAimHistory,
  listHotTopics,
  listKnowledge,
  selectTopic,
  transcribeAudio,
  type AimGenerateResponse,
  type AimGeneration,
  type ContentFormat,
  type KnowledgeEntry,
} from "@/lib/api/client"
import { useAudioRecorder } from "@/hooks/use-audio-recorder"
import type { ApiIpProfile, ApiTopicCard } from "@/types/api"
import type { HotTopic } from "@/types/content-template"

const FORMAT_OPTIONS: Array<{
  value: ContentFormat
  label: string
  desc: string
  icon: typeof FileText
}> = [
  {
    value: "video_script",
    label: "视频脚本",
    desc: "适合口播录制的短视频文案",
    icon: Send,
  },
  {
    value: "wechat_article",
    label: "公众号文章",
    desc: "适合深度阅读的长文版本",
    icon: FileText,
  },
  {
    value: "moments_post",
    label: "朋友圈文案",
    desc: "适合私域发布的短表达",
    icon: MessageCircle,
  },
]

const LOADING_MESSAGES = ["分析输入...", "检索知识库...", "生成内容..."]

const WORKFLOW_STEPS = [
  { label: "知识库", desc: "收集老板经验、卖点、痛点、案例" },
  { label: "IP 档案", desc: "AI 建立商业、人设、内容三维定位" },
  { label: "爆款选题", desc: "生成 4 个差异化选题" },
  { label: "口播文案", desc: "七大开头 + 文案结构自动生成" },
  { label: "审核融合", desc: "去 AI 味，可结合当前热点" },
  { label: "文案裂变", desc: "同步裂变公众号、朋友圈等格式" },
]

function formatLabel(format: ContentFormat | string) {
  return FORMAT_OPTIONS.find((item) => item.value === format)?.label || format
}

function renderZhuJianContent(text: string) {
  if (!text) return null
  const lines = text.split("\n")
  return (
    <div className="space-y-4 select-text font-serif leading-loose tracking-widest text-foreground/95 antialiased">
      {lines.map((line, index) => {
        // 匹配含有 【】的标记
        const regex = /(【[^】]+】)/g
        const parts = line.split(regex)
        if (parts.length > 1) {
          return (
            <p key={index} className="text-sm sm:text-[16px] leading-loose tracking-widest my-3 text-[#2c2b2a] dark:text-[#f3ede2]">
              {parts.map((part, pIdx) => {
                if (part.startsWith("【") && part.endsWith("】")) {
                  // 【画面】使用温润浅玉色竹简标签
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
                  // 【旁白】使用深金泥色加粗高亮
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
                  // 其他标签使用金石印章质感
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
}

function getHistoryContents(item: AimGeneration) {
  return [
    item.videoScript ? { format: "video_script" as const, content: item.videoScript } : null,
    item.wechatArticle ? { format: "wechat_article" as const, content: item.wechatArticle } : null,
    item.momentsPost ? { format: "moments_post" as const, content: item.momentsPost } : null,
  ].filter(Boolean) as Array<{ format: ContentFormat; content: string }>
}

export default function AimPage() {
  const searchParams = useSearchParams()
  const [rawInput, setRawInput] = useState("")
  const [selectedFormats, setSelectedFormats] = useState<Set<ContentFormat>>(
    () => new Set(["video_script", "moments_post"])
  )
  const [isGenerating, setIsGenerating] = useState(false)
  const [loadingIndex, setLoadingIndex] = useState(0)
  const [result, setResult] = useState<AimGenerateResponse | null>(null)
  const [activeResultTab, setActiveResultTab] = useState<ContentFormat>("video_script")
  const [history, setHistory] = useState<AimGeneration[]>([])
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([])
  const [ipProfile, setIpProfile] = useState<ApiIpProfile | null>(null)
  const [topicCards, setTopicCards] = useState<ApiTopicCard[]>([])
  const [topicSelectionId, setTopicSelectionId] = useState<string | null>(null)
  const [selectedTopicIndex, setSelectedTopicIndex] = useState<number | null>(null)
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false)
  const [hotTopics, setHotTopics] = useState<HotTopic[]>([])
  const [selectedHotTopic, setSelectedHotTopic] = useState("")
  const [polishInstruction, setPolishInstruction] = useState("去 AI 味，保留真人表达的犹豫、判断和具体细节，少用套话")
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null)
  const topicsRef = useRef<HTMLDivElement | null>(null)
  const generateRef = useRef<HTMLDivElement | null>(null)
  const reviewRef = useRef<HTMLDivElement | null>(null)
  const repurposeRef = useRef<HTMLDivElement | null>(null)

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
    onTranscribeSuccess: (text) => setRawInput((prev) => (prev ? `${prev}\n${text}` : text)),
  })

  useEffect(() => {
    listAimHistory(1, 10).then(setHistory).catch(() => {})
    listKnowledge().then(setKnowledge).catch(() => {})
    getIpProfile().then((data) => setIpProfile(data.profile)).catch(() => {})
    listHotTopics().then((data) => setHotTopics(data.topics || [])).catch(() => {})
  }, [])

  useEffect(() => {
    const hotTopic = searchParams.get("hotTopic")
    if (!hotTopic) return

    setRawInput((current) => {
      if (current.trim()) return current
      return `请结合当前热点「${hotTopic}」，为我的业务生成一组能追热点的营销文案。要求不要硬蹭热点，要找到热点和客户需求、产品卖点、老板经验之间的自然关联。`
    })
    setSelectedFormats(new Set(["video_script", "moments_post"]))
    setSelectedHotTopic(hotTopic)
  }, [searchParams])

  useEffect(() => {
    const step = searchParams.get("step")
    const target =
      step === "topics"
        ? topicsRef.current
        : step === "generate"
          ? generateRef.current
          : step === "review"
            ? reviewRef.current
            : step === "repurpose"
              ? repurposeRef.current || generateRef.current
              : null

    if (!target) return

    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [searchParams, result])

  useEffect(() => {
    if (!isGenerating) return
    const timer = setInterval(() => {
      setLoadingIndex((value) => (value + 1) % LOADING_MESSAGES.length)
    }, 1400)
    return () => clearInterval(timer)
  }, [isGenerating])



  function toggleFormat(format: ContentFormat) {
    setSelectedFormats((current) => {
      const next = new Set(current)
      if (next.has(format)) {
        next.delete(format)
      } else {
        next.add(format)
      }
      return next
    })
  }

  async function handleGenerateTopics() {
    if (!ipProfile?.isComplete) {
      toast.error("请先在企业档案中完成三维 IP 定位")
      return
    }

    setIsGeneratingTopics(true)
    try {
      const response = await generateTopics(undefined, topicCards.length > 0 ? 1 : 0)
      setTopicCards(response.cards)
      setTopicSelectionId(response.topicSelectionId)
      setSelectedTopicIndex(null)
      toast.success("已生成 4 个爆款选题")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "选题生成失败")
    } finally {
      setIsGeneratingTopics(false)
    }
  }

  async function handleSelectTopic(index: number) {
    setSelectedTopicIndex(index)
    if (!topicSelectionId) return
    try {
      await selectTopic(topicSelectionId, index)
    } catch {
      // 选题落库失败不阻断本次文案生成，前端仍保留用户选择。
    }
  }

  async function handleGenerate() {
    const input = rawInput.trim()
    const targetFormats = [...selectedFormats]
    if (!input) {
      toast.error("请输入要生成的内容")
      return
    }
    if (targetFormats.length === 0) {
      toast.error("请选择至少一种文案格式")
      return
    }

    setIsGenerating(true)
    setLoadingIndex(0)
    try {
      const selectedTopic =
        selectedTopicIndex != null ? topicCards[selectedTopicIndex] : null
      const response = await generateAimContent({
        rawInput: input,
        targetFormats,
        topicTitle: selectedTopic?.title,
        topicRationale: selectedTopic?.rationale,
        hotTopic: selectedHotTopic || undefined,
        polishInstruction: polishInstruction.trim() || undefined,
      })
      setResult(response)
      setActiveResultTab(response.results[0]?.format || targetFormats[0])
      listAimHistory(1, 10).then(setHistory).catch(() => {})
      toast.success("AIM 文案已生成")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成失败，请稍后重试")
    } finally {
      setIsGenerating(false)
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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-amber-600 bg-clip-text text-transparent">AIM 一键生成</h1>
          <Badge className="badge-gold border-none px-2 py-0.5 rounded-sm text-xs">文案工作流版</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          依托企业专属档案与庞大知识库，以太极之势一键推演爆款选题与薪火文案，裂变全媒介矩阵。
        </p>
      </div>

      <Card className="dao-shimmer border border-border/80 shadow-xs relative overflow-hidden">
        <CardContent className="space-y-5 pt-6">
          <div className="grid gap-3 md:grid-cols-6">
            {WORKFLOW_STEPS.map((step, index) => (
              <div key={step.label} className="rounded-xl border border-border/60 bg-muted/10 p-3.5 transition-all duration-300 hover:border-primary/20 hover:bg-muted/20">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex size-5.5 items-center justify-center rounded-sm bg-gradient-to-br from-primary to-amber-500 text-[10px] font-bold text-primary-foreground shadow-xs">
                    {index + 1}
                  </span>
                  <p className="text-xs font-semibold text-foreground/90">{step.label}</p>
                </div>
                <p className="text-[10px] leading-relaxed text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-card p-4 transition-all duration-300 hover:shadow-xs group hover:scale-[1.01]">
              <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-foreground/80">
                <BookOpen className="h-4 w-4 text-primary group-hover:scale-110 transition-all duration-300" />
                企业专属知识库
              </div>
              <p className="text-2xl font-bold text-foreground bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">{knowledge.length}</p>
              <p className="text-xs text-muted-foreground mt-1">天道归藏条目，生成时智能引用</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-4 transition-all duration-300 hover:shadow-xs group hover:scale-[1.01]">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-foreground/80">
                <Target className="h-4 w-4 text-primary group-hover:scale-110 transition-all duration-300" />
                三维 IP 商业档案
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-bold text-foreground">
                  {ipProfile?.isComplete ? (
                    <span className="text-amber-600 dark:text-amber-500">已立命数</span>
                  ) : (
                    <span className="text-muted-foreground">待立宗门</span>
                  )}
                </p>
              </div>
              <Button
                className="mt-1 h-7 p-0 text-xs text-primary font-medium hover:text-amber-600"
                variant="link"
                nativeButton={false}
                render={<Link href="/ip-profile?tab=ip-positioning" />}
              >
                去确立企业档案 →
              </Button>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-4 transition-all duration-300 hover:shadow-xs group hover:scale-[1.01]">
              <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-foreground/80">
                <ShieldCheck className="h-4 w-4 text-primary group-hover:scale-110 transition-all duration-300" />
                去 AI 味融合
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                自然法则：融合老板心法，拒绝冷冰话术，追求重剑无锋的真人犹豫与顿挫。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div ref={topicsRef} id="topics" className="scroll-mt-6">
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between pb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Lightbulb className="h-4 w-4 text-primary" />
                推演爆款选题
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                基于十二大黄帝内经商业元素，为品牌推演四大与众不同的惊艳选题。
              </p>
            </div>
            <Button 
              onClick={handleGenerateTopics} 
              disabled={isGeneratingTopics || isGenerating}
              className="badge-gold border-none shadow-xs hover:scale-105 active:scale-95 transition-all duration-300 h-9"
            >
              {isGeneratingTopics ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              {topicCards.length > 0 ? "重新推演选题" : "推演爆款选题"}
            </Button>
          </CardHeader>
          <CardContent>
            {topicCards.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/80 p-6 text-sm text-muted-foreground bg-muted/5 flex items-center justify-center">
                请先确立企业三维 IP 档案，再行点击上方「推演爆款选题」，或在下方直接落笔。
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {topicCards.map((topic, index) => {
                  const selected = selectedTopicIndex === index
                  return (
                    <button
                      key={`${topic.title}-${index}`}
                      type="button"
                      onClick={() => handleSelectTopic(index)}
                      className={`rounded-xl border p-5 text-left transition-all duration-300 relative overflow-hidden group hover:scale-[1.01] active:scale-[0.99] ${
                        selected
                          ? "border-primary bg-gradient-to-br from-primary/[0.04] to-amber-500/[0.02] shadow-[0_0_15px_rgba(239,68,68,0.06)]"
                          : "border-border/80 bg-card/60 hover:border-primary/40 hover:bg-card/90"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="badge-gold px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-widest">
                          【黄帝选题】
                        </span>
                        {selected && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                      
                      <h4 className={`text-sm font-bold leading-snug transition-colors duration-300 ${selected ? "text-primary" : "text-foreground"}`}>
                        {topic.title}
                      </h4>
                      
                      {topic.rationale && (
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-3 select-text whitespace-pre-wrap">
                          {topic.rationale}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 核心文案落笔生产卡片 */}
      <Card ref={generateRef} id="generate" className="scroll-mt-6 relative overflow-hidden border border-border/80 shadow-xs">
          <CardContent className="space-y-5 pt-6">
          <div className="space-y-2">
            <div className="relative">
              <Textarea
                value={rawInput}
                onChange={(event) => setRawInput(event.target.value)}
                rows={8}
                placeholder="例如：客户总问空调不制冷是不是缺氟，我想讲清楚为什么不能只看缺氟，还要看清洗、漏点和安装问题。"
                className={`min-h-44 resize-y pb-14 text-sm leading-relaxed transition-all duration-300 bg-neutral-100/40 dark:bg-[#131211] border-border/80 focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary focus-within:shadow-[0_0_20px_rgba(179,50,38,0.2)] ${
                  isRecording 
                    ? "ring-2 ring-primary/40 fire-pulse-ring border-primary bg-primary/[0.005]" 
                    : ""
                }`}
                disabled={isTranscribing || isGenerating}
              />
              
              {/* 智能语音转写 Loading 遮罩层 */}
              {isTranscribing && (
                <div className="absolute inset-0 ink-wash-mask flex flex-col items-center justify-center rounded-lg transition-all z-10">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="relative flex items-center justify-center">
                      <svg className="h-16 w-16 text-primary" viewBox="0 0 100 100" fill="currentColor">
                        <g className="tai-chi-rotate" style={{ animationDirection: 'reverse', animationDuration: '15s', transformOrigin: '50px 50px' }}>
                          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.3" />
                          <text x="50" y="14" textAnchor="middle" fontSize="6.5" fontFamily="serif" fill="currentColor" transform="rotate(0 50 50)">☰</text>
                          <text x="50" y="14" textAnchor="middle" fontSize="6.5" fontFamily="serif" fill="currentColor" transform="rotate(45 50 50)">☱</text>
                          <text x="50" y="14" textAnchor="middle" fontSize="6.5" fontFamily="serif" fill="currentColor" transform="rotate(90 50 50)">☲</text>
                          <text x="50" y="14" textAnchor="middle" fontSize="6.5" fontFamily="serif" fill="currentColor" transform="rotate(135 50 50)">☳</text>
                          <text x="50" y="14" textAnchor="middle" fontSize="6.5" fontFamily="serif" fill="currentColor" transform="rotate(180 50 50)">☷</text>
                          <text x="50" y="14" textAnchor="middle" fontSize="6.5" fontFamily="serif" fill="currentColor" transform="rotate(225 50 50)">☴</text>
                          <text x="50" y="14" textAnchor="middle" fontSize="6.5" fontFamily="serif" fill="currentColor" transform="rotate(270 50 50)">☵</text>
                          <text x="50" y="14" textAnchor="middle" fontSize="6.5" fontFamily="serif" fill="currentColor" transform="rotate(315 50 50)">☶</text>
                        </g>
                        <circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
                        <g className="tai-chi-rotate" style={{ animationDuration: '6s', transformOrigin: '50px 50px' }}>
                          <path d="M 50 18 A 16 16 0 0 0 50 50 A 16 16 0 0 1 50 82 A 32 32 0 0 0 50 18 Z" fill="currentColor" />
                          <circle cx="50" cy="34" r="3.5" fill="var(--background)" />
                          <circle cx="50" cy="66" r="3.5" fill="currentColor" />
                          <circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" strokeWidth="1" />
                        </g>
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
                    disabled={isTranscribing || isGenerating}
                    className="cursor-pointer gap-1.5 border-primary/30 hover:border-primary hover:bg-primary/5 shadow-sm text-xs h-9 rounded-md transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] badge-gold"
                  >
                    <Mic className="h-3.5 w-3.5 text-primary animate-pulse" />
                    语音输入
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              可以输入或语音录音录入碎片想法、产品卖点、客户问题、项目案例，越具体越好。
            </p>
          </div>

          <div ref={reviewRef} id="review" className="grid scroll-mt-6 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground/80">结合热点（可选）</p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    nativeButton={false}
                    render={<Link href="/hot-topics" />}
                    className="h-7 text-xs text-primary hover:bg-primary/5"
                  >
                    更多热点
                  </Button>
                  {selectedHotTopic ? (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedHotTopic("")} className="h-7 text-xs hover:bg-muted">
                      清除
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {hotTopics.slice(0, 8).map((topic) => (
                  <button
                    key={topic.id || topic.title}
                    type="button"
                    onClick={() => setSelectedHotTopic(topic.title)}
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
                      selectedHotTopic === topic.title
                        ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "bg-card border-border/80 hover:border-primary/40 hover:bg-card/90"
                    }`}
                  >
                    🔥 {topic.rank}. {topic.title}
                  </button>
                ))}
              </div>
              {selectedHotTopic ? (
                <p className="text-xs text-primary font-medium animate-pulse">将自然融合热点：{selectedHotTopic}</p>
              ) : (
                <p className="text-xs text-muted-foreground">不选热点时，文案只基于企业知识库和选题生成。</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground/80">文案审核与去 AI 味</p>
              <Textarea
                value={polishInstruction}
                onChange={(event) => setPolishInstruction(event.target.value)}
                rows={3}
                className="min-h-20 resize-none text-xs border-border/80"
                placeholder="例如：去 AI 味，保留真人表达，少用套话，多用具体案例 and 判断。"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {FORMAT_OPTIONS.map((option) => {
              const Icon = option.icon
              const checked = selectedFormats.has(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleFormat(option.value)}
                  className={`rounded-xl border p-4 text-left transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] ${
                    checked
                      ? "border-primary bg-gradient-to-br from-primary/[0.04] to-amber-500/[0.01] shadow-[0_0_15px_rgba(239,68,68,0.04)]"
                      : "border-border/85 bg-card hover:border-primary/40 hover:bg-card/90"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <span
                      className={`flex size-5 items-center justify-center rounded-full border transition-all duration-300 ${
                        checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                      }`}
                    >
                      {checked && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-foreground/90">{option.label}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{option.desc}</p>
                </button>
              )
            })}
          </div>

          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full cursor-pointer gap-2 bg-fire-earth-gradient text-primary-foreground shadow-md hover:opacity-95 hover:scale-[1.005] active:scale-[0.995] transition-all duration-300 font-semibold tracking-wider h-11"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {LOADING_MESSAGES[loadingIndex]}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
                一键生成 (推演太极薪火)
              </>
            )}
          </Button>
        </CardContent>

        {/* 智能生成中水墨遮罩 & 太极罗盘 */}
        {isGenerating && (
          <div className="absolute inset-0 ink-wash-mask flex flex-col items-center justify-center rounded-lg transition-all duration-500 z-30">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative flex items-center justify-center">
                <svg className="h-28 w-28 text-primary" viewBox="0 0 100 100" fill="currentColor">
                  {/* 外八卦圈：包含8个爻象符号，逆时针物理速旋 */}
                  <g className="tai-chi-rotate" style={{ animationDirection: 'reverse', animationDuration: '15s', transformOrigin: '50px 50px' }}>
                    <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.3" />
                    <text x="50" y="14" textAnchor="middle" fontSize="6.5" fontFamily="serif" fill="currentColor" transform="rotate(0 50 50)">☰</text>
                    <text x="50" y="14" textAnchor="middle" fontSize="6.5" fontFamily="serif" fill="currentColor" transform="rotate(45 50 50)">☱</text>
                    <text x="50" y="14" textAnchor="middle" fontSize="6.5" fontFamily="serif" fill="currentColor" transform="rotate(90 50 50)">☲</text>
                    <text x="50" y="14" textAnchor="middle" fontSize="6.5" fontFamily="serif" fill="currentColor" transform="rotate(135 50 50)">☳</text>
                    <text x="50" y="14" textAnchor="middle" fontSize="6.5" fontFamily="serif" fill="currentColor" transform="rotate(180 50 50)">☷</text>
                    <text x="50" y="14" textAnchor="middle" fontSize="6.5" fontFamily="serif" fill="currentColor" transform="rotate(225 50 50)">☴</text>
                    <text x="50" y="14" textAnchor="middle" fontSize="6.5" fontFamily="serif" fill="currentColor" transform="rotate(270 50 50)">☵</text>
                    <text x="50" y="14" textAnchor="middle" fontSize="6.5" fontFamily="serif" fill="currentColor" transform="rotate(315 50 50)">☶</text>
                  </g>
                  {/* 中同心度圆环 */}
                  <circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
                  {/* 内太极阴阳鱼：顺时针快速物理自旋 */}
                  <g className="tai-chi-rotate" style={{ animationDuration: '6s', transformOrigin: '50px 50px' }}>
                    <path d="M 50 18 A 16 16 0 0 0 50 50 A 16 16 0 0 1 50 82 A 32 32 0 0 0 50 18 Z" fill="currentColor" />
                    {/* 太极双眼 */}
                    <circle cx="50" cy="34" r="3.5" fill="var(--background)" />
                    <circle cx="50" cy="66" r="3.5" fill="currentColor" />
                    <circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" strokeWidth="1" />
                  </g>
                </svg>
              </div>
              <p className="text-sm font-semibold tracking-widest text-primary animate-pulse">
                【太极推演】{LOADING_MESSAGES[loadingIndex]}
              </p>
            </div>
          </div>
        )}
      </Card>

      {result && (
        <Card ref={repurposeRef} id="repurpose" className="scroll-mt-6 border border-primary/20 bg-gradient-to-b from-card to-primary/[0.01] shadow-md relative overflow-hidden">
          <CardHeader className="pb-3 border-b border-muted/30">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="h-4.5 w-4.5 text-primary animate-pulse" />
              智能生成结果 (薪火墨宝)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <Tabs value={activeResultTab} onValueChange={(value) => setActiveResultTab(value as ContentFormat)}>
              <TabsList className="bg-muted/60 p-1 rounded-lg">
                {result.results.map((item) => (
                  <TabsTrigger key={item.format} value={item.format} className="data-[state=active]:bg-background data-[state=active]:shadow-xs transition-all duration-300 rounded-md">
                    {formatLabel(item.format)}
                  </TabsTrigger>
                ))}
              </TabsList>
              {result.results.map((item) => (
                <TabsContent key={item.format} value={item.format} className="mt-4 focus-visible:outline-hidden">
                  <div className="relative overflow-hidden rounded-xl border border-border/80 bg-gradient-to-b from-background via-background to-secondary/10 p-6 shadow-xs transition-all duration-300">
                    <div className="mb-4 flex items-center justify-between gap-2 border-b border-muted/20 pb-3">
                      <div className="flex items-center gap-2">
                        <Badge className="badge-gold border-none px-2 py-0.5 rounded-sm text-[10px] font-semibold">
                          {formatLabel(item.format)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{item.wordCount} 字</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyText(item.content, item.format)}
                        className="cursor-pointer gap-1.5 font-medium hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 badge-gold border-none"
                      >
                        <span className={copiedFormat === item.format ? "seal-stamp-anim" : ""}>
                          {copiedFormat === item.format ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Clipboard className="h-3.5 w-3.5" />
                          )}
                        </span>
                        {copiedFormat === item.format ? "金石落印" : "复制全文"}
                      </Button>
                    </div>
                    
                    {/* 黄金竹简式排版渲染 */}
                    <div 
                      className="relative border-l-2 border-primary/30 pl-6 pr-4 py-6 my-4 bg-gradient-to-r from-amber-500/[0.025] via-amber-500/[0.005] to-amber-500/[0.035] dark:from-amber-500/[0.015] dark:via-transparent dark:to-amber-500/[0.02] rounded-r-lg shadow-[inset_0_0_12px_rgba(197,160,89,0.05)] border-y border-r border-amber-500/10"
                      style={{
                        backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(197, 160, 89, 0.06) 39px, rgba(197, 160, 89, 0.06) 40px)",
                        backgroundSize: "40px 100%"
                      }}
                    >
                      <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-gradient-to-b from-primary via-amber-400 to-transparent"></div>
                      {renderZhuJianContent(item.content)}
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            最近生成
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">还没有生成记录。</p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => {
                const contents = getHistoryContents(item)
                const expanded = expandedHistoryId === item.id
                return (
                  <div key={item.id} className="rounded-md border p-3">
                    <button
                      type="button"
                      onClick={() => setExpandedHistoryId(expanded ? null : item.id)}
                      className="w-full cursor-pointer text-left"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="line-clamp-1 text-sm font-medium">{item.rawInput}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {contents.map((content) => (
                          <Badge key={content.format} variant="secondary">
                            {formatLabel(content.format)}
                          </Badge>
                        ))}
                      </div>
                    </button>
                    {expanded && (
                      <div className="mt-3 space-y-3 border-t pt-3">
                        {contents.map((content) => (
                          <div key={content.format} className="rounded-md bg-muted/40 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-xs font-medium">{formatLabel(content.format)}</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyText(content.content)}
                                className="h-7 cursor-pointer"
                              >
                                复制
                              </Button>
                            </div>
                            <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-6">
                              {content.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
