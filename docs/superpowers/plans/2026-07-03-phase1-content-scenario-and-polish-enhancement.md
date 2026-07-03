# 阶段一：高杠杆增强 — 内容场景化 + 口播结构切换 + 风格选择器

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 content_producer 内引入 5 种内容场景模式，让文案生成按场景走专属 prompt 和知识策略；同时在选题卡片支持口播结构切换，在改文案 Agent 增加风格选择器。

**Architecture:** 新增 `ContentScenario` 枚举和场景配置表 `content-scenario-config.ts`。场景 prompt 在 `buildProducerSystemPrompt` 中按 scenario 注入。知识策略在 `aim-knowledge-strategy.ts` 中新增 3 个场景档。口播结构切换复用现有 `CopyStructure`。风格选择器在 `polishCopy` 中增加 `styleId` 参数，风格定义存为 `KnowledgeEntry`。

**Tech Stack:** TypeScript, Next.js 16, Prisma 7, existing LLM client

**关联 Spec:** `docs/superpowers/specs/2026-07-03-cyber-vibes-upgrade-plan.md` 第三部分 阶段一

## Global Constraints

- 不拆 agent，场景在 content_producer 内通过枚举 + prompt 注入实现
- 不引入新的 Prisma model（ContentScenario 不持久化，只在运行时传递）
- 风格数据存为 `KnowledgeEntry`（category: `style_guide`），不建新表
- 口播结构切换不重新生成选题，只换表达结构
- 所有场景共享 content_producer 的质检、多模型路由、知识注入能力
- 遵循现有 TDD 模式（单元测试在 `__tests__/unit/` 下）
- 禁用词列表（93 词）和质量门保持不变

---

## File Structure

### 新增文件
| 文件 | 职责 |
|------|------|
| `src/lib/content-scenario-config.ts` | ContentScenario 枚举 + 5 种场景的 prompt 块和质检侧重配置 |
| `__tests__/unit/content-scenario-config.test.ts` | 场景配置的单元测试 |
| `__tests__/unit/content-scenario-prompt.test.ts` | 验证场景 prompt 注入的测试 |
| `__tests__/unit/polish-copy-styles.test.ts` | 改文案风格选择器测试 |

### 修改文件
| 文件 | 修改内容 |
|------|---------|
| `src/lib/aim-knowledge-strategy.ts:16-22` | ResolvedKnowledgeStrategy 增加 3 个场景档；KNOWLEDGE_STRATEGY_PROFILES 增加对应 profile；resolveKnowledgeStrategy 增加场景优先级 |
| `src/lib/aim-agent-handlers.ts:33-107` | AimGenerateContext 增加 `contentScenario?` 字段；buildProducerSystemPrompt 按 scenario 注入场景 prompt |
| `src/lib/aim-agent-handlers.ts:1031-1170` | buildAimGeneration 传入 contentScenario 到 context 和知识策略解析 |
| `src/lib/aim-agents/script-agent.ts:10-54` | polishCopy 增加 `styleId?` 参数，按 styleId 加载对应风格 prompt 注入 |
| `src/lib/aim-generator.ts:16` | AimTaskType 不变，但在 generateAimContent 的 AimInput 中增加 `contentScenario?` |
| `prisma/schema.prisma` | 不改（ContentScenario 运行时传递即可） |

---

### Task 1: 创建内容场景配置模块

**Files:**
- Create: `src/lib/content-scenario-config.ts`
- Test: `__tests__/unit/content-scenario-config.test.ts`

**Interfaces:**
- Consumes: 无外部依赖（纯配置）
- Produces: `ContentScenario` 类型、`SCENARIO_CONFIGS` 配置对象、`getScenarioConfig(scenario)` 函数、`buildScenarioPromptBlock(scenario)` 函数

- [ ] **Step 1: 写失败的测试**

