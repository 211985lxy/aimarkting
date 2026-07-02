# AIM Chat Evolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the smallest useful "chat evolution" loop: extract customer preferences from AIM conversations, let the user confirm them, save them into the existing knowledge base, and retrieve them in future chats.

**Architecture:** Reuse the existing `KnowledgeEntry` table with category `user_insight`; do not add a new memory table. Add one server route that extracts structured insights with the existing LLM provider chain, one client function, and one AIM page action that stores confirmed insights through the existing `/api/knowledge` route.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 7, existing `LLMClient`, existing `KnowledgeEntry`, Vitest.

## Global Constraints

- No mock, fake, stub, fixture fallback, demo data fallback, or simulated provider in production code, preview flows, admin flows, or acceptance flows.
- UI work in `clipflow/apps/web` must use the existing shadcn/ui components in `src/components/ui`.
- Keep the first version human-confirmed; do not auto-write conversation-derived facts into the knowledge base.
- Do not add a new dependency or a new database table for v1.
- Store extracted preferences as `KnowledgeEntry.category = "user_insight"` and `sourceType = "manual"`.
- Keep project binding: only save insights when `projectId` is present and belongs to the user.

---

## File Structure

- Create: `mingyuan/apps/web/src/lib/aim-chat-evolution.ts`
  - Owns extraction prompt, JSON parsing, title/content formatting, and input limits.
- Create: `mingyuan/apps/web/src/app/api/aim/evolve/route.ts`
  - Authenticates the user, validates `projectId`, calls extraction, returns suggested knowledge entries only.
- Modify: `mingyuan/apps/web/src/lib/api/client.ts`
  - Adds typed `evolveAimConversation()` client helper.
- Modify: `mingyuan/apps/web/src/app/(dashboard)/aim/page.tsx`
  - Adds a "沉淀偏好" action after useful conversation, shows suggestions, and saves selected suggestions with existing `createKnowledge()`.
- Test: `mingyuan/apps/web/__tests__/unit/aim-chat-evolution.test.ts`
  - Covers JSON parsing, title/content formatting, and empty/low-signal conversations.

---

### Task 1: Extract Chat Insights Server Utility

**Files:**
- Create: `mingyuan/apps/web/src/lib/aim-chat-evolution.ts`
- Test: `mingyuan/apps/web/__tests__/unit/aim-chat-evolution.test.ts`

**Interfaces:**
- Consumes: existing `LLMClient.shared()`, existing chat message shape `{ role: "user" | "assistant"; content: string }`.
- Produces:
  - `type AimEvolutionSuggestion = { category: "user_insight"; title: string; content: string; tags: string[] }`
  - `function parseEvolutionJson(raw: string): AimEvolutionSuggestion[]`
  - `function buildEvolutionPrompt(messages: AimEvolutionMessage[]): string`
  - `async function extractAimEvolutionSuggestions(input: { messages: AimEvolutionMessage[]; maxSuggestions?: number }): Promise<AimEvolutionSuggestion[]>`

- [ ] **Step 1: Write the failing test**

Add `mingyuan/apps/web/__tests__/unit/aim-chat-evolution.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { buildEvolutionPrompt, parseEvolutionJson } from "@/lib/aim-chat-evolution"

describe("aim chat evolution", () => {
  it("parses valid extraction json into user_insight suggestions", () => {
    const parsed = parseEvolutionJson(JSON.stringify({
      suggestions: [
        {
          type: "style_preference",
          title: "偏好：短句、少术语",
          content: "用户明确要求文案少用套话，句子更短，更像真人口播。",
          evidence: "用户说：这个太AI了，短一点。",
        },
      ],
    }))

    expect(parsed).toEqual([
      {
        category: "user_insight",
        title: "偏好：短句、少术语",
        content: "用户明确要求文案少用套话，句子更短，更像真人口播。\n证据：用户说：这个太AI了，短一点。",
        tags: ["kb_scope:project", "asset_role:preference", "usable_for:video", "usable_for:wechat", "confidence:user_claim"],
      },
    ])
  })

  it("returns no suggestions for invalid json or empty suggestions", () => {
    expect(parseEvolutionJson("not-json")).toEqual([])
    expect(parseEvolutionJson(JSON.stringify({ suggestions: [] }))).toEqual([])
  })

  it("builds a bounded prompt from recent conversation", () => {
    const prompt = buildEvolutionPrompt([
      { role: "user", content: "我不喜欢那种很装的表达。" },
      { role: "assistant", content: "明白，我会改成更直接的口播。" },
    ])

    expect(prompt).toContain("只提炼长期有用的客户偏好")
    expect(prompt).toContain("我不喜欢那种很装的表达")
    expect(prompt.length).toBeLessThan(5000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/xiangyu/Desktop/明动aim智能体/mingyuan/apps/web
./node_modules/.bin/vitest run __tests__/unit/aim-chat-evolution.test.ts
```

