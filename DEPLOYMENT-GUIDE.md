# 🚀 ClipFlow 社交发布 - Lightpanda 快速部署指南

本指南帮助你在 5 分钟内完成 Lightpanda 无头浏览器的部署和集成。

## 📋 部署前检查

### 必需环境

- ✅ **Docker** - 用于运行 Lightpanda 容器
- ✅ **Docker Compose** - 用于服务编排
- ✅ **Python 3.8+** - 用于运行 social-auto-upload
- ✅ **Node.js 18+** - 用于运行 ClipFlow 应用

### 验证环境

```bash
# 检查 Docker
docker --version

# 检查 Docker Compose
docker compose version

# 检查 Python
python --version

# 检查 Node.js
node --version
```

## 🎯 快速启动（3 步）

### 步骤 1: 启动 Lightpanda

**方法 A：使用启动脚本（推荐）**

```bash
./start-lightpanda.sh
```

**方法 B：手动启动**

```bash
docker compose up -d lightpanda
```

### 步骤 2: 安装 social-auto-upload

```bash
# 使用 pip 安装
pip install social-auto-upload

# 或使用 uv（更快）
uv pip install social-auto-upload
```

### 步骤 3: 启动 ClipFlow

```bash
cd clipflow
npm run dev
```

✅ 现在访问 `http://localhost:3000/social` 开始使用！

## 🔧 配置说明

### 环境变量

创建 `.env.local` 文件（在 clipflow 目录下）：

```bash
# Lightpanda 配置
LIGHTPANDA_CDP_ENDPOINT=ws://127.0.0.1:9222
LIGHTPANDA_DISABLE_TELEMETRY=true
```

### Docker Compose 服务

`docker-compose.yml` 提供了以下服务：

- **lightpanda** - 无头浏览器服务（端口 9222）

## 🧪 测试部署

### 1. 测试 Lightpanda 连接

```bash
# 测试 CDP 端点
curl http://127.0.0.1:9222/json/version

# 应该返回类似：
# {
#   "browser": "Lightpanda",
#   "protocol-version": "1.3",
#   ...
# }
```

### 2. 测试 social-auto-upload

```bash
# 测试 sau 命令
sau --help

# 查看支持的平台
sau douyin --help
```

### 3. 完整流程测试

1. 访问 `http://localhost:3000/social`
2. 选择平台（如：抖音）
3. 点击"登录账号"
4. 扫码完成登录
5. 上传测试视频

## 📊 服务管理

### 查看服务状态

```bash
docker compose ps
```

### 查看日志

```bash
# 查看 Lightpanda 日志
docker compose logs lightpanda

# 实时跟踪日志
docker compose logs -f lightpanda
```

### 重启服务

```bash
docker compose restart lightpanda
```

### 停止服务

```bash
docker compose down
```

## 🐛 故障排查

### 问题 1: Lightpanda 无法启动

**症状：** `docker compose up` 失败

**解决方法：**
```bash
# 检查端口占用
lsof -i :9222

# 如果被占用，停止占用的进程或修改端口
# 编辑 docker-compose.yml，将 9222 改为其他端口
```

### 问题 2: 连接 Lightpanda 失败

**症状：** API 返回 "连接失败" 错误

**解决方法：**
```bash
# 1. 确认容器正在运行
docker compose ps

# 2. 测试 CDP 端点
curl http://127.0.0.1:9222/json/version

# 3. 检查环境变量
echo $LIGHTPANDA_CDP_ENDPOINT
```

### 问题 3: sau 命令不存在

**症状：** `sau: command not found`

**解决方法：**
```bash
# 重新安装 social-auto-upload
pip install social-auto-upload --upgrade

# 验证安装
which sau
sau --version
```

### 问题 4: 上传超时

**症状：** 上传视频时超时

**解决方法：**
```bash
# 1. 检查网络连接
ping -c 3 douyin.com

# 2. 增加超时时间（在 API 代码中）
# 编辑 apps/web/src/app/api/social/upload/route.ts
# 将 timeout: 300000 改为更大的值

# 3. 检查 Lightpanda 资源使用
docker stats clipflow-lightpanda
```

## 📈 性能优化

### 资源限制

编辑 `docker-compose.yml`，添加资源限制：

```yaml
services:
  lightpanda:
    # ... 现有配置
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### 并发控制

在 API 中限制并发上传数：

```typescript
// apps/web/src/lib/social-upload.ts
const MAX_CONCURRENT_UPLOADS = 3;
```

## 🔒 安全建议

### 生产环境部署

1. **使用防火墙**
   ```bash
   # 只允许本地访问 Lightpanda
   iptables -A INPUT -p tcp --dport 9222 -s 127.0.0.1 -j ACCEPT
   iptables -A INPUT -p tcp --dport 9222 -j DROP
   ```

2. **启用 HTTPS**
   - 使用 Nginx 反向代理
   - 配置 SSL 证书

3. **环境变量保护**
   ```bash
   # 设置 .env 文件权限
   chmod 600 .env.local
   ```

## 📚 相关文档

- [Lightpanda 官方文档](https://docs.lightpanda.io)
- [social-auto-upload GitHub](https://github.com/dreammis/social-auto-upload)
- [ClipFlow 文档](./clipflow/README.md)

## ✅ 部署检查清单

- [ ] Docker 已安装并运行
- [ ] Docker Compose 可用
- [ ] social-auto-upload 已安装
- [ ] Lightpanda 容器已启动
- [ ] CDP 端点可访问（http://127.0.0.1:9222）
- [ ] ClipFlow 应用已启动
- [ ] 社交发布页面可访问（/social）
- [ ] 测试登录功能成功
- [ ] 测试上传功能成功

## 🎉 完成！

现在你的 ClipFlow 应用已经集成了 Lightpanda 无头浏览器，可以高效地处理社交平台视频上传任务。

**下一步：**
- 绑定你的社交平台账号
- 开始批量发布视频
- 监控上传任务状态

如有问题，请查看 [故障排查](#-故障排查) 部分或提交 Issue。
