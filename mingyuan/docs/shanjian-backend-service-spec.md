# 明远AIM 后端服务规范

> Part 1: 闪剪 OpenAPI 集成层（基于 https://openapi-doc.shanjian.tv/ 完整 API 研究编写）
> Part 2: 抖音热榜采集服务
> Part 3: 内容模板运营管理系统
> Part 4: 1000 用户规模架构设计

---

## 1. 概述

ClipFlow 后端通过 `lib/shanjian.ts` 统一封装闪剪 OpenAPI，对内提供类型安全的服务方法，对外通过 Webhook 端点接收异步回调。所有闪剪 API 调用均为异步模式——提交任务后返回 `taskId`，结果通过 Webhook 回调或主动轮询获取。

### 1.1 架构总览

```
┌─────────────────────────────────────────────────────────┐
│  ClipFlow Frontend (Next.js App Router)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ 创建向导  │  │ 资产管理  │  │ 视频库   │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │                    │
│  ─────┼──────────────┼──────────────┼────────────────── │
│       ▼              ▼              ▼                    │
│  ┌─────────────────────────────────────────────────┐    │
│  │  API Routes (app/api/)                          │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐│    │
│  │  │ /tasks   │ │ /avatars │ │ /webhook/shanjian││    │
│  │  └────┬─────┘ └────┬─────┘ └────────┬─────────┘│    │
│  └───────┼─────────────┼────────────────┼──────────┘    │
│          ▼             ▼                ▼               │
│  ┌─────────────────────────────────────────────────┐    │
│  │  lib/shanjian.ts (闪剪服务层)                    │    │
│  │  ┌────────────────┐  ┌────────────────────────┐ │    │
│  │  │ ShanjianClient │  │ ShanjianWebhookHandler │ │    │
│  │  └────────┬───────┘  └────────────┬───────────┘ │    │
│  └───────────┼───────────────────────┼─────────────┘    │
│              ▼                       ▼                   │
│  ┌──────────────────┐    ┌──────────────────┐           │
│  │  Prisma (DB)     │    │  Redis (幂等/锁)  │           │
│  └──────────────────┘    └──────────────────┘           │
└─────────────────────────────────────────────────────────┘
               │
               ▼
     ┌────────────────────┐
     │ 闪剪 OpenAPI       │
     │ openapi.shanjian.tv│
     └────────────────────┘
```

### 1.2 核心设计原则

1. **统一封装**：所有闪剪 API 调用集中在 `lib/shanjian.ts`，不允许 API Routes 直接调用闪剪端点
2. **类型安全**：完整的 TypeScript 类型定义，覆盖请求参数、响应结构和回调数据
3. **失败隔离**：闪剪 API 错误不向上冒泡为 500，统一转换为业务可理解的错误码
4. **幂等安全**：Webhook 处理 + 任务状态变更全部幂等，重复回调和并发写入安全
5. **资源过期感知**：闪剪生成结果仅保留 24 小时，系统必须在回调成功后立即转存 OSS

---

## 2. 认证与连接

### 2.1 环境变量

```env
SHANJIAN_APP_KEY=          # 闪剪 API 密钥（Bearer Token）
SHANJIAN_BASE_URL=https://openapi.shanjian.tv   # API 基础地址
SHANJIAN_WEBHOOK_URL=      # 本系统 Webhook 回调地址（公网可达）
```

### 2.2 认证方式

所有请求携带以下 Headers：

```
Authorization: Bearer {SHANJIAN_APP_KEY}
Content-Type: application/json
```

### 2.3 客户端初始化

```typescript
// lib/shanjian.ts
class ShanjianClient {
  private baseUrl: string;
  private appKey: string;
  private webhookUrl: string;

  constructor() {
    this.baseUrl = env.SHANJIAN_BASE_URL;
    this.appKey = env.SHANJIAN_APP_KEY;
    this.webhookUrl = env.SHANJIAN_WEBHOOK_URL;

    if (!this.appKey) {
      throw new Error('SHANJIAN_APP_KEY is required');
    }
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    options?: { body?: unknown; params?: Record<string, string> }
  ): Promise<ShanjianResponse<T>>;
}
```

---

## 3. 类型系统

### 3.1 通用响应结构

```typescript
// 闪剪标准响应
interface ShanjianResponse<T = unknown> {
  code: string;           // "Succeed" 表示成功，其他值为错误码
  data: T;
  message?: string;       // 错误描述（code !== "Succeed" 时）
  requestId: string;      // 请求追踪 ID
}

// 异步任务创建响应
interface ShanjianTaskResponse {
  taskId: string;
}
```

### 3.2 资产类型

```typescript
// 公共配音/音色
interface ShanjianVoice {
  id: string;
  name: string;
  gender: string;
  coverUrl: string;
  demoUrl: string;
  langs: string[];
}

// 公共数字人
interface ShanjianVirtualman {
  id: string;
  name: string;
  gender: string;
  coverUrl: string;
}

// 编辑模板
interface ShanjianTemplate {
  id: string;
  name: string;
  coverUrl: string;
  scene: 'virtualman' | 'realMan' | 'oralMixCutting' | 'newsMixCutting';
  demoUrl: string;
}

// 模板详情（含图层结构）
interface ShanjianTemplateDetail extends ShanjianTemplate {
  videoStructInfo: {
    editInfo: {
      canvas: { width: number; height: number };
      headerLayer: LayerInfo;     // 标题图层
      subtitleLayer: LayerInfo;   // 字幕图层
      ipLayer: LayerInfo;         // 身份栏图层
    };
  };
}

interface LayerInfo {
  width: number;
  height: number;
  transform: {
    anchor: [number, number, number];
    scalar: [number, number, number];
    position: [number, number, number];
  };
}

// AI 封面模板
interface ShanjianCoverTemplate {
  id: string;
  name: string;
  coverUrl: string;
}
```

### 3.3 克隆请求类型

```typescript
// 专业数字人克隆
interface ProfessionalCloneRequest {
  videoUrl: string;           // 训练视频（30-120s, <=1GB, MP4/MOV, H.264/HEVC）
  authVideoUrl: string;       // 授权视频（<2min, <=100MB）
  authText: string;           // 授权品牌名
  callbackUrl?: string;
}

// 极速数字人克隆
interface FastCloneRequest {
  videoUrl: string;           // 训练视频（5-60s, <=500MB, MP4/MOV, H.264/HEVC）
  authVideoUrl: string;
  authText: string;
  callbackUrl?: string;
}

// 图生数字人克隆
interface ImageCloneRequest {
  imageUrl: string;           // 照片（300-2000px, <=5MB, JPG/PNG/WebP）
  authVideoUrl: string;
  authText: string;
  callbackUrl?: string;
}

// 声音克隆
type VoiceModel = 'v1' | 'v2' | 'v3' | 's1' | 's3';

interface VoiceCloneRequest {
  audioUrl: string;           // 音频（5-120s, <=10MB, mp3/wav/m4a）
  model: VoiceModel;
  language: string;
  demoText?: string;          // 默认中文示例文案
  callbackUrl?: string;
}
```

### 3.4 效果类型

```typescript
// 文字转语音 (TTS)
interface TTSRequest {
  text: string;
  speakerId: string;
  language?: string;          // 默认 "zh-CN"
  speedRatio?: number;        // 0.5-2.0，默认 1
  volume?: number;            // 0.5-2.0，默认 1
  codec?: 'mp3' | 'wav';     // 默认 mp3
  marks?: TextMark[];
  returnSubtitle?: boolean;
  callbackUrl?: string;
}

// 语音转文字 (ASR)
interface ASRRequest {
  audioUrl: string;           // 音频 URL（<=5min, <=100MB, mp3/wav/m4a）
  language: string;           // 支持 26 种语言
  callbackUrl?: string;
}

// 文本标记（停顿/发音替换）
type TextMark =
  | { type: 'break'; index: number; time: number }        // 停顿（100-10000ms）
  | { type: 'replace'; indexRange: number[]; text: string }; // 发音替换
```

### 3.5 视频生成类型

