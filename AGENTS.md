# 项目规则（唯一权威源）

> 本文件是整个项目的规则权威源。`mingyuan/` 下的 `Agents.md`（角色设定）、`PROJECT.md`（运维补充）仅作补充，若与本文冲突以本文为准。`mingyuan/boot.md` 已删除，`CLAUDE.md` 已精简为指针，其重复内容已合并到此处。

## 核心产品原则（最高纲领，所有规则服从于此）

**本系统交付的不是视频，而是「天命 IP 资产生产流程」。**

任何功能、页面、Agent、接口和数据结构，都不得只以「生成一条视频/一篇文案」为最终目标，而必须服务于用户的 IP 资产沉淀。短视频和文案只是 IP 资产的外显载体，不是最终交付物。

**天命 IP 资产包括七类：**

1. **定位资产**——用户是谁、服务谁、解决什么问题
2. **人设资产**——身份标签、表达风格、故事线、价值观、差异化记忆点
3. **内容资产**——选题库、脚本库、栏目结构、表达模板、发布文案
4. **信任资产**——案例、背书、方法论、观点体系、结果证据
5. **获客资产**——钩子、私信关键词、资料包、诊断入口、线索承接路径
6. **转化资产**——产品结构、咨询路径、成交话术、朋友圈承接、复购机制
7. **复利资产**——客户问题库、行业素材库、知识库、内容迭代记录、Agent 工作流

**每一次生成、推荐、分析、优化，都必须能回答一个问题：**
> 这一步是否帮助用户更清楚地被看见、更精准地获取客户、更稳定地建立信任、更自然地完成转化，并最终沉淀为可复用、可迭代、可复利的 IP 资产？

凡是只消耗不沉淀（例如只产视频/文案却不回填进资产库）的设计，都违背本原则。

### 七大资产的真实承载位置（三处源头）

资产沉淀分散在三处，不要只看数据库：

| 资产 | 主要承载位置 | 沉淀状态 |
|---|---|---|
| ① 定位 | 数据库 `IpProfile` + `IpWikiPage`(positioning/audience) | ✅ 完整 |
| ② 人设 | 数据库 `IpWikiPage`(persona) + `IpProfile` + 写作风格档案 | ✅ 完整 |
| ③ 内容 | 数据库 `TopicSelection`/`Script`/`ContentTemplate` + `IpWikiPage`(content_strategy/topic_direction) | ✅ 最强 |
| ④ 信任 | 数据库 `KnowledgeEntry`(project_case) + `IpWikiPage`(viral_methodology)；**观点体系散落** | ⚠️ 基本 |
| ⑤ **获客** | **Obsidian vault**（线索获客方法论、引流SOP、私信关键词、承接路径）；数据库 `IpWikiPage` 全案第9模块 | ⚠️ 在 vault，未进库 |
| ⑥ **转化** | **Obsidian vault**（`03-成交与销售`、成交话术、复购）；数据库 `IpWikiPage`(conversion_path) + 全案第10模块 | ⚠️ 在 vault，未进库 |
| ⑦ 复利 | 数据库 `KnowledgeEntry`(12类)+向量+图谱+`AimMemory`+`AimExecutionTrace` | ✅ 最成熟 |

**Obsidian vault（「灵感库」）是第二大脑和资产源头**，含方法论、获客/成交话术、SOP、客户项目资料（600+ markdown）。它是 `mingyuan/scripts/obsidian-sync.ts` 单向同步的源头，经 `#Aim/知识库` 标签闸门筛选后写入 `KnowledgeEntry`。详见 `mingyuan/docs/second-brain-and-aihot-integration.md`。

### 已知缺口（待补，影响资产闭环）

- **获客/转化资产进不去数据库**：同步管线有 `#Aim/知识库` 标签闸门，且 `KnowledgeEntry.category` 只有 5 类，装不下「获客话术/承接路径/成交话术」。结果是 AIM 智能体生成内容时，**可能检索不到 vault 里的获客/成交资产**。打通这条线（放宽标签 / 扩充 category / 或让 AIM 直接读 vault）是待办项。
- **④信任资产的「观点体系」无独立结构化模型**，散落在人设页和知识条目里。
- **天命IP全案是 12 模块**（项目总判断/天命底盘/IP主定位/目标客户/核心问题/IP价值/产品设计/内容系统/流量闭环/私域成交/交付资产化/行动处方，见 `aim-agent-handlers.ts` 的全案路由），其中第9模块（流量闭环，含私信关键词/微信承接）、第10模块（私域成交）、第11模块（交付资产化）正是获客/转化资产在系统生成侧的归属。

## 仓库结构

- **根项目**：天命 IP 资产生产流程系统，面向有打造个人 IP 需求的小企业主（当小白对待）。覆盖 IP 定位、选题、文案创作、质量检查，产出沉淀为七大 IP 资产。短视频/文案是资产的外显载体，非最终交付物（详见上方「核心产品原则」）。
- **主应用**：`mingyuan/apps/web`（包名 `@mingyuan/web`），Next.js 16 App Router + Prisma 7 + MySQL/MariaDB 的 monorepo。
  - `mingyuan/apps/web` —— Next.js 主应用（本项目的核心）
  - `mingyuan/apps/desktop` —— Tauri 桌面端（`@mingyuan/desktop`）
  - `mingyuan/packages/shared` —— 共享代码（`@mingyuan/shared`）
- **上传自动化**：`social-auto-upload`，Python 命令行/上传模块。除非明确要求集成，否则把它当作与 Next.js 应用相互独立的子系统。
- **文档**：根目录 `README.md` 和 `docs/` 是概览；深度产品与架构参考在 `mingyuan/docs/`。