Expected: FAIL with module not found for `@/lib/aim-chat-evolution`.

- [ ] **Step 3: Write minimal implementation**

Create `mingyuan/apps/web/src/lib/aim-chat-evolution.ts`:

```ts
import { LLMClient } from "@/lib/llm/client"
import type { ChatMessage } from "@/lib/llm/types"

export type AimEvolutionMessage = {
  role: "user" | "assistant"
  content: string
}

export type AimEvolutionSuggestion = {
  category: "user_insight"
  title: string
  content: string
  tags: string[]
}

type RawSuggestion = {
  type?: string
  title?: string
  content?: string
  evidence?: string
}

const DEFAULT_TAGS = [
  "kb_scope:project",
  "asset_role:preference",
  "usable_for:video",
  "usable_for:wechat",
  "confidence:user_claim",
]

export function buildEvolutionPrompt(messages: AimEvolutionMessage[]): string {
  const recent = messages
    .slice(-12)
    .map((message) => `${message.role === "user" ? "用户" : "助手"}：${message.content}`)
    .join("\n\n")
    .slice(0, 3500)

  return `你是 AIM 的客户偏好提炼器。只提炼长期有用的客户偏好，不要总结一次性任务。

可提炼类型：
- 表达偏好：用户喜欢/讨厌的语气、结构、长度、风格
- 禁忌表达：用户明确要求少用或不用的词、句式、套路
- 稳定观点：用户反复坚持的判断、立场、方法
- 业务偏好：用户对客户、场景、交付、成交方式的稳定选择

不要提炼：
- 一次性改稿指令
- 助手自己的建议
- 没有用户证据的猜测

输出 JSON，格式严格如下：
{
  "suggestions": [
    {
      "type": "style_preference",
      "title": "偏好：短句、少术语",
      "content": "一句可长期复用的偏好描述",
      "evidence": "用户原话或近似原话"
    }
  ]
}

如果没有值得长期沉淀的偏好，返回 {"suggestions": []}。

对话：
${recent}`
}

export function parseEvolutionJson(raw: string): AimEvolutionSuggestion[] {
  try {
    const parsed = JSON.parse(raw) as { suggestions?: RawSuggestion[] }
    if (!Array.isArray(parsed.suggestions)) return []

    return parsed.suggestions
      .map((item) => {
        const title = typeof item.title === "string" ? item.title.trim() : ""
        const content = typeof item.content === "string" ? item.content.trim() : ""
        const evidence = typeof item.evidence === "string" ? item.evidence.trim() : ""
        if (!title || !content) return null
        return {
          category: "user_insight" as const,
          title: title.slice(0, 80),
          content: evidence ? `${content}\n证据：${evidence}` : content,
          tags: DEFAULT_TAGS,
        }
      })
      .filter((item): item is AimEvolutionSuggestion => item !== null)
      .slice(0, 5)
  } catch {
    return []
  }
}

export async function extractAimEvolutionSuggestions(input: {
  messages: AimEvolutionMessage[]
  maxSuggestions?: number
}): Promise<AimEvolutionSuggestion[]> {
  const prompt = buildEvolutionPrompt(input.messages)
  const completion = await LLMClient.shared().complete({
    messages: [{ role: "user", content: prompt } satisfies ChatMessage],
    maxTokens: 900,
    temperature: 0.2,
    responseFormat: { type: "json_object" },
  })

  return parseEvolutionJson(completion.content).slice(0, input.maxSuggestions ?? 5)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd /Users/xiangyu/Desktop/明动aim智能体/mingyuan/apps/web
./node_modules/.bin/vitest run __tests__/unit/aim-chat-evolution.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/xiangyu/Desktop/明动aim智能体
git add mingyuan/apps/web/src/lib/aim-chat-evolution.ts mingyuan/apps/web/__tests__/unit/aim-chat-evolution.test.ts
git commit -m "feat: extract AIM chat evolution insights"
```

