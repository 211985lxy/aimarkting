# 阶段二：跨智能体联动 — 爆款方法论提取 + 前采整理 + 仿写模式

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通"竞品分析 → 爆款方法论 → 选题/文案"的价值传递链；让 persona agent 支持批量资料整理模式；让改文案 agent 支持跨行业爆款仿写。

**Architecture:** 爆款方法论复用 IP Wiki 的 `IpWikiPage` 模式，新增 `viral_methodology` pageType。前采整理在 PersonaHandler 中增加 `mode` 切换。仿写在 polishCopy 中增加 `mode: "polish" | "imitate"`，仿写时自动从知识库拉取行业信息。

**Tech Stack:** TypeScript, Next.js 16, Prisma 7, existing LLM client

**关联 Spec:** `docs/superpowers/specs/2026-07-03-cyber-vibes-upgrade-plan.md` 第三部分 阶段二

## Global Constraints

- 爆款方法论文档遵循 IP Wiki 的编译+人工确认模式，不自动入库
- 前采整理的产物直接写入 `KnowledgeEntry`，沉淀为知识资产
- 仿写模式不从用户手填获取行业信息，从 `KnowledgeEntry` 自动拉取
- 不引入新的 Prisma model，`viral_methodology` 作为 IpWikiPage 的新 pageType
- persona 的资料整理模式与现有引导式提问共存，通过输入信号自动检测

---

## File Structure

### 新增文件
| 文件 | 职责 |
|------|------|
| `src/lib/viral-methodology-compiler.ts` | 爆款方法论文档的 LLM 编译器（类比 ip-wiki/compile.ts） |
| `src/app/api/competitor-analysis/methodology/compile/route.ts` | 编译爆款方法论的 API |
| `__tests__/unit/viral-methodology-compiler.test.ts` | 编译器单元测试 |

### 修改文件
| 文件 | 修改内容 |
|------|---------|
| `src/lib/ip-wiki/types.ts:8-27` | IpWikiPageType 增加 `"viral_methodology"` |
| `src/lib/ip-wiki/context.ts` | buildIpWikiContext 时包含 viral_methodology 页 |
| `src/lib/aim-agent-handlers.ts` (PersonaHandler) | 增加 detectPersonaMode() 和前采整理 prompt |
| `src/lib/aim-agents/script-agent.ts` | polishCopy 增加 `mode` 和 `viralSourceText` 参数 |
| `prisma/schema.prisma` | IpWikiPage 的 pageType 不需要改（已有 String 类型，新增值即可） |

---

### Task 1: 新增 viral_methodology 到 IP Wiki 类型系统

**Files:**
- Modify: `src/lib/ip-wiki/types.ts:8-51`
- Test: `__tests__/unit/ip-wiki-viral-methodology-type.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `IpWikiPageType` 新增 `"viral_methodology"` 值

- [ ] **Step 1: 写失败的测试**

```typescript
// __tests__/unit/ip-wiki-viral-methodology-type.test.ts
import { describe, it, expect } from "vitest"
import {
  IP_WIKI_PAGE_TYPES,
  IP_WIKI_PAGE_TYPE_LABELS,
  IP_WIKI_CORE_PAGE_TYPES,
  isIpWikiPageType,
} from "@/lib/ip-wiki/types"

