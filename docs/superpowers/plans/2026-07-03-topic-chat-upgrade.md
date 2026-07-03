# Topic Chat Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让客户在手机/网页里随口发一个灵感或问题后，系统自动沉淀素材，并马上返回可拍选题、开头和下一步写稿动作。

**Architecture:** 先做一个轻量编排层，不新建智能体。前端提供一个聊天式输入框，`/api/topics/chat` 负责分类用户输入、写入 `KnowledgeEntry`、调用现有选题生成能力，再返回一段客户能看懂的回复。

**Tech Stack:** Next.js App Router, TypeScript, Prisma, existing `withUserAuth`, existing `generateTopicCards`, existing `KnowledgeEntry`, existing shadcn/ui.

## Global Constraints

- 不新建智能体；先用一个 API 编排现有能力。
- 不新增依赖；用现有 Next.js、Prisma、Vitest、ESLint。
- 前台不暴露 `user_insight`、`daily_inspiration`、`benchmark_reference` 这类后台分类词。
- 客户发送一句话后，回复必须包含：`建议先拍哪条`、`开头怎么说`、`还能怎么拍`、`下一步动作`。
- 自动入库必须绑定当前登录用户和当前客户项目，不能跨项目混用素材。
- API route 文件只导出 Next 允许的字段；helper 放在 `src/lib/`，不要从 route 导出普通函数。

---

## File Structure

- Modify: `mingyuan/apps/web/src/app/(dashboard)/topic-planning/page.tsx`
  - 在“补充素材”上方加入聊天式输入区。
  - 展示 topic chat 的回复、入库结果、生成的选题卡。

- Modify: `mingyuan/apps/web/src/lib/api/client.ts`
  - 增加 `sendTopicChatMessage()` 客户端请求函数和返回类型。

- Create: `mingyuan/apps/web/src/lib/topic-chat.ts`
  - 负责输入分类、知识库草稿构建、回复文案编排。
  - 只放纯函数，方便测试。

- Create: `mingyuan/apps/web/src/app/api/topics/chat/route.ts`
  - 登录校验、项目校验、写入知识库、调用选题生成、返回前端。
  - 只导出 `POST` 和可选 `maxDuration`。

- Create: `mingyuan/apps/web/__tests__/unit/topic-chat.test.ts`
  - 测分类、入库草稿、回复编排。

---

## Task 1: Topic Chat Pure Logic

**Files:**
- Create: `mingyuan/apps/web/src/lib/topic-chat.ts`
- Create: `mingyuan/apps/web/__tests__/unit/topic-chat.test.ts`

**Interfaces:**
- Produces:
  - `classifyTopicChatInput(content: string): TopicChatClassification`
  - `buildTopicKnowledgeDraft(input: { content: string; classification: TopicChatClassification }): TopicKnowledgeDraft`
  - `buildTopicChatReply(input: { savedTitle: string; cards: TopicChatCard[] }): TopicChatReply`

- Types:
```ts
export type TopicChatCategory = "daily_inspiration" | "user_insight" | "benchmark_reference"

export type TopicChatClassification = {
  category: TopicChatCategory
  reason: string
}

export type TopicKnowledgeDraft = {
  category: TopicChatCategory
  title: string
  content: string
  tags: string[]
  sourceType: "manual" | "import"
}

export type TopicChatCard = {
  title: string
  hook?: string
  angle?: string
  rationale?: string
}

export type TopicChatReply = {
  summary: string
  recommendedTitle: string
  opening: string
  alternatives: string[]
  nextActionLabel: string
}
```

- [ ] **Step 1: Write the failing tests**

