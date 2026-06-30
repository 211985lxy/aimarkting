# 账号分析 · 选题拆解板块 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在抖音账号分析报告（`/competitor/[id]`）新增「选题分析」板块，对点赞 Top 10 爆款逐条展示 数据 + 爆点判断 + 模板提炼 + 针对用户自己 IP 定位的仿写示例。

**Architecture:** 纯扩展。复用现有竞品分析流水线（采集 → enrich → AI 分析），在 AI 分析阶段一次产出 `top_topic_breakdown`，互动数字用真实采集数据注入（防 LLM 编数字）。前端新增 1 个组件插入报告页。无 Prisma 迁移、无新 API、无新路由。

**Tech Stack:** Next.js 16 App Router + TypeScript + Prisma 7 / MySQL、shadcn/ui + lucide-react、LLMClient（`@/lib/llm`）、vitest 4。

**规格来源：** `docs/superpowers/specs/2026-06-30-account-analysis-topic-breakdown-design.md`

## Global Constraints

- 无 mock/fake/stub/fixture/demo 数据回退（AGENTS.md 硬规则）——本特性纯解析真实采集数据与 LLM 产出，无外部 provider 降级。
- UI 只用 `src/components/ui` 里现有 shadcn 组件 + lucide-react 图标，不引新 UI 库。
- 字段命名沿用现有 snake_case（与 `top_videos`、`account_overview` 一致）。
- 仅抖音（pipeline 现状即只支持抖音）；其他平台本版不涉及。
- 测试用 vitest，遵循仓库现有「测纯函数、不 mock LLM」策略。
- `@/` 路径别名在 `vitest.config.ts` 已配置，测试可直接 `import { ... } from "@/..."`。

---

## 文件结构

| 文件 | 责任 | 动作 |
|---|---|---|
| `src/lib/tikhub/types.ts` | 定义 `TopicBreakdownItem` 类型 + 在 `CompetitorAnalysisResult` 加 `top_topic_breakdown?` | 改 |
| `src/lib/competitor-analysis/analyzer.ts` | 新增 `IpProfileContext` 参数；导出纯函数 `buildTopicBreakdown`；prompt 扩展；点赞排序；真实数据注入；`maxTokens` 上调 | 改 |
| `src/lib/competitor-analysis/pipeline.ts` | 读 `IpProfile` 组装 `IpProfileContext` 传入 analyzer | 改 |
| `src/components/competitor-diagnosis/topic-breakdown-section.tsx` | 选题分析板块组件（逐条卡片） | 新增 |
| `src/lib/competitor-diagnosis/types.ts` | `CompetitorDiagnosisViewModel` 加 `topTopicBreakdown` 字段 | 改 |
| `src/lib/competitor-diagnosis/build-view-model.ts` | 映射 `top_topic_breakdown → topTopicBreakdown` | 改 |
| `src/app/(dashboard)/competitor/[id]/page.tsx` | `ReportView` 插入 `<TopicBreakdownSection>` | 改 |
| `__tests__/unit/competitor-topic-breakdown.test.ts` | 纯函数 `buildTopicBreakdown` 单测 | 新增 |

---

## Task 1: 类型扩展（`TopicBreakdownItem` + 结果字段）

**Files:**
- Modify: `src/lib/tikhub/types.ts`（在 `CompetitorAnalysisResult` 定义内，紧邻 `stats` 字段）

**Interfaces:**
- Produces: `TopicBreakdownItem`（导出类型）、`CompetitorAnalysisResult.top_topic_breakdown?: TopicBreakdownItem[]`（可选字段，向后兼容老数据）

- [ ] **Step 1: 在 `types.ts` 顶部（`NormalizedComment` 之后、`Platform` 之前）新增类型定义**

在第 46 行（`NormalizedComment` 接口结束）之后插入：

```ts
// ─── Topic Breakdown（选题拆解：Top 爆款逐条）──────────

export interface TopicBreakdownItem {
  video_id: string
  title: string
  likes: number
  comments: number
  collects: number
  shares: number
  views: number
  video_url: string
  hook_analysis: string    // 爆点判断：标题为什么能爆
  title_template: string   // 模板提炼：可复用句式，如 "[传统行业] + 其实在 + [高价值行为]"
  rewrite_example: string  // 仿写示例：套用到当前用户 IP 定位
}

// LLM 拆解原始项（带 video_index 用于回填真实数据）
export interface TopicBreakdownLLMItem {
  video_index: number
  hook_analysis: string
  title_template: string
  rewrite_example: string
}
```