---

### Task 2: Add Confirm-Only Evolution API

**Files:**
- Create: `mingyuan/apps/web/src/app/api/aim/evolve/route.ts`
- Modify: `mingyuan/apps/web/__tests__/unit/aim-chat-evolution.test.ts`

**Interfaces:**
- Consumes: `extractAimEvolutionSuggestions({ messages, maxSuggestions })`.
- Produces: `POST /api/aim/evolve` returning `{ suggestions: AimEvolutionSuggestion[] }`.

- [ ] **Step 1: Write the failing test for message validation helper**

Append to `mingyuan/apps/web/__tests__/unit/aim-chat-evolution.test.ts`:

```ts
import { normalizeEvolutionMessages } from "@/lib/aim-chat-evolution"

it("normalizes only user and assistant messages with non-empty content", () => {
  expect(normalizeEvolutionMessages([
    { role: "system", content: "ignore" },
    { role: "user", content: "  我喜欢短句  " },
    { role: "assistant", content: "" },
    { role: "assistant", content: "好的" },
    { role: "user", content: 123 },
  ])).toEqual([
    { role: "user", content: "我喜欢短句" },
    { role: "assistant", content: "好的" },
  ])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/xiangyu/Desktop/明动aim智能体/mingyuan/apps/web
./node_modules/.bin/vitest run __tests__/unit/aim-chat-evolution.test.ts
```

Expected: FAIL with `normalizeEvolutionMessages` not exported.

- [ ] **Step 3: Add normalization helper**

Modify `mingyuan/apps/web/src/lib/aim-chat-evolution.ts`:

```ts
export function normalizeEvolutionMessages(value: unknown): AimEvolutionMessage[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const role = (item as { role?: unknown }).role
      const content = (item as { content?: unknown }).content
      if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null
      const trimmed = content.trim()
      if (!trimmed) return null
      return { role, content: trimmed }
    })
    .filter((item): item is AimEvolutionMessage => item !== null)
}
```

- [ ] **Step 4: Create API route**

Create `mingyuan/apps/web/src/app/api/aim/evolve/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, authErrorResponse } from "@/lib/user-auth"
import { prisma } from "@/lib/prisma"
import {
  extractAimEvolutionSuggestions,
  normalizeEvolutionMessages,
} from "@/lib/aim-chat-evolution"

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    const body = await request.json()
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : ""
    const messages = normalizeEvolutionMessages(body.messages)

    if (!projectId) {
      return NextResponse.json({ error: "projectId 必填" }, { status: 400 })
    }
    if (messages.length < 2) {
      return NextResponse.json({ suggestions: [] })
    }

    const project = await prisma.clientProject.findFirst({
      where: { id: projectId, userId: user.id, status: "active" },
      select: { id: true },
    })
    if (!project) {
      return NextResponse.json({ error: "IP营销全案不存在或已归档" }, { status: 404 })
    }

    const suggestions = await extractAimEvolutionSuggestions({
      messages,
      maxSuggestions: 5,
    })

    return NextResponse.json({ suggestions })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("[aim/evolve] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "偏好提炼失败" },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
cd /Users/xiangyu/Desktop/明动aim智能体/mingyuan/apps/web
./node_modules/.bin/vitest run __tests__/unit/aim-chat-evolution.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/xiangyu/Desktop/明动aim智能体
git add mingyuan/apps/web/src/lib/aim-chat-evolution.ts mingyuan/apps/web/src/app/api/aim/evolve/route.ts mingyuan/apps/web/__tests__/unit/aim-chat-evolution.test.ts
git commit -m "feat: add AIM conversation evolution API"
```

---

### Task 3: Add Client Helper and AIM UI Confirmation Flow

**Files:**
- Modify: `mingyuan/apps/web/src/lib/api/client.ts`
- Modify: `mingyuan/apps/web/src/app/(dashboard)/aim/page.tsx`

