# Copywriter Routing Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the AIM copywriter so it chooses among four content routes: 人设信任型, 观点立场型, 问题解决型, 案例转化型.

**Architecture:** Keep one deep copywriter agent. Put the durable writing taxonomy in `mingyuan/docs/ip-copywriting-methodology-core.md`, then use task-intent routing to call the right local tool section: content route for new drafts, local optimization route for opening/title/ending/structure/humanization edits.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, existing AIM prompt/methodology injection.

## Global Constraints

- Do not create new agents for 人设/观点/问题/案例 unless a future route gets its own input, output, UI, and quality standard.
- Do not add a database table for this phase.
- Do not add a new dependency.
- Keep industry differences as context rules, not separate agents.
- Use existing methodology injection through `buildIpCopywritingMethodologyBlock()`.

---

## File Structure

- Modify: `mingyuan/docs/ip-copywriting-methodology-core.md`
  - Add the four-route copywriting taxonomy, local optimization routing, and account-stage guidance.
- Modify: `mingyuan/apps/web/__tests__/unit/ip-copywriting-methodology.test.ts`
  - Lock that the methodology includes the four routes, merged definitions, and local optimization routing.
- Optional create: `mingyuan/apps/web/src/lib/copywriter-content-route.ts`
  - Only if tests show prompt-only routing is too vague.
- Optional test: `mingyuan/apps/web/__tests__/unit/copywriter-content-route.test.ts`
  - Only if the helper is added.

## Obsidian Source Mapping

Use these vault notes as the source of truth when updating `mingyuan/docs/ip-copywriting-methodology-core.md`:

- `/Users/xiangyu/Library/Mobile Documents/iCloud~md~obsidian/Documents/灵感库/00-操盘手方法论/02_内容信任.md`
  - 常驻规则：世界观、误区、核心主张、信任见证、关系阶梯。
- `/Users/xiangyu/Library/Mobile Documents/iCloud~md~obsidian/Documents/灵感库/00-操盘手方法论/归档/内容创作SOP+钩子全库.md`
  - 常驻规则：内容制作 SOP、13 种钩子、12 个黄金元素。
- `/Users/xiangyu/Library/Mobile Documents/iCloud~md~obsidian/Documents/灵感库/00-操盘手方法论/主理人操盘OS/七大爆款开头公式.md`
  - 按需调用：用户说“优化开头 / 前3秒 / 第一句话 / 钩子”时调用。
- `/Users/xiangyu/Library/Mobile Documents/iCloud~md~obsidian/Documents/灵感库/00-操盘手方法论/02-创作/线索获客型短视频方法论拆解.md`
  - 常驻规则：问题、解法、方案；精准客户、买点、需求引爆点。
- `/Users/xiangyu/Library/Mobile Documents/iCloud~md~obsidian/Documents/灵感库/我的文案/短视频文案结构模板（可复用版）.md`
  - 按需调用：用户说“优化结构 / 节奏 / 中段 / 问题解决内容”时调用。

### Task 1: Lock the Four-Route Methodology

**Files:**
- Modify: `mingyuan/apps/web/__tests__/unit/ip-copywriting-methodology.test.ts`
- Modify: `mingyuan/docs/ip-copywriting-methodology-core.md`

**Interfaces:**
- Consumes: `buildIpCopywritingMethodologyBlock(): Promise<string>`
- Produces: methodology text containing `人设信任型`, `观点立场型`, `问题解决型`, `案例转化型`

- [ ] **Step 1: Write the failing test**

Add this test to `mingyuan/apps/web/__tests__/unit/ip-copywriting-methodology.test.ts`:

```ts
it("contains the four copywriting content routes", async () => {
  const block = await buildIpCopywritingMethodologyBlock()

  expect(block).toContain("人设信任型")
  expect(block).toContain("观点立场型")
  expect(block).toContain("问题解决型")
  expect(block).toContain("案例转化型")
  expect(block).toContain("干货方法并入问题解决型")
  expect(block).toContain("成交转化并入案例转化型")
  expect(block).toContain("内容路由 = 这条内容为什么拍")
  expect(block).toContain("内容形式 = 这条内容怎么拍")
  expect(block).toContain("局部优化指令路由")
  expect(block).toContain("开头、前3秒、第一句话、钩子")
  expect(block).toContain("调用爆款开头库")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd mingyuan/apps/web
npx vitest run __tests__/unit/ip-copywriting-methodology.test.ts
```

