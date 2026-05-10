# ⚡ 5分钟让朋友访问 - 最简单的方案

## 🎯 使用 ngrok 临时暴露本地服务

### 适用场景
- 📱 临时给朋友展示
- 🧪 快速测试功能
- 🎓 演示项目
- 💰 不想购买服务器

## 🚀 3步搞定

### 步骤 1: 安装 ngrok (1分钟)

```bash
# macOS
brew install ngrok

# 或下载安装
# 访问: https://ngrok.com/download
```

### 步骤 2: 启动本地服务 (1分钟)

```bash
cd /Users/xiangyu/Desktop/ai智能体-发布页面管理/clipflow/apps/web
npm run dev
```

保持这个终端窗口运行。

### 步骤 3: 开启隧道 (1分钟)

**打开新的终端窗口：**

```bash
# 启动 ngrok 隧道
ngrok http 3000
```

你会看到类似输出：

```
Session Status                online
Account                       your_email@example.com
Version                       3.x.x
Region                        United States (us)
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:3000
```

## 🎉 完成！

**分享链接给朋友：**
```
https://abc123.ngrok-free.app
```

朋友就可以通过这个链接访问你的 ClipFlow 了！

## 📋 重要提示

### ⚠️ 限制说明
- **免费版限制**: 每次启动地址会变化
- **速度限制**: 免费版有速度限制
- **并发限制**: 同时连接数有限制
- **稳定性**: 需要保持你的电脑和网络开启

### ✅ 优势
- **完全免费**: 不需要任何费用
- **即时可用**: 5分钟设置完成
- **无需服务器**: 使用你的本地电脑
- **真实环境**: 朋友访问的是你的本地系统

### 🔧 使用技巧

#### 1. 固定子域名（付费版）
```bash
ngrok http 3000 --domain=your-custom-domain.ngrok-free.app
```

#### 2. 配置基本认证
```bash
ngrok http 3000 --basic-auth="username:password"
```

#### 3. 查看请求日志
```bash
ngrok http 3000 --log=stdout
```

#### 4. 指定地区
```bash
ngrok http 3000 --region=ap  # 亚太地区
```

## 🛑 如何停止

**停止 ngrok:**
在 ngrok 终端按 `Ctrl+C`

**停止本地服务:**
在 npm 终端按 `Ctrl+C`

## 🔄 重新开始

每次重新运行：
```bash
# 1. 启动本地服务
cd /Users/xiangyu/Desktop/ai智能体-发布页面管理/clipflow/apps/web
npm run dev

# 2. 启动 ngrok（新终端）
ngrok http 3000

# 3. 复制新的 https 链接分享给朋友
```

## 📱 分享示例

**给你的朋友发消息：**
```
嗨！我做了个AI视频发布工具，想请你帮忙测试一下。

访问链接：https://abc123.ngrok-free.app

功能介绍：
- 支持抖音、小红书、B站、快手
- 一键上传视频到多个平台
- 自动化发布流程

注意事项：
- 请在今天内测试（链接会变化）
- 遇到问题请截图告诉我

谢谢！🙏
```

## 🆚 ngrok vs 云服务器

| 特性 | ngrok | 云服务器 |
|------|-------|----------|
| **成本** | 免费 | ¥30-60/月 |
| **设置时间** | 5分钟 | 1-2小时 |
| **稳定性** | 需保持电脑开启 | 24小时运行 |
| **访问速度** | 一般 | 快速 |
| **并发支持** | 有限 | 高 |
| **固定域名** | 付费版 | 自定义域名 |
| **适合场景** | 临时测试 | 长期使用 |

## 🎯 使用建议

### 什么时候用 ngrok？
- ✅ 项目初期测试
- ✅ 给朋友演示功能
- ✅ 快速收集用户反馈
- ✅ 不确定是否长期运营

### 什么时候用云服务器？
- ✅ 长期运营项目
- ✅ 需要稳定服务
- ✅ 多用户同时访问
- ✅ 需要固定域名

## 🛠️ 常见问题

### Q: 链接打不开？
A:
1. 确认本地服务正在运行（npm run dev）
2. 确认 ngrok 正在运行
3. 检查链接是否复制完整

### Q: 朋友访问很慢？
A:
1. ngrok 免费版有速度限制
2. 可以选择更近的服务器区域
3. 考虑升级到付费版

### Q: 链接变化了怎么办？
A:
1. ngrok 免费版每次重启会变化
2. 重新分享新链接给朋友
3. 或升级付费版获得固定域名

### Q: 本地电脑关机了？
A:
1. ngrok 隧道会断开
2. 朋友无法访问
3. 需要重新启动服务

## 🚀 下一步

### 如果 ngrok 满足需求
- 继续使用免费版
- 收集用户反馈
- 改进产品功能

### 如果需要长期稳定服务
- 查看 [QUICK-START.md](QUICK-START.md)
- 部署到云服务器
- 获得固定域名和稳定服务

---

**立即开始：**
```bash
# 1. 安装 ngrok
brew install ngrok

# 2. 启动服务
cd /Users/xiangyu/Desktop/ai智能体-发布页面管理/clipflow/apps/web
npm run dev

# 3. 开启隧道（新终端）
ngrok http 3000

# 4. 复制 https 链接分享给朋友
```

**5分钟后，朋友就能访问你的系统了！** 🎉
