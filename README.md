# ClipFlow - AI 内容生产智能体

> 面向新媒体内容创作者的 AI 智能体，从 IP 定位 → 选题策划 → 文案生成 → 质量门控 的全链路内容生产平台。

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](./VERSION)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

---

## 核心价值

用户无需具备专业新媒体知识，只需通过**极简的 4 步黄金流**，即可由 AI 自动完成内容生产：

1. **信息设置 (`/ip-profile`)** - 通过五问向导生成商业定位、人设定位、内容定位的三维 IP 档案，为内容注入专业性灵魂。
2. **AIM 一键生成 (`/aim`)** - 全功能生成中枢，支持文本或语音录入，集成爆款选题（12 大核心营销元素）和文案创作（7大开头、8大结构、4种结尾组合），一键秒出视频脚本、公众号长文和朋友圈文案。
3. **质量检控 (`/quality-check`)** - 编辑质量、AI味、吸引力、逻辑一致性的四维自动检测，不及格时智能重构，通过即成佳作。
4. **工作台主页 (`/home`)** - 看板式工作台，对生成的短视频任务进行追踪、审核与多平台一键分发。

---

## 项目架构

```
ClipFlow/
├── clipflow/                    # 核心应用（Turborepo monorepo）
│   ├── apps/web/                # Next.js 16 前端 + API（App Router）
│   ├── packages/shared/         # 共享包
│   └── k8s/                     # Kubernetes 部署配置
├── social-auto-upload/          # 社交媒体自动上传模块（Python CLI/uploader）
├── scripts/                     # 运维脚本
└── docs/                        # 项目文档
```

### 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| **后端** | Next.js API Routes, Prisma ORM |
| **数据库** | MySQL (MariaDB) |
| **AI/LLM** | OpenAI GPT / Claude（通过 TheRouter 网关） |
| **部署** | Docker, Kubernetes |
| **Monorepo** | Turborepo, pnpm 9 |

---

## 快速开始

### 环境要求

- Node.js 18+
- pnpm 9+
- MySQL 8+ / MariaDB
- Docker（可选）

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/211985lxy/aimarkting.git
cd aimarkting

# 2. 安装依赖
cd clipflow
pnpm install

# 3. 配置环境变量
cd apps/web
cp .env.example .env.local
# 编辑 .env.local 填入数据库连接、LLM API Key 等

# 4. 初始化数据库
npx prisma generate
npx prisma db push
pnpm prisma db seed

# 5. 启动开发服务器
cd ../..
pnpm dev
```

访问 http://localhost:3000 即可使用。

### Docker 部署

```bash
# 使用部署脚本
bash scripts/deploy-production.sh
```

---

## 核心模块

### 模块 1：IP 档案建立

五步问卷向导（行业 → 目标客户 → 变现方式 → 个人特质 → 内容目标），AI 自动生成三维 IP 档案：

- **商业定位**：产品、目标用户、痛点、变现路径
- **人设定位**：角色类型、一句话介绍、视觉/语言/性格标签、信任背书
- **内容定位**：内容金字塔比例、系列方向、差异化建议、选题标签

### 模块 2：爆款选题生成

基于 12 大黄金营销元素（利益前置、极限反差、痛点直击、成本极限、身份圈层、猎奇反常、借势背书、情感驱动、视觉钩子、节奏密度、真实怀旧、互动体验）随机组合，每次生成 4 张差异化选题卡片，支持历史去重和冲突检测。

### 模块 3：文案创作

- **7 大爆款开头**：好奇类、借势类、痛点类、极限类、恐吓类、反差类、利益类
- **8 大文案结构**：现象解构、干货盘点、结果前置、金句递进、行业揭秘、利益传递、故事观点、知识分享
- **4 种结尾形式**：互动式、共情式、Slogan 型、反转式

### 模块 4：质量门控（四维自动检测）

| 维度 | 检测内容 | 及格线 |
|------|----------|--------|
| 编辑质量 | 结构完整度、可读性、人设匹配 | ≥ 7/10 |
| AI 味检测 | 93 个禁词黑名单 + 句式评分 | ≥ 6/10 |
| 吸引力 | 钩子强度、悬念设置、留存预判 | ≥ 7/10 |
| 逻辑一致 | 选题与文案一致性、论据匹配 | ≥ 7/10 |

不及格时 AI 自动重写（最多 3 次），通过后进入用户审核。

### 模块 5：AIM 内容智能体

- `/aim` 工作台支持文字输入与语音转写。
- 企业知识库保存在 `KnowledgeEntry`，可记录老板经验、产品卖点、客户痛点、项目案例和客户问答。
- 生成记录保存在 `AimGeneration`，包含视频脚本、公众号文章、朋友圈文案和质量评分。

### 模块 6：视频生成三层架构

| 层级 | 数据模型 | 责任 |
|------|----------|------|
| 导演层 | `VideoStructure` | 决定视频结构、节奏和叙事蓝图 |
| 文案层 | `ContentTemplate` / `Script` | 决定信息如何表达、销售和说服 |
| 包装层 | `VideoPackagingTemplate` / `VideoProductionPlan` | 决定 Shanjian 模板、素材、BGM、字幕和画面组合 |

---

## 目录结构

```
├── clipflow/apps/web/src/
│   ├── app/                     # Next.js App Router 页面和 API
│   │   ├── (marketing)/         # 营销落地页
│   │   ├── (auth)/              # 登录/注册/激活
│   │   ├── (dashboard)/         # 主工作台
│   │   │   ├── home/            # 首页
│   │   │   ├── ip-profile/      # IP 档案（五问问卷 + 三维定位）
│   │   │   ├── create/          # 视频创建（四步工作台）
│   │   │   ├── aim/             # AIM 灵感生成
│   │   │   ├── hot-topics/      # 热点选题
│   │   │   ├── videos/          # 视频管理
│   │   │   ├── assets/          # 资产管理
│   │   │   ├── competitor/      # 同行对标
│   │   │   └── account/         # 账户设置
│   │   └── api/                 # API 路由
│   │       ├── aim/             # AIM 生成、历史、语音转写
│   │       ├── knowledge/       # 企业知识库
│   │       ├── ip-profile/      # IP 定位 API
│   │       ├── topics/          # 选题生成 API
│   │       ├── scripts/         # 文案生成 API
│   │       ├── tasks/           # 视频任务
│   │       ├── packaging-templates/ # Shanjian 包装模板
│   │       └── hot-topics/      # 热点数据 API
│   ├── components/              # React 组件
│   ├── lib/                     # 核心业务逻辑
│   │   ├── llm/                 # LLM 集成（TheRouter + OpenAI）
│   │   ├── aim-generator.ts     # AIM 内容生成
│   │   ├── quality-gate.ts      # 四维质量门控
│   │   ├── topic-generation.ts  # 选题引擎
│   │   ├── script-generator.ts  # 文案生成引擎
│   │   ├── shanjian.ts          # Shanjian OpenAPI
│   │   └── hot-topic-intelligence.ts  # 热点融合
│   └── prisma/                  # 数据库 Schema
├── social-auto-upload/          # Python 社交媒体上传 CLI/uploader
├── scripts/                     # 运维脚本
│   ├── deploy-production.sh     # 生产部署
│   ├── start-all.sh             # 全服务启动
│   ├── server-manager.sh        # 服务器管理
│   └── status.sh                # 状态检查
└── docs/                        # 项目文档
    ├── ACTIVATION-CODE-GUIDE.md
    └── PRODUCTION-DEPLOYMENT.md
