> **⚠️ HISTORICAL — 早期规划文档，部分方案已落地、部分已迭代，引用的 ClipFlow 路径已过时。** 保留仅作历史参考。

# AIM系统优化开发深度方案（历史）

## 一、核心判断

当前系统不是从 0 开始开发，而是在已有 `明动AIM增长大脑 / ClipFlow` 基础上做产品收束和交付化改造。

现有系统已经具备：

- 官网营销页
- 用户注册、登录、激活码
- 管理后台
- 企业知识库
- IP 档案
- 热点追踪
- 对标账号
- AIM 内容生成
- 质量检测
- 生成历史
- Obsidian 导出/同步
- 视频任务与素材相关能力

当前最大问题不是“没有功能”，而是：

> 系统还像一个泛 AI 内容生成工具，没有被收束成“传统企业 AI 短视频市场部交付后台”。

所以开发目标不是继续堆功能，而是把现有 AIM 系统改造成可交付、可员工执行、可客户复用的标准化后台。

## 二、最终产品定位

### 产品名

**明动AIM企业AI短视频市场部搭建系统**

### 一句话定位

帮传统企业把老板经验、产品卖点、客户问题和成交案例，搭成一套可持续获客的 AI 短视频市场部。

### 系统角色

```text
飞书/企微：客户侧协作入口
AIM系统：内容资产与生产交付后台
Obsidian：李相宇方法论与长期知识库
Codex：总控大脑、系统工程师、SOP升级器
员工：资料录入、生成、审核流转、数据回填
李相宇：判断方向、审核策略、成交复盘
```

## 三、当前系统保留内容

### 1. 保留 AIM 内容生成

当前 `/aim` 已经支持：

- 极速生成
- 创意对齐
- 选题推演
- 视频脚本
- 公众号文章
- 朋友圈文案
- 历史记录
- Obsidian 保存

保留，但要改名和改交付物。

建议页面名称：

> AIM 内容生产台

不再叫“一键生成”，避免像工具站。

### 2. 保留企业知识库

当前 `KnowledgeEntry` 已有分类：

- `boss_experience`：老板经验
- `product_usp`：产品卖点
- `customer_pain`：客户痛点
- `project_case`：项目案例
- `customer_qa`：客户问答

这是 AIM 的核心资产层，必须保留。

### 3. 保留 IP 档案

当前 `IpProfile` 已经能保存：

- 行业
- 目标客户
- 变现方式
- 人设
- 内容目标
- 商业定位
- 人设定位
- 内容定位

保留，但要改成“企业短视频市场部定位档案”。

### 4. 保留质量检测

当前质量检测支持：

- 编辑质量
- AI 味检测
- 爆款吸引力
- 表达逻辑

保留，但要嵌入 AIM 生成流程，不要只作为单独页面。

## 四、必须新增的核心能力

## 1. 客户项目 Project

当前系统按 `User` 存数据，不适合你做多客户交付。

必须新增 `ClientProject`，让知识库、生成记录、脚本、复盘都挂到项目下面。

### 建议数据字段

```text
id
userId
name
industry
companyName
ownerName
contactName
collaborationType: feishu | wecom | manual
offer
targetCustomer
dealPath
status: onboarding | active | paused | completed
startedAt
endedAt
createdAt
updatedAt
```

### 价值

- 一个账号可以服务多个客户。
- 每个客户有独立知识库。
- 每个客户有独立生成历史。
- 后续能做项目看板和交付报告。

## 2. 知识库绑定项目

当前 `KnowledgeEntry` 只有 `userId`，需要增加：

```text
projectId
```

未来查询知识库时：

```text
userId + projectId + status
```

避免不同客户知识混在一起。

## 3. AIM 生成绑定项目

当前 `AimGeneration` 只有 `userId`，需要增加：

```text
projectId
topicTitle
hotTopic
polishInstruction
shootingBrief
coverText
commentHook
privateDomainScript
workflowStatus
reviewNote
publishedAt
```

### workflowStatus 建议

```text
draft
pending_review
client_confirming
ready_to_shoot
shooting
editing
ready_to_publish
published
reviewed
archived
```

这样员工就不是“生成完复制走”，而是在系统里推进交付。

## 4. AIM 输出新增“拍摄交接单”

当前 AIM 输出：