- [ ] **Step 2: 在 `CompetitorAnalysisResult` 内 `stats` 字段后新增可选字段**

定位到 `CompetitorAnalysisResult` 接口（约 96 行起），在 `stats: { ... }` 整块（约 146-157 行）**之后、接口闭合 `}` 之前**插入：

```ts
  /** 选题拆解：按点赞排序的 Top 爆款逐条（真实数据注入，可空） */
  top_topic_breakdown?: TopicBreakdownItem[]
```

- [ ] **Step 3: 类型检查**

Run（在 `mingyuan/apps/web` 下，下同）:
```bash
npx tsc --noEmit
```
Expected: 无新增错误（仓库可能有既有告警，只要不是本次改动引入的 TS 错误即可）。

- [ ] **Step 4: 提交**

```bash
cd /Users/xiangyu/Desktop/明动aim智能体
git add mingyuan/apps/web/src/lib/tikhub/types.ts
git commit -m "feat(competitor): add TopicBreakdownItem type and result field"
```

---

## Task 2: 纯函数 `buildTopicBreakdown`（TDD）

把「真实数据注入 + 越界过滤 + 点赞序」抽成纯函数，独立可测。先写测试。

**Files:**
- Test: `__tests__/unit/competitor-topic-breakdown.test.ts`
- Modify: `src/lib/competitor-analysis/analyzer.ts`（新增并导出 `buildTopicBreakdown`）

**Interfaces:**
- Consumes: `NormalizedVideo`（来自 `@/lib/tikhub/types`，字段：`videoId, title, videoUrl, views, likes, comments, shares, collects`）、`TopicBreakdownLLMItem`、`TopicBreakdownItem`（Task 1 产出）
- Produces: `buildTopicBreakdown(topVideosByLikes: NormalizedVideo[], llmBreakdown: TopicBreakdownLLMItem[] | undefined | null): TopicBreakdownItem[]`

- [ ] **Step 1: 写失败测试**

创建 `__tests__/unit/competitor-topic-breakdown.test.ts`：

```ts
import { describe, expect, it } from "vitest"
import { buildTopicBreakdown } from "@/lib/competitor-analysis/analyzer"
import type { NormalizedVideo } from "@/lib/tikhub/types"

function video(id: string, likes: number, extra: Partial<NormalizedVideo> = {}): NormalizedVideo {
  return {
    videoId: id,
    title: `标题-${id}`,
    coverUrl: "",
    videoUrl: `https://example.com/v/${id}`,
    createTime: 1000,
    duration: 30,
    views: 100000,
    likes,
    comments: 10,
    shares: 20,
    collects: 30,
    ...extra,
  }
}