Add `mingyuan/apps/web/__tests__/unit/topic-chat.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  buildTopicChatReply,
  buildTopicKnowledgeDraft,
  classifyTopicChatInput,
} from "@/lib/topic-chat"

describe("topic chat", () => {
  it("classifies customer objections as user insight", () => {
    const result = classifyTopicChatInput("今天客户又问我为什么报价比别人高")

    expect(result).toEqual({
      category: "user_insight",
      reason: "客户问题或成交顾虑",
    })
  })

  it("classifies links and benchmark wording as benchmark reference", () => {
    const result = classifyTopicChatInput("这个爆款开头可以参考：https://example.com/video")

    expect(result.category).toBe("benchmark_reference")
  })

  it("classifies loose ideas as daily inspiration", () => {
    const result = classifyTopicChatInput("刚才开会想到一个角度，老板讲交付要有边界")

    expect(result.category).toBe("daily_inspiration")
  })

  it("builds a knowledge draft from the classification", () => {
    const draft = buildTopicKnowledgeDraft({
      content: "今天客户又问我为什么报价比别人高",
      classification: { category: "user_insight", reason: "客户问题或成交顾虑" },
    })

    expect(draft).toEqual({
      category: "user_insight",
      title: "客户问题：为什么报价比别人高",
      content: "今天客户又问我为什么报价比别人高",
      tags: ["topic_chat", "auto_captured", "asset_role:pain"],
      sourceType: "manual",
    })
  })

  it("builds a customer-facing reply from generated cards", () => {
    const reply = buildTopicChatReply({
      savedTitle: "客户问题：为什么报价比别人高",
      cards: [
        {
          title: "贵在哪里",
          hook: "客户问你为什么贵，千万别先解释成本。",
          angle: "先讲便宜方案省掉了什么，再讲你的交付边界。",
        },
        { title: "报价的底气", hook: "报价高不可怕，怕的是客户不知道差在哪。" },
        { title: "别只比价格", rationale: "适合把成交顾虑转成信任内容。" },
      ],
    })

    expect(reply).toEqual({
      summary: "这句话已经沉淀为：客户问题：为什么报价比别人高",
      recommendedTitle: "贵在哪里",
      opening: "客户问你为什么贵，千万别先解释成本。",
      alternatives: ["报价的底气", "别只比价格"],
      nextActionLabel: "继续写成口播稿",
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from `mingyuan/apps/web`:

```bash
./node_modules/.bin/vitest run __tests__/unit/topic-chat.test.ts
```

Expected: FAIL because `@/lib/topic-chat` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `mingyuan/apps/web/src/lib/topic-chat.ts`:

```ts
export type TopicChatCategory = "daily_inspiration" | "user_insight" | "benchmark_reference"

export type TopicChatClassification = {
  category: TopicChatCategory
  reason: string
}

export type TopicKnowledgeDraft = {
  category: TopicChatCategory
  title: string
  content: string
  tags: string[]
  sourceType: "manual" | "import"
}

export type TopicChatCard = {
  title: string
  hook?: string
  angle?: string
  rationale?: string
}

export type TopicChatReply = {
  summary: string
  recommendedTitle: string
  opening: string
  alternatives: string[]
  nextActionLabel: string
}

function compactTitle(content: string) {
  return content
    .replace(/^今天客户又问我/, "")
    .replace(/^客户(问|说|担心)/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 28)
}

export function classifyTopicChatInput(content: string): TopicChatClassification {
  const text = content.trim()
  if (/https?:\/\/|爆款|对标|参考|链接|标题|开头/.test(text)) {
    return { category: "benchmark_reference", reason: "对标素材或外部参考" }
  }
  if (/客户|用户|顾虑|担心|为什么|报价|成交|咨询|评论|问题|异议/.test(text)) {
    return { category: "user_insight", reason: "客户问题或成交顾虑" }
  }
  return { category: "daily_inspiration", reason: "日常灵感或现场想法" }
}

export function buildTopicKnowledgeDraft(input: {
  content: string
  classification: TopicChatClassification
}): TopicKnowledgeDraft {
  const content = input.content.trim()
  const titleCore = compactTitle(content) || "客户输入"
  if (input.classification.category === "user_insight") {
    return {
      category: "user_insight",
      title: `客户问题：${titleCore}`,
      content,
      tags: ["topic_chat", "auto_captured", "asset_role:pain"],
      sourceType: "manual",
    }
  }
  if (input.classification.category === "benchmark_reference") {
    return {
      category: "benchmark_reference",
      title: `参考素材：${titleCore}`,
      content,
      tags: ["topic_chat", "auto_captured", "asset_role:benchmark"],
      sourceType: "import",
    }
  }
  return {
    category: "daily_inspiration",
    title: `日常灵感：${titleCore}`,
    content,
    tags: ["topic_chat", "auto_captured", "asset_role:idea"],
    sourceType: "manual",
  }
}

