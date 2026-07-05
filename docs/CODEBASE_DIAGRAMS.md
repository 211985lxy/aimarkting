> **⚠️ OUTDATED — 项目已重命名为明远AIM（mingyuan），本文中的 Mermaid 图和路径引用已过时。** 保留仅作历史参考。

# ClipFlow 系统架构与代码地图（代码图示手册 · 历史）

本手册旨在通过精细化的 **Mermaid 架构图与时序图**，为开发人员和 AI 智能体直观地梳理 ClipFlow 的整体工程边界、业务逻辑流、数据库表结构和异步任务架构。

---

## 1. 业务逻辑：4步黄金流水线与状态转移图

ClipFlow 遵循 **Direction A（AIM 一键生成为核心）** 架构。原本独立的 `/topic-planning` 与 `/copywriting` 已被移出菜单，收拢为 `/aim` 下的底层引擎，形成精简的 4 步黄金流：

```mermaid
stateDiagram-v2
    [*] --> Step1_IPProfile : 1. 信息设置 (/ip-profile)
    note right of Step1_IPProfile
        录入五问向导：
        行业/客户/变现/特质/目标
        生成商业、人设与内容定位档案
    end note

    Step1_IPProfile --> Step2_AIMGenerate : 2. 一键秒级生成 (/aim)
    note right of Step2_AIMGenerate
        输入简短灵感或实时语音转写
        合并 IP 档案和 12大爆款选题元素
        输出 Script (状态=candidate)
    end note

    Step2_AIMGenerate --> Step3_QualityGate : 3. 质量门控校验 (/quality-check)
    note right of Step3_QualityGate
        四维自动检测：
        编辑度 / AI味 / 吸引力 / 逻辑一致性
        不及格时触发靶向局部精改
    end note

    Step3_QualityGate --> Step4_Workbench : 4. 资产工作台 (/home)
    note right of Step4_Workbench
        文案确认，生成 ProductionPlan
        调用闪剪进行数字人/混剪渲染
        审核并分发至多平台自动发布
    end note

    Step4_Workbench --> [*]
```

---

## 2. 系统建模：视频生成三层架构关系图

系统将视频的创建过程明确解耦为 **导演层 (Director)**、**编剧层 (Scriptwriter)** 与 **包装层 (Packaging)**，以防这三者的数据模型与接口契约在运行时发生混淆。

```mermaid
graph TD
    %% Define Layers
    subgraph DirectorLayer ["1. 导演层 (Director Layer)"]
        VS["VideoStructure (视频结构)"]
        VP["blueprint (节拍/叙事蓝图)"]
        VS --> VP
    end

    subgraph ScriptwriterLayer ["2. 编剧层 (Scriptwriter Layer)"]
        CT["ContentTemplate (文案模板)"]
        IP["IpProfile (IP人设上下文)"]
        SC["Script (口播文案脚本)"]
        
        CT -->|融入 LLM Prompt| SC
        IP -->|限制人设基调| SC
        VP -->|结构化骨架约束| SC
    end

    subgraph PackagingLayer ["3. 包装层 (Packaging Layer)"]
        VPT["VideoPackagingTemplate (闪剪包装模板)"]
        VPP["VideoProductionPlan (视频生产计划)"]
        
        VPT -->|包装方案与渲染规则| VPP
        SC -->|填充说服文案| VPP
        Mat["materials (用户/Pexels 证据素材)"] -->|绑定素材角色槽位| VPP
        BGM["BGM (背景音乐配置)"] -->|关联音轨参数| VPP
    end

    subgraph Execution ["4. 任务执行层 (Execution Layer)"]
        VT["VideoTask (异步渲染任务)"]
        VPP -->|解析生成 Payload| VT
        VT -->|提交| SJ["Shanjian OpenAPI / 剪辑服务"]
    end

    classDef director fill:#e0f7fa,stroke:#00acc1,stroke-width:2px;
    classDef scriptwriter fill:#fff3e0,stroke:#fb8c00,stroke-width:2px;
    classDef packaging fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px;
    classDef execution fill:#eceff1,stroke:#546e7a,stroke-width:2px;

    class VS,VP director;
    class CT,IP,SC scriptwriter;
    class VPT,VPP,Mat,BGM packaging;
    class VT,SJ execution;
```

---

## 3. 数据库结构：Prisma 核心实体 ER 关联图