Expected: FAIL because the new route labels are not all present.

- [ ] **Step 3: Add minimal methodology section**

Add this section near the top of `mingyuan/docs/ip-copywriting-methodology-core.md`, after the current usage order:

```md
## 文案内容路由

文案智能体先判断“这条内容为什么拍”，再选择写法。不要为下面四类新建独立智能体；它们是 `deep_copywriter` 内部的内容路由。

### 1. 人设信任型

目的：让用户相信“这个人靠谱、懂我、值得听”。

适合：来时路、价值观、专业经历、踩坑、工作现场、vlog。

写法：先给一个真实场景或经历，再说这个经历形成了什么判断，最后落到用户为什么可以信任你。

### 2. 观点立场型

目的：打出判断，让用户觉得“他说得不一样，而且说中了”。

适合：行业误区、反常识观点、趋势判断、老板认知、争议话题。

写法：先给明确判断，再拆普通人为什么会判断错，最后给自己的判断标准。

### 3. 问题解决型

目的：站在客户角度，把他们关心的问题和痛点讲清楚，再给自己的解决方案。

适合：痛点拆解、避坑指南、产品如何解决问题、客户常见问题答疑、方法清单。干货方法并入问题解决型，不单独拆路由。

写法：先说客户正在遇到的具体问题，再拆问题原因，最后给可执行方案或产品对应解决点。

### 4. 案例转化型

目的：用真实案例、产品过程、客户变化证明“这个方案有效”。

适合：案例拆解、成交转化、产品拍摄、前后对比、客户故事。成交转化并入案例转化型，不单独拆路由。

写法：先讲具体对象和处境，再讲采取了什么动作，最后讲结果变化、信任证据和下一步行动。

### 内容形式不是路由

内容路由 = 这条内容为什么拍。

内容形式 = 这条内容怎么拍。

常见内容形式：测评系列、挑战 xx 的一天、vlog 系列、产品实拍系列、客户问题答疑系列、案例复盘系列。

### 账号阶段

第一阶段立人设：优先人设信任型、观点立场型。

第二阶段做矩阵：优先问题解决型、案例转化型。

第三阶段做转化闭环：优先案例转化型、问题解决型。

## 局部优化指令路由

当用户不是要求新写一条内容，而是要求“优化某个局部”，不要重写整篇。先判断优化对象，再调用对应方法论。

### 开头优化

触发词：开头、前3秒、第一句话、钩子、起手、开场。

调用爆款开头库：好奇类、借势类、痛点类、极限类、恐吓类、反差类、利益输送。

输出要求：给 3-5 个可替换开头，并说明每个开头调用了哪类钩子。

### 标题优化

触发词：标题、封面标题、小红书标题、发布标题。

调用规则：利益前置、痛点直击、反差冲突、人群点名、结果承诺。

输出要求：给 5-10 个标题，标注主推版本。

### 结尾优化

触发词：结尾、收尾、评论引导、行动引导、CTA。

调用规则：关系阶梯、评论关键词、资料包、诊断入口、下一步行动。

输出要求：结尾不能硬广，必须让用户知道下一步做什么。

### 结构优化

触发词：结构、节奏、中段、展开、逻辑、太散。

调用规则：趋势机会型、问题解决型、干货速查型，以及线索获客的“问题 -> 解法 -> 方案”。

输出要求：优先保留原选题，只重排段落和推进顺序。

### 口播感优化

触发词：去AI味、口语化、像人说话、太书面、太端着。

调用规则：真人口播、人味检查、删掉空话、少用排比和总结腔。

输出要求：只改表达，不改事实和核心观点。
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd mingyuan/apps/web
npx vitest run __tests__/unit/ip-copywriting-methodology.test.ts
```

Expected: PASS.

### Task 2: Add a Tiny Route Classifier Only If Needed