export function buildTopicChatReply(input: {
  savedTitle: string
  cards: TopicChatCard[]
}): TopicChatReply {
  const lead = input.cards[0]
  const alternatives = input.cards.slice(1, 3).map((card) => card.title)
  return {
    summary: `这句话已经沉淀为：${input.savedTitle}`,
    recommendedTitle: lead?.title || "先把这个问题讲透",
    opening: lead?.hook || lead?.rationale || "先从客户最关心的问题开口，再讲你的判断和解决办法。",
    alternatives,
    nextActionLabel: "继续写成口播稿",
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `mingyuan/apps/web`:

```bash
./node_modules/.bin/vitest run __tests__/unit/topic-chat.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/topic-chat.ts __tests__/unit/topic-chat.test.ts
git commit -m "feat: add topic chat classification logic"
```

---

## Task 2: Topic Chat API

**Files:**
- Create: `mingyuan/apps/web/src/app/api/topics/chat/route.ts`
- Test: `mingyuan/apps/web/__tests__/unit/topic-chat.test.ts`

**Interfaces:**
- Consumes:
  - `classifyTopicChatInput(content)`
  - `buildTopicKnowledgeDraft({ content, classification })`
  - `buildTopicChatReply({ savedTitle, cards })`
  - existing `generateTopicCards()` from `@/lib/topic-generation`
- Produces HTTP:
```ts
POST /api/topics/chat
Body: { projectId: string; content: string }
Response: {
  classification: TopicChatClassification
  knowledgeEntry: { id: string; category: string; title: string }
  cards: TopicChatCard[]
  reply: TopicChatReply
}
```

- [ ] **Step 1: Add route**

Create `mingyuan/apps/web/src/app/api/topics/chat/route.ts`:

```ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withUserAuth } from "@/lib/user-auth"
import { generateTopicCards } from "@/lib/topic-generation"
import {
  buildTopicChatReply,
  buildTopicKnowledgeDraft,
  classifyTopicChatInput,
} from "@/lib/topic-chat"

export const maxDuration = 60

export const POST = withUserAuth(async (request, { user }) => {
  const body = await request.json()
  const projectId = typeof body.projectId === "string" ? body.projectId : ""
  const content = typeof body.content === "string" ? body.content.trim() : ""

  if (!projectId) {
    return NextResponse.json({ error: "projectId 不能为空" }, { status: 400 })
  }
  if (content.length < 2) {
    return NextResponse.json({ error: "先说一句具体想法" }, { status: 400 })
  }

  const project = await prisma.clientProject.findFirst({
    where: { id: projectId, userId: user.id, status: "active" },
    select: {
      id: true,
      name: true,
      industry: true,
      targetCustomer: true,
      offer: true,
      deliveryGoal: true,
    },
  })

  if (!project) {
    return NextResponse.json({ error: "客户项目不存在或无权访问" }, { status: 404 })
  }

  const classification = classifyTopicChatInput(content)
  const draft = buildTopicKnowledgeDraft({ content, classification })

  const knowledgeEntry = await prisma.knowledgeEntry.create({
    data: {
      userId: user.id,
      projectId: project.id,
      category: draft.category,
      title: draft.title,
      content: draft.content,
      tags: draft.tags,
      sourceType: draft.sourceType,
      status: "active",
    },
    select: { id: true, category: true, title: true },
  })

  const projectSource = [
    project.industry ? `行业：${project.industry}` : null,
    project.targetCustomer ? `目标客户：${project.targetCustomer}` : null,
    project.offer ? `产品/服务：${project.offer}` : null,
    project.deliveryGoal ? `交付目标：${project.deliveryGoal}` : null,
  ].filter(Boolean).join("\n")

  const cards = await generateTopicCards({
    ipProfile: {
      persona: project.name,
      positioning: projectSource || project.name,
      targetAudience: project.targetCustomer || "",
      offer: project.offer || "",
    },
    topicSources: [
      { category: "client_project", title: project.name, content: projectSource || project.name },
      { category: draft.category, title: draft.title, content: draft.content },
    ],
    recommendationMode: "normal",
    refreshCount: 0,
  })

  const reply = buildTopicChatReply({
    savedTitle: knowledgeEntry.title,
    cards: cards.map((card) => ({
      title: card.title,
      hook: card.hook,
      angle: card.angle,
      rationale: card.rationale,
    })),
  })

  return NextResponse.json({
    classification,
    knowledgeEntry,
    cards,
    reply,
  })
})
```

- [ ] **Step 2: Run focused type check**

Run from `mingyuan/apps/web`:

```bash
./node_modules/.bin/eslint src/app/api/topics/chat/route.ts src/lib/topic-chat.ts
```

Expected: PASS.

- [ ] **Step 3: Run unit test**

Run from `mingyuan/apps/web`:

```bash
./node_modules/.bin/vitest run __tests__/unit/topic-chat.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/topics/chat/route.ts src/lib/topic-chat.ts __tests__/unit/topic-chat.test.ts
git commit -m "feat: add topic chat api"
```

---

## Task 3: Client API and Topic Page Chat Box

**Files:**
- Modify: `mingyuan/apps/web/src/lib/api/client.ts`
- Modify: `mingyuan/apps/web/src/app/(dashboard)/topic-planning/page.tsx`

**Interfaces:**
- Consumes:
  - `POST /api/topics/chat`
- Produces:
```ts
export type TopicChatResponse = {
  classification: { category: string; reason: string }
  knowledgeEntry: { id: string; category: string; title: string }
  cards: ApiTopicCard[]
  reply: {
    summary: string
    recommendedTitle: string
    opening: string
    alternatives: string[]
    nextActionLabel: string
  }
}

export async function sendTopicChatMessage(input: {
  projectId: string
  content: string
}): Promise<TopicChatResponse>
```

- [ ] **Step 1: Add client API function**

Modify `mingyuan/apps/web/src/lib/api/client.ts` near the topic API functions:

```ts
export type TopicChatResponse = {
  classification: { category: string; reason: string }
  knowledgeEntry: { id: string; category: string; title: string }
  cards: ApiTopicCard[]
  reply: {
    summary: string
    recommendedTitle: string
    opening: string
    alternatives: string[]
    nextActionLabel: string
  }
}

export async function sendTopicChatMessage(input: {
  projectId: string
  content: string
}): Promise<TopicChatResponse> {
  return request<TopicChatResponse>("/api/topics/chat", {
    method: "POST",
    body: JSON.stringify(input),
    timeout: 60000,
  })
}
```

- [ ] **Step 2: Add topic page state**

Modify imports in `mingyuan/apps/web/src/app/(dashboard)/topic-planning/page.tsx` to include:

```ts
  sendTopicChatMessage,
  type TopicChatResponse,
```

Add state inside `TopicPlanningPage()`:

```ts
  const [topicChatInput, setTopicChatInput] = useState("")
  const [topicChatLoading, setTopicChatLoading] = useState(false)
  const [topicChatReply, setTopicChatReply] = useState<TopicChatResponse | null>(null)
```

- [ ] **Step 3: Add submit handler**

Add this function inside `TopicPlanningPage()`:

```ts
  async function handleTopicChatSubmit() {
    const content = topicChatInput.trim()
    if (!selectedProjectId) {
      toast.error("先选择一个客户项目")
      return
    }
    if (content.length < 2) {
      toast.error("先说一句具体想法")
      return
    }

    setTopicChatLoading(true)
    try {
      const result = await sendTopicChatMessage({ projectId: selectedProjectId, content })
      setTopicChatReply(result)
      setTopicCards(result.cards)
      setSelectedKnowledgeIds((current) => [...new Set([result.knowledgeEntry.id, ...current])])
      setKnowledgeEntries((current) => [
        {
          ...result.knowledgeEntry,
          projectId: selectedProjectId,
          content,
          tags: [],
          sourceType: "manual",
          sortOrder: 0,
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...current,
      ] as KnowledgeEntry[])
      setTopicChatInput("")
      toast.success("已生成可拍方向")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成失败")
    } finally {
      setTopicChatLoading(false)
    }
  }
```

- [ ] **Step 4: Render chat box above material cards**

Add this block before the existing `补充素材（可选）` card:

```tsx
            <Card className="order-1 border-primary/20 bg-primary/[0.02]">
              <CardHeader className="pb-3">
                <CardTitle>跟智能体说说你的想法</CardTitle>
                <CardDescription>
                  发一句客户问题、现场灵感或对标素材，系统会直接变成可拍选题。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={topicChatInput}
                  placeholder="比如：今天客户又问我为什么报价比别人高"
                  className="min-h-24"
                  onChange={(event) => setTopicChatInput(event.target.value)}
                />
                <div className="flex justify-end">
                  <Button onClick={handleTopicChatSubmit} disabled={topicChatLoading || !selectedProjectId}>
                    <Sparkles className="mr-1 h-4 w-4" />
                    {topicChatLoading ? "生成中..." : "生成可拍方向"}
                  </Button>
                </div>
                {topicChatReply ? (
                  <div className="rounded-lg border bg-background p-3 text-sm leading-6">
                    <p className="font-medium">{topicChatReply.reply.summary}</p>
                    <p className="mt-2">
                      <b>建议先拍：</b>{topicChatReply.reply.recommendedTitle}
                    </p>
                    <p>
                      <b>开头：</b>{topicChatReply.reply.opening}
                    </p>
                    {topicChatReply.reply.alternatives.length > 0 ? (
                      <p>
                        <b>还能拍：</b>{topicChatReply.reply.alternatives.join("、")}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
```

- [ ] **Step 5: Keep material cards below chat**

Change the existing material wrapper class from:

```tsx
            <div className="order-2 rounded-xl border bg-muted/20 p-3 text-sm opacity-80">
```

to:

```tsx
            <div className="order-2 rounded-xl border bg-muted/20 p-3 text-sm opacity-80">
```

Expected: no visual change in this line; this step only confirms the material management area remains below the chat entry.

- [ ] **Step 6: Run checks**

Run from `mingyuan/apps/web`:

```bash
./node_modules/.bin/eslint 'src/app/(dashboard)/topic-planning/page.tsx' src/lib/api/client.ts
./node_modules/.bin/vitest run __tests__/unit/topic-chat.test.ts
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/api/client.ts 'src/app/(dashboard)/topic-planning/page.tsx'
git commit -m "feat: add topic chat input to planning page"
```

---

## Task 4: Manual Verification and Known Type Debt

**Files:**
- No source changes required if Task 1-3 pass.

**Interfaces:**
- Verifies:
  - `/topic-planning` page loads.
  - Chat input posts to `/api/topics/chat`.
  - Generated topic cards replace the recommendation area.
  - New knowledge entry appears in the correct category area.

- [ ] **Step 1: Start or reuse dev server**

From `mingyuan/apps/web`:

```bash
./node_modules/.bin/next dev --webpack
```

Expected: server listens on `http://localhost:3000`. If it reports a lock, reuse the existing server.

- [ ] **Step 2: Open page**

Open:

```text
http://localhost:3000/topic-planning
```

Expected: after login, page shows `跟智能体说说你的想法`.

- [ ] **Step 3: Submit a customer objection**

Input:

```text
今天客户又问我为什么报价比别人高
```

Expected:
- The page shows `建议先拍`.
- The page shows an `开头`.
- The recommendation cards refresh.
- The material area shows a new `用户洞察` entry.

- [ ] **Step 4: Submit a loose idea**

Input:

```text
刚才开会想到一个角度，老板讲交付要有边界
```

Expected:
- The page shows `建议先拍`.
- The material area shows a new `日常灵感` entry.

- [ ] **Step 5: Submit a benchmark link**

Input:

```text
这个爆款开头可以参考：https://example.com/video
```

Expected:
- The page shows `建议先拍`.
- The material area shows a new `参考素材` entry.

- [ ] **Step 6: Record known type debt**

Run from `mingyuan/apps/web`:

```bash
./node_modules/.bin/tsc --noEmit --pretty false
```

Expected current known failure:

```text
.next/dev/types/app/api/topics/generate/route.ts ... Property 'buildBenchmarkAccountSources' is incompatible with index signature.
```

Do not fix this inside the topic-chat upgrade unless the executor is explicitly asked to clean existing type debt. This failure exists because `src/app/api/topics/generate/route.ts` exports helper functions from an App Route file.

- [ ] **Step 7: Commit verification note if source changed**

If Task 4 required no source changes, do not commit. If a small source fix was required, run:

```bash
git add <changed-files>
git commit -m "fix: stabilize topic chat verification"
```

---

## Self-Review

Spec coverage:
- Customer says one sentence and gets a useful reply: Task 3 UI + Task 2 API.
- Automatic knowledge capture: Task 2 creates `KnowledgeEntry`.
- User insight comes from chat, not manual form: current page already hides manual `用户洞察`; Task 3 keeps chat as source.
- No new intelligent agent: Global Constraints and Task 2 use orchestration.
- Backend route avoids App Route helper export issue: Task 2 places helpers in `src/lib/topic-chat.ts`.

Placeholder scan:
- No `TBD`.
- No `TODO`.
- No "implement later".

Type consistency:
- `TopicChatResponse.cards` uses existing `ApiTopicCard`.
- `TopicChatReply` from `src/lib/topic-chat.ts` matches `TopicChatResponse.reply`.
- API response shape matches client function and page state.