**Interfaces:**
- Consumes: `POST /api/aim/evolve`.
- Produces:
  - `evolveAimConversation(input): Promise<AimEvolutionSuggestion[]>`
  - AIM page button `沉淀偏好`
  - user-confirmed save through existing `createKnowledge()`

- [ ] **Step 1: Add API client types and helper**

Modify `mingyuan/apps/web/src/lib/api/client.ts` near the AIM client functions:

```ts
export interface AimEvolutionSuggestion {
  category: "user_insight"
  title: string
  content: string
  tags: string[]
}

export async function evolveAimConversation(input: {
  projectId: string
  messages: Array<{ role: "user" | "assistant"; content: string }>
  signal?: AbortSignal
}): Promise<AimEvolutionSuggestion[]> {
  const payload = await request<{ suggestions: AimEvolutionSuggestion[] }>("/api/aim/evolve", {
    method: "POST",
    body: JSON.stringify({
      projectId: input.projectId,
      messages: input.messages,
    }),
    signal: input.signal,
    timeout: 30000,
  })
  return payload.suggestions
}
```

- [ ] **Step 2: Import helpers in AIM page**

Modify imports in `mingyuan/apps/web/src/app/(dashboard)/aim/page.tsx`:

```ts
import {
  ApiError,
  chatAim,
  createKnowledge,
  evolveAimConversation,
  generateAimContent,
  listAimHistory,
  listProjects,
  markAimGenerationStatus,
  qualityCheckAimContent,
  type AimEvolutionSuggestion,
  type AimGenerateResponse,
  type AimGeneration,
  type ClientProject,
  type ContentFormat,
  type QualityCheckReport,
} from "@/lib/api/client"
```

Use the actual current import block and only add `createKnowledge`, `evolveAimConversation`, and `type AimEvolutionSuggestion`.

- [ ] **Step 3: Add local state**

Inside `AimPage`, near other `useState` calls, add:

```ts
const [isEvolving, setIsEvolving] = useState(false)
const [evolutionSuggestions, setEvolutionSuggestions] = useState<AimEvolutionSuggestion[]>([])
```

- [ ] **Step 4: Add extraction handler**

Inside `AimPage`, near `sendText`, add:

```ts
async function handleEvolveConversation() {
  if (!projectEnabled || !selectedProjectId) {
    toast.error("请先启用一个 IP 营销全案")
    return
  }
  const sourceMessages = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({ role: message.role, content: message.content }))

  if (sourceMessages.length < 2) {
    toast.error("对话太少，还没有可沉淀的偏好")
    return
  }

  setIsEvolving(true)
  try {
    const suggestions = await evolveAimConversation({
      projectId: selectedProjectId,
      messages: sourceMessages,
    })
    setEvolutionSuggestions(suggestions)
    if (suggestions.length === 0) toast.info("这轮对话还没有明显的长期偏好")
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "偏好提炼失败")
  } finally {
    setIsEvolving(false)
  }
}
```

- [ ] **Step 5: Add save handler**

Inside `AimPage`, near `handleEvolveConversation`, add:

```ts
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
```

- [ ] **Step 6: Add the button**

In the AIM page header action area near the "新对话" button, add:

```tsx
<Button
  size="sm"
  variant="outline"
  className="h-8 px-2"
  onClick={() => void handleEvolveConversation()}
  disabled={isThinking || isGenerating || isEvolving || messages.length < 2}
  title="从当前对话提炼客户偏好"
>
  {isEvolving ? "提炼中" : "沉淀偏好"}
</Button>
```

- [ ] **Step 7: Render confirmation suggestions**

Above the message stream, after any existing progress banner, add:

```tsx
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
```

- [ ] **Step 8: Run focused checks**

Run:

```bash
cd /Users/xiangyu/Desktop/明动aim智能体/mingyuan/apps/web
./node_modules/.bin/vitest run __tests__/unit/aim-chat-evolution.test.ts
```

Expected: PASS.

Run:

```bash
cd /Users/xiangyu/Desktop/明动aim智能体/mingyuan
COREPACK_ENABLE_PROJECT_SPEC=1 corepack pnpm --filter @mingyuan/web lint
```