- 视频脚本
- 公众号文章
- 朋友圈文案

必须新增：

> 拍摄交接单

### 标准格式

```text
视频标题：
核心观点：
目标客户：
视频目标：涨粉 / 建信任 / 引流 / 成交
拍摄形式：口播 / 访谈 / 场景展示 / 混剪
建议时长：
脚本正文：
必拍镜头：
补充素材：
封面文案：
评论区引导：
私域承接话术：
事实风险提醒：
```

### 价值

这是真正能交给拍摄剪辑的人执行的文件。

过去企业短视频交付最大的断点是：

> 内容策略和拍摄执行之间没有标准交接。

拍摄交接单就是 AIM 系统的核心交付物。

## 5. 质量检测嵌入 AIM

当前质量检测在独立页面。优化后 AIM 生成后自动跑质量检测。

### 自动检测维度

- 是否像真人说话
- 是否符合 IP 档案
- 是否有前三秒钩子
- 是否有明确 CTA
- 是否适合拍摄
- 是否有事实风险
- 是否有成交承接

### 输出状态

```text
不可提交
可优化
可提审
可拍摄
```

员工只看状态，不需要理解复杂评分。

## 五、页面结构优化

## 1. 官网首页

当前首页偏“AI营销增长智能体”，建议收束成：

### 首屏标题

```text
帮传统企业搭建自己的 AI 短视频市场部
```

### 副标题

```text
用 AIM 系统把老板经验、产品卖点、客户问题和成交案例，转化成可持续生产的选题、脚本、拍摄交接单和私域承接话术。
```

### CTA

```text
预约系统诊断
领取《AI短视频市场部7步搭建法》
```

### 首页模块建议

1. 传统企业做短视频的 5 个问题
2. AIM 如何把老板经验变成内容资产
3. 系统交付流程
4. 飞书/企微都能接入
5. 7天最小闭环
6. 产品版本与服务
7. 预约诊断

## 2. 后台菜单

当前菜单：

- 工作台
- 企业知识库
- 热点追踪
- 对标账号
- AIM 灵感生成
- 内容质量检控
- 账户设置

建议改成：

- 项目总览
- 客户项目
- 知识资产库
- 内容生产台
- 拍摄交接单
- 发布排期
- 线索承接
- 数据复盘
- 系统设置

第一版可以先不全部开发，但命名要向交付系统靠拢。

## 3. AIM 内容生产台

页面应该按员工操作流程重排：

### 第一步：选择客户项目

员工先选项目，否则不能生成。

### 第二步：选择内容目标

```text
涨粉
建立信任
引流私域
促成咨询
成交转化
客户教育
招商加盟
```

### 第三步：选择输入来源

```text
老板口述
客户问题
成交案例
产品卖点
热点借势
同行对标
```

### 第四步：生成交付物

```text
选题
视频脚本
拍摄交接单
朋友圈文案
公众号文章
私域承接话术
```

### 第五步：自动质量检测

输出：

```text
质量状态
问题提醒
修改建议
一键优化
```

### 第六步：提交审核

状态进入：

```text
pending_review
```

## 六、员工操作 SOP

员工不需要懂 AI，不需要懂 Codex。

员工每天只做：

1. 选择客户项目。
2. 录入资料到知识资产库。
3. 在 AIM 内容生产台生成内容。
4. 看质量状态。
5. 生成拍摄交接单。
6. 发给李相宇或客户审核。
7. 发布后回填数据。

## 七、开发任务拆解

## P0：上线必须做

### 技术安全

- [ ] 清理 `.env.example` 真实密钥。
- [ ] 重置 DeepSeek / TheRouter / OSS / JWT / 数据库密码。
- [ ] 把 Google Fonts 改成本地字体或系统字体，确保生产构建不依赖 Google。
- [ ] 修复 build。
- [ ] 修复关键 lint。

### 产品收束

- [ ] 官网首屏改成“传统企业 AI 短视频市场部”。
- [ ] AIM 页面标题改成“内容生产台”。
- [ ] AIM 输出增加“拍摄交接单”。
- [ ] 质量检测结果能从 AIM 生成后直接触发。

### 数据保存

- [ ] `AimGeneration` 保存 `hotTopic`、`polishInstruction`、`topicTitle`。
- [ ] `AimGeneration` 保存 `shootingBrief`。
- [ ] 生成历史能展示拍摄交接单。