**Files:**
- Create: `mingyuan/apps/web/src/lib/copywriter-content-route.ts`
- Create: `mingyuan/apps/web/__tests__/unit/copywriter-content-route.test.ts`

**Interfaces:**
- Consumes: `input: string`
- Produces: `classifyCopywriterContentRoute(input): CopywriterContentRoute`

Skip this task if Task 1 produces good outputs in manual AIM tests.

- [ ] **Step 1: Write the failing test**

Create `mingyuan/apps/web/__tests__/unit/copywriter-content-route.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { classifyCopywriterContentRoute } from "@/lib/copywriter-content-route"

describe("classifyCopywriterContentRoute", () => {
  it("routes customer pain and solution content to problem_solution", () => {
    expect(classifyCopywriterContentRoute("客户最关心的问题是获客贵，帮我写一个解决方案")).toBe("problem_solution")
  })

  it("routes case and conversion content to case_conversion", () => {
    expect(classifyCopywriterContentRoute("把这个成交案例拆成一条短视频")).toBe("case_conversion")
  })

  it("routes personal story and vlog content to persona_trust", () => {
    expect(classifyCopywriterContentRoute("写一个挑战老板陪访客户的一天 vlog")).toBe("persona_trust")
  })

  it("routes industry judgment content to opinion_stance", () => {
    expect(classifyCopywriterContentRoute("我想表达一个反常识观点：不要盲目做矩阵")).toBe("opinion_stance")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd mingyuan/apps/web
npx vitest run __tests__/unit/copywriter-content-route.test.ts
```

Expected: FAIL because the file does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `mingyuan/apps/web/src/lib/copywriter-content-route.ts`:

```ts
export type CopywriterContentRoute =
  | "persona_trust"
  | "opinion_stance"
  | "problem_solution"
  | "case_conversion"

export function classifyCopywriterContentRoute(input: string): CopywriterContentRoute {
  const text = input.toLowerCase()

  if (/案例|成交|转化|客户故事|前后对比|复盘/.test(text)) return "case_conversion"
  if (/问题|痛点|解决|方案|避坑|怎么做|方法|清单|答疑/.test(text)) return "problem_solution"
  if (/观点|判断|反常识|误区|趋势|认知|立场/.test(text)) return "opinion_stance"
  if (/人设|信任|来时路|经历|vlog|一天|工作现场|价值观/.test(text)) return "persona_trust"

  return "problem_solution"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd mingyuan/apps/web
npx vitest run __tests__/unit/copywriter-content-route.test.ts
```

Expected: PASS.

### Task 3: Manual AIM Smoke Test

**Files:**
- No code file required.

**Interfaces:**
- Consumes: `deep_copywriter` AIM generation
- Produces: four manually verified outputs

- [ ] **Step 1: Start local app only if not already running**

Run:

```bash
lsof -i :3000
```

If empty:

```bash
cd mingyuan
pnpm dev
```

- [ ] **Step 2: Test four prompts**

Use `deep_copywriter` with these prompts:

```text
写一条人设信任型内容：老板陪客户跑现场的一天。
```

```text
写一条观点立场型内容：不要一上来就做矩阵号。
```

```text
写一条问题解决型内容：客户现在获客贵，不知道该拍什么。
```

```text
写一条案例转化型内容：一个客户通过产品实拍拿到线索。
```

- [ ] **Step 3: Verify output**

Expected:

- 人设信任型：有真实场景和信任来源，不是自我介绍。
- 观点立场型：有明确判断和反常识理由。
- 问题解决型：先讲客户问题，再给解决方案。
- 案例转化型：有对象、动作、变化、行动引导。

## Self-Review

- Spec coverage: covers four content routes, merged 干货方法, merged 成交转化/案例, content form vs route, account stage.
- Obsidian coverage: maps content trust, hook library, seven opening formulas, lead-generation short video method, and reusable short-video structures into either always-on rules or local optimization calls.
- Placeholder scan: no TBD/TODO/fill later.
- Type consistency: optional helper exports `CopywriterContentRoute` and `classifyCopywriterContentRoute(input: string)`.