Expected: no new lint errors from `page.tsx` or `client.ts`.

- [ ] **Step 9: Manual verification**

With dev server running:

```bash
cd /Users/xiangyu/Desktop/明动aim智能体/mingyuan
COREPACK_ENABLE_PROJECT_SPEC=1 corepack pnpm --filter @mingyuan/web dev
```

In browser:

1. Open `/aim`.
2. Use an active IP 营销全案.
3. Send: `我不喜欢很装、很端着的表达，给我短句、直接一点。`
4. Wait for assistant reply.
5. Click `沉淀偏好`.
6. Expected: suggestion card appears with title similar to `偏好：短句、直接表达`.
7. Click `写入知识库`.
8. Open `/admin/knowledge` or `/knowledge` list if available.
9. Expected: a new `user_insight` entry exists for the current project.

- [ ] **Step 10: Commit**

```bash
cd /Users/xiangyu/Desktop/明动aim智能体
git add mingyuan/apps/web/src/lib/api/client.ts 'mingyuan/apps/web/src/app/(dashboard)/aim/page.tsx'
git commit -m "feat: confirm and save AIM chat preferences"
```

---

### Task 4: Verify Retrieval Uses Saved Preferences

**Files:**
- Modify: `mingyuan/apps/web/__tests__/unit/aim-knowledge-context.test.ts`

**Interfaces:**
- Consumes: existing `rankKnowledgeEntriesForAgent(agentId, entries)`.
- Produces: regression coverage that `user_insight` is prioritized for writing agents.

- [ ] **Step 1: Write failing test**

Append to `mingyuan/apps/web/__tests__/unit/aim-knowledge-context.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { rankKnowledgeEntriesForAgent } from "@/lib/aim-knowledge-context"

describe("AIM evolved preferences retrieval", () => {
  it("keeps user_insight visible for deep copywriter ranking", () => {
    const ranked = rankKnowledgeEntriesForAgent("deep_copywriter", [
      { id: "product", category: "product_usp", title: "产品", content: "产品卖点", score: 0.8, tags: [] },
      { id: "preference", category: "user_insight", title: "偏好", content: "用户喜欢短句", score: 0.8, tags: ["kb_scope:project"] },
    ])

    expect(ranked.some((entry) => entry.category === "user_insight")).toBe(true)
  })
})
```

If the file already has imports or a `describe`, merge the import and append only the test body.

- [ ] **Step 2: Run test**

Run:

```bash
cd /Users/xiangyu/Desktop/明动aim智能体/mingyuan/apps/web
./node_modules/.bin/vitest run __tests__/unit/aim-knowledge-context.test.ts
```

Expected: PASS. If it fails because `user_insight` is not ranked high enough for deep copywriter, modify `AGENT_PRIORITY_CATEGORIES.deep_copywriter` in `mingyuan/apps/web/src/lib/aim-knowledge-context.ts` to keep `"user_insight"` in the list.

- [ ] **Step 3: Manual retrieval verification**

After saving a preference in Task 3:

1. Send a new AIM message: `按我的偏好重写这段：我们提供企业AI转型咨询服务。`
2. Expected: assistant naturally follows the saved preference, such as shorter/direct wording.
3. Generate content.
4. Expected: delivery badge still shows knowledge usage when relevant: `已用知识库 N 条`.

- [ ] **Step 4: Commit**

```bash
cd /Users/xiangyu/Desktop/明动aim智能体
git add mingyuan/apps/web/__tests__/unit/aim-knowledge-context.test.ts mingyuan/apps/web/src/lib/aim-knowledge-context.ts
git commit -m "test: keep AIM evolved preferences retrievable"
```

---

## Self-Review

**Spec coverage:** The plan adds a real evolution loop from chat to extracted preference, to user confirmation, to knowledge base, to future RAG retrieval. It explicitly avoids unconfirmed automatic writes.

**Placeholder scan:** No `TBD`, `TODO`, "implement later", or unbounded "add appropriate handling" steps remain.

**Type consistency:** `AimEvolutionSuggestion` is defined once server-side and mirrored client-side with the same fields. The API route returns `{ suggestions }`, and the client helper consumes the same shape.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-26-aim-chat-evolution.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
