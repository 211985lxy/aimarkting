# Spec: AI 一键补充证据素材

## 背景

视频创建流程 Phase 2（定包装）的"补充证据素材"区域目前是纯手动操作：用户需要为每个角色手动粘贴 OSS URL。这个门槛过高，大多数用户可能直接跳过。

**目标**：添加"AI 一键补充"按钮，根据文案内容 + IP 画像自动从 Pexels 搜索合适的图片/视频素材，填入素材列表，丰富最终视频的画中画/插画内容，提高视频质量。

## 核心约束（来自闪剪）

| 规则 | 值 |
|------|-----|
| 单张图片时长 | 固定 2 秒 |
| 单个视频时长 | ≤ 60 秒 |
| 素材总时长上限 | ≤ 300 秒（5 分钟） |
| 图片格式 | JPG / PNG / WebP，单边 ≤ 2000px，≤ 10MB |
| 视频格式 | MP4 / MOV，H.264/H.265，10-60fps |
| 素材排列方式 | `materialComposition`: "random" 或 "order" |
| 素材匹配方式 | `materialMatchWay`: "preciseMatch" 或 "fuzzyMatch" |

## 素材数量策略

### 估算脚本时长
- 中文文案：约 3-4 字/秒（取 3.5 字/秒）
- `estimatedDuration = scriptContent.length / 3.5`

### 目标素材覆盖率
- 素材是**补充性画中画**，不是主画面，不需要覆盖全时长
- 目标覆盖率：**30%-40%** 的脚本时长
- `targetMaterialDuration = estimatedDuration * 0.35`

### 图片数量计算
- 优先使用图片（更稳定、更可控）
- `imageCount = Math.round(targetMaterialDuration / 2)`
- 上限：15 张（30 秒覆盖，避免过度）
- 下限：3 张（最少有效补充）

### 示例
| 文案长度 | 估算时长 | 目标覆盖 | 图片数 |
|---------|---------|---------|-------|
| 200 字 | ~57s | ~20s | 10 张 |
| 350 字 | ~100s | ~35s | 15 张（上限） |
| 80 字 | ~23s | ~8s | 4 张 |
| 50 字 | ~14s | ~5s | 3 张（下限） |

## 技术方案

### 新增 API 端点

**`POST /api/materials/ai-suggest`**

#### 请求体
```typescript
interface AiMaterialSuggestRequest {
  scriptContent: string;        // 编辑后的文案全文
  ipProfile: {                  // 从 Phase 0 加载的 IP 画像（仅传必要字段）
    industry?: string;
    primaryOffer?: string;
    targetAudience?: string;
  };
  existingMaterials?: MaterialAssignment[];  // 用户已手动添加的素材（避免重复角色）
  maxCount?: number;             // 可选覆盖，默认按上述策略算
}
```

#### 处理流程

```
1. 估算脚本时长 → 计算目标图片数量
2. 调用 LLM 分析文案+IP → 生成搜索计划
3. 并发调用 Pexels 搜索
4. 筛选 + 去重 + 分配角色
5. 触发 OSS 后台转存
6. 返回建议素材列表
```

#### Step 2: LLM 生成搜索计划

Prompt 输入：
- 文案全文
- IP 行业、主打产品、目标受众
- 已有素材角色（排除）
- 目标图片数量

Prompt 输出（structured JSON）：
```typescript
interface SearchPlan {
  queries: Array<{
    query: string;        // Pexels 搜索关键词（英文，Pexels 对英文支持更好）
    role: string;         // 对应的素材角色
    count: number;        // 该查询需要几张
    rationale: string;    // 为什么选这个关键词（debug 用）
  }>;
}
```

**角色分配逻辑**：
- LLM 根据文案内容智能分配角色，不需要均匀分配
- 如果文案中有大量产品描述 → 多分配 `product_detail`
- 如果文案中提到客户案例/使用效果 → 分配 `customer_case`、`before_after`
- 如果文案中涉及环境/场景 → 分配 `store_environment`
- 偏通用性质的内容 → 分配 `process`
- 每个 query 的 count 加起来 = 目标总数

**搜索关键词策略**：
- 使用英文关键词（Pexels 英文库更大，效果更好）
- 关键词要具体（"coffee shop interior modern" 而非 "shop"）
- 结合行业和产品特征（"restaurant kitchen wok cooking" 而非 "cooking"）
- 避免人脸特写（可能与数字人冲突）

#### Step 3: Pexels 搜索

- 复用现有 `GET /api/pexels/search` 端点
- 每个 query 并发搜索，`mediaType: "photo"`，`orientation: "landscape"`（横版适配大多数模板）
- `perPage` 设为 `count * 2`（搜多一些用于筛选）
- 使用 `locale: "en-US"`

#### Step 4: 筛选逻辑

- 去重：同一张图不出现在多个角色
- 尺寸检查：确保 ≤ 2000px 单边（用 Pexels 返回的 `large` 或 `large2x` 而非 `original`，避免超限）
- 相关性：取每个 query 结果的前 N 张（Pexels 默认按相关性排序）
- 使用 `src.large` (W940) 作为素材 URL — 满足闪剪 ≤ 2000px 限制

#### Step 5: OSS 转存