```typescript
// __tests__/unit/content-scenario-config.test.ts
import { describe, it, expect } from "vitest"
import {
  ContentScenario,
  getScenarioConfig,
  buildScenarioPromptBlock,
  SCENARIO_LABELS,
} from "@/lib/content-scenario-config"

describe("content-scenario-config", () => {
  it("should export 5 scenarios", () => {
    const scenarios: ContentScenario[] = [
      "ip_knowledge",
      "entity_local",
      "traffic_conversion",
      "xhs_planting",
      "kol_explore",
    ]
    expect(Object.keys(SCENARIO_LABELS)).toEqual(
      expect.arrayContaining(scenarios)
    )
  })

  it("should return config for each scenario", () => {
    for (const s of Object.keys(SCENARIO_LABELS) as ContentScenario[]) {
      const config = getScenarioConfig(s)
      expect(config).toBeDefined()
      expect(config.promptBlock).toContain("你的核心任务")
      expect(config.knowledgeStrategy).toBeDefined()
      expect(config.qualityFocus).toBeDefined()
    }
  })

  it("should build prompt block for traffic_conversion", () => {
    const block = buildScenarioPromptBlock("traffic_conversion")
    expect(block).toContain("3秒")
    expect(block).toContain("CTA")
  })

  it("should build prompt block for kol_explore", () => {
    const block = buildScenarioPromptBlock("kol_explore")
    expect(block).toContain("感官爆点")
  })

  it("should return empty string for undefined scenario", () => {
    const block = buildScenarioPromptBlock(undefined)
    expect(block).toBe("")
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/content-scenario-config.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现场景配置模块**

```typescript
// src/lib/content-scenario-config.ts

/**
 * 内容场景模式
 *
 * 在 content_producer 内部按场景区分 prompt 和知识策略，
 * 而非拆成独立 agent。所有场景共享质检、多模型路由、知识注入。
 */
export type ContentScenario =
  | "ip_knowledge"
  | "entity_local"
  | "traffic_conversion"
  | "xhs_planting"
  | "kol_explore"

/** 场景配置 */
interface ScenarioConfig {
  /** 场景专属 prompt 块，注入到 system prompt */
  promptBlock: string
  /** 该场景对应的知识策略档 */
  knowledgeStrategy: "persona" | "conversion" | "traffic" | "hot_topic" | "deep"
  /** 该场景质检的侧重点（提示质检重点关注什么维度） */
  qualityFocus: string
}

/** 场景中文标签（前端展示用） */
export const SCENARIO_LABELS: Record<ContentScenario, string> = {
  ip_knowledge: "IP 知识型口播",
  entity_local: "实体/本地获客",
  traffic_conversion: "投流转化文案",
  xhs_planting: "小红书种草",
  kol_explore: "KOL 探店",
}