```

---

## 配置说明

### 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `DATABASE_URL` | MySQL 连接字符串 | ✅ |
| `JWT_SECRET` | 用户 JWT 加密密钥 | ✅ |
| `ADMIN_JWT_SECRET` | 管理后台 JWT 加密密钥 | ❌ |
| `THEROUTER_API_KEY` | TheRouter LLM 网关 API Key | ✅ |
| `OPENAI_API_KEY` | OpenAI API Key（fallback） | ❌ |
| `META_PROMPT_MODEL` | 分析型任务模型 | ❌ |
| `SCRIPT_GENERATION_MODEL` | 文案生成模型 | ❌ |
| `SHANJIAN_APP_KEY` | Shanjian OpenAPI App Key | ❌ |
| `OSS_REGION` / `OSS_BUCKET` / `OSS_ACCESS_KEY_*` | 阿里云 OSS 配置 | ❌ |
| `ALIYUN_NLS_APP_KEY` | AIM 语音转写 | ❌ |
| `TIKHUB_API_KEY` | 同行对标数据 | ❌ |

---

## 文档

- [生产环境部署指南](docs/PRODUCTION-DEPLOYMENT.md)
- [激活码管理指南](docs/ACTIVATION-CODE-GUIDE.md)

---

## 版本历史

### v1.1.0 (2026-05)

- **核心流程重构 (Direction A)**：合并并剔除了原本独立、混乱且体验断层的 `/topic-planning` 和 `/copywriting` 页面，将控制台全面精简为以 `/aim` (AIM 一键生成) 为中枢的 **4步黄金流水线**（信息设置 -> 一键生成 -> 质量检控 -> 工作台）。
- **控制台 UI 升级**：侧边栏菜单及工作台流程状态指示器全量对齐 4 步流程。修复了 Tailwind v4 在 JIT 下的活动态左边框渲染等样式问题。
- **Zero Mock 规则践行**：移除了 API 路由中的 mock 响应，当依赖不满足时真诚地返回 503 HTTP 状态。
- **高阶 AI 技能就位**：在系统全局配置中成功集成 `aihot`、`hv-analysis`、`khazix-writer`、`neat-freak` 四个高水平智能体技能。

### v1.0.0 (2026-05)

- IP 档案五问问卷 + 三维定位
- AIM 灵感生成 + 企业知识库
- 爆款选题生成（12 元素 x 4 卡片）
- 文案生成（7 开头 x 8 结构 x 4 结尾）
- 热点数据接入 + 融合逻辑
- 四维质量门控 + 段落级润色 API
- 视频结构、文案模板、Shanjian 包装模板三层链路

---

## 📜 License

[MIT](./LICENSE)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