## P1：标准交付要做

- [ ] 新增 `ClientProject`。
- [ ] `KnowledgeEntry` 增加 `projectId`。
- [ ] `AimGeneration` 增加 `projectId`。
- [ ] AIM 生成前必须选择项目。
- [ ] 增加内容状态流转。
- [ ] 新增“拍摄交接单”列表页。
- [ ] 新增“发布排期”基础表。
- [ ] 新增“数据复盘”基础录入。

## P2：自动化增强

- [ ] 飞书表格同步。
- [ ] 企微/腾讯文档同步。
- [ ] Obsidian 双向归档。
- [ ] Codex 周复盘 Agent。
- [ ] 评论区线索导入。
- [ ] 私域跟进话术自动生成。

## 八、数据库迁移建议

### 新增 ClientProject

```prisma
model ClientProject {
  id                String   @id @default(cuid())
  userId            String
  name              String
  companyName       String?
  industry          String?
  ownerName         String?
  contactName       String?
  collaborationType String   @default("manual")
  offer             String?  @db.Text
  targetCustomer    String?  @db.Text
  dealPath          String?  @db.Text
  status            String   @default("onboarding")
  startedAt         DateTime?
  endedAt           DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@index([userId, status])
}
```

### KnowledgeEntry 增加

```prisma
projectId String?
```

### AimGeneration 增加

```prisma
projectId           String?
topicTitle          String?
hotTopic            String?
polishInstruction   String? @db.Text
shootingBrief       String? @db.Text
coverText           String? @db.Text
commentHook         String? @db.Text
privateDomainScript String? @db.Text
workflowStatus      String  @default("draft")
reviewNote          String? @db.Text
publishedAt         DateTime?
```

## 九、AIM Prompt 优化方向

当前 prompt 重点是“企业营销内容专家”，需要升级成：

> 企业 AI 短视频市场部内容总监。

### 新系统提示词方向

```text
你是一个企业 AI 短视频市场部内容总监。
你不是单纯写文案，而是要把老板经验、产品卖点、客户痛点和成交案例，转化为可拍摄、可发布、可承接私域的短视频内容交付物。

每次输出必须考虑：
1. 这条内容解决什么业务目标？
2. 目标客户是谁？
3. 前三秒如何抓住注意力？
4. 哪个事实或案例支撑观点？
5. 拍摄剪辑怎么执行？
6. 评论区和私域如何承接？
7. 是否存在事实风险或承诺风险？
```

## 十、验收标准

## P0 验收

- [ ] 官网能清楚表达“AI短视频市场部”。
- [ ] 用户能注册、登录、激活。
- [ ] 员工能录入知识库。
- [ ] AIM 能生成视频脚本、朋友圈、公众号、拍摄交接单。
- [ ] 生成结果能保存。
- [ ] 质量检测能运行。
- [ ] 系统能成功 build。

## P1 验收

- [ ] 能创建客户项目。
- [ ] 知识库能按项目隔离。
- [ ] AIM 生成能按项目隔离。
- [ ] 每条内容有状态。
- [ ] 拍摄交接单能列表查看。
- [ ] 员工能按 SOP 完成一次交付。

## P2 验收

- [ ] 飞书/企微至少一种协作入口能半自动同步。
- [ ] Obsidian 能沉淀方法论和优秀案例。
- [ ] Codex 能基于复盘生成系统优化建议。

## 十一、第一版不要做的事

第一版不要做：

- 不做完整 CRM。
- 不做复杂任务管理。
- 不做全自动发布。
- 不做客户所有聊天记录同步。
- 不做员工直接调用 Codex。
- 不做大而全 SaaS 开放注册。

第一版只做：

> 让员工用 AIM，把客户资料稳定变成选题、脚本、拍摄交接单和复盘。

## 十二、最小上线闭环

```text
创建客户项目
      ↓
录入知识资产
      ↓
生成选题
      ↓
生成脚本
      ↓
生成拍摄交接单
      ↓
质量检测
      ↓
提交审核
      ↓
拍摄发布
      ↓
回填数据
      ↓
周复盘
```

只要这个闭环跑通，AIM 就从“工具”变成了你的“标准化交付系统”。

