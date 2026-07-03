# 文案润色与质检：唯一入口说明

> 本文档记录 2026-07-03 的死代码清理与同类项合并结论，防止「两套系统同时跑导致跑偏」。
> 修改润色 / 质检相关功能前，先读这篇，确认改的是唯一活路径。

## 背景：曾经的双系统问题

历史上润色（polish）和质检（quality check）各有两套实现，一套活、一套死，
但死代码仍在仓库里被维护，导致：

- 新功能（如 imitate 跨行业仿写）被加到了**死代码**上，UI 根本触达不到，等于没上线；
- 维护者每次改动都要先猜「到底改哪一套」；
- 两套设计哲学不同（重写型 vs 精修型），输出不一致。

## 清理结论：唯一入口

### 润色（Polish）—— 唯一入口 `/api/scripts/polish`

| 文件 | 作用 |
|---|---|
| `src/app/api/scripts/polish/route.ts` | **唯一活路径**，三种模式 |
| `src/lib/api/client.ts` → `polishScript()` | 前端唯一调用方 |
| `src/lib/style-profile.ts` → `getStyleProfileBlock()` | 用户级写作风格档案（这个 IP 的真实文风），做润色底色 |
| `src/lib/style-guide-config.ts` → `getStylePromptBlock()` | 12 种内置风格，供 imitate 模式做本次腔调覆盖 |

**三种模式**（`mode` 字段）：

1. `proofread` —— 轻量校对（错别字/标点/语病），生成后自动跑，不改结构和意思。
2. `polish` —— 按四维弱点（aiTaste / editorial / attraction / logic）精修，保持原意结构。
3. `imitate` —— **跨行业爆款仿写**：拿一条对标爆款的钩子/节奏/结尾结构逻辑，
   用当前 IP 的知识库 + 写作风格档案重写成同结构、本行业内容的新稿。可选 12 风格覆盖。
   - UI 入口：`/aim` 对标编辑面板（BenchmarkEditorPanel）头部的「仿写」按钮。
   - 必须提供对标爆款原文（`viralSourceText`）和草稿（`content`）。

> ⚠️ 不要再新增润色路径。已删除的废弃实现见下「已删除」。

### 质检（Quality Check）—— 唯一入口 `quality-gate.ts`

| 文件 | 作用 |
|---|---|
| `src/lib/quality-gate.ts` → `runQualityCheck()` | **唯一活路径**，四维 + 自动重写最多 3 次 |
| `src/lib/ai-taste-detector.ts` | AI 味独立检测引擎（93 禁词 + 句式评分） |
| `src/app/api/scripts/quality-check/route.ts` | HTTP 入口 |

四维：编辑质量（editorial）/ AI 味（aiTaste）/ 吸引力（attraction）/ 逻辑（logic）。
不及格时 `needsRewrite=true`，自动重写最多 3 次。

## 已删除（不要再复活）

- `src/lib/aim-agents/`（整个目录）—— 废弃的 `polishCopy` / `writeScript` /
  `runQualityCheck` / `repurposeContent`。其中 `polishCopy` 的 imitate 逻辑已迁移到
  活路径 `/api/scripts/polish`，质检逻辑无保留价值（活路径更强）。
- `src/lib/aim-agents/script-agent.ts` 里的 `loadProjectKnowledge` 已迁移到
  `/api/scripts/polish/route.ts`，供 imitate 注入项目知识库。
- 三个孤立测试（`polish-copy-styles` / `polish-copy-imitate-mode` / `script-structure-switch`），
  其中 style-guide-config 的测试保留为 `style-guide-config.test.ts`。

## 内容生产官 Agent ID 统一

内容生产官曾有两套 id（公共层 `ip_video` / 内部 handler 层 `content_producer`），
现已统一为 `content_producer`。旧 `ip_video` 作为向后兼容别名保留：

- `src/lib/aim-ui-config.ts` → `normalizeAimAgentId()` 把 `ip_video → content_producer`；
- `src/lib/aim-agent-handlers.ts` → `AGENT_ID_ALIASES` 在 handler 调度层兜底；
- `src/lib/agent-api-auth.ts` → 读取 API key scope 和校验访问时归一化。

旧书签链接、旧外部 API 调用、旧 `AimGeneration` 数据库行仍能正常工作。
数据库迁移 `20260703120000_normalize_agent_id_content_producer` 把存量 `ip_video` 行归一化。