const SCENARIO_CONFIGS: Record<ContentScenario, ScenarioConfig> = {
  ip_knowledge: {
    promptBlock: `【内容场景：IP 知识型口播】
你的核心任务：让用户觉得"这个人懂我、懂行业、值得关注、值得咨询"。
写作要点：
- 人设身份先行：每条内容必须体现 IP 的专业身份和行业判断力
- 观点驱动：以独特观点或反常识判断开头，而非描述性陈述
- 论据来自经验：用老板亲身经历、项目案例、客户反馈作为论据，不要泛泛而谈
- 结尾引导互动：引导评论、私信咨询，而非硬性转化
- 语气：专业但接地气，像一个在行业摸爬滚打多年的过来人在跟朋友聊天`,
    knowledgeStrategy: "persona",
    qualityFocus: "人设匹配度 + 观点独特性",
  },
  entity_local: {
    promptBlock: `【内容场景：实体/本地获客】
你的核心任务：让附近的人刷到你、信任你、进店、私信、预约、咨询。
写作要点：
- 门店信息前置：提到位置、产品、到店理由
- 痛点+解决方案结构：直接切入客户最核心的痛点，然后给出你的方案
- 到店理由必须具体：不是"欢迎光临"，而是"来体验一次你就知道区别"
- 团购/优惠信息自然嵌入：不要硬推，在结尾自然带出
- 本地化语言：用当地人的说话方式，提本地地标或生活场景
- 语气：热情直接，像一个靠谱的邻居在推荐`,
    knowledgeStrategy: "conversion",
    qualityFocus: "转化引导力 + 到店理由具体性",
  },
  traffic_conversion: {
    promptBlock: `【内容场景：投流转化文案】
你的核心任务：开头 3 秒抓人、卖点密集排列、强 CTA 促转化。
写作要点：
- 前 3 秒必须有强钩子：冲突/数字/反常识/痛点直击，不允许缓慢铺垫
- 卖点呈现：每个卖点一句话，用"不是…而是…"或数字对比强化
- 信任背书紧随卖点：每个卖点后面跟一个客户案例/数据/权威背书
- 价格刺激：明确标价、限时、限量、对比原价
- 强 CTA：结尾必须有明确的行动指令（点击下方/立即预约/马上抢），不要软性引导
- 篇幅控制：300 字以内，信息密度极高，不允许任何废话
- 语气：急促有力，像一个金牌销售在 30 秒内完成推销`,
    knowledgeStrategy: "conversion",
    qualityFocus: "CTA 强度 + 开头 3 秒钩子 + 信息密度",
  },
  xhs_planting: {
    promptBlock: `【内容场景：小红书种草笔记】
你的核心任务：写得像真实用户分享，让人觉得"这个东西适合我"。
写作要点：
- 第一人称体验视角：用"我"、"真的"、"终于找到"等真实感词汇
- 场景化描述：不是列参数，而是描述使用场景和感受
- 痛点共鸣开头：先说"之前一直困扰我的问题是…"再引出产品
- 真实感细节：提到具体使用频率、持续天数、对比之前的感受
- 标签化结尾：用 emoji + 简短标签总结（✅ xx ✨ xx）
- 语气：像一个真实消费者在跟闺蜜分享好物，不要官方腔`,
    knowledgeStrategy: "traffic",
    qualityFocus: "真实感 + 场景具体性 + 种草感",
  },
  kol_explore: {
    promptBlock: `【内容场景：KOL 探店文案】
你的核心任务：写出让人想立刻去打卡的探店内容。四要素缺一不可。
写作要点：
- 感官爆点：描述视觉/嗅觉/味觉/触觉的具体感受（"牛油锅底现炒的那个呛香味轰一下上来"）
- 信任背书：老板资历、原料来源、工艺特色、行业认证
- 稀缺故事：这家店"别人没有"的独特之处（独家配方/隐藏菜单/独特经历）
- 场景体验：描述具体的到店体验流程（坐下→点单→上菜→第一口→感受）
- 团购/优惠自然嵌入：在体验描述的高潮点之后自然带出
- 语气：像一个资深吃货/探店达人在分享私藏好店`,
    knowledgeStrategy: "conversion",
    qualityFocus: "感官爆点完整度 + 信任背书 + 场景体验感",
  },
}

export function getScenarioConfig(scenario: ContentScenario): ScenarioConfig {
  return SCENARIO_CONFIGS[scenario]
}

