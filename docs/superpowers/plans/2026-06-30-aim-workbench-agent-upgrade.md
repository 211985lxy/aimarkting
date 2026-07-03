# AIM Workbench Agent Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the AIM chat box from a plain model conversation into a small workbench controller that can operate editor, generation, self-check, and memory workflows.

**Architecture:** Keep the lazy version: a pure command parser plus a thin UI-side dispatcher. Commands that affect UI state run locally before any model call; content generation and self-check remain in the existing AIM generate/chat routes. No new dependencies, no generic plugin framework.

**Tech Stack:** Next.js App Router, React client state, TypeScript, Vitest, existing `sonner` toast, existing AIM API client.

## Global Constraints

- No mock, fake, stub, fixture fallback, demo data fallback, or simulated provider in production code, preview flows, admin flows, or acceptance flows.
- UI work in `mingyuan/apps/web` must use the existing shadcn/ui components in `src/components/ui`.
- Chat-box workbench operations must execute real UI/data changes before calling the model.
- Keep command parsing deterministic and testable with pure functions.
- Do not add dependencies.
- Preserve current “对标改写” constraints: target length close to original, no near-copy output, one automatic rewrite check.

---

## File Structure

- Create: `mingyuan/apps/web/src/lib/aim-workbench-commands.ts`
  - Pure command parser and command metadata.
  - Owns command ids, aliases, and safety labels.
- Modify: `mingyuan/apps/web/src/lib/aim-editor.ts`
  - Remove workbench command parser from editor helper after migration.
  - Keep only editor text extraction and selection helpers.
- Modify: `mingyuan/apps/web/src/app/(dashboard)/aim/page.tsx`
  - Replace inline command checks with `detectAimWorkbenchCommand()`.
  - Execute local commands before model calls.
  - Add generation/self-check/memory command cases.
- Modify: `mingyuan/apps/web/__tests__/unit/aim-editor.test.ts`
  - Keep editor extraction tests only.
- Create: `mingyuan/apps/web/__tests__/unit/aim-workbench-commands.test.ts`
  - Parser coverage for UI, generation, self-check, and memory commands.
- Modify: `mingyuan/apps/web/__tests__/unit/aim-content-production.test.ts`
  - Keep existing benchmark rewrite/length checks.

---

### Task 1: Extract Workbench Command Parser

**Files:**
- Create: `mingyuan/apps/web/src/lib/aim-workbench-commands.ts`
- Modify: `mingyuan/apps/web/src/lib/aim-editor.ts`
- Create: `mingyuan/apps/web/__tests__/unit/aim-workbench-commands.test.ts`
- Modify: `mingyuan/apps/web/__tests__/unit/aim-editor.test.ts`

**Interfaces:**
- Consumes: raw chat input string.
- Produces:
  - `type AimWorkbenchCommandId`
  - `interface AimWorkbenchCommand`
  - `function detectAimWorkbenchCommand(text: string): AimWorkbenchCommand | null`

- [ ] **Step 1: Write the failing parser test**

Add `mingyuan/apps/web/__tests__/unit/aim-workbench-commands.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { detectAimWorkbenchCommand } from "@/lib/aim-workbench-commands"

describe("aim workbench commands", () => {
  it("detects editor commands", () => {
    expect(detectAimWorkbenchCommand("整合到编辑区")?.id).toBe("integrate_editor")
    expect(detectAimWorkbenchCommand("打开编辑区")?.id).toBe("open_editor")
    expect(detectAimWorkbenchCommand("隐藏文案编辑")?.id).toBe("close_editor")
    expect(detectAimWorkbenchCommand("保存我的稿子到交付物")?.id).toBe("save_editor")
    expect(detectAimWorkbenchCommand("把对标原文填到右侧编辑区")?.id).toBe("fill_reference")
  })

  it("detects generation and quality commands", () => {
    expect(detectAimWorkbenchCommand("重新生成这一版")?.id).toBe("regenerate")
    expect(detectAimWorkbenchCommand("按原文字数重新改写")?.id).toBe("rewrite_benchmark")
    expect(detectAimWorkbenchCommand("检查一下有没有照抄")?.id).toBe("run_quality_check")
  })

  it("detects memory commands without swallowing normal chat", () => {
    expect(detectAimWorkbenchCommand("记住这个偏好")?.id).toBe("remember_preference")
    expect(detectAimWorkbenchCommand("清空当前对话")?.id).toBe("reset_conversation")
    expect(detectAimWorkbenchCommand("帮我改得更口语化")).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/xiangyu/Desktop/明动aim智能体/mingyuan/apps/web
./node_modules/.bin/vitest run __tests__/unit/aim-workbench-commands.test.ts
```