```typescript
// ========== 共用子结构 ==========

// 素材
interface MaterialItem {
  type?: 'image' | 'video';
  fileUrl: string;
  soundSwitch?: boolean;      // 保留原声（视频素材）
  entryPoint?: number;        // 入场时间点（秒，custom 接口）
  duration?: number;          // 持续时长（秒，custom 接口）
}

// 身份栏
interface IntroduceCard {
  name?: string;
  description?: string;
}

// 字幕数据
interface SubtitleItem {
  startMs: number;
  endMs: number;              // 最大 310,000ms
  text: string;               // 单字符
}

// 包装规则
interface PackRules {
  headerSwitch?: boolean;     // 标题效果
  materialSwitch?: boolean;   // 素材效果
  subtitleSwitch?: boolean;   // 字幕效果
  keywordSwitch?: boolean;    // 关键词效果
  backgroundMusic?: {
    audioSwitch?: boolean;
    audioUrl?: string;        // mp3/wav/m4a, <=120MB, <=5min
    volume?: number;          // 0-1
  };
}

// 处理规则
interface ProcessRules {
  watermarkShow?: boolean;                    // AI 生成水印
  resourcePreprocessMethod?: 'roughCut' | 'sliceMerge';
  materialMatchWay?: 'fuzzyMatch' | 'preciseMatch';
  materialComposition?: 'random' | 'order';
  metadata?: Record<string, string>;          // 单组键值对，值为 string
  firstFrameCover?: {
    coverSwitch?: boolean;
    templateId?: string;
    imageUrl?: string;                        // AI 封面基础图
    resultImageUrl?: string;                  // 预制封面（优先级高于 imageUrl）
  };
}

// 图层定制
interface StructLayer {
  markCode: 'headerLayer' | 'subtitleLayer' | 'ipLayer';
  show?: boolean;
  showMode?: 'always' | 'customize';          // headerLayer 专用
  showTime?: number;                           // customize 时的显示时长（秒，3位小数）
  layer?: {
    transform?: {
      position: [number, number, number];
    };
  };
}

// 场景（custom 接口用）
interface VideoScene {
  captions: {
    content: string;          // 3-1800 字符
    marks?: TextMark[];
  };
  materials?: MaterialItem[];
}

// 语速参数
interface SpeakerExtra {
  speedRatio?: number;        // 0.5-2.0
  language?: string;
  marks?: TextMark[];
}

// ========== 视频生成请求 ==========

// 纯数字人口播（无包装）
interface VirtualmanVideoRequest {
  virtualmanId: string;
  audioUrl?: string;          // 二选一：audioUrl 或 text+speakerId
  text?: string;              // 3-3600 字符
  speakerId?: string;
  speakerExtra?: SpeakerExtra;
  metadata?: Record<string, string>;
  callbackUrl?: string;
}

// 数字人口播混剪
interface VirtualmanBroadcastRequest {
  styleId: string;
  virtualmanId: string;
  audioUrl?: string;          // 二选一
  content?: string;           // 3-1800 字符
  speakerId?: string;
  speakerExtra?: SpeakerExtra;
  language?: string;
  title?: string;
  materials?: MaterialItem[];
  materialSoundSwitch?: boolean;
  introduceCard?: IntroduceCard;
  subtitle?: SubtitleItem[];
  packRules?: PackRules;
  processRules?: ProcessRules;
  structLayers?: StructLayer[];
  callbackUrl?: string;
}

// 真人口播混剪
interface RealmanBroadcastRequest {
  styleId: string;
  videoUrl: string;           // MP4/MOV, H.264/HEVC, 10-60fps, <5min, <500MB
  language?: string;
  title?: string;
  subtitle?: SubtitleItem[];
  materials?: MaterialItem[];
  materialSoundSwitch?: boolean;
  introduceCard?: IntroduceCard;
  packRules?: PackRules;
  processRules?: ProcessRules;
  structLayers?: StructLayer[];
  callbackUrl?: string;
}

// 自定义真人口播混剪
interface CustomRealmanBroadcastRequest extends RealmanBroadcastRequest {
  // materials 增加 entryPoint + duration 控制
}

// 素材混剪
interface MaterialMixcutRequest {
  styleId: string;
  materials: MaterialItem[];
  audioUrl?: string;          // 二选一
  content?: string;           // 3-1800 字符
  speakerId?: string;
  speakerExtra?: SpeakerExtra;
  language?: string;
  title?: string;
  introduceCard?: IntroduceCard;
  subtitle?: SubtitleItem[];
  packRules?: PackRules;
  processRules?: ProcessRules;
  structLayers?: StructLayer[];
  callbackUrl?: string;
}

// 新闻体视频
interface NewsMixcutRequest {
  styleId: string;
  title: string;              // 3-1800 字符
  materials: MaterialItem[];
  introduceCard?: IntroduceCard;
  packRules?: PackRules;
  processRules?: ProcessRules;
  structLayers?: StructLayer[];
  callbackUrl?: string;
}

// 自定义数字人口播混剪（场景级控制）
interface CustomVirtualmanBroadcastRequest {
  styleId: string;
  virtualmanId: string;
  speakerId: string;
  scenes: VideoScene[];
  title?: string;
  speakerExtra?: SpeakerExtra;
  introduceCard?: IntroduceCard;
  packRules?: PackRules;
  processRules?: ProcessRules;
  structLayers?: StructLayer[];
  callbackUrl?: string;
}

// 自定义素材混剪（场景级控制）
interface CustomMaterialMixcutRequest {
  styleId: string;
  scenes: VideoScene[];       // scenes[].materials 必填
  title?: string;
  speakerId?: string;
  speakerExtra?: SpeakerExtra;
  introduceCard?: IntroduceCard;
  packRules?: PackRules;
  processRules?: ProcessRules;
  structLayers?: StructLayer[];
  callbackUrl?: string;
}

// AI 封面生成
interface AICoverRequest {
  imageUrl: string;           // JPG/PNG, <=10MB, <=2000px
  templateId: string;
  processRules: {
    coverMainTitle: string;   // 1-50 字符
    coverSubtitle?: string;   // 1-50 字符
    coverKeywords?: string[]; // 每个 1-50 字符
    metadata?: Record<string, string>;
  };
  callbackUrl?: string;
}
```

### 3.6 任务查询与回调类型

```typescript
// 任务状态枚举
type TaskStatus = 'processing' | 'succeed' | 'failed';

// 任务查询结果
interface TaskResult {
  taskId: string;
  status: TaskStatus;
  result?: {
    videoUrl?: string;        // 视频任务
    audioUrl?: string;        // 音频/TTS 任务
    imageUrl?: string;        // 图片/封面任务
    text?: string;            // ASR 任务
    coverUrl?: string;        // 视频封面
    aiCoverSucceed?: boolean;
    duration?: number;        // 时长（秒）
    demoAudioUrl?: string;    // 声音克隆试听音频
    virtualmanId?: string;    // 数字人克隆结果 ID
    speakerId?: string;       // 声音克隆结果 ID
    subtitle?: SubtitleResult[];
  };
  errorCode?: string;
  errorMessage?: string;
}

interface SubtitleResult {
  text: string;
  startMs: string;
  endMs: string;
}

// Webhook 回调数据
interface WebhookPayload extends TaskResult {
  costRights?: {
    credits: number;          // 消耗的闪剪算力
  };
}
```

### 3.7 错误码映射

```typescript
// 闪剪错误码 → ClipFlow 业务错误码映射
const ERROR_MAP: Record<string, { status: number; code: string; message: string }> = {
  'Invalid.Authorization':     { status: 401, code: 'SHANJIAN_AUTH_FAILED',      message: '闪剪认证失败，请检查 API Key' },
  'Invalid.TrainAuth':         { status: 422, code: 'INVALID_AUTH_VIDEO',         message: '授权视频验证失败' },
  'Request.Limit':             { status: 429, code: 'RATE_LIMITED',               message: '请求过于频繁，请稍后重试' },
  'Concurrency.Limit':         { status: 429, code: 'CONCURRENCY_EXCEEDED',       message: '并发任务数已满，请排队等候' },
  'Account.NotExist':          { status: 403, code: 'SHANJIAN_ACCOUNT_ERROR',     message: '闪剪账户异常' },
  'Resource.NotExist':         { status: 404, code: 'RESOURCE_NOT_FOUND',         message: '数字人或声音资源不存在' },
  'Resource.Disable':          { status: 403, code: 'RESOURCE_DISABLED',          message: '资源已被禁用' },
  'Task.NotExist':             { status: 404, code: 'TASK_NOT_FOUND',             message: '任务不存在' },
  'Invalid.File.Format':       { status: 422, code: 'INVALID_FILE_FORMAT',        message: '文件格式不符合要求' },
  'Invalid.File.Resolution':   { status: 422, code: 'INVALID_FILE_RESOLUTION',    message: '文件分辨率超限' },
  'Invalid.File.Duration':     { status: 422, code: 'INVALID_FILE_DURATION',      message: '文件时长不符合要求' },
  'Invalid.File.Size':         { status: 422, code: 'INVALID_FILE_SIZE',          message: '文件大小超限' },
  'Invalid.File.FPS':          { status: 422, code: 'INVALID_FILE_FPS',           message: '帧率不符合要求' },
  'Invalid.File.Codec':        { status: 422, code: 'INVALID_FILE_CODEC',         message: '编码格式不支持' },
  'Invalid.File.Audio':        { status: 422, code: 'INVALID_AUDIO',              message: '音频检测异常' },
  'Invalid.Face.Detection':    { status: 422, code: 'FACE_NOT_DETECTED',          message: '未检测到人脸' },
  'Invalid.Face.Completeness': { status: 422, code: 'FACE_INCOMPLETE',            message: '人脸不完整（侧脸/遮挡）' },
  'Invalid.Speech':            { status: 422, code: 'SPEECH_QUALITY_LOW',         message: '语音质量不达标' },
  'Invalid.Face.Comparison':   { status: 422, code: 'FACE_MISMATCH',             message: '授权视频与训练视频人脸不匹配' },
  'Failed.Timeout':            { status: 504, code: 'PROCESSING_TIMEOUT',         message: '处理超时，请重试' },
  'Service.Error':             { status: 502, code: 'SHANJIAN_SERVICE_ERROR',     message: '闪剪服务异常，请稍后重试' },
};
```

---

## 4. 服务方法定义

### 4.1 资产查询

```typescript
class ShanjianClient {
  /**
   * 获取公共配音列表
   * GET /v1/assets/voice/common
   * MVP 用途：TTS 发音人选择、视频生成时的配音选择
   */
  async getPublicVoices(): Promise<ShanjianVoice[]>;

  /**
   * 获取公共数字人列表
   * GET /v1/assets/virtualman/common
   * MVP 用途：创建向导第二步的数字人选择列表（补充用户自建数字人）
   */
  async getPublicVirtualmen(): Promise<ShanjianVirtualman[]>;

  /**
   * 获取智能剪辑模板列表
   * GET /v1/clip/template
   * MVP 用途：视频生成时的模板选择
   * @param scene - 模板场景类型
   * @param options - 分页参数
   */
  async getTemplates(
    scene: 'virtualman' | 'realMan' | 'oralMixCutting' | 'newsMixCutting',
    options?: { pageSize?: number; sid?: string; searchKey?: string; searchValue?: string; sortBy?: 'desc' | 'asc' }
  ): Promise<{ results: ShanjianTemplate[]; sid: string }>;

  /**
   * 获取模板详情（含图层结构信息）
   * GET /v1/clip/template/detail/{id}
   * MVP 用途：视频生成前获取模板画布尺寸和图层布局
   */
  async getTemplateDetail(templateId: string): Promise<ShanjianTemplateDetail>;

  /**
   * 获取 AI 封面模板列表
   * GET /v1/clip/image/template
   * MVP 用途：视频封面生成时的模板选择
   */
  async getCoverTemplates(
    options?: { pageSize?: number; sid?: string }
  ): Promise<{ results: ShanjianCoverTemplate[]; sid: string }>;
}
```

### 4.2 克隆服务