describe("viral_methodology page type", () => {
  it("should include viral_methodology in page types", () => {
    expect(IP_WIKI_PAGE_TYPES).toContain("viral_methodology")
  })

  it("should have Chinese label for viral_methodology", () => {
    expect(IP_WIKI_PAGE_TYPE_LABELS["viral_methodology"]).toBe("爆款方法论")
  })

  it("should pass isIpWikiPageType check", () => {
    expect(isIpWikiPageType("viral_methodology")).toBe(true)
  })

  it("should NOT be in core page types (it's a supplementary page)", () => {
    expect(IP_WIKI_CORE_PAGE_TYPES).not.toContain("viral_methodology")
  })

  it("should preserve all existing page types", () => {
    expect(IP_WIKI_PAGE_TYPES).toHaveLength(9) // was 8, now +1
    expect(IP_WIKI_PAGE_TYPES).toContain("positioning")
    expect(IP_WIKI_PAGE_TYPES).toContain("persona")
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/ip-wiki-viral-methodology-type.test.ts`
Expected: FAIL — `viral_methodology` 不在枚举中

- [ ] **Step 3: 修改 types.ts**

在 `IpWikiPageType` 联合类型中增加 `"viral_methodology"`，在 `IP_WIKI_PAGE_TYPES` 数组中追加，在 `IP_WIKI_PAGE_TYPE_LABELS` 中增加 `"viral_methodology": "爆款方法论"`。

不加入 `IP_WIKI_CORE_PAGE_TYPES`（它是补充页，不是核心定位页）。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/ip-wiki-viral-methodology-type.test.ts`
Expected: PASS

- [ ] **Step 5: 运行现有 IP Wiki 测试无回归**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/ip-wiki-*.test.ts`
Expected: ALL PASS

- [ ] **Step 6: 提交**

```bash
git add src/lib/ip-wiki/types.ts __tests__/unit/ip-wiki-viral-methodology-type.test.ts
git commit -m "feat: add viral_methodology as IpWikiPageType for competitor methodology docs"
```

---

### Task 2: 创建爆款方法论编译器

**Files:**
- Create: `src/lib/viral-methodology-compiler.ts`
- Test: `__tests__/unit/viral-methodology-compiler.test.ts`

**Interfaces:**
- Consumes: `IpWikiPageType` from task 1, `CompiledWikiPage` interface from `ip-wiki/compile.ts`
- Produces: `buildMethodologyCompilePrompt(input)`, `parseMethodologyCompileResponse(raw)`

- [ ] **Step 1: 写失败的测试**

```typescript
// __tests__/unit/viral-methodology-compiler.test.ts
import { describe, it, expect } from "vitest"
import {
  buildMethodologyCompilePrompt,
  parseMethodologyCompileResponse,
} from "@/lib/viral-methodology-compiler"

describe("viral methodology compiler", () => {
  it("should build compile prompt with competitor analysis text", () => {
    const prompt = buildMethodologyCompilePrompt({
      competitorAnalysisText: "这个账号做火锅店内容，开头用痛点直击...",
      projectName: "我的火锅店项目",
      sourceCompetitorId: "comp-123",
    })
    expect(prompt).toContain("爆款方法论")
    expect(prompt).toContain("开头打法")
    expect(prompt).toContain("中段推进")
    expect(prompt).toContain("结尾收束")
    expect(prompt).toContain("爆点迁移清单")
  })

  it("should parse valid compile response", () => {
    const raw = JSON.stringify([{
      pageType: "viral_methodology",
      title: "XX火锅店爆款打法方法论",
      content: "开头打法：用痛点直击...",
      frontmatter: { sourceAccount: "xx_hotpot", verifiedAt: "2026-07-01" },
      sources: [{ kind: "competitor_analysis", id: "comp-123" }],
      links: [],
    }])
    const pages = parseMethodologyCompileResponse(raw)
    expect(pages).toHaveLength(1)
    expect(pages[0].pageType).toBe("viral_methodology")
    expect(pages[0].title).toBe("XX火锅店爆款打法方法论")
  })

  it("should handle empty or invalid response gracefully", () => {
    expect(parseMethodologyCompileResponse("")).toEqual([])
    expect(parseMethodologyCompileResponse("not json")).toEqual([])
  })

  it("should handle array with non-matching pageType", () => {
    const raw = JSON.stringify([{ pageType: "positioning", title: "定位" }])
    const pages = parseMethodologyCompileResponse(raw)
    expect(pages).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/viral-methodology-compiler.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现编译器**

```typescript
// src/lib/viral-methodology-compiler.ts
import type { CompiledWikiPage } from "@/lib/ip-wiki/compile"

export interface MethodologyCompileInput {
  /** 竞品分析全文（来自 competitor-analysis pipeline） */
  competitorAnalysisText: string
  /** 当前项目名称 */
  projectName?: string
  /** 竞品分析来源 ID（用于 sources 溯源） */
  sourceCompetitorId?: string
}

type RawCompiledPage = {
  pageType?: string
  title?: string
  content?: string
  frontmatter?: unknown
  sources?: unknown
  links?: unknown
}

const MAX_CONTENT_CHARS = 5000

function sliceAnalysis(text: string): string {
  return text.slice(0, MAX_CONTENT_CHARS)
}

export function buildMethodologyCompilePrompt(input: MethodologyCompileInput): string {
  const analysis = sliceAnalysis(input.competitorAnalysisText)

  return `你是一个「爆款方法论」编译器。你的任务是把一份竞品账号分析报告，编译成一份结构化的「爆款打法方法论」文档。

这份方法论文档将被下游内容生产官和深度文案官在生成内容时直接读取，帮助他们学习对标账号的打法并迁移到本 IP 的行业。

## 输入

项目名称：${input.projectName ?? "（未提供）"}
竞品分析来源 ID：${input.sourceCompetitorId ?? "（未提供）"}

竞品分析全文：
"""
${analysis}
"""

## 输出要求

请输出恰好 1 个 JSON 数组（不要 markdown 代码块），包含 1 个维基页对象：

[{
  "pageType": "viral_methodology",
  "title": "<简洁的方法论标题，格式：XX账号/XX行业爆款打法方法论>",
  "content": "<方法论文档正文>",
  "frontmatter": {
    "sourceAccount": "<对标账号名称>",
    "industry": "<行业>",
    "contentNiche": "<内容赛道>",
    "verifiedAt": "<今天的日期>"
  },
  "sources": [{"kind": "competitor_analysis", "id": "${input.sourceCompetitorId ?? ""}"}],
  "links": []
}]

## content 必须包含以下结构化章节（用二级标题）：

### 开头打法
这个账号的开头怎么抓人？用了哪些公式？有没有独特模式？给出 3-5 个可复制的开头公式。

### 中段推进
叙事节奏怎么设计？如何保持注意力？论证/故事/案例怎么穿插？中段的节奏模式是什么？

### 结尾收束
结尾怎么收？是情绪型、行动号召型、还是留悬念型？CTA 怎么设计？

### 爆点迁移清单
列出 5-10 个可以迁移到本 IP 行业的爆点元素（去掉行业特定词汇后仍成立的通用打法）。每个爆点写明：原始形式 + 迁移建议。

### 适用场景标签
列出这套打法最适合的内容场景（如：ip_knowledge / entity_local / traffic_conversion / xhs_planting / kol_explore）。

请确保 content 是可以直接被下游 agent 读取的纯文本方法论文档，不要嵌套 JSON。`
}

export function parseMethodologyCompileResponse(
  raw: string
): CompiledWikiPage[] {
  if (!raw?.trim()) return []

  try {
    const parsed: RawCompiledPage[] = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (p): p is CompiledWikiPage =>
        p.pageType === "viral_methodology" &&
        typeof p.title === "string" &&
        typeof p.content === "string"
    )
  } catch {
    return []
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/viral-methodology-compiler.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/lib/viral-methodology-compiler.ts __tests__/unit/viral-methodology-compiler.test.ts
git commit -m "feat: add viral methodology compiler (extract competitor tactics into structured doc)"
```

---

### Task 3: 爆款方法论编译 API

**Files:**
- Create: `src/app/api/competitor-analysis/methodology/compile/route.ts`
- Test: `__tests__/unit/api-methodology-compile.test.ts`

**Interfaces:**
- Consumes: `buildMethodologyCompilePrompt` and `parseMethodologyCompileResponse` from task 2
- Produces: `POST /api/competitor-analysis/methodology/compile` → `{ proposedPages: CompiledWikiPage[] }`

- [ ] **Step 1: 写失败的测试**

```typescript
// __tests__/unit/api-methodology-compile.test.ts
import { describe, it, expect, vi } from "vitest"

// Mock LLM client
const mockComplete = vi.fn().mockResolvedValue({
  content: JSON.stringify([{
    pageType: "viral_methodology",
    title: "测试方法论",
    content: "开头打法：痛点直击",
    frontmatter: { sourceAccount: "test" },
    sources: [],
    links: [],
  }]),
})

vi.mock("@/lib/llm/client", () => ({
  LLMClient: {
    shared: () => ({ complete: mockComplete }),
  },
}))

describe("POST /api/competitor-analysis/methodology/compile", () => {
  it("should return proposed pages from competitor analysis", async () => {
    const { POST } = await import("@/app/api/competitor-analysis/methodology/compile/route")
    const response = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competitorAnalysisText: "这个账号做火锅内容...",
        projectName: "测试项目",
        sourceCompetitorId: "comp-123",
      }),
    }))
    const data = await response.json()
    expect(data.proposedPages).toBeDefined()
    expect(data.proposedPages).toHaveLength(1)
    expect(data.proposedPages[0].pageType).toBe("viral_methodology")
  })

  it("should return 400 if competitorAnalysisText is missing", async () => {
    const { POST } = await import("@/app/api/competitor-analysis/methodology/compile/route")
    const response = await POST(new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }))
    expect(response.status).toBe(400)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/api-methodology-compile.test.ts`
Expected: FAIL — route not found

- [ ] **Step 3: 实现 API route**

```typescript
// src/app/api/competitor-analysis/methodology/compile/route.ts
import { NextResponse } from "next/server"
import { LLMClient } from "@/lib/llm/client"
import {
  buildMethodologyCompilePrompt,
  parseMethodologyCompileResponse,
  type MethodologyCompileInput,
} from "@/lib/viral-methodology-compiler"

export async function POST(request: Request) {
  const body = await request.json()
  const { competitorAnalysisText, projectName, sourceCompetitorId } = body as MethodologyCompileInput

  if (!competitorAnalysisText?.trim()) {
    return NextResponse.json(
      { error: "competitorAnalysisText is required" },
      { status: 400 }
    )
  }

  const prompt = buildMethodologyCompilePrompt({
    competitorAnalysisText,
    projectName,
    sourceCompetitorId,
  })

  const completion = await LLMClient.shared().complete({
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    maxTokens: 4000,
  })

  const proposedPages = parseMethodologyCompileResponse(completion.content)

  return NextResponse.json({ proposedPages })
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/api-methodology-compile.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/app/api/competitor-analysis/methodology/compile/route.ts __tests__/unit/api-methodology-compile.test.ts
git commit -m "feat: add POST /api/competitor-analysis/methodology/compile API"
```

---

### Task 4: IP Wiki context 包含 viral_methodology 页

**Files:**
- Modify: `src/lib/ip-wiki/context.ts` — buildIpWikiContext 时包含 viral_methodology 页
- Test: `__tests__/unit/ip-wiki-viral-context.test.ts`

**Interfaces:**
- Consumes: `IpWikiPageType` (含新增的 viral_methodology)
- Produces: wiki context block 包含方法论页内容

- [ ] **Step 1: 写失败的测试**

```typescript
// __tests__/unit/ip-wiki-viral-context.test.ts
import { describe, it, expect } from "vitest"

describe("IP Wiki context includes viral methodology pages", () => {
  it("viral_methodology should be included in wiki page type list", async () => {
    const { IP_WIKI_PAGE_TYPES } = await import("@/lib/ip-wiki/types")
    // Verify the type system includes it
    expect(IP_WIKI_PAGE_TYPES).toContain("viral_methodology")
  })
})
```

- [ ] **Step 2: 检查 context.ts 的查询逻辑**

如果 context.ts 使用 `IP_WIKI_CORE_PAGE_TYPES` 来过滤页面，则需要确认 viral_methodology 是否被包含。如果是用全量查询则不需要改。

- [ ] **Step 3: 如需修改，确保 viral_methodology 页被包含在 context 构建中**

如果 context.ts 只查 core pages，改为查全部 pages 或将 viral_methodology 加入查询列表。

- [ ] **Step 4: 运行测试**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/ip-wiki-viral-context.test.ts __tests__/unit/ip-wiki-context.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/lib/ip-wiki/context.ts __tests__/unit/ip-wiki-viral-context.test.ts
git commit -m "feat: include viral_methodology pages in IP Wiki context for downstream agents"
```

---

### Task 5: Persona Agent 前采资料整理模式

**Files:**
- Modify: `src/lib/aim-agent-handlers.ts` (PersonaHandler) — 增加 detectPersonaMode + 前采整理 prompt
- Test: `__tests__/unit/persona-intake-mode.test.ts`

**Interfaces:**
- Consumes: 现有 PersonaHandler 的 chat() 方法
- Produces: PersonaHandler.chat() 根据输入信号自动切换「引导提问」/「资料整理」模式

**设计决策**：不增加新 handler，而是在 PersonaHandler 内部根据输入信号检测模式：
- 如果用户输入包含"前采""访谈""录音""整理""报告"等关键词 → 资料整理模式
- 否则 → 现有引导提问模式

资料整理模式的 prompt 核心指令：
- 接收分批文字，回复"收到"
- 用户说"开始整理"后，输出结构化前采报告
- 报告包含：身份/人设/故事/性格/商业逻辑/内容素材 + 信息缺口补采建议

- [ ] **Step 1: 写失败的测试**

```typescript
// __tests__/unit/persona-intake-mode.test.ts
import { describe, it, expect } from "vitest"
import { detectPersonaMode } from "@/lib/aim-agent-handlers"

describe("persona intake mode detection", () => {
  it("should detect intake mode from keywords", () => {
    expect(detectPersonaMode("帮我整理一下前采记录")).toBe("intake")
    expect(detectPersonaMode("这是访谈录音转文字")).toBe("intake")
    expect(detectPersonaMode("前采资料整理")).toBe("intake")
    expect(detectPersonaMode("帮我整理访谈内容")).toBe("intake")
  })

  it("should default to guided mode for general input", () => {
    expect(detectPersonaMode("我想做个人IP")).toBe("guided")
    expect(detectPersonaMode("帮我定位一下")).toBe("guided")
    expect(detectPersonaMode("")).toBe("guided")
  })

  it("should detect start-compile signal", () => {
    expect(detectPersonaMode("开始整理")).toBe("intake_compile")
    expect(detectPersonaMode("已发完，开始整理")).toBe("intake_compile")
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/persona-intake-mode.test.ts`
Expected: FAIL — function not exported

- [ ] **Step 3: 在 aim-agent-handlers.ts 中实现**

1. 新增导出函数 `detectPersonaMode(input: string): "guided" | "intake" | "intake_compile"`

```typescript
export function detectPersonaMode(input: string): "guided" | "intake" | "intake_compile" {
  const text = input.trim()
  if (text.includes("开始整理")) return "intake_compile"
  const intakeKeywords = ["前采", "访谈", "录音", "整理", "报告", "资料整理", "逐字稿"]
  if (intakeKeywords.some((kw) => text.includes(kw))) return "intake"
  return "guided"
}
```

2. 在 PersonaHandler.buildChatPrompt 中根据模式切换 prompt：

```typescript
const mode = detectPersonaMode(lastUserMessage)
if (mode === "intake" || mode === "intake_compile") {
  return this.buildIntakePrompt(params, mode)
}
return this.buildGuidedPrompt(params)
```

3. 新增 `buildIntakePrompt` — 前采整理 prompt：

```typescript
private buildIntakePrompt(params: AimChatParams, mode: "intake" | "intake_compile"): string {
  if (mode === "intake") {
    return `你是一个「前采信息整理专家」。用户会分批发送前采资料（访谈记录、录音转文字、聊天内容等）。

你的规则：
1. 用户发来前采文字时，只需回复"收到"。
2. 不要追问、不要分析、不要输出任何报告。
3. 等待用户发送"开始整理"的指令。

前采已收到的内容会在对话历史中。当用户说"开始整理"时，我会切换到整理模式。

请回复"收到"。`
  }

  // intake_compile mode
  return `你是一个「前采信息整理专家」。用户已经发送完所有前采资料，现在需要你整理成一份结构化的前采信息整理报告。

企业已有知识库（参考背景）：
${params.knowledgeBlock}

请根据对话历史中的所有前采内容，输出以下结构化报告：

## 一、身份信息
- 姓名/品牌名、行业、角色、从业年限

## 二、人设特征
- 性格标签（3-5 个）
- 说话风格（用一句话概括）
- 核心情绪基调

## 三、故事素材
- 列出 3-5 个有爆点的真实故事/经历（含细节、原话、情绪点）

## 四、商业逻辑
- 盈利模式
- 核心产品/服务
- 差异化优势

## 五、客户画像
- 目标客户是谁
- 客户最大痛点
- 客户决策路径

## 六、内容素材
- 可以直接用来做选题的话题（5-10 个）
- 老板金句/口头禅（原文摘录）

## 七、信息缺口与补采建议
- 哪些维度信息不足
- 建议补问的具体问题（5-10 个）

直接输出报告，不要追问。`
}
```

4. 修改 PersonaHandler.chat() 使用 detectPersonaMode：

```typescript
async chat(params: AimChatParams): Promise<AimChatResponse> {
  const lastUserMsg = params.messages[params.messages.length - 1]?.content ?? ""
  const mode = detectPersonaMode(lastUserMsg)
  let prompt: string
  if (mode === "intake" || mode === "intake_compile") {
    prompt = this.buildIntakePrompt(params, mode)
  } else {
    prompt = this.buildChatPrompt(params)
  }
  return executeChatLLM(this.agentId, prompt, params.messages)
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/persona-intake-mode.test.ts`
Expected: PASS

- [ ] **Step 5: 运行现有测试无回归**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/`
Expected: ALL PASS

- [ ] **Step 6: 提交**

```bash
git add src/lib/aim-agent-handlers.ts __tests__/unit/persona-intake-mode.test.ts
git commit -m "feat: add persona intake mode for batch interview data processing"
```

---

### Task 6: 改文案仿写模式

**Files:**
- Modify: `src/lib/aim-agents/script-agent.ts` — polishCopy 增加 `mode` 和 `viralSourceText`
- Test: `__tests__/unit/polish-copy-imitate-mode.test.ts`

**Interfaces:**
- Consumes: `loadProjectKnowledge` (已有)，`KnowledgeEntry` 数据
- Produces: `polishCopy(input)` 新增 `mode?: "polish" | "imitate"`, `viralSourceText?: string`

**设计决策**：
- `mode: "polish"` (默认) — 现有润色行为
- `mode: "imitate"` — 仿写模式，需要提供 `viralSourceText`（爆款原文）
- 仿写时，知识库自动注入（含行业信息），用户不需要手填

- [ ] **Step 1: 写失败的测试**

```typescript
// __tests__/unit/polish-copy-imitate-mode.test.ts
import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    knowledgeEntry: {
      findMany: vi.fn().mockResolvedValue([
        { category: "boss_experience", title: "老板经历", content: "做了10年火锅", sortOrder: 1 },
        { category: "product_usp", title: "现炒底料", content: "每天现炒牛油锅底", sortOrder: 2 },
        { category: "customer_pain", title: "怕不正宗", content: "顾客最怕吃到预制底料", sortOrder: 3 },
      ]),
    },
  },
}))

vi.mock("@/lib/ip-copywriting-methodology", () => ({
  buildIpCopywritingMethodologyBlock: vi.fn().mockResolvedValue(""),
}))

vi.mock("@/lib/llm/client", () => ({
  LLMClient: {
    shared: () => ({
      complete: vi.fn().mockResolvedValue({ content: "仿写后的文案内容" }),
    }),
  },
}))

describe("polishCopy imitate mode", () => {
  it("should accept mode and viralSourceText parameters", async () => {
    const { polishCopy } = await import("@/lib/aim-agents/script-agent")
    const result = await polishCopy({
      userId: "test-user",
      rawInput: "随便填的",
      mode: "imitate",
      viralSourceText: "他是我见过最傻的火锅店老板...",
    })
    expect(result).toBeDefined()
    expect(result.content).toBe("仿写后的文案内容")
  })

  it("should default to polish mode when mode is not specified", async () => {
    const { polishCopy } = await import("@/lib/aim-agents/script-agent")
    const result = await polishCopy({
      userId: "test-user",
      rawInput: "原始文案",
    })
    expect(result).toBeDefined()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/polish-copy-imitate-mode.test.ts`
Expected: FAIL — polishCopy 不接受 mode/viralSourceText

- [ ] **Step 3: 修改 polishCopy**

在 `src/lib/aim-agents/script-agent.ts` 中：

1. polishCopy input 增加 `mode?: "polish" | "imitate"` 和 `viralSourceText?: string`
2. 当 `mode === "imitate"` 时，使用仿写 prompt：

```typescript
if (input.mode === "imitate" && input.viralSourceText) {
  // 仿写模式：结构解构 + 跨域重建
  const systemPrompt = `你是一个「爆款文案仿写专家」。你的任务是把一条爆款文案的底层逻辑迁移到用户所在的行业。

${knowledge}  // 从知识库自动拉取的行业信息
${methodologyBlock}

仿写规则：
1. 先分析爆款原文的结构：开头钩子是什么类型？中段推进用了什么节奏？结尾用了什么收束方式？
2. 保留原文的结构逻辑和情绪节奏，但把内容完全替换成用户行业的
3. 必须使用知识库中的产品卖点、客户痛点、老板经验来填充新内容
4. 保持原文的爆点力度，但场景和细节必须是用户行业的真实场景
5. 禁止保留原文的行业特定词汇，必须全部替换
6. 直接输出仿写成稿，不要解释你的分析过程
7. 禁止使用：赋能、闭环、抓手、颗粒度、对齐、拉通、打通、沉淀、复盘、迭代、链路、触达、心智、赛道
8. 输出纯文本，不要加格式标记或解释`

  const userPrompt = `请把以下爆款文案的逻辑迁移到我所在的行业：

【爆款原文】
${input.viralSourceText}

${input.instruction ? `\n额外要求：${input.instruction}` : ""}
---`

  // ... LLM call with this system/user prompt
}
```

3. 默认 mode 为 `"polish"`，行为与现有完全一致（向后兼容）

- [ ] **Step 4: 运行测试确认通过**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/polish-copy-imitate-mode.test.ts`
Expected: PASS

- [ ] **Step 5: 运行现有改文案测试无回归**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/polish-copy-styles.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/lib/aim-agents/script-agent.ts __tests__/unit/polish-copy-imitate-mode.test.ts
git commit -m "feat: add imitate mode to polishCopy for cross-industry viral copy transfer"
```

---

## Self-Review

1. **Spec 覆盖**：阶段二的 3 个特性全部有对应 task：爆款方法论（task 1-4）、前采整理（task 5）、仿写模式（task 6）
2. **占位符扫描**：无 TBD/TODO，所有 prompt 内容已写完
3. **类型一致性**：viral_methodology 在 task 1 定义，task 2/3/4 引用；polishCopy 的 mode 在 task 6 定义
4. **向后兼容**：persona 的模式检测是自动的，polishCopy 的 mode 默认值是 "polish"
5. **知识库自动注入**：仿写模式复用现有 `loadProjectKnowledge`，不从用户手填
