# 市场洞察爆款 Top 20 接入选题定位 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 AIM 选题定位策划自动读取市场洞察里的对标账号爆款作品 Top 20，并把客户经历故事匹配成更容易火的 IP 选题。

**Architecture:** 第一版复用现有 `WatchAccount.viralVideos` JSON，不新建表、不做历史素材库。市场洞察负责沉淀爆款作品 Top 20，AIM 生成接口负责把这些爆款作品拼成上下文，定位策划 prompt 负责输出“客户经历 × 爆款观点匹配”。

**Tech Stack:** Next.js App Router, TypeScript, Prisma 7, MySQL/MariaDB, Vitest, shadcn/ui.

## Global Constraints

- 不新增数据库表，不做 Prisma migration。
- 不新增第三方依赖。
- 不做 mock、fake、stub、fixture fallback、demo data fallback。
- UI 只使用现有 `src/components/ui` 组件。
- 人工粘贴只作为兜底，主路径必须复用市场洞察已有数据。
- 禁止照搬对标账号标题，只复用观点结构、钩子逻辑和表达方式。

---

## Files

- Modify: `mingyuan/apps/web/src/app/api/competitor/watch-accounts/refresh/route.ts`
  - 固定保存互动分 Top 20 爆款作品。
- Modify: `mingyuan/apps/web/src/app/(dashboard)/competitor/page.tsx`
  - 爆款作品区展示 Top 1-20 排名。
- Modify: `mingyuan/apps/web/src/lib/aim-generate-validate.ts`
  - 解析 `useMarketViralVideos?: boolean`。
- Modify: `mingyuan/apps/web/src/app/api/aim/generate/route.ts`
  - 拼入市场洞察爆款作品上下文。
- Test: `mingyuan/apps/web/__tests__/unit/competitor-watch-viral-ranking.test.ts`
  - 覆盖 Top 20 排序逻辑。
- Test: `mingyuan/apps/web/__tests__/unit/aim-market-viral-context.test.ts`
  - 覆盖 AIM 上下文拼接和用户隔离。

## Task 1: 固定沉淀爆款作品 Top 20

**Interfaces:**
- Produces: `calculateViralVideos(videos): NormalizedVideoWithEngagement[]` returns up to 20 videos sorted by `engagementScore` desc.

- [ ] **Step 1: Extract ranking helper**

Move `calculateViralVideos()` out of the route-local scope only if needed for testing. Keep it in the same file if the test can import it without widening the app surface.

Scoring formula stays:

```ts
engagementScore = likes + comments * 2 + collects * 3 + shares * 4
```

- [ ] **Step 2: Write failing test**

Create `mingyuan/apps/web/__tests__/unit/competitor-watch-viral-ranking.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { calculateViralVideos } from "@/app/api/competitor/watch-accounts/refresh/route"

function video(index: number, likes: number) {
  return {
    videoId: `v${index}`,
    title: `视频 ${index}`,
    coverUrl: "",
    createTime: index,
    views: 0,
    likes,
    comments: 0,
    shares: 0,
    collects: 0,
  }
}

describe("calculateViralVideos", () => {
  it("keeps the top 20 videos by engagement score", () => {
    const result = calculateViralVideos(
      Array.from({ length: 30 }, (_, index) => video(index + 1, index + 1)),
    )

    expect(result).toHaveLength(20)
    expect(result[0]?.videoId).toBe("v30")
    expect(result[19]?.videoId).toBe("v11")
  })

  it("keeps all videos when there are fewer than 20", () => {
    const result = calculateViralVideos([video(1, 1), video(2, 2), video(3, 3)])

    expect(result.map((item) => item.videoId)).toEqual(["v3", "v2", "v1"])
  })
})
```

- [ ] **Step 3: Run failing test**

Run from `mingyuan/apps/web`:

```bash
npx vitest run __tests__/unit/competitor-watch-viral-ranking.test.ts
```

Expected before implementation: fail because `calculateViralVideos` is not exported or still returns variable count.

- [ ] **Step 4: Minimal implementation**

Update `calculateViralVideos()`:

```ts
export function calculateViralVideos(videos: WatchVideoInput[]) {
  return videos
    .map((v) => ({
      ...v,
      engagementScore: v.likes + v.comments * 2 + v.collects * 3 + v.shares * 4,
    }))
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, 20)
}
```

Use a small local `WatchVideoInput` type matching the existing function input shape.

- [ ] **Step 5: Verify**

Run:

```bash
npx vitest run __tests__/unit/competitor-watch-viral-ranking.test.ts
```

Expected: PASS.

## Task 2: 市场洞察页面显示 Top 排名

**Interfaces:**
- Consumes: `WatchAccount.viralVideos` sorted desc.
- Produces: visible `TOP N` label on viral video cards.

- [ ] **Step 1: Modify viral list**

In `mingyuan/apps/web/src/app/(dashboard)/competitor/page.tsx`, keep:

```ts
.sort((a, b) => b.engagementScore - a.engagementScore)
.slice(0, 20)
```

- [ ] **Step 2: Add rank display**

Change `renderVideoCard(video, { viral: true })` to pass rank:

```tsx
{activeViralVideos.map((video, index) =>
  renderVideoCard(video, { viral: true, rank: index + 1 }),
)}
```

Extend options:

```ts
function renderVideoCard(video: WatchVideo, options: { viral?: boolean; rank?: number } = {}) {
```

