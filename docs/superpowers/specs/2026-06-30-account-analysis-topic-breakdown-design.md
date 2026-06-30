# 账号分析 · 选题拆解板块（Top 爆款逐条拆解）

- 日期：2026-06-30
- 分支：`feat/market-viral-top20-topic-positioning`
- 状态：待评审

## 1. 背景与目标

竞品/账号分析（`/competitor/[id]`）目前已能采集账号下每条视频的完整互动数据（点赞 / 评论 / 收藏 / 转发 / 播放），但报告里只把 Top 视频渲染成「数据证据」区的一个简单表格，**缺乏逐条选题的深度拆解**。

用户希望报告里新增一种富信息呈现：对点赞最高的若干爆款，逐条给出

1. **数据**：点赞 / 评论 / 收藏 / 转发 / 播放
2. **爆点判断**：标题为什么能爆
3. **模板提炼**：把标题抽象成可复用的句式模板
4. **仿写示例**：套用到**当前用户自己的 IP 定位**该怎么写

### 成功标准

- 打开任意已完成的抖音账号分析报告，能在「选题分析」板块看到 Top 10（按点赞）爆款的逐条卡片，每条含数据 + 爆点判断 + 模板提炼 + 仿写示例。
- 仿写示例针对当前登录用户的 `IpProfile` 定位生成；用户未设定位时降级为通用跨行业仿写，且**不报错、不阻塞**。
- 互动数据（点赞/评论/收藏/转发/播放）来自采集到的真实数据，不由 LLM 编造。
- 不破坏现有报告：老数据（无拆解字段）静默不显示该板块；现有 Top 视频表格保留。

## 2. 范围

**包含：**

- 扩展 `CompetitorAnalysisResult` 类型，新增 `top_topic_breakdown` 字段。
- 扩展 `analyzeCompetitor` 的 AI 提示词，在一次请求中同时产出选题拆解。
- 把 Top 视频排序口径由「播放」改为「点赞」，并把全量互动数据传给 LLM。
- pipeline 读取用户 `IpProfile`，注入仿写上下文。
- 新增前端组件 `TopicBreakdownSection`，插入报告页。
- analyzer 的数据注入逻辑单测。

**不包含：**

- 不新建 Prisma 模型、不新建 API、不新建页面路由（复用现有 `GET /api/competitor/[id]` 透传）。
- 不改动其他平台（小红书 / B站 / 快手）适配器——第一版仅抖音。
- 不做"重新拆解/换赛道仿写"按钮（YAGNI，如需后续再加）。

## 3. 架构与数据流

```
GET /competitor/[id]（页面，已有）
        │  轮询 GET /api/competitor/[id]（透传 analysisResult，无需改）
        ▼
runCompetitorAnalysisPipeline(analysisId)（已有）
        │  Step3 改：传入 userId，读取 IpProfile
        ▼
analyzeCompetitor(account, videos, comments, metrics, ipProfileContext)  ← 改
        │  扩展 prompt → 一次产出 scores/sections/stats + top_topic_breakdown
        │  注入真实互动数据覆写 top_topic_breakdown 的数字字段
        ▼
analysisResult（含新字段，存 DB）
        ▼
ReportView → <TopicBreakdownSection />（新组件）
```

**为什么是"扩展现有分析"而非新建流水线**：数据采集、pipeline、状态机轮询、报告页全部已存在。选题拆解只需在 Step3 的 AI 请求里多产出一组字段 + 多读一次 IpProfile，是最小改动路径，且符合用户「打开报告即见、一次生成」的选择。

## 4. 详细设计

### 4.1 类型扩展

`src/lib/tikhub/types.ts` —— 在 `CompetitorAnalysisResult` 内新增（与 `stats` 同级）：

```ts
export interface TopicBreakdownItem {
  video_id: string
  title: string
  likes: number
  comments: number
  collects: number
  shares: number
  views: number
  video_url: string
  hook_analysis: string    // 爆点判断
  title_template: string   // 模板提炼，如 "[传统行业/现象] + 其实在 + [高价值行为]"
  rewrite_example: string  // 针对用户 IP 定位的仿写示例
}

// CompetitorAnalysisResult 内：
//   stats: { ...已存在 }
//   top_topic_breakdown?: TopicBreakdownItem[]   ← 新增
```

字段命名沿用现有 snake_case 风格（与 `top_videos`、`account_overview` 一致）。

### 4.2 AI 生成逻辑（`src/lib/competitor-analysis/analyzer.ts`）