Expected: FAIL because `@/lib/aim-workbench-commands` does not exist.

- [ ] **Step 3: Implement the pure parser**

Create `mingyuan/apps/web/src/lib/aim-workbench-commands.ts`:

```ts
export type AimWorkbenchCommandId =
  | "integrate_editor"
  | "fill_reference"
  | "open_editor"
  | "close_editor"
  | "save_editor"
  | "reset_conversation"
  | "regenerate"
  | "rewrite_benchmark"
  | "run_quality_check"
  | "remember_preference"

export interface AimWorkbenchCommand {
  id: AimWorkbenchCommandId
  input: string
}

const COMMAND_PATTERNS: Array<{ id: AimWorkbenchCommandId; pattern: RegExp }> = [
  { id: "reset_conversation", pattern: /(清空|重置|重新开始).{0,6}(对话|聊天|当前内容)/ },
  { id: "save_editor", pattern: /(保存|同步).{0,8}(编辑稿|编辑区|我的稿子|交付物)/ },
  { id: "open_editor", pattern: /(打开|展开|显示).{0,8}(编辑区|文案编辑|我的稿子)/ },
  { id: "close_editor", pattern: /(隐藏|收起|关闭).{0,8}(编辑区|文案编辑|我的稿子)/ },
  { id: "fill_reference", pattern: /对标原文.*(右侧|文案编辑|对标文案|编辑区)|(右侧|文案编辑|对标文案|编辑区).*对标原文/ },
  { id: "integrate_editor", pattern: /(整合|合并|放|搞|弄|更新|同步).{0,8}编辑区|编辑区.{0,8}(整合|合并|更新|同步)/ },
  { id: "rewrite_benchmark", pattern: /(按原文字数|对标原文|不要照抄|重新洗).{0,12}(重写|改写|再生成)/ },
  { id: "regenerate", pattern: /(重新生成|再生成|重来一版|换一版)/ },
  { id: "run_quality_check", pattern: /(检查|自检|质检).{0,12}(照抄|字数|跑题|AI味|质量)/ },
  { id: "remember_preference", pattern: /(记住|沉淀|保存).{0,8}(偏好|规则|习惯|口吻)/ },
]

export function detectAimWorkbenchCommand(text: string): AimWorkbenchCommand | null {
  const input = text.trim()
  if (!input) return null
  const command = COMMAND_PATTERNS.find((item) => item.pattern.test(input))
  return command ? { id: command.id, input } : null
}
```

- [ ] **Step 4: Move parser import out of `aim-editor.ts`**

Modify `mingyuan/apps/web/src/lib/aim-editor.ts`:

```ts
// Delete these exports from aim-editor.ts:
// export type AimWorkbenchCommand = ...
// export function detectAimWorkbenchCommand(...)
```

Modify `mingyuan/apps/web/__tests__/unit/aim-editor.test.ts`:

```ts
// Remove detectAimWorkbenchCommand from imports.
// Remove the "detects local workbench commands before calling the model" test.
```

- [ ] **Step 5: Run parser and editor tests**

Run:

```bash
cd /Users/xiangyu/Desktop/明动aim智能体/mingyuan/apps/web
./node_modules/.bin/vitest run __tests__/unit/aim-workbench-commands.test.ts __tests__/unit/aim-editor.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/aim-workbench-commands.ts src/lib/aim-editor.ts __tests__/unit/aim-workbench-commands.test.ts __tests__/unit/aim-editor.test.ts
git commit -m "refactor: extract AIM workbench command parser"
```

---

### Task 2: Centralize Local Command Dispatch

**Files:**
- Modify: `mingyuan/apps/web/src/app/(dashboard)/aim/page.tsx`

**Interfaces:**
- Consumes: `AimWorkbenchCommand` from `@/lib/aim-workbench-commands`.
- Produces:
  - `runWorkbenchCommand(command: AimWorkbenchCommand): boolean`
  - Local execution before model calls in `sendText()`.

- [ ] **Step 1: Update imports**

In `mingyuan/apps/web/src/app/(dashboard)/aim/page.tsx`, replace the parser import:

```ts
import { detectAimWorkbenchCommand, type AimWorkbenchCommand } from "@/lib/aim-workbench-commands"
```

Remove `detectAimWorkbenchCommand` from the `@/lib/aim-editor` import.

- [ ] **Step 2: Change dispatcher signature**

Replace:

```ts
function runWorkbenchCommand(text: string) {
  const command = detectAimWorkbenchCommand(text)
  if (!command) return false
  setInput("")

  if (command === "integrate_editor") return integrateLatestAssistantDraftToEditor()
  if (command === "fill_reference") return fillReferenceTextFromConversation(text)
  ...
}
```