```typescript
class ShanjianClient {
  /**
   * 专业数字人克隆
   * POST /v1/virtualman/train
   * 耗时 1-6 小时，消耗 500 算力
   * 训练视频要求：30-120s, <=1GB, 2K 以下, 10-60fps, H.264/HEVC, MP4/MOV
   */
  async cloneProfessionalAvatar(req: ProfessionalCloneRequest): Promise<string>; // → taskId

  /**
   * 极速数字人克隆（MVP 主用）
   * POST /v1/virtualman/fast/train
   * 无需等待训练，首次使用比后续慢 3-5 分钟
   * 训练视频要求：5-60s, <=500MB, 2K 以下, 10-60fps (推荐25fps), H.264/HEVC, MP4/MOV
   */
  async cloneFastAvatar(req: FastCloneRequest): Promise<string>; // → taskId

  /**
   * 图生数字人克隆
   * POST /v1/virtualman/image/train
   * 约 10 分钟完成
   * 图片要求：300-2000px, <=5MB, JPG/PNG/WebP, 宽高比 0.4-2.5
   */
  async cloneImageAvatar(req: ImageCloneRequest): Promise<string>; // → taskId

  /**
   * 声音克隆
   * POST /v1/voice/train
   * 模型能力：V1/V2 = 6 语言, V3 = 中英, S1/S3 = 40+ 语言
   * 音频要求：V1/V2/V3 = 5-120s, S1/S3 = 10-120s, <=10MB, mp3/wav/m4a
   */
  async cloneVoice(req: VoiceCloneRequest): Promise<string>; // → taskId

  /**
   * 删除数字人或声音（不可逆）
   * DELETE /v1/assets/{id}
   */
  async deleteAsset(assetId: string): Promise<void>;
}
```

### 4.3 效果服务

```typescript
class ShanjianClient {
  /**
   * 文字转语音 (TTS)
   * POST /v1/effect/tts
   * @returns taskId — 结果通过回调或轮询获取
   */
  async textToSpeech(req: TTSRequest): Promise<string>; // → taskId

  /**
   * 语音转文字 (ASR)
   * POST /v1/effect/asr
   * 支持 26 种语言（含中文方言）
   * 音频要求：<=5min, <=100MB, mp3/wav/m4a
   * @returns taskId
   */
  async audioToText(req: ASRRequest): Promise<string>; // → taskId
}
```

### 4.4 视频生成服务

```typescript
class ShanjianClient {
  /**
   * 数字人纯口播视频（无包装）
   * POST /v1/virtualman/video
   * 50 算力/分钟
   * 两种输入模式：text+speakerId 或 audioUrl
   */
  async generateRawVideo(req: VirtualmanVideoRequest): Promise<string>; // → taskId

  /**
   * 数字人口播混剪视频 ★ MVP 主力接口
   * POST /v1/clip/video/virtualman_broadcast
   * 70 算力/分钟
   * 数字人 + AI 配音 + 文案 + 素材，60+ 套模板一键包装
   */
  async generateVirtualmanBroadcast(req: VirtualmanBroadcastRequest): Promise<string>; // → taskId

  /**
   * 真人口播混剪视频
   * POST /v1/clip/video/realman_broadcast
   * 10 算力/分钟
   * 自动去除气口和无声片段
   */
  async generateRealmanBroadcast(req: RealmanBroadcastRequest): Promise<string>; // → taskId

  /**
   * 自定义真人口播混剪视频
   * POST /v1/clip/video/custom_realman_broadcast
   * 精细控制素材入场时间和时长
   */
  async generateCustomRealmanBroadcast(req: CustomRealmanBroadcastRequest): Promise<string>; // → taskId

  /**
   * 素材混剪视频
   * POST /v1/clip/video/broadcast_mixcut
   * 10 算力/分钟
   * 文案 + AI 语音 + 多场景素材自动生成
   */
  async generateMaterialMixcut(req: MaterialMixcutRequest): Promise<string>; // → taskId

  /**
   * 新闻体视频
   * POST /v1/clip/video/news_mixcut
   * 4 算力/分钟
   * 素材 + 标题 + 音乐快速生成新闻风格
   */
  async generateNewsMixcut(req: NewsMixcutRequest): Promise<string>; // → taskId

  /**
   * 自定义数字人口播混剪（场景级控制）
   * POST /v1/clip/video/custom_virtualman_broadcast
   * 按场景/镜头拆分控制
   */
  async generateCustomVirtualmanBroadcast(req: CustomVirtualmanBroadcastRequest): Promise<string>; // → taskId

  /**
   * 自定义素材混剪（场景级控制）
   * POST /v1/clip/video/custom_broadcast_mixcut
   */
  async generateCustomMaterialMixcut(req: CustomMaterialMixcutRequest): Promise<string>; // → taskId

  /**
   * AI 封面图片生成
   * POST /v1/clip/image/ai_cover
   */
  async generateAICover(req: AICoverRequest): Promise<string>; // → taskId
}
```

### 4.5 任务管理

```typescript
class ShanjianClient {
  /**
   * 查询任务详情
   * GET /v1/task/info?taskId={taskId}
   * 可查询所有类型的异步任务（克隆/TTS/ASR/视频/封面）
   */
  async getTaskInfo(taskId: string): Promise<TaskResult>;
}
```

---

## 5. MVP 接口使用矩阵

下表标注 ClipFlow MVP 所需的闪剪接口及其对应的产品能力：

| 闪剪接口 | MVP 使用 | 对应产品能力 | 算力消耗 |
|----------|---------|-------------|---------|
| GET /v1/assets/voice/common | ✅ | 配音选择 | 0 |
| GET /v1/assets/virtualman/common | ✅ | 公共数字人列表 | 0 |
| POST /v1/virtualman/fast/train | ✅ 主力 | 数字人极速克隆 | 0（免费） |
| POST /v1/virtualman/train | ⬡ 可选 | 数字人专业克隆 | 500/次 |
| POST /v1/virtualman/image/train | ⬡ 可选 | 图生数字人 | — |
| POST /v1/voice/train | ⬡ 可选 | 声音克隆 | — |
| DELETE /v1/assets/{id} | ✅ | 删除数字人/声音 | 0 |
| POST /v1/effect/tts | ✅ | TTS 配音 | — |
| POST /v1/effect/asr | ⬡ 可选 | 语音识别字幕 | — |
| POST /v1/virtualman/video | ⬜ MVP 后 | 裸口播视频 | 50/分钟 |
| POST /v1/clip/video/virtualman_broadcast | ✅ 核心 | 数字人口播混剪 | 70/分钟 |
| POST /v1/clip/video/realman_broadcast | ⬡ 可选 | 真人口播混剪 | 10/分钟 |
| POST /v1/clip/video/broadcast_mixcut | ⬡ 可选 | 素材混剪 | 10/分钟 |
| POST /v1/clip/video/news_mixcut | ⬜ MVP 后 | 新闻体视频 | 4/分钟 |
| POST /v1/clip/video/custom_virtualman_broadcast | ⬜ MVP 后 | 自定义数字人混剪 | 70/分钟 |
| POST /v1/clip/video/custom_realman_broadcast | ⬜ MVP 后 | 自定义真人混剪 | 10/分钟 |
| POST /v1/clip/video/custom_broadcast_mixcut | ⬜ MVP 后 | 自定义素材混剪 | 10/分钟 |
| GET /v1/clip/template | ✅ | 模板列表 | 0 |
| GET /v1/clip/template/detail/{id} | ✅ | 模板详情 | 0 |
| GET /v1/clip/image/template | ⬡ 可选 | AI 封面模板 | 0 |
| POST /v1/clip/image/ai_cover | ⬡ 可选 | AI 封面生成 | — |
| GET /v1/task/info | ✅ | 任务状态查询 | 0 |

**图例**：✅ MVP 必须  ⬡ MVP 可选  ⬜ MVP 后期

---

## 6. MVP 核心流程

### 6.1 数字人克隆流程

```
用户上传自拍视频 → OSS 直传
       │
       ▼
POST /api/avatars/create
       │
       ├─ 创建 avatar 记录 (status: uploading → cloning)
       ├─ 生成授权视频 URL（OSS 中）
       │
       ▼
ShanjianClient.cloneFastAvatar({
  videoUrl: ossUrl,
  authVideoUrl: authOssUrl,
  authText: "ClipFlow",
  callbackUrl: SHANJIAN_WEBHOOK_URL
})
       │
       ├─ 返回 taskId → 存入 avatar.external_task_id
       │
       ▼
等待闪剪回调（极速克隆无需训练，首次 3-5 分钟）
       │
       ▼
Webhook POST /api/webhook/shanjian
       │
       ├─ Redis SET NX 幂等检查 (webhook:{taskId}, TTL 24h)
       ├─ 查找 avatar by external_task_id
       │
       ├─ 成功：更新 avatar.status = 'ready'
       │        保存 virtualmanId + speakerId
       │
       └─ 失败：更新 avatar.status = 'failed'
                保存 errorCode + errorMessage
```

### 6.2 视频生成流程

```
创建向导第 3 步确认生成
       │
       ▼
POST /api/tasks/create
       │
       ├─ 额度预检（估算时长 × 70算力/分钟）
       ├─ 创建 video_task 记录 (status: processing)
       │
       ▼
ShanjianClient.generateVirtualmanBroadcast({
  styleId: template.id,
  virtualmanId: avatar.external_virtualman_id,
  content: script.content,
  speakerId: avatar.external_speaker_id,
  materials: assets.map(a => ({ fileUrl: a.oss_url, type: a.type })),
  title: script.title,
  packRules: {
    headerSwitch: true,
    subtitleSwitch: true,
    materialSwitch: true,
    backgroundMusic: { audioSwitch: true }
  },
  processRules: {
    watermarkShow: false,
    firstFrameCover: { coverSwitch: true }
  },
  callbackUrl: SHANJIAN_WEBHOOK_URL
})
       │
       ├─ 返回 taskId → 存入 video_task.external_task_id
       │
       ▼
等待闪剪回调（视频生成通常 30s-2min）
       │
       ▼
Webhook POST /api/webhook/shanjian
       │
       ├─ Redis SET NX 幂等检查
       ├─ 查找 video_task by external_task_id
       │
       ├─ 成功：
       │   ├─ 下载闪剪视频 → 转存 OSS（24 小时过期！）
       │   ├─ 下载封面图 → 转存 OSS
       │   ├─ 更新 video_task.status = 'completed'
       │   ├─ 保存 canonical video_url (OSS) + cover_url (OSS)
       │   ├─ 保存 duration + subtitle 数据
       │   ├─ 结算 credits_cost = ceil(duration / 60 * 50)
       │   └─ 扣减用户 credits
       │
       └─ 失败：
           ├─ 更新 video_task.status = 'failed'
           ├─ 保存 errorCode + errorMessage
           └─ 不扣减 credits
```