export function buildScenarioPromptBlock(scenario?: ContentScenario): string {
  if (!scenario) return ""
  const config = SCENARIO_CONFIGS[scenario]
  return `\n${config.promptBlock}`
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/content-scenario-config.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/lib/content-scenario-config.ts __tests__/unit/content-scenario-config.test.ts
git commit -m "feat: add content scenario config with 5 scenarios"
```

---

### Task 2: 在知识策略中增加场景优先级

**Files:**
- Modify: `src/lib/aim-knowledge-strategy.ts:16-22,51-100,109-122,193-215`
- Test: `__tests__/unit/content-scenario-knowledge-strategy.test.ts`

**Interfaces:**
- Consumes: `ContentScenario` from `src/lib/content-scenario-config.ts`
- Produces: `ResolveKnowledgeStrategyInput.contentScenario?` — 新增字段

- [ ] **Step 1: 写失败的测试**

```typescript
// __tests__/unit/content-scenario-knowledge-strategy.test.ts
import { describe, it, expect } from "vitest"
import { resolveKnowledgeStrategy } from "@/lib/aim-knowledge-strategy"

describe("content scenario knowledge strategy resolution", () => {
  it("traffic_conversion should resolve to conversion strategy", () => {
    const result = resolveKnowledgeStrategy({
      contentScenario: "traffic_conversion",
    })
    expect(result).toBe("conversion")
  })

  it("ip_knowledge should resolve to persona strategy", () => {
    const result = resolveKnowledgeStrategy({
      contentScenario: "ip_knowledge",
    })
    expect(result).toBe("persona")
  })

  it("entity_local should resolve to conversion strategy", () => {
    const result = resolveKnowledgeStrategy({
      contentScenario: "entity_local",
    })
    expect(result).toBe("conversion")
  })

  it("xhs_planting should resolve to traffic strategy", () => {
    const result = resolveKnowledgeStrategy({
      contentScenario: "xhs_planting",
    })
    expect(result).toBe("traffic")
  })

  it("kol_explore should resolve to conversion strategy", () => {
    const result = resolveKnowledgeStrategy({
      contentScenario: "kol_explore",
    })
    expect(result).toBe("conversion")
  })

  it("scenario should take priority over topicType", () => {
    // Even if topicType is 人设型, scenario traffic_conversion should win
    const result = resolveKnowledgeStrategy({
      contentScenario: "traffic_conversion",
      topicType: "人设型",
    })
    expect(result).toBe("conversion")
  })

  it("no scenario should fall through to existing logic", () => {
    const result = resolveKnowledgeStrategy({
      topicType: "转化型",
    })
    expect(result).toBe("conversion")
  })

  it("light_edit runtime task should still override scenario", () => {
    const result = resolveKnowledgeStrategy({
      contentScenario: "traffic_conversion",
      runtimeTask: "light_edit",
    })
    // light_edit is highest priority, should still win
    expect(result).toBe("light_edit")
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/content-scenario-knowledge-strategy.test.ts`
Expected: FAIL — `contentScenario` not in input type

- [ ] **Step 3: 修改知识策略**

在 `src/lib/aim-knowledge-strategy.ts` 中：

1. `ResolveKnowledgeStrategyInput` 增加 `contentScenario?: ContentScenario` 字段（从 content-scenario-config 导入类型）
2. `resolveKnowledgeStrategy` 函数中，在轻改润色判断之后、热点判断之前，增加场景优先级分支：

```typescript
// 在 resolveKnowledgeStrategy 函数中，步骤 1 之后增加步骤 2：
// 2. 内容场景档：场景模式的优先级仅次于轻改润色
if (input.contentScenario) {
  const scenarioConfig = getScenarioConfig(input.contentScenario)
  return scenarioConfig.knowledgeStrategy
}
// 原来的步骤 2（热点）变为步骤 3，以此类推
```

需要从 `content-scenario-config` 导入 `getScenarioConfig`。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/content-scenario-knowledge-strategy.test.ts`
Expected: PASS

- [ ] **Step 5: 运行现有知识策略测试确认无回归**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/aim-knowledge-strategy.test.ts`
Expected: PASS（所有现有测试不受影响）

- [ ] **Step 6: 提交**

```bash
git add src/lib/aim-knowledge-strategy.ts __tests__/unit/content-scenario-knowledge-strategy.test.ts
git commit -m "feat: add content scenario priority in knowledge strategy resolution"
```

---

### Task 3: 在 buildAimGeneration 中传递 contentScenario

**Files:**
- Modify: `src/lib/aim-agent-handlers.ts:57-86` (AimGenerateContext 增加 contentScenario)
- Modify: `src/lib/aim-agent-handlers.ts:1031-1170` (buildAimGeneration 传入)
- Modify: `src/lib/aim-generator.ts` (AimInput 增加 contentScenario)
- Test: `__tests__/unit/content-scenario-prompt.test.ts`

**Interfaces:**
- Consumes: `ContentScenario` from task 1
- Produces: `AimGenerateContext.contentScenario` — 传递到 handler.generate() 和知识策略解析

- [ ] **Step 1: 写失败的测试**

```typescript
// __tests__/unit/content-scenario-prompt.test.ts
import { describe, it, expect } from "vitest"
import { buildScenarioPromptBlock } from "@/lib/content-scenario-config"

describe("scenario prompt injection", () => {
  it("should produce non-empty block for each scenario", () => {
    const scenarios = ["ip_knowledge", "entity_local", "traffic_conversion", "xhs_planting", "kol_explore"] as const
    for (const s of scenarios) {
      const block = buildScenarioPromptBlock(s)
      expect(block.length).toBeGreaterThan(50)
      expect(block).toContain("你的核心任务")
    }
  })

  it("should not contain AI-sounding phrases", () => {
    const scenarios = ["ip_knowledge", "entity_local", "traffic_conversion", "xhs_planting", "kol_explore"] as const
    const forbidden = ["赋能", "闭环", "抓手", "颗粒度", "对齐", "拉通"]
    for (const s of scenarios) {
      const block = buildScenarioPromptBlock(s)
      for (const word of forbidden) {
        expect(block).not.toContain(word)
      }
    }
  })
})
```

- [ ] **Step 2: 运行测试**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/content-scenario-prompt.test.ts`
Expected: PASS（已由 task 1 的实现覆盖）

- [ ] **Step 3: 修改 AimGenerateContext 类型**

在 `src/lib/aim-agent-handlers.ts` 的 `AimGenerateContext` 接口中增加：

```typescript
/** 内容场景模式（可选，决定 prompt 和知识策略） */
contentScenario?: import("@/lib/content-scenario-config").ContentScenario
```

- [ ] **Step 4: 修改 buildProducerSystemPrompt**

在 `buildProducerSystemPrompt` 中（或 ContentProducerHandler.generate() 中），在 formatBlocks 之后注入场景 prompt：

```typescript
const scenarioBlock = buildScenarioPromptBlock(context.contentScenario)
// 将 scenarioBlock 追加到 systemPrompt 中
```

- [ ] **Step 5: 修改 buildAimGeneration 传入**

在 `buildAimGeneration` 函数中，将 `contentScenario` 传入 `resolveKnowledgeStrategy`：

```typescript
const knowledgeStrategy = resolveKnowledgeStrategy({
  ...existingInput,
  contentScenario: params.contentScenario, // 新增
})
```

- [ ] **Step 6: 修改 AimInput 类型**

在 `src/lib/aim-generator.ts` 的 `AimInput` 接口中增加 `contentScenario?`，并在 `generateAimContent` 中传递到 `buildAimGeneration`。

- [ ] **Step 7: 运行所有相关测试**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/content-scenario-*.test.ts __tests__/unit/aim-knowledge-strategy.test.ts`
Expected: ALL PASS

- [ ] **Step 8: 提交**

```bash
git add src/lib/aim-agent-handlers.ts src/lib/aim-generator.ts __tests__/unit/content-scenario-prompt.test.ts
git commit -m "feat: pass contentScenario through generate pipeline and inject into prompt"
```

---

### Task 4: 口播结构显式切换

**Files:**
- Modify: `src/lib/aim-agents/script-agent.ts` — writeScript 增加可选 `structureCode?` 参数
- Test: `__tests__/unit/script-structure-switch.test.ts`

**Interfaces:**
- Consumes: `CopyStructure` 从 Prisma 读取（现有 `buildViralStructureBlock`）
- Produces: `writeScript(input)` 增加 `structureCode?: string` — 指定使用哪种 CopyStructure

- [ ] **Step 1: 写失败的测试**

```typescript
// __tests__/unit/script-structure-switch.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    copyStructure: { findMany: vi.fn() },
    openingType: { findMany: vi.fn() },
    endingType: { findMany: vi.fn() },
    knowledgeEntry: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock("@/lib/ip-copywriting-methodology", () => ({
  buildIpCopywritingMethodologyBlock: vi.fn().mockResolvedValue(""),
}))

vi.mock("@/lib/llm/client", () => ({
  LLMClient: {
    shared: () => ({
      complete: vi.fn().mockResolvedValue({ content: "测试脚本内容" }),
    }),
  },
}))

describe("script structure switch", () => {
  it("writeScript should accept structureCode parameter", async () => {
    const { writeScript } = await import("@/lib/aim-agents/script-agent")
    // Should not throw when structureCode is provided
    const result = await writeScript({
      userId: "test-user",
      rawInput: "测试主题",
      structureCode: "conclusion_first",
    })
    expect(result).toBeDefined()
    expect(result.content).toBe("测试脚本内容")
  })

  it("writeScript should work without structureCode (backward compat)", async () => {
    const { writeScript } = await import("@/lib/aim-agents/script-agent")
    const result = await writeScript({
      userId: "test-user",
      rawInput: "测试主题",
    })
    expect(result).toBeDefined()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/script-structure-switch.test.ts`
Expected: FAIL — writeScript 不接受 structureCode

- [ ] **Step 3: 修改 writeScript 签名和 prompt**

在 `src/lib/aim-agents/script-agent.ts` 中：

1. `writeScript` input 增加 `structureCode?: string`
2. 在 system prompt 中，如果传了 `structureCode`，增加提示：

```typescript
// 在脚本要求的 prompt 中增加：
${input.structureCode
  ? `\n- 本次指定使用文案结构：${input.structureCode}，请严格按照该结构的节拍展开\n`
  : ""}
```

3. `buildViralStructureBlock` 中可按 `structureCode` 过滤只注入指定的 CopyStructure（可选优化）

- [ ] **Step 4: 运行测试确认通过**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/script-structure-switch.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/lib/aim-agents/script-agent.ts __tests__/unit/script-structure-switch.test.ts
git commit -m "feat: add structureCode parameter to writeScript for explicit structure switching"
```

---

### Task 5: 改文案风格选择器

**Files:**
- Create: `src/lib/style-guide-config.ts` — 12 种风格定义
- Modify: `src/lib/aim-agents/script-agent.ts:10-54` — polishCopy 增加 `styleId?` 参数
- Test: `__tests__/unit/polish-copy-styles.test.ts`

**Interfaces:**
- Consumes: `KnowledgeEntry`（风格定义优先从知识库读，fallback 到内置配置）
- Produces: `polishCopy(input)` 增加 `styleId?: string`；`STYLE_GUIDE_CONFIGS` 风格配置

- [ ] **Step 1: 写失败的测试**

```typescript
// __tests__/unit/polish-copy-styles.test.ts
import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    knowledgeEntry: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock("@/lib/ip-copywriting-methodology", () => ({
  buildIpCopywritingMethodologyBlock: vi.fn().mockResolvedValue(""),
}))

vi.mock("@/lib/llm/client", () => ({
  LLMClient: {
    shared: () => ({
      complete: vi.fn().mockResolvedValue({ content: "改后文案" }),
    }),
  },
}))

describe("polishCopy style selector", () => {
  it("should export 12 built-in styles", () => {
    const { STYLE_GUIDE_IDS, STYLE_GUIDE_LABELS } = require("@/lib/style-guide-config")
    expect(STYLE_GUIDE_IDS).toHaveLength(12)
    expect(Object.keys(STYLE_GUIDE_LABELS)).toHaveLength(12)
  })

  it("should return style prompt block for each style", () => {
    const { getStylePromptBlock } = require("@/lib/style-guide-config")
    for (const id of ["sharp", "humor", "restrained", "colloquial", "literary", "story", "golden_quote", "boss", "experienced", "counter_intuitive", "healing", "professional"] as const) {
      const block = getStylePromptBlock(id)
      expect(block.length).toBeGreaterThan(20)
    }
  })

  it("should return empty for unknown style", () => {
    const { getStylePromptBlock } = require("@/lib/style-guide-config")
    expect(getStylePromptBlock("nonexistent" as any)).toBe("")
  })

  it("polishCopy should accept styleId parameter", async () => {
    const { polishCopy } = await import("@/lib/aim-agents/script-agent")
    const result = await polishCopy({
      userId: "test-user",
      rawInput: "原始文案",
      styleId: "sharp",
    })
    expect(result).toBeDefined()
    expect(result.content).toBe("改后文案")
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/polish-copy-styles.test.ts`
Expected: FAIL — style-guide-config module not found, polishCopy 不接受 styleId

- [ ] **Step 3: 创建风格配置模块**

```typescript
// src/lib/style-guide-config.ts

export type StyleGuideId =
  | "sharp"          // 犀利
  | "humor"          // 幽默
  | "restrained"     // 克制
  | "colloquial"     // 口语化
  | "literary"       // 文艺
  | "story"          // 故事感
  | "golden_quote"   // 金句体
  | "boss"           // 老板口吻
  | "experienced"    // 过来人
  | "counter_intuitive" // 反常识
  | "healing"        // 治愈
  | "professional"  // 专业理性

export const STYLE_GUIDE_IDS: StyleGuideId[] = [
  "sharp", "humor", "restrained", "colloquial", "literary", "story",
  "golden_quote", "boss", "experienced", "counter_intuitive", "healing", "professional",
]

export const STYLE_GUIDE_LABELS: Record<StyleGuideId, string> = {
  sharp: "犀利",
  humor: "幽默",
  restrained: "克制高级",
  colloquial: "口语化",
  literary: "文艺",
  story: "故事感",
  golden_quote: "金句体",
  boss: "老板口吻",
  experienced: "过来人",
  counter_intuitive: "反常识",
  healing: "治愈",
  professional: "专业理性",
}

const STYLE_PROMPTS: Record<StyleGuideId, string> = {
  sharp: "用犀利的语气改写：观点鲜明，不留余地，敢于说真话，像一把刀切进去。用短句，不绕弯，每个字都有力量。",
  humor: "用幽默的语气改写：用自嘲、反讽、unexpected 的比喻制造笑点。先让人笑，再让人想。轻松但不轻浮。",
  restrained: "用克制高级的语气改写：少即是多。去掉所有感叹号、夸张词、情绪化的修辞。用事实和细节说话，让读者自己感受力量。",
  colloquial: "用口语化的语气改写：像跟朋友聊天一样，用大白话、短句、自然的停顿。可以用"嘛""啊""呗"等语气词，但不要刻意。",
  literary: "用文艺的语气改写：注重画面感和节奏感，用比喻和意象代替直接陈述。句子有韵律，像散文诗一样流畅。",
  story: "用故事感的语气改写：以叙事为主线，有场景、有人物、有转折、有情绪。不要讲道理，要讲故事。让读者身临其境。",
  golden_quote: "用金句体的语气改写：每段话都要有一句可以被单独拎出来当标题的金句。观点浓缩，表达精炼，有记忆点。",
  boss: "用老板口吻改写：像企业一把手在开会。有决断力，有格局，讲事实不讲感情，但偶尔流露真实的经历感。不端不装。",
  experienced: "用过来人的语气改写：像经历过很多事的年长者在跟年轻人说话。有阅历感、包容感，但不是居高临下。用语平实但有分量。",
  counter_intuitive: "用反常识的语气改写：开头就是一个违背直觉的结论，然后用逻辑和案例拆解为什么常识是错的。制造认知冲突。",
  healing: "用治愈的语气改写：温暖但不油腻。像一个懂你的朋友在深夜跟你说话。语速慢，用词轻，允许有停顿和空白。",
  professional: "用专业理性的语气改写：有数据支撑、有逻辑链条、有行业术语（但不堆砌）。像一个专家在做判断，冷静、准确、有说服力。",
}

export function getStylePromptBlock(styleId?: StyleGuideId): string {
  if (!styleId || !(styleId in STYLE_PROMPTS)) return ""
  return `\n\n【风格指令：${STYLE_GUIDE_LABELS[styleId]}】\n${STYLE_PROMPTS[styleId]}`
}
```

- [ ] **Step 4: 修改 polishCopy 增加 styleId**

在 `src/lib/aim-agents/script-agent.ts` 中：

1. 导入 `getStylePromptBlock` 和 `StyleGuideId`
2. `polishCopy` input 增加 `styleId?: StyleGuideId`
3. 在 system prompt 末尾注入风格块：

```typescript
const styleBlock = getStylePromptBlock(input.styleId)
// 追加到 systemPrompt 中
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/polish-copy-styles.test.ts`
Expected: PASS

- [ ] **Step 6: 运行现有测试确认无回归**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/`
Expected: ALL PASS

- [ ] **Step 7: 提交**

```bash
git add src/lib/style-guide-config.ts src/lib/aim-agents/script-agent.ts __tests__/unit/polish-copy-styles.test.ts
git commit -m "feat: add 12 style options to polishCopy agent"
```

---

### Task 6: 前端场景选择 UI 骨架（API 层）

**Files:**
- Create: `src/app/api/aim/scenarios/route.ts` — 返回可用场景列表
- Test: `__tests__/unit/api-scenarios.test.ts`

**Interfaces:**
- Produces: `GET /api/aim/scenarios` → `{ scenarios: Array<{ id, label, description, qualityFocus }> }`

- [ ] **Step 1: 写失败的测试**

```typescript
// __tests__/unit/api-scenarios.test.ts
import { describe, it, expect } from "vitest"
import { GET } from "@/app/api/aim/scenarios/route"

describe("GET /api/aim/scenarios", () => {
  it("should return 5 scenarios with required fields", async () => {
    const response = await GET()
    const data = await response.json()
    expect(data.scenarios).toHaveLength(5)
    for (const s of data.scenarios) {
      expect(s).toHaveProperty("id")
      expect(s).toHaveProperty("label")
      expect(s).toHaveProperty("description")
      expect(s).toHaveProperty("qualityFocus")
    }
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/api-scenarios.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 API route**

```typescript
// src/app/api/aim/scenarios/route.ts
import { NextResponse } from "next/server"
import {
  ContentScenario,
  SCENARIO_LABELS,
  getScenarioConfig,
} from "@/lib/content-scenario-config"

export async function GET() {
  const scenarios = Object.keys(SCENARIO_LABELS) as ContentScenario[]
  return NextResponse.json({
    scenarios: scenarios.map((id) => ({
      id,
      label: SCENARIO_LABELS[id],
      qualityFocus: getScenarioConfig(id).qualityFocus,
    })),
  })
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd mingyuan/apps/web && npx vitest run __tests__/unit/api-scenarios.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/app/api/aim/scenarios/route.ts __tests__/unit/api-scenarios.test.ts
git commit -m "feat: add GET /api/aim/scenarios endpoint for scenario list"
```

---

## Self-Review

1. **Spec 覆盖**：阶段一的 3 个特性全部有对应 task：场景模式（task 1-3, 6）、口播结构切换（task 4）、风格选择器（task 5）
2. **占位符扫描**：无 TBD/TODO/实现后续，所有 prompt 内容已写完
3. **类型一致性**：ContentScenario 类型在 task 1 定义，task 2/3/6 引用同一类型；polishCopy 的 styleId 在 task 5 定义
4. **向后兼容**：所有新增参数都是 optional，不影响现有调用方