签名变更：

```ts
export async function analyzeCompetitor(
  account: NormalizedAccount,
  videos: NormalizedVideo[],
  comments: NormalizedComment[],
  metrics: CompetitorMetrics,
  ipProfileContext?: IpProfileContext,   // 新增
): Promise<CompetitorAnalysisResult>
```

`IpProfileContext`（轻量结构，pipeline 组装）：

```ts
export interface IpProfileContext {
  hasProfile: boolean
  summary: string  // 已组装好的人话定位摘要，如"行业=特殊资产，目标客户=负债人群，变现=咨询"
}
```

prompt 变更要点：

1. **Top 10 按点赞排序**：现有 `topVideos` 按 `views || likes` 排序且只传 `t/dur/v/l/c/s/col`。改为按 `likes` 降序取前 10，并把这些视频的**全量互动 + 索引**传给 LLM（如 `{i:0, t, l, c, col, s, v}`），供 LLM 逐条产出拆解。
2. 在 userPrompt 里追加「## 你的 IP 定位」段：
   - `hasProfile=true` → `你的定位：{summary}。请把每条仿写示例套用到这个赛道。`
   - `hasProfile=false` → `用户未设置 IP 定位，请为每条给出一个跨行业的通用仿写示例（标注所属行业）。`
3. 扩展 JSON schema 指令，新增 `top_topic_breakdown` 数组，要求长度等于传入的 Top 视频数，每条含 `video_index`（对应传入视频序号）+ `hook_analysis` + `title_template` + `rewrite_example`。`maxTokens` 由 3500 上调到 ~4500 以容纳新增内容。

数据注入（关键，防 LLM 编数字）：拿到 LLM 解析结果后，**按 `video_index` 回填真实数据**：

```ts
parsed.top_topic_breakdown = llmBreakdown
  .map(item => {
    const v = topVideosByLikes[item.video_index]
    if (!v) return null  // 越界则丢弃
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
  .filter(Boolean) as TopicBreakdownItem[]
```

> 注：LLM 只负责 `hook_analysis / title_template / rewrite_example` 三个语义字段；所有数字与标题/链接来自真实采集数据。

降级处理：

- LLM 未返回 `top_topic_breakdown` 或为空 → 该字段置为 `[]`，不影响其他结果。
- LLM 返回的 `video_index` 无法匹配 → 该条丢弃，其余正常。
- Top 视频数 < 3 → 不传该任务，字段置空（前端不显示板块）。

### 4.3 pipeline 改动（`src/lib/competitor-analysis/pipeline.ts`）

- `runCompetitorAnalysisPipeline(analysisId)` 内部在 Step3 前新增：通过 `analysis.userId` 读取 `IpProfile`，组装 `IpProfileContext`：
  - `prisma.ipProfile.findUnique({ where: { userId: analysis.userId } })`（沿用 `topics/generate` 的字段选择）。
  - `hasProfile` = 记录存在且 `isComplete` 或关键字段非空。
  - `summary` 由 `industry / surveyIndustry / primaryOffer / targetAudience / surveyTargetCustomer` 组装；为空则 `hasProfile=false`。
- 把 `ipProfileContext` 传入 `analyzeCompetitor`。
- 读取失败用 try/catch 吞掉（`ipProfileContext = { hasProfile: false, summary: '' }`），绝不阻塞分析。

### 4.4 API 契约

`GET /api/competitor/[id]` 已透传整个 `analysisResult` JSON，**无需改动**。`src/types/api.ts` 中 `CompetitorAnalysisResult` 由 `@/lib/tikhub/types` 透传，新增字段自动可见，**无需改动**。

### 4.5 前端板块

新增组件 `src/components/competitor-diagnosis/topic-breakdown-section.tsx`：

- Props：`{ items: TopicBreakdownItem[]; ipLabel?: string }`（`ipLabel` 从 `analysis` 不直接可得，由页面层读取或省略；第一版用 `ipProfileContext.hasProfile` 标志——见下）。
- 每条卡片：标题 + 外链角标（点击跳 `video_url`）→ 数据行（5 个互动指标，用现有 `formatCount`）→ 爆点判断 → 模板提炼（等宽/代码样式突出句式）→ 仿写示例。
- "针对你的赛道"标签：第一版**不**在 analysisResult 里存 IP 摘要（避免泄露/冗余），改为：有拆解数据且用户当前有 IpProfile 时显示"针对你的定位"，否则显示"通用仿写"。判断在页面层用 hook 读取当前用户 IpProfile 状态（轻量），或保守起见统一显示"仿写示例"不带赛道标注。**决策：第一版统一标签为「仿写示例」，并在 prompt 里让有定位时仿写自带赛道特征，省去前端额外请求。**
- 用现有 shadcn 组件：`Card / Badge`，图标用 `lucide-react`（`Heart / MessageCircle / Star / Share2 / Play / ExternalLink / Lightbulb / Code2 / PenLine`）。不引入新 UI 库。