For viral cards, replace the small `爆款` badge with:

```tsx
<span className="text-[10px] px-1 py-0.5 rounded bg-orange-500/80 text-white font-bold">
  TOP {options.rank}
</span>
```

- [ ] **Step 3: Verify manually**

Run app and confirm market insights page shows `TOP 1` through up to `TOP 20` in the 爆款作品 section.

## Task 3: AIM 生成读取市场洞察爆款上下文

**Interfaces:**
- Consumes: `useMarketViralVideos?: boolean` from AIM generate body.
- Produces: raw input block titled `=== 市场洞察爆款作品上下文（选题定位必须参考） ===`.

- [ ] **Step 1: Parse input flag**

In `mingyuan/apps/web/src/lib/aim-generate-validate.ts`, add to `ParseGenerateBodyResult`:

```ts
useMarketViralVideos: boolean | undefined
```

Return:

```ts
useMarketViralVideos:
  typeof body.useMarketViralVideos === "boolean" ? body.useMarketViralVideos : undefined,
```

- [ ] **Step 2: Add context builder**

In `mingyuan/apps/web/src/app/api/aim/generate/route.ts`, add a helper that queries current user only:

```ts
async function buildRawInputWithMarketViralContext(
  userId: string,
  rawInput: string,
  enabled?: boolean,
) {
  if (enabled === false) return rawInput

  const accounts = await prisma.watchAccount.findMany({
    where: { userId },
    select: {
      nickname: true,
      targetUrl: true,
      viralVideos: true,
    },
    orderBy: { lastRefreshedAt: "desc" },
    take: 10,
  })

  const lines = accounts.flatMap((account) => {
    const videos = Array.isArray(account.viralVideos) ? account.viralVideos.slice(0, 20) : []
    return videos.map((video, index) => {
      const item = video as {
        title?: string
        videoUrl?: string
        likes?: number
        comments?: number
        shares?: number
        collects?: number
        engagementScore?: number
      }
      return [
        `账号：${account.nickname || account.targetUrl}`,
        `排名：TOP ${index + 1}`,
        `标题：${item.title || "无标题"}`,
        `互动：赞${item.likes ?? 0} / 评${item.comments ?? 0} / 转${item.shares ?? 0} / 藏${item.collects ?? 0} / 热度${item.engagementScore ?? 0}`,
        item.videoUrl ? `链接：${item.videoUrl}` : null,
      ].filter(Boolean).join("；")
    })
  })

  if (lines.length === 0) return rawInput

  return [
    rawInput,
    "",
    "=== 市场洞察爆款作品上下文（选题定位必须参考） ===",
    "硬规则：不得照搬对标账号标题；只能复用观点结构、钩子逻辑和表达方式。",
    "生成选题时必须输出：客户经历资产、匹配爆款观点、人设转译、选题建议、爆款依据。",
    ...lines.slice(0, 60),
  ].join("\n")
}
```

- [ ] **Step 3: Wire with existing video-copy context**

In POST handler, build raw input in this order:

```ts
const withVideoCopyContext = await buildRawInputWithVideoCopyContext(
  user.id,
  parsed.rawInput,
  parsed.videoCopyExtractionId,
)

const rawInput = await buildRawInputWithMarketViralContext(
  user.id,
  withVideoCopyContext,
  parsed.useMarketViralVideos,
)
```

- [ ] **Step 4: Add focused test**

Create `mingyuan/apps/web/__tests__/unit/aim-market-viral-context.test.ts` if the helper can be exported cheaply. Otherwise test through the smallest existing route/helper seam.

Required assertions:

```ts
expect(rawInput).toContain("市场洞察爆款作品上下文")
expect(rawInput).toContain("客户经历资产")
expect(rawInput).toContain("不得照搬对标账号标题")
expect(query.where.userId).toBe(currentUserId)
```

- [ ] **Step 5: Verify**

Run from `mingyuan/apps/web`:

```bash
npx vitest run __tests__/unit/competitor-watch-viral-ranking.test.ts __tests__/unit/aim-market-viral-context.test.ts
```

Expected: PASS.

## Task 4: 选题定位前端默认启用市场洞察

**Interfaces:**
- Consumes: AIM generate API `useMarketViralVideos`.
- Produces: selected-agent generation sends `useMarketViralVideos: true` for positioning/topic planning.

- [ ] **Step 1: Send default flag**

In `mingyuan/apps/web/src/app/(dashboard)/aim/page.tsx`, add to `generateAimContent()` body:

```ts
useMarketViralVideos: selectedAgentId === "business_diagnosis",
```

If the repo uses another id for 选题定位策划, use the existing constant from AIM agent config instead of inventing a new id.

- [ ] **Step 2: Verify request shape**

Run the smallest existing AIM generation client/unit test, or inspect browser network request locally. Confirm the request includes:

```json
{ "useMarketViralVideos": true }
```

for the positioning/topic-planning agent only.

## Final Verification

- [ ] Run:

```bash
npx vitest run __tests__/unit/competitor-watch-viral-ranking.test.ts __tests__/unit/aim-market-viral-context.test.ts
```

- [ ] Run targeted lint if available:

```bash
pnpm lint
```

- [ ] Manual check:
  - Market insights page shows 爆款作品 Top 1-20.
  - AIM 选题定位 output includes “客户经历 × 爆款观点匹配”.
  - No unrelated schema migration or dependency change appears in git diff.