## 命令

> ⚠️ 旧 `Makefile` 已删除。所有命令用 pnpm，在 `mingyuan/` 下执行。

在 `mingyuan/` 下：
- 安装依赖：`pnpm install`
- 启动主应用：`pnpm dev`（等价 `pnpm dev:web`）
- 构建：`pnpm build`
- 代码检查：`pnpm lint`

在 `mingyuan/apps/web/` 下：
- 跑单元测试：`pnpm test`（即 `vitest run`）或 `npx vitest run <具体测试文件>`
- 跑质量门禁测试：`npx vitest run __tests__/unit/quality-gate.test.ts`
- 推送 Prisma schema：`npx prisma db push`
- 数据库迁移：`npx prisma migrate dev`（生产用 `migrate deploy`）
- 填充种子数据：`pnpm prisma db seed`
- 打开 Prisma Studio：`npx prisma studio`

在 `mingyuan/` 下：
- Obsidian 同步：`pnpm tsx scripts/obsidian-sync.ts`（加 `--force` 全量推送）

## 技术栈

Next.js 16 + React 19 + TypeScript 5 + Prisma 7（MySQL/MariaDB）+ Tailwind 4 + shadcn/ui v4（基于 Base UI）+ zustand + zod + ioredis + OpenAI SDK + 阿里云（OSS/视频增强）+ sonner（toast）+ lucide-react（图标）。测试用 vitest（单测）+ Playwright（E2E）。Monorepo 用 pnpm workspace + turbo 编排。

## 生产主流程（Direction A）

- **一键生成为核心**：系统遵循「Direction A」架构。`/aim`（AIM 智能体）是内容生产的主入口，把选题和文案统一成一步。
- **四步精简流程**：`/home`（信息设置）→ `/aim`（一键生成）→ `/quality-check`（质量门禁）→ `/home`（工作总览）。
- **路由纪律**：废弃的占位路由（`/topic-planning`、`/copywriting`）已从导航移除，**未经明确重构不得重新暴露到侧边栏**。
- **创作 vs 包装**：见下方「视频包装」一节。

## 硬性规则

### 零 Mock 铁律（不可破坏）

- 生产代码、预览流程、管理后台、验收流程中，**禁止**任何 mock、fake、stub、fixture 回退、示例数据回退或模拟的服务提供方。
- 所有功能必须走真实 API、真实数据库、真实存储、真实第三方服务。
- 禁止为了「先跑通界面」而接入假数据、模拟响应、本地样例 JSON、硬编码列表。
- 验收标准不是「页面能展示」，而是「真实数据能流动、真实流程能执行、真实测试能通过」。mock 测试不能作为完成的主要证据。
- 真实依赖缺失时：明确报阻塞、补齐依赖、修复环境，**绝不**用 mock 兜底掩盖问题。
- 重新引入 mock 必须经过用户明确批准。发现现存 mock 应优先移除或替换为真实调用。

### UI 规则

- 所有 UI 相关工作必须**先调用 `ui-ux-pro-max` skill**，保持设计语言和视觉一致。
- UI 组件**只能用 shadcn/ui**（`mingyuan/apps/web/src/components/ui`）。禁止其他 UI 组件库或自建组件体系。

### 安全规则

- **不要提交密钥**。`mingyuan/apps/web/.env.example` 是所需环境变量的参考模板。
- `OBSIDIAN_SYNC_TOKEN` 是同步鉴权密钥，不得在生产环境泄露。

## 视频包装（重要：已脱离主流程，标记为待删）

> 历史上项目有「导演层 → 编剧层 → 包装层」三层视频架构。**现在主流程只剩创作（导演层 + 编剧层），「闪剪包装成片」这步已不做了。**

**主流程当前只有创作**（在 `/aim` 智能体里完成）：
- 导演层：视频结构、叙事节奏（`VideoStructure`、结构模板）—— 还在用
- 编剧层：文案/脚本表达（`ContentTemplate`、IP 人设、脚本生成）—— 还在用

**包装层已脱离主流程，下列代码是「待删死代码」**（commit `bef553bc` 已从侧边栏移除入口，但代码未删）：
- 页面：`/create`（旧工作台，仅 URL 直访）、`/videos`、`/videos/[id]`（成片列表/预览）
- 接口：`/api/packaging-templates`、`/api/packaging-material-suggestions`、视频任务部分 `/api/tasks`
- 库：`shanjian.ts`、`shanjian-submit.ts`、`shanjian-semaphore.ts`
- 数据模型：`VideoPackagingTemplate`、`VideoTask`、`VideoProductionPlan`（含历史数据，删表需谨慎）

对待删死代码的处置原则：
- **不要主动改动或修复**这些包装代码，也不要在侧边栏恢复它们的入口。
- **保留** `/api/webhook/shanjian`、`cron/poll-tasks`、`task-recovery.ts`、`video-task-settlement.ts` —— 它们独立运行，处理历史任务的回调和结算。
- 真正的彻底清理（删除页面/接口/库/表）是一项独立工作，需另行安排，本次仅作标记。

## 架构文档索引

- 文案润色与质检唯一入口：[mingyuan/docs/copywriting-polish-and-quality-single-entry.md](mingyuan/docs/copywriting-polish-and-quality-single-entry.md)
- 第二大脑与 AI HOT 集成：[mingyuan/docs/second-brain-and-aihot-integration.md](mingyuan/docs/second-brain-and-aihot-integration.md)
- E2E 测试最佳实践：[mingyuan/docs/e2e-testing-best-practices.md](mingyuan/docs/e2e-testing-best-practices.md)