### 6.3 兜底轮询流程

```
Cron Job (每 5 分钟)
       │
       ▼
查找超时任务：
  - avatar:  status='cloning'  AND updated_at < now()-10min
  - video:   status='processing' AND updated_at < now()-5min
       │
       ▼
对每个超时任务：
  ├─ Redis SET NX 轮询锁 (poll:{taskId}, TTL 60s)
  ├─ ShanjianClient.getTaskInfo(external_task_id)
  │
  ├─ status='succeed' → 同回调成功逻辑
  ├─ status='failed'  → 同回调失败逻辑
  └─ status='processing' → 跳过（继续等待）
```

---

## 7. Webhook 处理规范

### 7.1 端点定义

```
POST /api/webhook/shanjian
```

### 7.2 处理流程

```typescript
async function handleWebhook(payload: WebhookPayload): Promise<void> {
  // 1. 幂等检查
  const isNew = await redis.set(`webhook:${payload.taskId}`, '1', 'NX', 'EX', 86400);
  if (!isNew) return; // 重复回调，忽略

  // 2. 识别任务类型
  const avatar = await db.avatar.findFirst({ where: { externalTaskId: payload.taskId } });
  if (avatar) {
    return handleAvatarCallback(avatar, payload);
  }

  const videoTask = await db.videoTask.findFirst({ where: { externalTaskId: payload.taskId } });
  if (videoTask) {
    return handleVideoCallback(videoTask, payload);
  }

  // 3. 未知 taskId → 记录日志，返回 200（不重试）
  logger.warn('Unknown taskId in webhook', { taskId: payload.taskId });
}
```

### 7.3 回调数据字段映射

| 任务类型 | 成功时关注字段 | 系统操作 |
|---------|-------------|---------|
| 极速/专业数字人克隆 | `virtualmanId`, `speakerId` | 更新 avatar 为 ready，绑定 ID |
| 图生数字人克隆 | `virtualmanId` | 更新 avatar 为 ready |
| 声音克隆 | `speakerId`, `demoAudioUrl` | 更新 voice 记录 |
| TTS | `audioUrl`, `duration`, `subtitle` | 存储音频文件 |
| ASR | `text`, `subtitle` | 返回识别结果 |
| 视频生成 | `videoUrl`, `coverUrl`, `duration`, `subtitle`, `aiCoverSucceed` | 转存 OSS → 更新 task → 结算 |
| AI 封面 | `imageUrl` | 转存 OSS |

### 7.4 安全措施

1. **仅处理已知 taskId**：callback 中的 taskId 必须在系统内有对应记录，否则丢弃
2. **Redis 幂等去重**：`SET NX` + 24h TTL，防止重复处理
3. **快速 ACK**：收到请求立即返回 200，异步处理业务逻辑（避免闪剪超时重试）
4. **签名验证**：如闪剪提供请求签名机制，在 middleware 层校验（当前文档未提及签名，需确认）

---

## 8. 文件格式校验规则

在调用闪剪 API 前，后端应进行前置校验，避免浪费 API 调用和用户等待：

### 8.1 训练视频校验

```typescript
const TRAINING_VIDEO_RULES = {
  professional: {
    duration: { min: 30, max: 120 },    // 秒
    maxSize: 1024 * 1024 * 1024,        // 1GB
    maxResolution: 2000,                 // 单边 px
    fps: { min: 10, max: 60 },
    formats: ['mp4', 'mov'],
    codecs: ['h264', 'hevc'],
  },
  fast: {
    duration: { min: 5, max: 60 },
    maxSize: 500 * 1024 * 1024,         // 500MB
    maxResolution: 2000,
    fps: { min: 10, max: 60 },          // 推荐 25fps
    formats: ['mp4', 'mov'],
    codecs: ['h264', 'hevc'],
  },
  image: {
    resolution: { min: 300, max: 2000 },
    maxSize: 5 * 1024 * 1024,           // 5MB
    formats: ['jpg', 'png', 'webp'],
    aspectRatio: { min: 0.4, max: 2.5 },
  },
};
```

### 8.2 素材校验

```typescript
const MATERIAL_RULES = {
  video: {
    formats: ['mp4', 'mov'],
    codecs: ['h264', 'hevc'],
    maxDuration: 60,                    // 单个素材 <60s
    maxSize: 500 * 1024 * 1024,
    maxResolution: 2000,
  },
  image: {
    formats: ['jpg', 'png', 'webp'],
    maxSize: 10 * 1024 * 1024,
    maxResolution: 2000,
  },
  audio: {
    formats: ['mp3', 'wav', 'm4a'],
    maxDuration: 300,                   // 5 分钟
    maxSize: 120 * 1024 * 1024,
  },
  totalDuration: 300,                   // 全部素材总时长 <=5 分钟
};
```

### 8.3 声音克隆音频校验

```typescript
const VOICE_CLONE_RULES: Record<VoiceModel, { duration: { min: number; max: number }; maxSize: number }> = {
  v1: { duration: { min: 5, max: 120 }, maxSize: 10 * 1024 * 1024 },
  v2: { duration: { min: 5, max: 120 }, maxSize: 10 * 1024 * 1024 },
  v3: { duration: { min: 5, max: 120 }, maxSize: 10 * 1024 * 1024 },
  s1: { duration: { min: 10, max: 120 }, maxSize: 10 * 1024 * 1024 },
  s3: { duration: { min: 10, max: 120 }, maxSize: 10 * 1024 * 1024 },
};
```

---

## 9. 算力成本与额度映射

### 9.1 闪剪算力消耗表

| 功能 | 算力/分钟 | 备注 |
|------|----------|------|
| 纯数字人口播 | 50 | 无包装 |
| 数字人口播混剪 | 70 | ★ MVP 主力 |
| 真人口播智剪 | 10 | |
| 素材混剪 | 10 | |
| 新闻体 | 4 | |
| 专业数字人克隆 | 500/次 | 固定消耗 |
| 极速数字人克隆 | 0 | 免费 |
| 声音克隆 V1-V3 | 0 | 套餐内 |

### 9.2 ClipFlow 额度换算

MVP 阶段 ClipFlow 内部 credit 与闪剪算力的换算关系：

```typescript
// 视频生成 credits 计算
function calculateCreditsCost(durationSeconds: number, videoType: string): number {
  const costPerMinute: Record<string, number> = {
    virtualman_broadcast: 70,
    realman_broadcast: 10,
    broadcast_mixcut: 10,
    news_mixcut: 4,
    virtualman_video: 50,
  };

  const rate = costPerMinute[videoType] ?? 70;
  const raw = (durationSeconds / 60) * rate;
  return Math.max(1, Math.round(raw * 100) / 100); // 最低 1，保留 2 位小数
}

// 预检估算（生成前）
function estimateCreditsCost(textLength: number, videoType: string): number {
  // 估算时长：约 300 字/分钟（中文口播语速）
  const estimatedMinutes = textLength / 300;
  const rate = costPerMinute[videoType] ?? 70;
  return Math.ceil(estimatedMinutes * rate);
}
```

---

## 10. 并发与限流

### 10.1 闪剪并发限制

闪剪按模块限制并发数（套餐决定），超并发的任务会**直接失败返回**（错误码 `Concurrency.Limit`），需要自行排队。

### 10.2 ClipFlow 应对策略

```typescript
// API Route 层面的排队机制
async function submitVideoTask(userId: string, request: VideoGenRequest) {
  // 1. 检查当前用户正在处理的任务数
  const activeTasks = await db.videoTask.count({
    where: { userId, status: 'processing' },
  });

  if (activeTasks >= MAX_CONCURRENT_PER_USER) {
    throw new AppError('CONCURRENT_LIMIT', '您有正在处理的视频，请等待完成后再提交');
  }

  // 2. 尝试提交到闪剪
  try {
    const taskId = await shanjian.generateVirtualmanBroadcast(request);
    return taskId;
  } catch (e) {
    if (e.code === 'CONCURRENCY_EXCEEDED') {
      // 闪剪并发超限 → 提示用户排队
      throw new AppError('SYSTEM_BUSY', '系统繁忙，请稍后重试');
    }
    throw e;
  }
}
```

### 10.3 建议的用户并发限制

| 套餐 | 同时处理视频数 | 同时克隆数字人数 |
|------|-------------|---------------|
| free | 1 | 1 |
| basic | 2 | 1 |
| pro | 5 | 2 |

---

## 11. 输出域名白名单

闪剪生成的结果文件来自以下域名，系统在下载转存 OSS 时需要信任这些域名：

| 类型 | 域名 |
|------|------|
| 纯口播视频（无水印） | `*.cos.ap-guangzhou.myqcloud.com` |
| 纯口播视频（加水印） | `*.cos.ap-beijing.myqcloud.com` |
| 口播混剪视频 | `*.oss-cn-beijing.aliyuncs.com` |
| TTS 音频 | `*.oss-cn-beijing.aliyuncs.com` |

---

## 12. 结果过期与转存策略

### 12.1 核心约束

> **闪剪生成的视频和音频结果仅保留 24 小时。**
> 素材文件不存储，仅单次临时使用。

### 12.2 转存流程