- Pexels 图片 URL 有时效性，需要转存到自有 OSS
- 复用已有的 `pexels-oss.ts` 转存逻辑
- 返回时优先使用 `ossUrl`（如果已 ready），否则用 Pexels 原始 URL + 标记 pending
- 前端轮询或 SSE 等待 OSS 转存完成后再允许提交

#### 响应体
```typescript
interface AiMaterialSuggestResponse {
  suggestions: Array<{
    role: string;
    type: "image" | "video";
    fileUrl: string;          // ossUrl (if ready) 或 pexels preview url
    ossStatus: "ready" | "pending" | "transferring";
    pexelsId: number;
    thumbnailUrl: string;     // 用于前端预览
    searchQuery: string;      // 产生这个结果的搜索词（debug/透明度）
  }>;
  meta: {
    scriptEstimatedDuration: number;
    targetMaterialDuration: number;
    totalSuggested: number;
  };
}
```

### 前端变更

#### UI 位置
在现有"补充证据素材"标题行的右侧添加按钮（截图中蓝色框标注区域）。

#### 新增按钮
```
[✨ AI 一键补充]
```
- 位置：标题 "补充证据素材（可选）" 的右侧
- 样式：`variant="outline"` + 紫色/蓝色调
- 状态：
  - 默认态：可点击
  - Loading 态：显示 spinner + "AI 搜索中..."
  - 已有 AI 素材：按钮文字变为 "重新生成"

#### 交互流程

1. **点击按钮** → 调用 `POST /api/materials/ai-suggest`
2. **Loading 状态** → 按钮显示 spinner，素材区域显示骨架屏
3. **结果返回** → 素材自动填入列表，每条带缩略图预览
4. **用户可操作**：
   - 删除不喜欢的条目（已有功能）
   - 手动添加更多（已有功能）
   - 再次点击重新生成（替换所有 AI 生成的，保留手动添加的）

#### 素材条目 UI 增强（仅针对 AI 生成的条目）

现有条目只有 URL 文本框。AI 生成的条目需要增强：
```
┌─────────────────────────────────────────────────────┐
│ [缩略图]  [角色 Badge]  [URL（只读）]  [🔍] [✕]     │
│           来自: "coffee shop interior"    AI 推荐    │
└─────────────────────────────────────────────────────┘
```
- 缩略图：使用 `thumbnailUrl` 显示小预览图
- URL 字段：只读（AI 生成的不可编辑 URL）
- 搜索词标签：小字显示来源搜索词
- "AI 推荐" 标记：区分手动 vs AI 添加的素材
- 🔍 按钮：可选 — 点击可查看大图预览

#### OSS 状态指示

对于 `ossStatus !== "ready"` 的素材：
- 显示一个小的 loading indicator
- Tooltip: "素材正在转存到 OSS，转存完成后可提交"
- "下一步：出视频" 按钮需检查：所有 AI 素材的 OSS 状态是否为 ready
- 前端每 3 秒轮询 `GET /api/pexels/media/[pexelsId]` 检查 OSS 状态

### 数据流总览

```
用户点击 "AI 一键补充"
    │
    ▼
POST /api/materials/ai-suggest
    │
    ├─ 1. 估算脚本时长 → 算目标数量
    ├─ 2. 调 LLM → 搜索计划 (queries + roles + counts)
    ├─ 3. 并发调 Pexels Search API (复用已有缓存层)
    ├─ 4. 筛选去重 + 选取最佳结果
    ├─ 5. 后台触发 OSS 转存
    │
    ▼
返回 suggestions[] → 前端填入 materials 状态
    │
    ▼
用户审阅 → 删除/保留/手动补充
    │
    ▼
用户点击 "下一步：出视频"
    │
    ▼
materials 传入 createProductionPlan() → 已有流程不变
```

## 不做的事情

- **不做视频搜索**：Pexels 视频文件大、时长不可控，图片更简单可靠
- **不做自动提交**：AI 只是建议，用户必须审阅后才提交
- **不做素材编辑**：不提供裁剪/调整功能，交给闪剪的匹配算法
- **不做持久化搜索历史**：搜索结果通过 Pexels 缓存层已持久化，不需要额外存储
- **不改闪剪调用逻辑**：materials 格式不变，仍然是 `{role, fileUrl, type}[]`

## 依赖

- [x] Pexels API 搜索 — 已实现 (`/api/pexels/search`)
- [x] Pexels OSS 转存 — 已实现 (`pexels-oss.ts`)
- [x] Pexels 数据库缓存 — 已实现 (`PexelsMedia`, `PexelsQueryCache`)
- [ ] **新增 API**: `POST /api/materials/ai-suggest`
- [ ] **前端改造**: 补充证据素材区域 UI 增强
- [ ] **LLM Prompt**: 文案分析 + 搜索计划生成

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| Pexels 搜索结果与行业不匹配 | LLM 生成具体关键词 + 取结果前几张（最相关） |
| Pexels 限流 (200/hr) | 已有多 key 轮换池 + 查询缓存 |
| OSS 转存延迟影响提交 | 前端轮询等待 + 进度指示 |
| 图片尺寸超闪剪限制 | 使用 Pexels `src.large` (W940) 而非 `original` |
| LLM 响应慢 | 设置 15 秒超时，失败则提示手动添加 |
