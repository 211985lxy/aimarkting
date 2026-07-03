# 阶段三：体验完善 — 分批输入能力下沉为通用能力

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将阶段二 persona 前采的"分批输入 + 确认式交互"抽象为通用能力，适用于知识条目批量导入、竞品资料输入、长文案素材输入等场景。前端检测长文本后提示用户分批发送。

**Architecture:** 新增 `batch-input-utils.ts` 工具模块，提供文本长度检测、分批提示生成、累积缓冲管理。在前端 prompt composer 中集成检测逻辑。后端 persona agent 已在阶段二实现确认式交互，此阶段只做通用化。

**Tech Stack:** TypeScript, React, Next.js 16

**关联 Spec:** `docs/superpowers/specs/2026-07-03-cyber-vibes-upgrade-plan.md` 第三部分 阶段三 特性 3.1

## Global Constraints

- 不改后端 agent 逻辑（persona 的确认式交互已在阶段二完成）
- 前端提示是 advisory（建议分批），不是 blocking（不阻止发送）
- 分批阈值可配置，默认 3000 字
- 不引入新的 Prisma model 或 API route（纯前端 + 工具函数）

---

## File Structure

### 新增文件
| 文件 | 职责 |
|------|------|
| `src/lib/batch-input-utils.ts` | 分批输入工具函数：长度检测、分批建议、阈值配置 |
| `__tests__/unit/batch-input-utils.test.ts` | 工具函数单元测试 |

### 修改文件
| 文件 | 修改内容 |
|------|---------|
| `src/components/aim/aim-prompt-composer.tsx` | 在用户输入后、发送前检测文本长度，超阈值时显示分批提示 |

---

### Task 1: 创建分批输入工具模块

**Files:**
- Create: `src/lib/batch-input-utils.ts`
- Test: `__tests__/unit/batch-input-utils.test.ts`

**Interfaces:**
- Consumes: 无外部依赖（纯工具函数）
- Produces: `shouldSuggestBatch(text)`, `getBatchSuggestion(text)`, `BATCH_INPUT_THRESHOLD`

- [ ] **Step 1: 写失败的测试**

```typescript
// __tests__/unit/batch-input-utils.test.ts
import { describe, it, expect } from "vitest"
import {
  BATCH_INPUT_THRESHOLD,
  shouldSuggestBatch,
  getBatchSuggestion,
} from "@/lib/batch-input-utils"

describe("batch-input-utils", () => {
  it("should have configurable threshold", () => {
    expect(BATCH_INPUT_THRESHOLD).toBeGreaterThan(0)
  })

  it("should suggest batch for long text", () => {
    const longText = "字".repeat(BATCH_INPUT_THRESHOLD + 1)
    expect(shouldSuggestBatch(longText)).toBe(true)
  })

  it("should NOT suggest batch for short text", () => {
    expect(shouldSuggestBatch("这是一段短文本")).toBe(false)
  })

  it("should NOT suggest batch for text at exactly threshold", () => {
    const exactText = "字".repeat(BATCH_INPUT_THRESHOLD)
    expect(shouldSuggestBatch(exactText)).toBe(false)
  })

  it("should return suggestion with char count", () => {
    const longText = "字".repeat(5000)
    const suggestion = getBatchSuggestion(longText)
    expect(suggestion.shouldSuggest).toBe(true)
    expect(suggestion.charCount).toBe(5000)
    expect(suggestion.message).toContain("字")
  })

  it("should return no suggestion for short text", () => {
    const suggestion = getBatchSuggestion("短文本")
    expect(suggestion.shouldSuggest).toBe(false)
    expect(suggestion.message).toBe("")
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/batch-input-utils.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现工具模块**

```typescript
// src/lib/batch-input-utils.ts

/**
 * 分批输入工具
 *
 * 当用户输入的文本超过阈值时，建议分批发送。
 * 这是 advisory（建议），不是 blocking（不阻止发送）。
 */

/** 分批建议阈值（字符数），超过此长度建议分批 */
export const BATCH_INPUT_THRESHOLD = 3000

export interface BatchSuggestion {
  shouldSuggest: boolean
  charCount: number
  message: string
}

/** 判断是否建议分批 */
export function shouldSuggestBatch(text: string): boolean {
  return text.length > BATCH_INPUT_THRESHOLD
}

/** 获取分批建议（含提示文案） */
export function getBatchSuggestion(text: string): BatchSuggestion {
  if (!shouldSuggestBatch(text)) {
    return { shouldSuggest: false, charCount: text.length, message: "" }
  }

  const estimatedChunks = Math.ceil(text.length / BATCH_INPUT_THRESHOLD)
  return {
    shouldSuggest: true,
    charCount: text.length,
    message: `输入内容较长（${text.length} 字），建议分 ${estimatedChunks} 批发送。发送后可继续输入下一批，最后说"开始整理"或直接发送指令即可。`,
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/batch-input-utils.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/lib/batch-input-utils.ts __tests__/unit/batch-input-utils.test.ts
git commit -m "feat: add batch input utility for long text detection and suggestions"
```

---

### Task 2: 前端 prompt composer 集成分批提示

**Files:**
- Modify: `src/components/aim/aim-prompt-composer.tsx`
- Test: 手动测试（前端组件不在单元测试范围）

**Interfaces:**
- Consumes: `getBatchSuggestion` from task 1
- Produces: 用户在 composer 中输入长文本后，发送前显示分批建议 toast/banner

- [ ] **Step 1: 在 aim-prompt-composer.tsx 中导入工具**

```typescript
import { getBatchSuggestion } from "@/lib/batch-input-utils"
```

- [ ] **Step 2: 在发送前的 handler 中检测文本长度**

在用户点击发送按钮的 handler 中（或 onSubmit 回调中），在发送前检测：

```typescript
const suggestion = getBatchSuggestion(inputText)
if (suggestion.shouldSuggest) {
  // 显示提示（非阻塞），用户可选择忽略继续发送或分批
  // 使用现有的 toast 或 inline message 组件
  showBatchSuggestion(suggestion.message)
  // 不阻止发送，只是提示
}
```

- [ ] **Step 3: 确认提示样式与现有 UI 一致**

使用项目现有的 `shadcn/ui` 组件（toast 或 alert），保持视觉一致性。

- [ ] **Step 4: 手动测试**

1. 在 AIM 页面输入超过 3000 字的文本
2. 点击发送，应看到分批建议提示
3. 提示不应阻止发送
4. 短文本不应显示提示

- [ ] **Step 5: 提交**

```bash
git add src/components/aim/aim-prompt-composer.tsx
git commit -m "feat: integrate batch input suggestion in AIM prompt composer"
```

---

## Self-Review

1. **Spec 覆盖**：阶段三的特性 3.1（分批输入能力下沉）完全覆盖
2. **占位符扫描**：无 TBD/TODO
3. **类型一致性**：BATCH_INPUT_THRESHOLD 在 task 1 定义，task 2 引用
4. **向后兼容**：分批提示是 advisory，不改变现有发送行为
5. **范围控制**：此阶段非常轻量（2 个 task），符合"体验完善"的定位
