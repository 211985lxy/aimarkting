# 闪剪视频包装逻辑全流程分析

> 调研时间：2026-03-23

## 端到端流程

```
用户选结构/模板/填Brief → AI生成文案 → 用户选包装模板/素材/BGM → 选数字人
→ 创建 ProductionPlan → 调闪剪 API → Webhook 回调 → OSS 转存 → 完成
```

## 五个阶段

### Stage 1: 数字人准备

```
用户上传视频/图片 → cloneFastAvatar/Professional/Image → 闪剪异步训练
→ Webhook 回调 → 拿到 virtualmanId + speakerId → Avatar 状态变 ready
→ 自动触发 Demo 视频生成
```

Avatar 状态机：`uploading → cloning → ready / failed`

### Stage 2: 文案 → 包装方案（Production Plan）

```
Script(文案内容)
  + VideoPackagingTemplate(闪剪模板 styleId)
  + Materials(素材)
  + packRules(字幕/标题/背景音乐开关)
  + processRules(水印/封面)
  → VideoProductionPlan (status: draft → confirmed → used)
```

### Stage 3: 视频生成

调闪剪 API，根据 videoType 走不同端点：

| videoType | 说明 | 闪剪端点 |
|-----------|------|---------|
| `virtualman_broadcast` | 数字人口播（当前唯一启用） | POST /v1/clip/video/virtualman_broadcast |
| `realman_broadcast` | 真人口播 | POST /v1/clip/video/realman_broadcast |
| `broadcast_mixcut` | 口播混剪 | POST /v1/clip/video/broadcast_mixcut |
| `news_mixcut` | 新闻混剪 | POST /v1/clip/video/news_mixcut |
| `virtualman_video` | 数字人裸视频（无包装） | POST /v1/virtualman/video |
| `custom_virtualman_broadcast` | 自定义数字人口播 | POST /v1/clip/video/custom_virtualman_broadcast |
| `custom_realman_broadcast` | 自定义真人口播 | POST /v1/clip/video/custom_realman_broadcast |
| `custom_broadcast_mixcut` | 自定义混剪 | POST /v1/clip/video/custom_broadcast_mixcut |
| `ai_cover` | AI 封面 | POST /v1/clip/image/ai_cover |

### Stage 4: Webhook 回调

```
闪剪完成 → POST /api/webhook/shanjian
→ Redis 去重(24h TTL) → 视频文件转存 OSS（闪剪结果24h过期！）
→ VideoTask.status = completed, videoUrl = oss://...
```

### Stage 5: 轮询兜底

```
/api/cron/poll-tasks 每5分钟
→ 找超过2分钟未更新的 processing 任务
→ 主动调 getTaskInfo 查结果
→ 和 Webhook 走同一处理流程
```

## 用户可自定义 vs 系统自动

### 用户可控

| 阶段 | 可控内容 |
|------|---------|
| Phase 0: 定结构 | 选择视频结构（共情代入法、对比反差法等） |
| Phase 1: 定表达 | 选内容模板、填 Brief 字段（或 AI 一键填写）、选热点、选/编辑文案 |
| Phase 2: 定包装 | 选闪剪包装模板、上传素材（图片/视频）、填 BGM URL |
| Phase 3: 出视频 | 选数字人（自己的或公共的）、选公共声音 |

### 用户不可控（系统决定）

- **packRules**（字幕开关、标题特效、素材插入方式）— 跟着模板走，无 UI 暴露
- **processRules**（水印、封面生成策略）— 无 UI
- **videoType** — 固定 `virtualman_broadcast`，无法切换 realman/mixcut 等
- **styleId** — 绑死在包装模板上，只能整体选模板
- **字幕样式、标题样式、画布比例** — 由闪剪模板决定
- **BGM 音量** — 硬编码 `volume: 50`

## BGM 逻辑

| 用户操作 | 实际效果 |
|---------|---------|
| 不填 BGM URL，不传 packRules | 用模板自带的默认 BGM |
| 传 `packRules.backgroundMusic.audioSwitch: false` | 静音 |
| 传 `packRules.backgroundMusic.audioUrl` | 自定义 BGM |

闪剪 OpenAPI **没有公共 BGM 库接口**。如需提供 BGM 选择，需自建资源库或对接第三方。

## 包装模板管理

- `POST /api/packaging-templates/sync` 从闪剪拉模板列表存入 `VideoPackagingTemplate` 表
- 模板包含：视频画布尺寸、图层定位（标题/字幕/身份卡）、场景类型
- `styleId`（即 `shanjianId`）是传给闪剪的核心参数

## packRules 结构

```typescript
{
  headerSwitch?: boolean,      // 标题特效
  materialSwitch?: boolean,    // 素材插入
  subtitleSwitch?: boolean,    // 字幕
  keywordSwitch?: boolean,     // 关键词高亮
  backgroundMusic?: {
    audioSwitch?: boolean,     // BGM 开关
    audioUrl?: string,         // 自定义 BGM
    volume?: number            // 音量 0-100
  }
}
```

## processRules 结构

```typescript
{
  watermarkShow?: boolean,
  firstFrameCover?: {
    coverSwitch?: boolean,     // 自动封面
    templateId?: string        // AI 封面模板
  }
}
```

## 素材传递

用户上传的素材按角色分配，转成闪剪格式：

```
用户: [{ role: "product_detail", fileUrl: "...", type: "image" }]
  ↓
闪剪: [{ type: "image", fileUrl: "..." }]
```

## 关键文件索引

| 文件 | 职责 |
|------|------|
| `src/lib/shanjian.ts` | 闪剪 API 客户端（22 个端点） |
| `src/types/shanjian.ts` | 闪剪 TypeScript 类型 |
| `src/app/api/webhook/shanjian/route.ts` | Webhook 回调处理 |
| `src/app/api/tasks/route.ts` | 视频任务创建（9 种 videoType） |
| `src/app/api/avatars/route.ts` | 数字人克隆 |
| `src/app/api/production-plans/route.ts` | 包装方案创建 |
| `src/app/api/packaging-templates/sync/route.ts` | 模板同步 |
| `src/lib/task-recovery.ts` | 轮询兜底 & 修复 |
| `src/lib/avatar-demo.ts` | Demo 视频生成 |
| `src/lib/avatar-voice-assets.ts` | 声音提取 & 克隆 |

## 后续可扩展方向

- 开放 videoType 选择（realman_broadcast、broadcast_mixcut）
- 暴露 packRules UI（字幕开关、标题特效等）
- 自建 BGM 资源库
- 暴露 processRules UI（水印、封面策略）
- BGM 音量用户可调