With:

```ts
function runWorkbenchCommand(command: AimWorkbenchCommand) {
  setInput("")

  if (command.id === "integrate_editor") return integrateLatestAssistantDraftToEditor()
  if (command.id === "fill_reference") return fillReferenceTextFromConversation(command.input)
  if (command.id === "open_editor") {
    setEditorPanelOpen(true)
    toast.success("已打开右侧编辑区")
    return true
  }
  if (command.id === "close_editor") {
    setEditorPanelOpen(false)
    toast.success("已隐藏右侧编辑区")
    return true
  }
  if (command.id === "save_editor") return saveEditorToDeliverable()
  if (command.id === "reset_conversation") {
    resetConversation()
    toast.success("已清空当前对话")
    return true
  }
  return false
}
```

- [ ] **Step 3: Route commands before model calls**

In `sendText()`, replace:

```ts
if (runWorkbenchCommand(text)) return
```

With:

```ts
const command = detectAimWorkbenchCommand(text)
if (command && runWorkbenchCommand(command)) return
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
cd /Users/xiangyu/Desktop/明动aim智能体/mingyuan/apps/web
./node_modules/.bin/vitest run __tests__/unit/aim-workbench-commands.test.ts __tests__/unit/aim-editor.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/aim/page.tsx
git commit -m "refactor: centralize AIM workbench command dispatch"
```

---

### Task 3: Add Generation Commands

**Files:**
- Modify: `mingyuan/apps/web/src/app/(dashboard)/aim/page.tsx`
- Modify: `mingyuan/apps/web/src/lib/aim-workbench-commands.ts`
- Modify: `mingyuan/apps/web/__tests__/unit/aim-workbench-commands.test.ts`

**Interfaces:**
- Consumes: existing `handleGenerate()`, `input`, `editorText`, `sourceOriginalText`, `sourceVideoCopyExtractionId`.
- Produces:
  - Chat commands that call existing generation pipeline:
    - `regenerate`
    - `rewrite_benchmark`

- [ ] **Step 1: Add parser cases if missing**

Ensure `mingyuan/apps/web/src/lib/aim-workbench-commands.ts` contains:

```ts
{ id: "rewrite_benchmark", pattern: /(按原文字数|对标原文|不要照抄|重新洗).{0,12}(重写|改写|再生成)/ },
{ id: "regenerate", pattern: /(重新生成|再生成|重来一版|换一版)/ },
```

- [ ] **Step 2: Add command implementation**

In `mingyuan/apps/web/src/app/(dashboard)/aim/page.tsx`, add before `runWorkbenchCommand()`:

```ts
function setInputAndGenerate(nextInput: string) {
  setInput(nextInput)
  setTimeout(() => {
    void handleGenerate()
  }, 0)
  return true
}
```

Then extend `runWorkbenchCommand()`:

```ts
if (command.id === "regenerate") {
  const nextInput = input.trim() || editorText.trim() || "基于当前素材重新生成一版。"
  toast.success("已开始重新生成")
  return setInputAndGenerate(nextInput)
}
if (command.id === "rewrite_benchmark") {
  const nextInput = [
    "请基于当前对标原文重新改写。",
    "硬要求：字数贴近原文；不能照抄原句；开头、案例、过渡句、行动引导至少两类重写。",
    editorText.trim() ? `当前稿：\n${editorText.trim()}` : null,
  ].filter(Boolean).join("\n\n")
  toast.success("已按对标重写规则重新生成")
  return setInputAndGenerate(nextInput)
}
```

- [ ] **Step 3: Fix stale-state risk**

If `handleGenerate()` reads `input` before React state updates in local testing, replace `setInputAndGenerate()` with an explicit generate function:

```ts
async function generateFromCommand(nextInput: string) {
  setInput(nextInput)
  await sendText(nextInput)
}
```

Use this fallback only if Step 2 fails manual testing. Do not keep both paths.

- [ ] **Step 4: Run tests**

Run:

```bash
cd /Users/xiangyu/Desktop/明动aim智能体/mingyuan/apps/web
./node_modules/.bin/vitest run __tests__/unit/aim-workbench-commands.test.ts __tests__/unit/aim-content-production.test.ts
```

Expected: PASS.

- [ ] **Step 5: Manual verification**

In the running AIM page:

1. Type `重新生成这一版`.
2. Expected: generation starts; no normal assistant chat bubble claiming it will do it later.
3. Type `按原文字数重新改写`.
4. Expected: generation starts with benchmark rules.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/aim/page.tsx src/lib/aim-workbench-commands.ts __tests__/unit/aim-workbench-commands.test.ts
git commit -m "feat: let AIM chat trigger generation commands"
```

---

### Task 4: Add Self-Check Command

**Files:**
- Modify: `mingyuan/apps/web/src/app/(dashboard)/aim/page.tsx`
- Modify: `mingyuan/apps/web/src/lib/aim-workbench-commands.ts`
- Modify: `mingyuan/apps/web/__tests__/unit/aim-workbench-commands.test.ts`

**Interfaces:**
- Consumes: existing `checkScriptQuality`, `handleQuality(messageId)`, `messages`, `editorText`.
- Produces:
  - Command `run_quality_check` that runs the real existing quality check on the latest deliverable when available.

- [ ] **Step 1: Add helper to find latest assistant deliverable**

In `mingyuan/apps/web/src/app/(dashboard)/aim/page.tsx`, add near `latestDeliverableId()`:

```ts
function latestDeliverableMessageId() {
  return [...messages].reverse().find((message) => message.deliverables?.id)?.id
}
```

- [ ] **Step 2: Add command implementation**

Extend `runWorkbenchCommand()`:

```ts
if (command.id === "run_quality_check") {
  const messageId = latestDeliverableMessageId()
  if (!messageId) {
    toast.error("当前没有可质检的生成结果")
    return true
  }
  void handleQuality(messageId)
  toast.success("已开始质检")
  return true
}
```

- [ ] **Step 3: Run tests**

Run:

```bash
cd /Users/xiangyu/Desktop/明动aim智能体/mingyuan/apps/web
./node_modules/.bin/vitest run __tests__/unit/aim-workbench-commands.test.ts
```

Expected: PASS.

- [ ] **Step 4: Manual verification**

1. Generate a script.
2. Type `检查一下有没有照抄`.
3. Expected: latest deliverable quality check starts; no fake assistant response.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/aim/page.tsx src/lib/aim-workbench-commands.ts __tests__/unit/aim-workbench-commands.test.ts
git commit -m "feat: let AIM chat trigger quality checks"
```

---

### Task 5: Add Memory Preference Command

**Files:**
- Modify: `mingyuan/apps/web/src/app/(dashboard)/aim/page.tsx`
- Modify: `mingyuan/apps/web/src/lib/aim-workbench-commands.ts`
- Modify: `mingyuan/apps/web/__tests__/unit/aim-workbench-commands.test.ts`

**Interfaces:**
- Consumes: existing `evolveStyleConversation()` and current `messages`.
- Produces:
  - Command `remember_preference`.
  - Confirmation toast on successful style evolution.

- [ ] **Step 1: Add command implementation**

Extend `runWorkbenchCommand()`:

```ts
if (command.id === "remember_preference") {
  const contextMessages = [
    ...messages.map((message) => ({ role: message.role, content: message.content })),
    { role: "user" as const, content: command.input },
  ].slice(-8)
  void evolveStyleConversation({ messages: contextMessages })
    .then((result) => {
      if (result.delta) toast.success("已沉淀为写作偏好")
      else toast.info(result.reason || "这句话没有形成稳定偏好")
    })
    .catch(() => toast.error("偏好沉淀失败"))
  return true
}
```

- [ ] **Step 2: Preserve confirmation boundary**

Do not auto-save arbitrary facts from chat. Keep this command explicit: it only runs when the user says `记住这个偏好` or equivalent.

- [ ] **Step 3: Run tests**

Run:

```bash
cd /Users/xiangyu/Desktop/明动aim智能体/mingyuan/apps/web
./node_modules/.bin/vitest run __tests__/unit/aim-workbench-commands.test.ts __tests__/unit/aim-style-evolution.test.ts
```

Expected: PASS.

- [ ] **Step 4: Manual verification**

1. Type `记住这个偏好：以后口播少用排比句`.
2. Expected: real `evolveStyleConversation()` request fires and toast confirms result.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/aim/page.tsx src/lib/aim-workbench-commands.ts __tests__/unit/aim-workbench-commands.test.ts
git commit -m "feat: let AIM chat save explicit writing preferences"
```

---

## Self-Review

**Spec coverage:** The plan covers the practical four-layer upgrade: perception via deterministic command parsing, action via local UI dispatch, reflection via quality check command, and memory via explicit preference save. It does not implement a generic Agent platform because the current product needs a workbench controller, not a framework.

**Placeholder scan:** No task uses TBD/TODO/fill-in language. The only conditional path is Task 3 Step 3, which gives an exact replacement if React state timing fails manual verification.

**Type consistency:** `AimWorkbenchCommand.id` is used consistently in parser tests and page dispatch. Command ids in tests match the union type in Task 1.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-30-aim-workbench-agent-upgrade.md`. Two execution options:

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