```typescript
async function persistVideoResult(
  taskId: string,
  result: TaskResult['result']
): Promise<{ videoUrl: string; coverUrl?: string }> {
  // 1. 下载闪剪视频到内存/临时文件
  const videoBuffer = await downloadFile(result.videoUrl!);

  // 2. 上传到 ClipFlow OSS
  const ossVideoKey = `videos/${taskId}/output.mp4`;
  const ossVideoUrl = await oss.upload(ossVideoKey, videoBuffer);

  // 3. 如有封面，同步转存
  let ossCoverUrl: string | undefined;
  if (result.coverUrl) {
    const coverBuffer = await downloadFile(result.coverUrl);
    const ossCoverKey = `videos/${taskId}/cover.jpg`;
    ossCoverUrl = await oss.upload(ossCoverKey, coverBuffer);
  }

  return { videoUrl: ossVideoUrl, coverUrl: ossCoverUrl };
}
```

### 12.3 转存时机

- **Webhook 回调时**：收到成功回调后立即触发转存（主路径）
- **兜底轮询时**：轮询发现任务完成后也触发转存
- **超时保护**：如果转存失败，标记 task 为 `persist_failed` 状态，不丢失 URL，允许手动重试

---

## 13. 语言代码参考

### 13.1 TTS 支持语言

| 模型 | 支持语言 |
|------|---------|
| V1/V2 | zh-CN, en-US, ja-JP, es-ES, id-ID, pt-BR（6 种）|
| V3 | zh-CN, en-US（2 种）|
| S1/S3 | 40+ 种主流语言 |

### 13.2 ASR 支持语言（26 种）

包含中文普通话及方言、英语、日语、韩语、西班牙语、法语、德语、葡萄牙语、意大利语、俄语、阿拉伯语、印地语、印尼语、泰语、越南语、马来语等。

---

## 14. 关键注意事项

### 14.1 多音字处理

闪剪当前不支持拼音标注，对于多音字发音错误，使用**同音字替代**策略。系统在 TTS 和视频生成文案中保留原文显示，仅将音频合成文本替换为同音字。

### 14.2 授权视频要求

数字人克隆必须提供授权视频，内容格式示例：

> "我是 xxx（真实姓名），我授权【ClipFlow】使用视频中的肖像、声音，为我生成定制数字人及声音，并在本人【ClipFlow】账号中创作使用。"

### 14.3 数字人拍摄要求（需告知用户）

- 光线充足、安静环境
- 第一秒闭嘴
- 不遮挡嘴巴
- 不拍侧脸（侧脸幅度不超 45°）
- 画面中只有一个人
- 人物始终在画面内

### 14.4 声音克隆录制要求（需告知用户）

- 安静环境（无杂音、噪音、回声、混响）
- 麦克风距嘴约 10cm
- 情绪稳定，语速均匀
- 使用普通话，避免方言和英文混杂

### 14.5 内容审核

闪剪接入第三方审核平台（树美），涵盖政治、色情、暴力内容检查。审核不通过仅返回大类（黄、赌、毒、涉政），不指出具体位置。

**ClipFlow 应对**：
- 在生成失败时将审核相关错误码翻译为用户可理解的提示
- 提示用户检查文案和素材中是否包含敏感内容后重试

### 14.6 模板行数限制

新闻体视频的标题行数不应超过模板封面的行数，超出会回退到默认模板。系统应在生成前根据模板约束截断或警告。

---

## 15. 闪剪 API 端点汇总