根据 [schema.prisma](file:///Users/xiangyu/Desktop/明动aim智能体/clipflow/apps/web/prisma/schema.prisma) 整理的实体关系模型，帮助理解核心资产的归属和流转血缘（Lineage）：

```mermaid
erDiagram
    User ||--|| IpProfile : "1:1 配置"
    User ||--o{ Avatar : "拥有数字人"
    User ||--o{ Asset : "上传证据素材"
    User ||--o{ Script : "编写口播稿"
    User ||--o{ VideoProductionPlan : "固化生产计划"
    User ||--o{ VideoTask : "提交渲染任务"
    User ||--o{ AimGeneration : "AIM 货架交付物"
    User ||--o{ KnowledgeEntry : "老板企业知识库"
    User ||--o{ ClientProject : "归属的交付项目"

    Avatar ||--o{ VideoTask : "作为口播替身"
    
    Script }|--|| ContentGenerationRun : "由某次运行生成"
    Script }|--|| VideoStructure : "遵循结构蓝图"
    Script ||--o{ VideoTask : "作为视频台词"

    VideoProductionPlan ||--|| VideoStructure : "选用导演结构"
    VideoProductionPlan ||--|| VideoPackagingTemplate : "选用包装样式"
    VideoProductionPlan ||--o{ VideoTask : "生成渲染凭证"

    VideoTask }|--|| Avatar : "使用替身"
    VideoTask }|--|| Script : "使用脚本"
    VideoTask }|--|| VideoProductionPlan : "追溯包装"
    VideoTask }|--|| VideoStructure : "追溯结构"
    VideoTask }|--|| VideoPackagingTemplate : "追溯模板"

    ClientProject ||--o{ AimGeneration : "关联交付产物"
    ClientProject ||--o{ KnowledgeEntry : "限定项目知识"
```

---

## 4. 异步处理：视频状态收敛的“四通道”合并图

为了防范闪剪平台回调丢失以及网络抖动，系统并非只依赖 Webhook，而是通过四种通道并发地收敛视频任务状态，保障资产的安全落库：

```mermaid
flowchart TD
    subgraph Frontend ["1. 前端用户界面"]
        UI["/create 或 /videos/[id] 页面"]
        Poll["前端 3 秒高频轮询 GET /api/tasks/[id]"]
        UI --> Poll
    end

    subgraph Gateway ["2. 服务编排与状态推进层"]
        API_Query["GET /api/tasks/[id] API 路由"]
        Webhook["POST /api/webhook/shanjian 回调路由"]
        Recovery["Task Recovery 守护进程 (Cron / Worker)"]
    end

    subgraph Upstream ["3. 上游渲染服务 (Shanjian)"]
        SJ_API["闪剪 OpenAPI (getTaskInfo)"]
        SJ_Engine["渲染生成引擎"]
    end

    subgraph Storage ["4. 数据落地与存储 (MySQL & OSS)"]
        DB[("MySQL Database (VideoTask)")]
        OSS["阿里云 OSS (视频与封面持久化)"]
    end

    %% Flow 1: Webhook
    SJ_Engine -->|1. 主动回调状态| Webhook
    Webhook -->|校验并读取结果| OSS
    Webhook -->|更新状态并可能退款| DB

    %% Flow 2: Recovery
    Recovery -->|2. 轮询 stale processing 任务| SJ_API
    SJ_API -.->|返回结果| Recovery
    Recovery -->|转存视频数据| OSS
    Recovery -->|修复状态| DB

    %% Flow 3: Detail Query
    Poll --> API_Query
    API_Query -->|3. 若本地仍为 processing 则主动查询| SJ_API
    SJ_API -.->|返回最新状态| API_Query
    API_Query -->|转存视频数据| OSS
    API_Query -->|更新本地任务状态| DB

    style Webhook fill:#ffebee,stroke:#c62828,stroke-width:2px;
    style Recovery fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    style API_Query fill:#e1f5fe,stroke:#0277bd,stroke-width:2px;
```

> **架构警示 (Hard Rules)**:
> 1. **超扣风险**: 并发高时，`GET /api/tasks/[id]` 与 Webhook 状态冲突极易造成积分扣减/退款竞争，必须警惕原子性保障。
> 2. **转存安全**: OSS 转存如果失败，不要静默使用闪剪的临时链接（24小时失效），应提供降级报警。