describe("buildTopicBreakdown", () => {
  it("注入真实互动数据并按传入顺序透传语义字段", () => {
    const videos = [video("a", 900), video("b", 500)]
    const llm = [
      { video_index: 0, hook_analysis: "反差", title_template: "[X]+其实在+[Y]", rewrite_example: "仿写a" },
      { video_index: 1, hook_analysis: "悬念", title_template: "[Z]竟然是为了", rewrite_example: "仿写b" },
    ]
    const result = buildTopicBreakdown(videos, llm)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      video_id: "a",
      title: "标题-a",
      likes: 900,
      comments: 10,
      collects: 30,
      shares: 20,
      views: 100000,
      video_url: "https://example.com/v/a",
      hook_analysis: "反差",
      title_template: "[X]+其实在+[Y]",
      rewrite_example: "仿写a",
    })
  })

  it("LLM 的 video_index 越界时丢弃该条，保留其余", () => {
    const videos = [video("a", 900)]
    const llm = [
      { video_index: 0, hook_analysis: "ok", title_template: "t", rewrite_example: "r" },
      { video_index: 5, hook_analysis: "越界", title_template: "t", rewrite_example: "r" },
    ]
    const result = buildTopicBreakdown(videos, llm)
    expect(result).toHaveLength(1)
    expect(result[0]?.video_id).toBe("a")
  })

  it("llmBreakdown 为空或 undefined 时返回空数组且不抛错", () => {
    expect(buildTopicBreakdown([video("a", 1)], undefined)).toEqual([])
    expect(buildTopicBreakdown([video("a", 1)], null)).toEqual([])
    expect(buildTopicBreakdown([video("a", 1)], [])).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
npx vitest run __tests__/unit/competitor-topic-breakdown.test.ts
```
Expected: FAIL —— `buildTopicBreakdown is not a function`（或导入失败）。

- [ ] **Step 3: 实现 `buildTopicBreakdown`**

在 `src/lib/competitor-analysis/analyzer.ts` 顶部 import 块补充类型导入（在第 2-8 行已有 import 里加 `TopicBreakdownItem`、`TopicBreakdownLLMItem`）：

```ts
import type {
  NormalizedAccount,
  NormalizedVideo,
  NormalizedComment,
  CompetitorMetrics,
  CompetitorAnalysisResult,
  TopicBreakdownItem,
  TopicBreakdownLLMItem,
} from './types'
```

在文件**末尾**（`analyzeCompetitor` 函数之后）新增导出纯函数：

```ts
// ── Topic breakdown: 把 LLM 拆解按 video_index 回填真实采集数据 ─────────────
// topVideosByLikes 必须已按点赞降序排好（调用方负责）。越界或语义字段缺失的条目被丢弃。
export function buildTopicBreakdown(
  topVideosByLikes: NormalizedVideo[],
  llmBreakdown: TopicBreakdownLLMItem[] | undefined | null,
): TopicBreakdownItem[] {
  if (!llmBreakdown || llmBreakdown.length === 0) return []

  return llmBreakdown
    .map((item): TopicBreakdownItem | null => {
      const v = topVideosByLikes[item.video_index]
      if (!v) return null
      return {
        video_id: v.videoId,
        title: v.title,
        likes: v.likes,
        comments: v.comments,
        collects: v.collects,
        shares: v.shares,
        views: v.views,
        video_url: v.videoUrl,
        hook_analysis: item.hook_analysis,
        title_template: item.title_template,
        rewrite_example: item.rewrite_example,
      }
    })
    .filter((x): x is TopicBreakdownItem => x !== null)
}
```

- [ ] **Step 4: 运行测试确认通过**

Run:
```bash
npx vitest run __tests__/unit/competitor-topic-breakdown.test.ts
```
Expected: PASS（3 个用例全过）。

- [ ] **Step 5: 提交**

```bash
cd /Users/xiangyu/Desktop/明动aim智能体
git add mingyuan/apps/web/src/lib/competitor-analysis/analyzer.ts mingyuan/apps/web/__tests__/unit/competitor-topic-breakdown.test.ts
git commit -m "feat(competitor): add pure buildTopicBreakdown with real-data injection"
```

---

## Task 3: 扩展 `analyzeCompetitor`（IpProfileContext + prompt + 注入）

让 AI 一次产出选题拆解，并用真实数据覆写数字字段。

**Files:**
- Modify: `src/lib/competitor-analysis/analyzer.ts`

**Interfaces:**
- Consumes: `buildTopicBreakdown`（Task 2）、`TopicBreakdownLLMItem`（Task 1）
- Produces: `analyzeCompetitor` 新增第 5 个参数 `ipProfileContext?: IpProfileContext`；返回的 `CompetitorAnalysisResult.top_topic_breakdown` 被填充
- `IpProfileContext` 类型（本任务在 analyzer.ts 定义并导出）：
  ```ts
  export interface IpProfileContext {
    hasProfile: boolean
    summary: string
  }
  ```

- [ ] **Step 1: 新增 `IpProfileContext` 类型导出**

在 `analyzer.ts` 的 import 块之后、`SYSTEM_PROMPT` 之前插入：

```ts
// ── IP 定位上下文（来自 pipeline 读取的 IpProfile），用于让仿写示例针对用户赛道 ──
export interface IpProfileContext {
  hasProfile: boolean
  summary: string
}
```

- [ ] **Step 2: 修改 `analyzeCompetitor` 签名，新增第 5 个参数**

把函数签名（约第 18-23 行）改为：

```ts
export async function analyzeCompetitor(
  account: NormalizedAccount,
  videos: NormalizedVideo[],
  comments: NormalizedComment[],
  metrics: CompetitorMetrics,
  ipProfileContext?: IpProfileContext,
): Promise<CompetitorAnalysisResult> {
```

- [ ] **Step 3: 在函数体内构建「按点赞排序的 Top 10」并供 LLM 与回填共用**

定位到现有 `// ── Build top 10 videos by views` 块（约第 35-48 行）。**在它之前**新增一段（按点赞排序、带 index）：

```ts
  // ── Build top 10 videos by likes（选题拆解用）────────────────────────────
  const MIN_BREAKDOWN_VIDEOS = 3
  const topVideosByLikes = [...videos]
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 10)
  const breakdownEnabled = topVideosByLikes.length >= MIN_BREAKDOWN_VIDEOS
  const breakdownVideoSubset = breakdownEnabled
    ? topVideosByLikes.map((v, i) => ({
        i,
        t: v.title.slice(0, 60),
        l: v.likes,
        c: v.comments,
        col: v.collects,
        s: v.shares,
        v: v.views,
      }))
    : []
```

- [ ] **Step 4: 扩展 userPrompt —— 注入 IP 定位段 + 选题拆解指令**

在 userPrompt 字符串里，紧接「## 评论样本」段之后、`输出JSON格式` 行**之前**插入两段。最终 userPrompt 结构（只展示新增/改动部分，其余保持原样）：

在 `${JSON.stringify(compactComments)}` 之后追加：

```
## 你的 IP 定位
${ipProfileContext?.hasProfile
  ? `你的定位：${ipProfileContext.summary}。请把每条仿写示例套用到这个赛道，贴合你的目标客户和变现方式。`
  : '用户未设置 IP 定位，请为每条选题给出一个跨行业的通用仿写示例，并在示例末尾用括号标注所属行业。'}
```

把原 `输出JSON格式` 那一长串 JSON 结构指令，**在 `recommendations` 之后、最外层 `}` 闭合的 `}` 之前**插入新字段 `top_topic_breakdown`。即把 prompt 里：

```
,"recommendations":{"reusable_strategies":[""],"differentiation_points":[""],"action_plan_30d":[""],"risks":[""]}}}
```

改为（注意末尾多了一个逗号和新字段）：

```
,"recommendations":{"reusable_strategies":[""],"differentiation_points":[""],"action_plan_30d":[""],"risks":[""]}${breakdownEnabled ? `,"top_topic_breakdown":[{"video_index":0,"hook_analysis":"","title_template":"","rewrite_example":""}]` : ''}}}
```

并在该 JSON 指令段后追加一行说明（紧跟同一段字符串内）：

```
${breakdownEnabled ? `\n## 选题拆解\n请基于下方「选题视频」数据，为每条生成 top_topic_breakdown：hook_analysis（一句话点明标题爆点）、title_template（把标题抽象成可复用句式模板，用方括号标注变量）、rewrite_example（见上方"你的 IP 定位"要求）。video_index 对应「选题视频」数组的下标（0 起），数量必须等于选题视频条数。\n## 选题视频（字段：i=下标,t=标题,l=点赞,c=评论,col=收藏,s=分享,v=播放）\n${JSON.stringify(breakdownVideoSubset)}` : ''}
```

- [ ] **Step 5: 调用 LLM 时上调 `maxTokens`**

把（约第 116 行）`maxTokens: 3500,` 改为：

```ts
    maxTokens: 4500,
```

- [ ] **Step 6: 在 `analyzeCompetitor` 返回前，用真实数据注入 `top_topic_breakdown`**

定位到函数末尾的 `// ── Inject authoritative stats` 块（约第 150-156 行，给 `parsed.stats` 赋值的地方）。在 `return parsed`（约第 158 行）**之前**插入：

```ts
  // ── Inject top_topic_breakdown（真实数据覆写 LLM 数字）─────────────────────
  if (breakdownEnabled) {
    const llmBreakdown = parsed.top_topic_breakdown as unknown as
      | TopicBreakdownLLMItem[]
      | undefined
    // LLM 返回的可能是完整 TopicBreakdownItem（含数字）；只取语义字段 + video_index
    const normalized: TopicBreakdownLLMItem[] | undefined = llmBreakdown?.map((b, idx) => ({
      // 若 LLM 漏给 video_index，按数组顺序回退对齐 topVideosByLikes
      video_index: typeof (b as { video_index?: number }).video_index === 'number'
        ? (b as { video_index: number }).video_index
        : idx,
      hook_analysis: (b as { hook_analysis?: string }).hook_analysis ?? '',
      title_template: (b as { title_template?: string }).title_template ?? '',
      rewrite_example: (b as { rewrite_example?: string }).rewrite_example ?? '',
    }))
    parsed.top_topic_breakdown = buildTopicBreakdown(topVideosByLikes, normalized)
  } else {
    parsed.top_topic_breakdown = []
  }
```

- [ ] **Step 7: 类型检查**

Run:
```bash
npx tsc --noEmit
```
Expected: 无本次改动引入的 TS 错误。

- [ ] **Step 8: 全量单元测试不回归**

Run:
```bash
npx vitest run __tests__/unit/competitor-topic-breakdown.test.ts
```
Expected: PASS（Task 2 的测试仍通过；本任务未改纯函数逻辑）。

- [ ] **Step 9: 提交**

```bash
cd /Users/xiangyu/Desktop/明动aim智能体
git add mingyuan/apps/web/src/lib/competitor-analysis/analyzer.ts
git commit -m "feat(competitor): generate top_topic_breakdown with IP-aware rewrite in one pass"
```

---

## Task 4: pipeline 读取 IpProfile 并传入 analyzer

**Files:**
- Modify: `src/lib/competitor-analysis/pipeline.ts`

**Interfaces:**
- Consumes: `analyzeCompetitor`（Task 3，第 5 参数 `ipProfileContext?: IpProfileContext`）、`prisma.ipProfile.findUnique`、`analysis.userId`
- Produces: pipeline 在 Step3 读取用户 IpProfile 组装 `IpProfileContext` 传入

- [ ] **Step 1: 修改 import，引入 `IpProfileContext`**

把 `pipeline.ts` 顶部 import 块（第 1-5 行）改为：

```ts
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { calculateMetrics } from './metrics'
import { analyzeCompetitor, type IpProfileContext } from './analyzer'
import { collectDouyinCompetitorData } from './collector'
```

- [ ] **Step 2: 在 Step3 调用 `analyzeCompetitor` 前新增「读取 IpProfile 组装 context」**

定位到 Step3（约第 71-80 行）：

```ts
    // ── Step 3: ANALYZE ───────────────────────────────────────
    await updateStatus(analysisId, 'analyzing')
    log.info('Step 3: AI analysis')

    const result = await analyzeCompetitor(
      account,
      videos,
      comments,
      metrics,
    )
```

替换为：

```ts
    // ── Step 3: ANALYZE ───────────────────────────────────────
    await updateStatus(analysisId, 'analyzing')
    log.info('Step 3: AI analysis')

    const ipProfileContext = await buildIpProfileContext(analysis.userId)

    const result = await analyzeCompetitor(
      account,
      videos,
      comments,
      metrics,
      ipProfileContext,
    )
```

- [ ] **Step 3: 在文件末尾 helper 区新增 `buildIpProfileContext`**

在文件末尾（`sanitizeErrorForUser` 函数之后）追加：

```ts
// ── IP 定位上下文：读取用户 IpProfile 组装摘要；失败降级为通用，绝不阻塞分析 ──
async function buildIpProfileContext(userId: string): Promise<IpProfileContext> {
  try {
    const profile = await prisma.ipProfile.findUnique({
      where: { userId },
      select: {
        industry: true,
        surveyIndustry: true,
        primaryOffer: true,
        targetAudience: true,
        surveyTargetCustomer: true,
        surveyContentGoal: true,
        ipTraits: true,
        isComplete: true,
      },
    })

    if (!profile || !profile.isComplete) {
      return { hasProfile: false, summary: '' }
    }

    const parts: string[] = []
    const industry = profile.surveyIndustry || profile.industry
    if (industry) parts.push(`行业=${industry}`)
    const audience = profile.surveyTargetCustomer || profile.targetAudience
    if (audience) parts.push(`目标客户=${audience}`)
    if (profile.primaryOffer) parts.push(`核心产品=${profile.primaryOffer}`)
    if (profile.surveyContentGoal) parts.push(`内容目标=${profile.surveyContentGoal}`)
    if (profile.ipTraits) parts.push(`人设=${profile.ipTraits}`)

    if (parts.length === 0) return { hasProfile: false, summary: '' }
    return { hasProfile: true, summary: parts.join('，') }
  } catch (err) {
    log.warn({ err }, 'Failed to load IpProfile for topic breakdown, fallback to generic')
    return { hasProfile: false, summary: '' }
  }
}
```

- [ ] **Step 4: 类型检查**

Run:
```bash
npx tsc --noEmit
```
Expected: 无本次改动引入的 TS 错误。

- [ ] **Step 5: 提交**

```bash
cd /Users/xiangyu/Desktop/明动aim智能体
git add mingyuan/apps/web/src/lib/competitor-analysis/pipeline.ts
git commit -m "feat(competitor): feed user IpProfile into analysis for targeted rewrite"
```

---

## Task 5: 视图模型映射（`topTopicBreakdown`）

**Files:**
- Modify: `src/lib/competitor-diagnosis/types.ts`
- Modify: `src/lib/competitor-diagnosis/build-view-model.ts`

**Interfaces:**
- Consumes: `TopicBreakdownItem`（Task 1，来自 `@/lib/tikhub/types`，`ApiCompetitorAnalysis.analysisResult.top_topic_breakdown` 透传可见）
- Produces: `CompetitorDiagnosisViewModel.topTopicBreakdown: TopicBreakdownItem[]`

- [ ] **Step 1: 在 view-model 的 types 加字段**

`src/lib/competitor-diagnosis/types.ts` 第 1 行 import 补充类型：

```ts
import type { ApiCompetitorAnalysis } from "@/types/api"
import type { TopicBreakdownItem } from "@/lib/tikhub/types"
```

在 `CompetitorDiagnosisViewModel` 接口里（`// Evidence` 与 `// Strategic Bets` 之间，约第 109 行后）插入：

```ts
  // Topic Breakdown（选题拆解）
  topTopicBreakdown: TopicBreakdownItem[]
```

- [ ] **Step 2: 在 `build-view-model.ts` 映射该字段**

在 `src/lib/competitor-diagnosis/build-view-model.ts` 第 1 行 import 之后加（若已 import 其他类型则合并）：

```ts
import type { TopicBreakdownItem } from "@/lib/tikhub/types"
```

在主函数 `buildCompetitorDiagnosisViewModel` 的返回对象（约第 493-511 行）里，紧接 `evidence: buildEvidence(analysis),` 之后加一行：

```ts
    topTopicBreakdown: (r?.top_topic_breakdown ?? []) as TopicBreakdownItem[],
```

- [ ] **Step 3: 类型检查**

Run:
```bash
npx tsc --noEmit
```
Expected: 无本次改动引入的 TS 错误（注意 `CompetitorDiagnosisViewModel` 现在要求 `topTopicBreakdown`，主函数已提供，不会缺字段）。

- [ ] **Step 4: 提交**

```bash
cd /Users/xiangyu/Desktop/明动aim智能体
git add mingyuan/apps/web/src/lib/competitor-diagnosis/types.ts mingyuan/apps/web/src/lib/competitor-diagnosis/build-view-model.ts
git commit -m "feat(competitor): map top_topic_breakdown into diagnosis view model"
```

---

## Task 6: 新增选题分析板块组件

**Files:**
- Create: `src/components/competitor-diagnosis/topic-breakdown-section.tsx`

**Interfaces:**
- Consumes: `TopicBreakdownItem`（Task 1）、`formatCount`（`@/lib/competitor-diagnosis/format`）、shadcn `Card`/`Badge`、lucide 图标、`SectionTitle`（同目录）
- Produces: `TopicBreakdownSection` 组件，props `{ items: TopicBreakdownItem[] }`

- [ ] **Step 1: 创建组件文件**

`src/components/competitor-diagnosis/topic-breakdown-section.tsx`：

```tsx
import {
  Heart,
  MessageCircle,
  Star,
  Share2,
  Play,
  ExternalLink,
  Lightbulb,
  Code2,
  PenLine,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SectionTitle } from "./section-title"
import { formatCount } from "@/lib/competitor-diagnosis/format"
import type { TopicBreakdownItem } from "@/lib/tikhub/types"

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Heart
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-1.5" title={`${label}：${value}`}>
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value > 0 ? formatCount(value) : "-"}</span>
    </div>
  )
}

function TopicCard({ rank, item }: { rank: number; item: TopicBreakdownItem }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* 标题行 */}
        <div className="flex items-start gap-3">
          <Badge variant="secondary" className="shrink-0 rounded-full">
            #{rank}
          </Badge>
          <p className="text-sm font-medium leading-snug flex-1 line-clamp-2">
            {item.title || "—"}
          </p>
          {item.video_url && (
            <a
              href={item.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 mt-0.5"
              title="打开视频"
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </a>
          )}
        </div>

        {/* 数据行 */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <Metric icon={Heart} label="赞" value={item.likes} />
          <Metric icon={MessageCircle} label="评" value={item.comments} />
          <Metric icon={Star} label="藏" value={item.collects} />
          <Metric icon={Share2} label="转" value={item.shares} />
          <Metric icon={Play} label="播" value={item.views} />
        </div>

        {/* 爆点判断 */}
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <Lightbulb className="h-3.5 w-3.5" /> 爆点判断
          </p>
          <p className="text-sm leading-relaxed text-foreground/90">{item.hook_analysis || "—"}</p>
        </div>

        {/* 模板提炼 */}
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <Code2 className="h-3.5 w-3.5" /> 模板提炼
          </p>
          <p className="text-sm font-mono bg-muted/50 rounded px-2 py-1.5">{item.title_template || "—"}</p>
        </div>

        {/* 仿写示例 */}
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <PenLine className="h-3.5 w-3.5" /> 仿写示例
          </p>
          <p className="text-sm leading-relaxed text-foreground/90">{item.rewrite_example || "—"}</p>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 选题分析：对点赞 Top 爆款逐条拆解——数据 + 爆点判断 + 模板提炼 + 仿写示例。
 * 数据来自真实采集，语义字段（爆点/模板/仿写）来自 AI 分析。
 */
export function TopicBreakdownSection({ items }: { items: TopicBreakdownItem[] }) {
  if (items.length === 0) return null

  return (
    <section className="space-y-3">
      <SectionTitle
        title="选题分析"
        subtitle="点赞最高的爆款逐条拆解：为什么爆 + 可复用句式 + 套用到你的赛道怎么写。"
        anchor="topic-breakdown"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.slice(0, 10).map((item, i) => (
          <TopicCard key={item.video_id || i} rank={i + 1} item={item} />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: 确认依赖项存在**

Run（确认 shadcn 组件与图标导出存在）:
```bash
ls src/components/ui/card.tsx src/components/ui/badge.tsx
```
Expected: 两个文件都存在（仓库已用 `Card/CardContent` 和 `Badge`，见 `report-hero.tsx`）。

- [ ] **Step 3: 类型检查**

Run:
```bash
npx tsc --noEmit
```
Expected: 无本次改动引入的 TS 错误。（`line-clamp-2` 在 Tailwind v4 内置可用，仓库 `last30days-panel.tsx` 已在用。）

- [ ] **Step 4: 提交**

```bash
cd /Users/xiangyu/Desktop/明动aim智能体
git add mingyuan/apps/web/src/components/competitor-diagnosis/topic-breakdown-section.tsx
git commit -m "feat(competitor): add TopicBreakdownSection card grid"
```

---

## Task 7: 报告页接入板块

**Files:**
- Modify: `src/app/(dashboard)/competitor/[id]/page.tsx`

**Interfaces:**
- Consumes: `TopicBreakdownSection`（Task 6）、`vm.topTopicBreakdown`（Task 5）

- [ ] **Step 1: 加 import**

在 `src/app/(dashboard)/competitor/[id]/page.tsx` 的 import 区（第 14-22 行那批 `competitor-diagnosis` 导入里），追加一行：

```ts
import { TopicBreakdownSection } from "@/components/competitor-diagnosis/topic-breakdown-section"
```

- [ ] **Step 2: 在 `ReportView` 里插入板块**

定位到 `ReportView` 组件（约第 166-213 行）。在 `{/* 4. 内容策略证据 */}` 块之后、`{/* 5. 数据证据 */}` 之前插入：

```tsx
      {/* 4.5 选题分析：Top 爆款逐条拆解 */}
      <TopicBreakdownSection items={vm.topTopicBreakdown} />
```

即最终顺序为：内容策略证据 → **选题分析** → 数据证据。

- [ ] **Step 3: 类型检查**

Run:
```bash
npx tsc --noEmit
```
Expected: 无本次改动引入的 TS 错误。

- [ ] **Step 4: 提交**

```bash
cd /Users/xiangyu/Desktop/明动aim智能体
git add "mingyuan/apps/web/src/app/(dashboard)/competitor/[id]/page.tsx"
git commit -m "feat(competitor): render topic breakdown section in report"
```

---

## Task 8: 全量验证（lint + test + build）

**Files:** 无改动。

- [ ] **Step 1: 运行全量单元测试**

Run:
```bash
cd mingyuan/apps/web && npx vitest run __tests__/unit/
```
Expected: 全部 PASS（含新增 `competitor-topic-breakdown.test.ts`，且无既有用例回归）。

- [ ] **Step 2: Lint**

Run:
```bash
cd mingyuan/apps/web && pnpm lint
```
Expected: 无 error（warning 可接受；若有本次引入的 error 需修掉）。

- [ ] **Step 3: Build（确认编译通过）**

Run:
```bash
cd mingyuan && pnpm build
```
Expected: build 成功，无类型错误。

- [ ] **Step 4: 人工冒烟（可选，需本地起服务 + 已有抖音分析记录）**

- `make dev` 起服务 → 打开任意已完成的 `/competitor/[id]` 报告 → 确认「选题分析」板块出现在「内容策略证据」和「数据证据」之间，每条卡片有数据 + 爆点判断 + 模板提炼 + 仿写示例。
- 新分析一条抖音主页链接，等待完成，确认板块出现、数字与采集一致。
- 老数据（无拆解）报告：板块不显示，其余正常。

- [ ] **Step 5: 收尾提交（若有 lint/build 修复）**

```bash
cd /Users/xiangyu/Desktop/明动aim智能体
git add -A
git commit -m "chore(competitor): pass lint/build for topic breakdown" 2>/dev/null || echo "nothing to commit"
```

---

## Self-Review 记录

**Spec 覆盖核对：**
- §4.1 类型 → Task 1 ✓
- §4.2 AI 生成 + 纯函数注入 → Task 2（纯函数）+ Task 3（prompt/注入）✓
- §4.3 pipeline 读 IpProfile → Task 4 ✓
- §4.4 API 契约（无改动）→ Task 8 build 验证透传 ✓（`GET /api/competitor/[id]` 透传 `analysisResult`，无需任务）
- §4.5 前端板块 + 视图模型 → Task 5（vm）+ Task 6（组件）+ Task 7（接入）✓
- §4.6 边界降级（<3 不显示、越界丢弃、空数组、IpProfile 失败吞错）→ Task 3（breakdownEnabled/越界）+ Task 4（catch 降级）+ Task 6（空数组 return null）✓
- §4.7 测试 → Task 2（纯函数 3 用例）✓

**类型一致性：** `TopicBreakdownItem`（Task 1 定义）在 Task 2/5/6 使用一致；`buildTopicBreakdown`（Task 2 定义）在 Task 3 调用一致；`IpProfileContext`（Task 3 定义并导出）在 Task 4 import 一致；`vm.topTopicBreakdown`（Task 5 定义）在 Task 7 使用一致。✓

**无 placeholder：** 每个 Step 都有具体代码或确切命令。✓