| # | 方法 | 路径 | 描述 | 文档 |
|---|------|------|------|------|
| 1 | GET | /v1/assets/voice/common | 公共配音列表 | [Doc](https://openapi-doc.shanjian.tv/397345823e0) |
| 2 | GET | /v1/assets/virtualman/common | 公共数字人列表 | [Doc](https://openapi-doc.shanjian.tv/397369717e0) |
| 3 | POST | /v1/virtualman/train | 专业数字人克隆 | [Doc](https://openapi-doc.shanjian.tv/342231002e0) |
| 4 | POST | /v1/virtualman/fast/train | 极速数字人克隆 | [Doc](https://openapi-doc.shanjian.tv/342232918e0) |
| 5 | POST | /v1/virtualman/image/train | 图生数字人克隆 | [Doc](https://openapi-doc.shanjian.tv/347502607e0) |
| 6 | POST | /v1/voice/train | 声音克隆 | [Doc](https://openapi-doc.shanjian.tv/342241374e0) |
| 7 | DELETE | /v1/assets/{id} | 删除数字人/声音 | [Doc](https://openapi-doc.shanjian.tv/344550029e0) |
| 8 | POST | /v1/effect/tts | 文字转语音 | [Doc](https://openapi-doc.shanjian.tv/359919256e0) |
| 9 | POST | /v1/effect/asr | 语音转文字 | [Doc](https://openapi-doc.shanjian.tv/342294933e0) |
| 10 | POST | /v1/virtualman/video | 数字人纯口播 | [Doc](https://openapi-doc.shanjian.tv/342245572e0) |
| 11 | POST | /v1/clip/video/virtualman_broadcast | 数字人口播混剪 | [Doc](https://openapi-doc.shanjian.tv/342271033e0) |
| 12 | POST | /v1/clip/video/realman_broadcast | 真人口播混剪 | [Doc](https://openapi-doc.shanjian.tv/342282685e0) |
| 13 | POST | /v1/clip/video/custom_realman_broadcast | 自定义真人口播混剪 | [Doc](https://openapi-doc.shanjian.tv/360232310e0) |
| 14 | POST | /v1/clip/video/broadcast_mixcut | 素材混剪 | [Doc](https://openapi-doc.shanjian.tv/347508346e0) |
| 15 | POST | /v1/clip/video/news_mixcut | 新闻体视频 | [Doc](https://openapi-doc.shanjian.tv/347517114e0) |
| 16 | POST | /v1/clip/video/custom_virtualman_broadcast | 自定义数字人口播混剪 | [Doc](https://openapi-doc.shanjian.tv/354590181e0) |
| 17 | POST | /v1/clip/video/custom_broadcast_mixcut | 自定义素材混剪 | [Doc](https://openapi-doc.shanjian.tv/354615984e0) |
| 18 | GET | /v1/clip/template | 智能剪辑模板列表 | [Doc](https://openapi-doc.shanjian.tv/342258231e0) |
| 19 | GET | /v1/clip/template/detail/{id} | 模板详情 | [Doc](https://openapi-doc.shanjian.tv/382122111e0) |
| 20 | GET | /v1/clip/image/template | AI 封面模板列表 | [Doc](https://openapi-doc.shanjian.tv/389221892e0) |
| 21 | POST | /v1/clip/image/ai_cover | AI 封面生成 | [Doc](https://openapi-doc.shanjian.tv/389226151e0) |
| 22 | GET | /v1/task/info | 查询任务详情 | [Doc](https://openapi-doc.shanjian.tv/342296170e0) |

---
---

# Part 2: 抖音热榜采集服务

---

## 16. 概述

ClipFlow 通过定时采集抖音热搜榜数据，为用户提供「蹭热点」的营销灵感。热榜数据与内容模板系统联动，帮助小白用户快速找到当下最有流量的话题，并匹配到合适的脚本模板。

### 16.1 产品价值

- **降低选题门槛**：用户不需要自己刷抖音找灵感，系统直接呈现当前热门话题
- **提升内容时效性**：营销视频蹭上热点话题可获得平台流量加权
- **串联模板推荐**：热点话题 → 匹配行业模板 → 一键生成视频，缩短用户决策路径

### 16.2 数据源

**API 端点**: `https://v2.xxapi.cn/api/douyinhot`

- 免费、无需认证
- 返回约 50 条热搜条目
- 数据来源于抖音实时热搜榜
- 无 SLA 保证（免费社区服务）

**降级方案**：如 xxapi 不可用，可切换至备用源：
- `https://api.vvhan.com/api/hotlist/douyinHot`（免费、无需 Key）
- `https://apis.tianapi.com/douyinhot/index`（需 API Key，有 SLA）
- 自建 DailyHotApi 实例（GitHub: imsyy/DailyHotApi）

---

## 17. 抖音热榜数据模型

### 17.1 API 响应结构

```typescript
// xxapi.cn 返回结构
interface DouyinHotListResponse {
  code: number;           // 200 = 成功
  msg: string;            // "success"
  data: DouyinHotItem[];
  request_id: string;
}

interface DouyinHotItem {
  word: string;                    // 热搜关键词（如 "火箭热火冲突6人被驱逐"）
  hot_value: number;               // 热度值（如 12244807）
  position: number;                // 排名位置
  sentence_id: string;             // 话题唯一 ID
  group_id: string;                // 分组 ID
  label: number;                   // 标签类型（0=普通, 1=新, 2=热, 3=荐）
  event_time: number;              // Unix 时间戳
  video_count: number;             // 相关视频数
  discuss_video_count: number;     // 讨论视频数
  word_cover: {                    // 封面图
    uri: string;
    url_list: string[];
  } | null;
  word_type: number;               // 话题类型
  sentence_tag: number;            // 话题标签
  display_style: number;           // 展示样式
  can_extend_detail: boolean;      // 是否可展开详情
  hotlist_param: string;           // 热榜参数（JSON 序列化）
  word_sub_board: number[] | null; // 子分类板块
  related_words: string[] | null;  // 关联词
  aweme_infos: unknown | null;     // 关联视频信息
  article_detail_count: number;    // 相关文章数
  drift_info: unknown | null;      // 漂移信息
}
```

### 17.2 数据库模型

```prisma
// schema.prisma

model DouyinHotItem {
  id              String   @id @default(cuid())
  sentenceId      String   // 抖音话题 ID（去重键）
  word            String   // 热搜关键词
  hotValue        Int      // 热度值
  position        Int      // 排名
  label           Int      @default(0)  // 0=普通 1=新 2=热 3=荐
  videoCount      Int      @default(0)
  discussCount    Int      @default(0)
  coverUrl        String?  // 封面图 URL
  eventTime       DateTime // 话题事件时间
  fetchedAt       DateTime @default(now()) // 采集时间（每小时一批）
  batchId         String   // 批次 ID（同一次采集的标识）

  @@unique([sentenceId, batchId])
  @@index([fetchedAt])
  @@index([position])
}

model DouyinHotSnapshot {
  id         String   @id @default(cuid())
  batchId    String   @unique
  fetchedAt  DateTime @default(now())
  itemCount  Int
  rawJson    Json?    // 原始 JSON 备份（debug 用）
  status     String   @default("success") // success | failed | partial
}
```

### 17.3 ClipFlow 内部热榜模型

```typescript
// 面向前端的精简数据结构
interface HotTopic {
  id: string;
  rank: number;              // 排名
  title: string;             // 热搜词
  hotValue: number;          // 热度值
  label: 'normal' | 'new' | 'hot' | 'recommended';
  videoCount: number;        // 相关视频数
  coverUrl: string | null;   // 封面图
  douyinSearchUrl: string;   // 抖音搜索链接
  fetchedAt: string;         // 采集时间 ISO
}
```

---

## 18. 热榜采集服务

### 18.1 采集架构

```
┌─────────────────────────────────────────────┐
│  Cron Job (每小时执行)                        │
│  app/api/cron/douyin-hot/route.ts           │
│                                             │
│  ┌─────────────┐    ┌─────────────────────┐ │
│  │ 采集器       │    │ 降级链               │ │
│  │ fetchHotList │───▶│ xxapi → vvhan → DB缓存│ │
│  └──────┬──────┘    └─────────────────────┘ │
│         │                                    │
│         ▼                                    │
│  ┌──────────────┐   ┌──────────────────┐    │
│  │ 去重 & 入库   │   │ Redis 缓存        │    │
│  │ DouyinHotItem│   │ douyin:hot:latest │    │
│  │ + Snapshot   │   │ TTL = 70min       │    │
│  └──────────────┘   └──────────────────┘    │
└─────────────────────────────────────────────┘
```

### 18.2 服务实现

```typescript
// lib/douyin-hot.ts

class DouyinHotService {
  private readonly PRIMARY_URL = 'https://v2.xxapi.cn/api/douyinhot';
  private readonly FALLBACK_URL = 'https://api.vvhan.com/api/hotlist/douyinHot';
  private readonly CACHE_KEY = 'douyin:hot:latest';
  private readonly CACHE_TTL = 70 * 60; // 70 分钟（略长于采集间隔，防间隙）

  /**
   * 定时采集入口（Cron 调用）
   * 每小时执行一次
   */
  async fetchAndStore(): Promise<{ batchId: string; itemCount: number }> {
    const batchId = `batch_${Date.now()}`;

    // 1. 带降级的数据抓取
    const items = await this.fetchWithFallback();

    // 2. 批量入库（upsert 去重）
    await this.storeBatch(batchId, items);

    // 3. 写入 Redis 缓存（前端读取走缓存）
    await this.cacheLatest(items);

    // 4. 记录快照
    await db.douyinHotSnapshot.create({
      data: { batchId, itemCount: items.length, status: 'success' },
    });

    return { batchId, itemCount: items.length };
  }

  /**
   * 带降级链的数据抓取
   */
  private async fetchWithFallback(): Promise<DouyinHotItem[]> {
    try {
      return await this.fetchFromXxapi();
    } catch (e) {
      logger.warn('xxapi failed, falling back to vvhan', { error: e.message });
      try {
        return await this.fetchFromVvhan();
      } catch (e2) {
        logger.error('All hot list sources failed', { error: e2.message });
        throw new Error('DOUYIN_HOT_FETCH_FAILED');
      }
    }
  }

  /**
   * 获取最新热榜（前端 API 调用）
   * 优先从 Redis 缓存读取，缓存未命中则从 DB 读取最近一批
   */
  async getLatestHotList(): Promise<HotTopic[]>;

  /**
   * 获取历史热榜（按日期/批次）
   */
  async getHistoryByDate(date: string): Promise<HotTopic[]>;
}
```

### 18.3 Cron 配置

```typescript
// app/api/cron/douyin-hot/route.ts
// Vercel Cron: 每小时执行

export const runtime = 'nodejs';
export const maxDuration = 30; // 30 秒超时足够

export async function GET(request: Request) {
  // 验证 Cron 密钥（防止外部触发）
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const result = await douyinHotService.fetchAndStore();
  return Response.json({ ok: true, ...result });
}
```

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/douyin-hot",
      "schedule": "0 * * * *"
    }
  ]
}
```

### 18.4 环境变量

```env
CRON_SECRET=                     # Cron 调用鉴权密钥
DOUYIN_HOT_PRIMARY_URL=https://v2.xxapi.cn/api/douyinhot
DOUYIN_HOT_FALLBACK_URL=https://api.vvhan.com/api/hotlist/douyinHot
```

### 18.5 数据保留策略

| 数据 | 保留周期 | 清理方式 |
|------|---------|---------|
| Redis 缓存 | 70 分钟 TTL | 自动过期 |
| DB 热搜条目 | 30 天 | Cron 每日清理 `fetchedAt < 30d ago` |
| DB 快照记录 | 90 天 | Cron 每日清理 |

---

## 19. 热榜前端 API

### 19.1 获取当前热榜

```
GET /api/hot-topics
```

**响应**:

```json
{
  "data": {
    "topics": [
      {
        "id": "1947544",
        "rank": 1,
        "title": "某某事件引发热议",
        "hotValue": 12244807,
        "label": "hot",
        "videoCount": 58423,
        "coverUrl": "https://...",
        "douyinSearchUrl": "https://www.douyin.com/search/某某事件引发热议",
        "fetchedAt": "2026-03-18T10:00:00Z"
      }
    ],
    "updatedAt": "2026-03-18T10:00:00Z"
  }
}
```

### 19.2 热点 → 脚本灵感（与 AI 脚本生成联动）

```
POST /api/scripts/generate
```

**请求**:

```json
{
  "industry": "房产中介",
  "sellingPoints": ["学区房", "地铁口"],
  "city": "深圳",
  "hotTopic": "某某政策出台"     // ← 新增：关联热点话题
}
```

AI 脚本生成提示词模板增加热点融合逻辑：

```
你是营销短视频脚本专家。用户行业：{industry}，城市：{city}，卖点：{sellingPoints}。
当前抖音热点话题：「{hotTopic}」（热度：{hotValue}）。
请生成 3 条口播脚本，其中至少 1 条自然融入当前热点话题，提升视频时效性和流量潜力。
脚本遵循 358 结构：3 秒钩子 → 5 秒痛点 → 每 8 秒一个反转/亮点。
```

---
---

# Part 3: 内容模板运营管理系统

---

## 20. 概述

内容模板是 ClipFlow 的核心运营资产。运营人员（而非用户）负责策划、创建和管理高质量的营销脚本模板，让小白用户"选模板 → 填信息 → 出视频"。模板系统是 ClipFlow 从"工具"升级为"营销专家平台"的关键壁垒。

### 20.1 模板定义

一个「内容模板」= **脚本框架** + **视频风格指引** + **行业/场景标签** + **热点关联规则**

| 维度 | 说明 | 示例 |
|------|------|------|
| 脚本框架 | 带变量槽位的口播文案结构 | "你还在为{痛点}发愁吗？{品牌}帮你{解决方案}..." |
| 视频风格 | 绑定的闪剪模板 styleId + 包装参数 | 数字人口播混剪，字幕居底，品牌身份栏 |
| 行业标签 | 适用行业 | 房产、教育、电商、餐饮 |
| 内容类型 | 脚本结构类型 | 产品介绍、促销活动、知识分享、故事叙述 |
| 热点关联 | 可蹭热点的关键词/话题类型 | 季节性、政策类、节日类 |

### 20.2 358 脚本结构标准

所有模板脚本遵循短视频黄金结构：

```
┌─────────────────────────────────────┐
│  0-3s   钩子（Hook）                  │
│  ├─ 价格利益钩   "只要99元..."        │
│  ├─ 权威推荐钩   "十年老中医告诉你..." │
│  ├─ 人群锚定钩   "宝妈们注意了..."     │
│  ├─ 痛点直击钩   "还在为XX发愁？"      │
│  ├─ 效果展示钩   "看看这个效果..."     │
│  ├─ 好奇心钩     "99%的人不知道..."    │
│  ├─ 提问钩       "你知道XX吗？"       │
│  ├─ 反常识钩     "千万别XX..."        │
│  └─ 情绪共鸣钩   "每次看到XX..."      │
├─────────────────────────────────────┤
│  3-8s   痛点（Pain Point）            │
│  描述目标用户的真实困境                │
├─────────────────────────────────────┤
│  8-16s  解决方案 + 卖点（Solution）    │
│  每 8 秒一个亮点/反转                  │
├─────────────────────────────────────┤
│  最后 3s  行动号召（CTA）              │
│  "点击下方链接 / 私信咨询 / 关注获取"  │
└─────────────────────────────────────┘
```

---

## 21. 模板数据模型

### 21.1 Prisma Schema

```prisma
// 内容模板
model ContentTemplate {
  id              String   @id @default(cuid())
  name            String                          // 模板名称（运营可见）
  displayName     String                          // 面向用户的展示名称
  description     String?                         // 模板说明

  // 脚本框架
  scriptTemplate  String   @db.Text               // 带变量槽位的脚本文案
  variables       Json     @default("[]")          // 变量定义 [{key, label, placeholder, required}]
  hookType        String?                          // 钩子类型：price|authority|audience|pain|effect|curiosity|question|reverse|emotion

  // 视频风格绑定
  shanjianStyleId String?                          // 绑定的闪剪模板 ID
  videoType       String   @default("virtualman_broadcast") // 视频生成类型
  packRulesJson   Json?                            // 预设的 packRules
  processRulesJson Json?                           // 预设的 processRules

  // 分类标签
  industry        String[]                         // 适用行业 ["房产","教育","电商"]
  contentType     String                           // 内容类型：product_intro|promotion|knowledge|story|testimonial
  tags            String[]                         // 自由标签
  seasonalEvent   String?                          // 关联季节/节日事件

  // 运营管理
  status          String   @default("draft")       // draft|review|published|archived
  sortOrder       Int      @default(0)             // 排序权重（越大越靠前）
  featured        Boolean  @default(false)         // 是否推荐/置顶
  usageCount      Int      @default(0)             // 使用次数统计

  // 审核
  createdBy       String                           // 创建人（管理员 ID）
  reviewedBy      String?                          // 审核人
  publishedAt     DateTime?                        // 发布时间
  archivedAt      DateTime?                        // 下架时间

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([status])
  @@index([industry])
  @@index([contentType])
  @@index([sortOrder])
  @@index([featured, status])
}

// 模板变量定义
// 存储在 ContentTemplate.variables JSON 字段中
// interface TemplateVariable {
//   key: string;           // 变量标识 如 "painPoint"
//   label: string;         // 中文标签 如 "痛点描述"
//   placeholder: string;   // 占位提示 如 "输入您客户最常见的困扰"
//   required: boolean;
//   type: 'text' | 'textarea' | 'select';
//   options?: string[];    // type=select 时的选项
// }
```

### 21.2 TypeScript 类型

```typescript
// 模板完整类型
interface ContentTemplate {
  id: string;
  name: string;
  displayName: string;
  description: string | null;

  scriptTemplate: string;        // "你还在为{{painPoint}}发愁吗？..."
  variables: TemplateVariable[];
  hookType: HookType | null;

  shanjianStyleId: string | null;
  videoType: VideoType;
  packRules: PackRules | null;
  processRules: ProcessRules | null;

  industry: string[];
  contentType: ContentType;
  tags: string[];
  seasonalEvent: string | null;

  status: TemplateStatus;
  sortOrder: number;
  featured: boolean;
  usageCount: number;

  createdBy: string;
  reviewedBy: string | null;
  publishedAt: string | null;
}

type TemplateStatus = 'draft' | 'review' | 'published' | 'archived';
type ContentType = 'product_intro' | 'promotion' | 'knowledge' | 'story' | 'testimonial';
type HookType = 'price' | 'authority' | 'audience' | 'pain' | 'effect' | 'curiosity' | 'question' | 'reverse' | 'emotion';
type VideoType = 'virtualman_broadcast' | 'realman_broadcast' | 'broadcast_mixcut' | 'news_mixcut';

interface TemplateVariable {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
  type: 'text' | 'textarea' | 'select';
  options?: string[];
}
```

---

## 22. 模板生命周期管理

### 22.1 状态流转

```
                 ┌─────────┐
        创建 ───▶│  draft   │
                 └────┬────┘
                      │ 提交审核
                      ▼
                 ┌─────────┐
                 │  review  │
                 └────┬────┘
                      │ 审核通过          审核拒绝
                      ▼                    │
                 ┌─────────┐              ▼
                 │published │◀──── 重新提交 ── draft
                 └────┬────┘
                      │ 下架
                      ▼
                 ┌─────────┐
                 │ archived │──── 重新上架 ──▶ published
                 └─────────┘
```

### 22.2 管理员 API

```
# 模板 CRUD（仅管理员）
POST   /api/admin/templates              # 创建模板
GET    /api/admin/templates              # 模板列表（含全部状态）
GET    /api/admin/templates/:id          # 模板详情
PUT    /api/admin/templates/:id          # 编辑模板
DELETE /api/admin/templates/:id          # 删除模板（仅 draft 状态可删）

# 状态变更
POST   /api/admin/templates/:id/submit   # draft → review
POST   /api/admin/templates/:id/approve  # review → published
POST   /api/admin/templates/:id/reject   # review → draft（附 reason）
POST   /api/admin/templates/:id/archive  # published → archived
POST   /api/admin/templates/:id/restore  # archived → published

# 排序与推荐
PUT    /api/admin/templates/:id/sort     # 调整排序权重
PUT    /api/admin/templates/:id/feature  # 设为推荐/取消推荐

# 批量操作
POST   /api/admin/templates/batch-archive   # 批量下架
POST   /api/admin/templates/batch-publish   # 批量发布
```

### 22.3 用户端 API

```
# 用户浏览模板（仅 published 状态）
GET /api/templates                       # 模板列表
    ?industry=房产                        # 按行业筛选
    &contentType=product_intro           # 按内容类型筛选
    &featured=true                       # 仅推荐模板
    &search=钩子                          # 关键词搜索
    &page=1&pageSize=20

GET /api/templates/:id                   # 模板详情（含变量定义）

# 使用模板生成脚本
POST /api/templates/:id/generate-script  # 填入变量 → 渲染脚本文案
```

### 22.4 模板渲染引擎

```typescript
// lib/template-engine.ts

/**
 * 将模板脚本 + 用户填写的变量值渲染为最终脚本
 * 模板语法：{{variableKey}} 双花括号占位
 */
function renderTemplate(
  scriptTemplate: string,
  variables: Record<string, string>
): string {
  return scriptTemplate.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match; // 未填变量保留占位符
  });
}

// 示例：
// 模板: "你还在为{{painPoint}}发愁吗？{{brand}}帮你{{solution}}，现在{{cta}}！"
// 变量: { painPoint: "获客难", brand: "XX教育", solution: "精准引流", cta: "私信领取方案" }
// 输出: "你还在为获客难发愁吗？XX教育帮你精准引流，现在私信领取方案！"
```

---

## 23. 模板分类体系

### 23.1 行业分类（MVP 首批）

| 行业代码 | 行业名称 | 典型痛点 |
|---------|---------|---------|
| real_estate | 房产中介 | 获客难、信任度低、房源展示单一 |
| ecommerce | 电商卖家 | 商品同质化、转化率低、退货率高 |
| education | 教育培训 | 招生难、课程展示枯燥、家长信任 |
| food | 餐饮美食 | 到店率低、新品推广、口碑传播 |
| beauty | 美容美妆 | 效果展示、信任建立、复购引导 |
| auto | 汽车销售 | 到店率低、车型对比、金融方案 |
| health | 健康养生 | 信任门槛高、效果可视化 |
| local_service | 本地生活服务 | 覆盖范围、服务展示、口碑 |

### 23.2 内容类型

| 类型 | 说明 | 适用场景 |
|------|------|---------|
| product_intro | 产品/服务介绍 | 新品上市、核心卖点展示 |
| promotion | 促销/活动 | 限时优惠、节日活动、开业 |
| knowledge | 知识分享 | 行业科普、使用技巧、避坑指南 |
| story | 故事叙述 | 品牌故事、客户案例、创业经历 |
| testimonial | 客户见证 | 使用效果、口碑推荐 |

### 23.3 热点关联规则

```typescript
// 模板可声明其适合蹭的热点类型
interface HotTopicRule {
  // 关键词匹配（热搜词包含这些关键词时推荐此模板）
  keywords?: string[];        // ["政策", "利率", "房价"]

  // 季节/节日匹配
  seasonalEvents?: string[];  // ["spring_festival", "618", "double_11", "mid_autumn"]

  // 话题分类匹配（基于 word_sub_board）
  topicCategories?: number[];
}

// 热点 → 模板匹配逻辑
async function matchTemplatesForHotTopic(topic: HotTopic): Promise<ContentTemplate[]> {
  // 1. 关键词匹配：热搜词中包含模板声明的关键词
  const keywordMatches = await db.contentTemplate.findMany({
    where: {
      status: 'published',
      // tags 或 seasonalEvent 中包含与热搜词相关的关键词
    },
  });

  // 2. 按行业相关性 + 使用量排序
  return sortByRelevance(keywordMatches, topic);
}
```

---

## 24. 管理员认证与权限

### 24.1 角色定义

```typescript
type AdminRole = 'editor' | 'reviewer' | 'admin';

const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  editor: [
    'template.create',
    'template.edit',       // 仅自己创建的
    'template.submit',     // draft → review
  ],
  reviewer: [
    'template.create',
    'template.edit',       // 所有模板
    'template.submit',
    'template.approve',    // review → published
    'template.reject',     // review → draft
    'template.archive',
    'hot_topics.view',
  ],
  admin: [
    '*',                   // 全部权限
    'template.delete',
    'template.bulk_ops',
    'admin.manage_users',
  ],
};
```

### 24.2 管理后台认证

MVP 阶段管理后台采用简单方案：

```typescript
// 管理员用户表（与普通用户分离）
model AdminUser {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String   // bcrypt hash
  name      String
  role      String   @default("editor") // editor | reviewer | admin
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

管理后台路由挂载在 `/admin/*`，独立认证中间件校验 AdminUser JWT。

---
---

# Part 4: 1000 用户规模架构设计

---

## 25. 规模假设与容量规划

### 25.1 用户行为假设

| 指标 | 假设值 | 计算依据 |
|------|--------|---------|
| 注册用户 | 1,000 | 目标规模 |
| 日活用户 (DAU) | 200-300 | 25-30% 日活率 |
| 每用户日均生成视频 | 2-3 条 | 营销场景，非高频 |
| 日均视频生成任务 | 500-900 条 | DAU × 每人 3 条 |
| 峰值并发在线 | 50-80 | DAU 的 20-30% |
| 峰值同时生成视频 | 15-25 | 并发用户的 30% 在生成 |
| 数字人克隆 | 5-10 次/天 | 低频操作 |

### 25.2 闪剪 API 调用量估算

| 接口 | 日调用量 | 月调用量 |
|------|---------|---------|
| 视频生成（virtualman_broadcast） | 500-900 | 15,000-27,000 |
| 任务查询（task/info） | 1,000-2,000 | 30,000-60,000 |
| 模板列表（clip/template） | 500-800 | 15,000-24,000 |
| 公共数字人/配音列表 | 300-500 | 9,000-15,000 |
| TTS | 200-400 | 6,000-12,000 |
| 数字人克隆 | 5-10 | 150-300 |

### 25.3 存储量估算

| 数据 | 单条大小 | 月增量 | 年总量 |
|------|---------|--------|--------|
| 视频文件 (OSS) | 30-80MB | 600GB-2TB | 7-24TB |
| 封面图片 (OSS) | 200KB-1MB | 5-27GB | 60-320GB |
| 素材文件 (OSS) | 10-50MB | 200GB-500GB | 2-6TB |
| DB 记录 | ~2KB/行 | ~50MB | ~600MB |
| 热榜数据 (DB) | ~500B/条 | ~35MB | ~420MB |

---

## 26. 基础设施规格建议

### 26.1 最小部署架构

```
┌─────────────────────────────────────────────────────┐
│  Vercel (Next.js)                                   │
│  ├─ Serverless Functions (API Routes)               │
│  ├─ Edge Functions (静态页面 + 缓存)                 │
│  └─ Cron Jobs (热榜采集 + 兜底轮询)                  │
├─────────────────────────────────────────────────────┤
│  数据层                                              │
│  ├─ PostgreSQL (Supabase / Neon / RDS)              │
│  │   └─ 推荐: 2vCPU, 4GB RAM, 50GB SSD             │
│  ├─ Redis (Upstash / ElastiCache)                   │
│  │   └─ 推荐: 256MB 足够（仅幂等 + 缓存）            │
│  └─ OSS (阿里云 / S3)                               │
│      └─ 按量计费                                     │
└─────────────────────────────────────────────────────┘
```

### 26.2 各组件配置

| 组件 | 规格 | 月成本估算 |
|------|------|----------|
| Vercel Pro | Serverless, 1000 GB-hours | ~$20/月 |
| PostgreSQL (Neon) | 2vCPU, 4GB, 50GB | ~$25-50/月 |
| Redis (Upstash) | 256MB, 按请求计费 | ~$10/月 |
| 阿里云 OSS | 按量，1TB 存储 + 流量 | ~$50-100/月 |
| 闪剪 API | 按算力套餐 | 按需 |
| LLM API | 按 token 计费 | ~$20-50/月 |

**总计: ~$125-250/月** 支撑 1000 用户规模。

---

## 27. 性能优化策略

### 27.1 缓存层设计

```typescript
// 缓存策略总表
const CACHE_STRATEGY = {
  // 公共数据 — 不频繁变化，长缓存
  'shanjian:voices':        { ttl: 24 * 3600, source: 'redis' },  // 公共配音列表
  'shanjian:virtualmen':    { ttl: 24 * 3600, source: 'redis' },  // 公共数字人列表
  'shanjian:templates':     { ttl: 6 * 3600,  source: 'redis' },  // 模板列表（按 scene）

  // 热榜数据 — 每小时更新
  'douyin:hot:latest':      { ttl: 70 * 60,   source: 'redis' },  // 当前热榜

  // 内容模板 — 运营更新时主动失效
  'templates:published':    { ttl: 30 * 60,   source: 'redis', invalidateOnUpdate: true },

  // 用户级数据 — 不缓存或短缓存
  'user:credits':           { ttl: 0,          source: 'db' },     // 实时查 DB
  'user:avatars':           { ttl: 5 * 60,    source: 'redis' },  // 用户数字人列表
};
```

### 27.2 API 响应缓存

```typescript
// 公共数据接口增加 Cache-Control
// GET /api/voices → Cache-Control: public, max-age=3600, s-maxage=86400
// GET /api/templates → Cache-Control: public, max-age=1800, s-maxage=21600
// GET /api/hot-topics → Cache-Control: public, max-age=300, s-maxage=3600
```

### 27.3 数据库查询优化

```sql
-- 关键索引（1000 用户规模下足够）
CREATE INDEX idx_video_tasks_user_status ON video_tasks(user_id, status);
CREATE INDEX idx_video_tasks_external_task ON video_tasks(external_task_id);
CREATE INDEX idx_avatars_user_status ON avatars(user_id, status);
CREATE INDEX idx_content_templates_status_industry ON content_templates(status, industry);
CREATE INDEX idx_douyin_hot_fetched ON douyin_hot_items(fetched_at);
```

### 27.4 前端轮询优化

```typescript
// 1000 用户规模下的轮询负载：
// 峰值 25 个视频在生成 × 每 5 秒轮询 = 5 QPS
// 完全在 Serverless 承受范围内，无需优化为 SSE/WebSocket

// 但应实现指数退避：
const POLL_INTERVALS = [3000, 5000, 5000, 10000, 10000, 15000, 30000]; // ms
// 前 3 次密集轮询（用户焦虑期），后续逐步放慢
```

---

## 28. 闪剪并发管理（1000 用户）

### 28.1 并发瓶颈分析

闪剪按模块限制并发数，超出直接返回失败。1000 用户规模下的峰值并发：

```
峰值同时生成: 15-25 个视频任务
闪剪套餐需要: 至少 20-30 并发的数字人口播混剪模块
```

### 28.2 任务队列（可选升级）

如果闪剪并发限制低于用户需求，需要引入简单队列：

```typescript
// 简易队列（基于 DB，1000 用户规模无需 Redis Queue / BullMQ）
model TaskQueue {
  id          String   @id @default(cuid())
  userId      String
  requestJson Json     // 序列化的生成请求
  priority    Int      @default(0)
  status      String   @default("queued") // queued | dispatching | dispatched | failed
  attempts    Int      @default(0)
  maxAttempts Int      @default(3)
  createdAt   DateTime @default(now())
  dispatchedAt DateTime?

  @@index([status, priority, createdAt])
}

// Cron 每 10 秒检查队列，按并发上限分发
```

### 28.3 用户公平性

```typescript
// 防止单用户占满并发：
const MAX_CONCURRENT_PER_USER: Record<string, number> = {
  free: 1,
  basic: 2,
  pro: 5,
};

// 套餐维度的每日限额：
const DAILY_VIDEO_LIMIT: Record<string, number> = {
  free: 3,      // 每日 3 条
  basic: 20,    // 每日 20 条
  pro: 100,     // 每日 100 条
};
```

---

## 29. 监控与告警

### 29.1 关键监控指标

| 指标 | 告警阈值 | 说明 |
|------|---------|------|
| 闪剪 API 错误率 | >5% 连续 5 分钟 | 闪剪服务可能异常 |
| Webhook 接收延迟 | >10 分钟无回调 | 兜底轮询应已介入 |
| 视频生成成功率 | <90% 连续 1 小时 | 内容审核或参数问题 |
| 热榜采集失败 | 连续 2 次失败 | 数据源可能不可用 |
| DB 连接池使用率 | >80% | 需要扩容或优化查询 |
| OSS 转存失败率 | >1% | 视频 URL 可能过期 |
| 用户并发排队数 | >50 | 需要升级闪剪套餐 |

### 29.2 日志规范

```typescript
// 关键操作必须记录结构化日志
logger.info('video_task_created', { userId, taskId, videoType, estimatedCredits });
logger.info('shanjian_api_called', { endpoint, taskId, duration, statusCode });
logger.info('webhook_received', { taskId, status, isIdempotent: !isNew });
logger.info('video_persisted', { taskId, ossUrl, duration, creditsCost });
logger.warn('shanjian_api_error', { endpoint, errorCode, errorMessage, requestId });
logger.error('oss_persist_failed', { taskId, videoUrl, error });
```

---

## 30. 完整 API 路由汇总

```
# ============ 用户端 ============

# 认证
POST   /api/auth/register            # 注册
POST   /api/auth/login               # 登录
GET    /api/auth/session              # 获取当前会话

# 数字人
GET    /api/avatars                   # 我的数字人列表
POST   /api/avatars                   # 创建数字人（触发克隆）
DELETE /api/avatars/:id               # 删除数字人

# 素材
GET    /api/assets                    # 我的素材列表
POST   /api/assets                    # 创建素材记录
DELETE /api/assets/:id                # 删除素材

# 上传
POST   /api/upload/sts                # 获取 OSS STS 临时凭证

# 脚本
GET    /api/scripts                   # 我的脚本列表
POST   /api/scripts/generate          # AI 生成脚本（支持热点关联）
POST   /api/scripts                   # 保存脚本
PUT    /api/scripts/:id               # 编辑脚本
DELETE /api/scripts/:id               # 删除脚本

# 视频生成
POST   /api/tasks                     # 创建视频生成任务
GET    /api/tasks/:id                 # 查询任务状态

# 视频库
GET    /api/videos                    # 我的视频列表
GET    /api/videos/:id                # 视频详情（预览+下载）

# 公共数据
GET    /api/voices                    # 公共配音列表（缓存）
GET    /api/virtualmen                # 公共数字人列表（缓存）
GET    /api/templates/shanjian        # 闪剪视频模板列表（缓存）

# 热榜
GET    /api/hot-topics                # 当前抖音热榜

# 内容模板（用户端）
GET    /api/templates                 # 浏览内容模板
GET    /api/templates/:id             # 模板详情
POST   /api/templates/:id/generate    # 模板渲染脚本

# 账户
GET    /api/account                   # 账户信息 + 额度
PUT    /api/account                   # 更新个人信息

# ============ Webhook ============
POST   /api/webhook/shanjian          # 闪剪异步回调

# ============ Cron ============
GET    /api/cron/douyin-hot           # 热榜采集（每小时）
GET    /api/cron/recovery-poll        # 兜底轮询（每 5 分钟）
GET    /api/cron/cleanup              # 数据清理（每日）

# ============ 管理后台 ============
POST   /api/admin/auth/login          # 管理员登录

# 内容模板管理
GET    /api/admin/templates           # 模板列表（全状态）
POST   /api/admin/templates           # 创建模板
GET    /api/admin/templates/:id       # 模板详情
PUT    /api/admin/templates/:id       # 编辑模板
DELETE /api/admin/templates/:id       # 删除模板
POST   /api/admin/templates/:id/submit   # 提交审核
POST   /api/admin/templates/:id/approve  # 审核通过
POST   /api/admin/templates/:id/reject   # 审核拒绝
POST   /api/admin/templates/:id/archive  # 下架
POST   /api/admin/templates/:id/restore  # 重新上架

# 热榜监控
GET    /api/admin/hot-topics/history  # 热榜采集历史
GET    /api/admin/hot-topics/stats    # 采集状态统计

# 数据概览
GET    /api/admin/dashboard           # 运营数据面板
```