在 `competitor/[id]/page.tsx` 的 `ReportView` 中，把 `TopicBreakdownSection` 插入到「内容策略证据」之后、「数据证据」之前：

```
<ContentStrategyEvidence ... />
<TopicBreakdownSection items={vm.topTopicBreakdown} />   ← 新增
<EvidenceDashboard ... />
```

`build-view-model.ts` 的 `buildCompetitorDiagnosisViewModel` 新增映射：

```ts
topTopicBreakdown: r?.top_topic_breakdown ?? []
```

并扩展 `CompetitorDiagnosisViewModel` 类型。

### 4.6 边界与降级汇总

| 场景 | 行为 |
|---|---|
| 视频数 < 3 | 不生成拆解；板块不显示 |
| LLM 未返回该字段 / 为空 | 字段 `[]`；板块不显示 |
| `video_index` 不匹配 | 丢弃该条，其余显示 |
| 用户无 IpProfile | 仿写改通用，板块正常显示，标签"仿写示例" |
| IpProfile 读取异常 | 吞错降级为通用，不阻塞分析 |
| 老数据（无该字段） | 板块静默不显示，报告其余正常 |

### 4.7 测试

为了可测性，把「真实数据注入 / 越界过滤 / 排序」抽成**纯函数** `buildTopicBreakdown(topVideosByLikes, llmBreakdown): TopicBreakdownItem[]`（与 `analyzer.ts` 内联逻辑同文件导出，便于复用）。该纯函数不依赖 LLM、不依赖 Prisma，可直接单测。

单测 `__tests__/unit/competitor-topic-breakdown.test.ts`（vitest，沿用现有 `__tests__/unit/competitor-watch-viral-ranking.test.ts` 的纯函数风格，避免 mock LLM）：

1. 给定按点赞排序的 videos + LLM 拆解（带 `video_index`）→ 断言：输出按点赞序、`likes/comments/collects/shares/views/title/video_url` 来自真实数据（不是 LLM 写的数字）、语义字段透传。
2. LLM 的 `video_index` 越界 → 该条被丢弃，其余保留。
3. `llmBreakdown` 为空 / undefined → 返回 `[]`（不抛错）。

> analyzer 主体（含 LLM 调用）不做 mock 测试，避免脆性；只测纯函数。这与仓库现有测试策略一致（如 `competitor-watch-viral-ranking.test.ts` 只测纯函数 `calculateViralVideos`）。

## 5. 改动文件清单

| 文件 | 改动 |
|---|---|
| `src/lib/tikhub/types.ts` | 新增 `TopicBreakdownItem` + `top_topic_breakdown` 字段 |
| `src/lib/competitor-analysis/analyzer.ts` | 新增 `IpProfileContext` 参数；prompt 扩展；点赞排序；导出纯函数 `buildTopicBreakdown` |
| `src/lib/competitor-analysis/pipeline.ts` | 读 IpProfile → 组装 context → 传入 analyzer |
| `src/components/competitor-diagnosis/topic-breakdown-section.tsx` | 新增组件 |
| `src/components/competitor-diagnosis/types.ts` | `CompetitorDiagnosisViewModel` 增 `topTopicBreakdown` |
| `src/lib/competitor-diagnosis/build-view-model.ts` | 映射 `top_topic_breakdown` |
| `src/app/(dashboard)/competitor/[id]/page.tsx` | `ReportView` 插入新板块 |
| `__tests__/unit/competitor-topic-breakdown.test.ts` | 新增单测（纯函数） |

共 8 个文件（1 个新增组件 + 1 个新增测试 + 6 个修改）。无 Prisma 迁移、无新 API、无新路由。

## 6. 开放问题

无。所有关键决策已确认：
- 独立板块（非替换表格）
- 仿写针对用户自己 IP 定位
- 分析时一次生成（方案 A）
- 按点赞排序 Top 10
- 复用现有流水线（路线①）
