# 🎬 ClipFlow 社交发布 - Lightpanda 集成

[![Lightpanda](https://img.shields.io/badge/browser-Lightpanda-orange)](https://github.com/lightpanda-io/browser)
[![social-auto-upload](https://img.shields.io/badge/tool-social--auto--upload-blue)](https://github.com/dreammis/social-auto-upload)

将 **Lightpanda 无头浏览器** 集成到 ClipFlow 社交发布功能，实现高效、低资源占用的视频自动化上传。

## ✨ 特性

- 🚀 **极速性能** - 比 Chrome 快 9 倍
- 💾 **超低内存** - 比 Chrome 节省 16 倍内存
- 🔒 **完全兼容** - 支持 CDP 协议，兼容 Playwright/Puppeteer
- 🐳 **易于部署** - 一键 Docker 部署
- 📱 **多平台支持** - 抖音、小红书、Bilibili、快手

## 📁 项目结构

```
.
├── clipflow/                          # ClipFlow 主应用
│   └── apps/web/src/app/api/social/
│       ├── upload/route.ts            # 上传 API（已集成 Lightpanda）
│       └── accounts/login/route.ts    # 登录 API（已集成 Lightpanda）
├── docker-compose.yml                 # Lightpanda 容器配置
├── start-lightpanda.sh                # 快速启动脚本
├── test-lightpanda.sh                 # 集成测试脚本
├── .env.lightpanda.example            # 环境变量模板
├── DEPLOYMENT-GUIDE.md                # 详细部署指南
└── LIGHTPANDA-INTEGRATION.md          # 集成技术文档
```

## 🚀 快速开始

### 1. 一键启动

```bash
./start-lightpanda.sh
```

### 2. 安装依赖

```bash
pip install social-auto-upload
```

### 3. 启动应用

```bash
cd clipflow
npm run dev
```

### 4. 开始使用

访问 `http://localhost:3000/social`

## 📚 文档

- **[部署指南](DEPLOYMENT-GUIDE.md)** - 完整的部署和配置说明
- **[集成文档](LIGHTPANDA-INTEGRATION.md)** - 技术实现细节
- **[使用指南](SOCIAL-PUBLISH-DEPLOYMENT.md)** - 社交发布功能使用说明

## 🧪 测试

运行集成测试：

```bash
./test-lightpanda.sh
```

## 📊 性能对比

| 浏览器 | 内存占用 | 执行速度 | 兼容性 |
|--------|---------|---------|--------|
| Chrome | 1.5 GB  | 1x      | ✅ 完全 |
| Lightpanda | 90 MB | 9x  | ✅ 优秀 |

## 🛠️ 服务管理

```bash
# 启动服务
docker compose up -d

# 查看状态
docker compose ps

# 查看日志
docker compose logs -f lightpanda

# 停止服务
docker compose down
```

## 🔧 配置

环境变量（创建 `.env.local`）：

```bash
LIGHTPANDA_CDP_ENDPOINT=ws://127.0.0.1:9222
LIGHTPANDA_DISABLE_TELEMETRY=true
```

## 🐛 故障排查

### Lightpanda 无法启动

```bash
# 检查端口占用
lsof -i :9222

# 查看日志
docker compose logs lightpanda
```

### API 连接失败

```bash
# 测试 CDP 端点
curl http://127.0.0.1:9222/json/version

# 检查环境变量
echo $LIGHTPANDA_CDP_ENDPOINT
```

更多问题请查看 [部署指南 - 故障排查](DEPLOYMENT-GUIDE.md#-故障排查)

## 📦 已集成的功能

### API 路由

- ✅ `POST /api/social/upload` - 使用 Lightpanda 上传视频
- ✅ `POST /api/social/accounts/login` - 使用 Lightpanda 登录账号
- ✅ `GET /api/social/upload` - 获取支持的平台列表

### 前端页面

- ✅ `/social` - 社交发布页面
- ✅ 账号登录和二维码显示
- ✅ 视频上传和进度显示
- ✅ 支持多平台选择

## 🔐 安全性

- Cookie 数据加密存储
- API 速率限制
- 用户隔离验证
- 本地 CDP 端点（不对外暴露）

## 🎯 支持的平台

- ✅ **抖音** - 视频、笔记
- ✅ **小红书** - 视频、笔记
- ✅ **Bilibili** - 视频
- ✅ **快手** - 视频、笔记

## 📈 下一步

- [ ] 支持更多平台（视频号、YouTube 等）
- [ ] 批量发布优化
- [ ] 实时进度推送（WebSocket）
- [ ] 定时发布功能
- [ ] 发布数据分析

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可

MIT License

## 🙏 致谢

- [Lightpanda](https://github.com/lightpanda-io/browser) - 高性能无头浏览器
- [social-auto-upload](https://github.com/dreammis/social-auto-upload) - 社交媒体自动上传工具

---

**Note:** 此项目为 ClipFlow 的社交发布模块，与主应用集成使用。
