# Lightpanda 无头浏览器集成指南

## 📋 什么是 Lightpanda

Lightpanda 是**专为 AI 和自动化设计的无头浏览器**：
- 用 Zig 从零编写，不是 Chromium 分支
- 超低资源占用（16x less memory than Chrome）
- 极速执行（9x faster than Chrome）
- 支持 CDP 协议，兼容 Playwright/Puppeteer

## 🚀 安装 Lightpanda

### 方案 A：二进制安装（推荐）

**Linux:**
```bash
curl -L -o lightpanda https://github.com/lightpanda-io/browser/releases/download/nightly/lightpanda-x86_64-linux && \
chmod a+x ./lightpanda

# 移动到系统路径
sudo mv ./lightpanda /usr/local/bin/lightpanda
```

**macOS:**
```bash
curl -L -o lightpanda https://github.com/lightpanda-io/browser/releases/download/nightly/lightpanda-aarch64-macos && \
chmod a+x ./lightpanda

# 移动到系统路径
sudo mv ./lightpanda /usr/local/bin/lightpanda
```

### 方案 B：Docker 安装（最简单）

```bash
docker run -d --name lightpanda -p 127.0.0.1:9222:9222 lightpanda/browser:nightly
```

这会启动 Lightpanda 的 CDP 服务器在端口 9222。

## 🔧 配置 social-auto-upload 使用 Lightpanda

social-auto-upload 使用 Playwright，需要配置使用 Lightpanda 的 CDP 端点。

### 步骤 1：启动 Lightpanda CDP 服务器

**使用二进制：**
```bash
# 启动 CDP 服务器
lightpanda serve --host 127.0.0.1 --port 9222
```

**使用 Docker：**
```bash
# 如果还没运行
docker run -d --name lightpanda -p 127.0.0.1:9222:9222 lightpanda/browser:nightly
```

### 步骤 2：配置环境变量

创建或编辑 `~/.bashrc` 或 `~/.zshrc`：

```bash
# Lightpanda CDP 端点
export LIGHTPANDA_CDP_ENDPOINT="ws://127.0.0.1:9222"

# 禁用遥测（可选）
export LIGHTPANDA_DISABLE_TELEMETRY=true
```

然后重新加载：
```bash
source ~/.bashrc
# 或
source ~/.zshrc
```

### 步骤 3：测试 Lightpanda

```bash
# 测试 Lightpanda 是否正常工作
lightpanda fetch https://example.com
```

## 📝 修改 ClipFlow API 以使用 Lightpanda

现在修改我们的 API，让 sau 命令使用 Lightpanda：

### 更新上传 API

编辑 `apps/web/src/app/api/social/upload/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, account, file, title, desc, tags } = body;

    // 验证参数...
    const supportedPlatforms = ['douyin', 'xiaohongshu', 'bilibili', 'kuaishou'];
    if (!supportedPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: `不支持的平台：${platform}` },
        { status: 400 }
      );
    }

    // 设置 Lightpanda 环境变量
    const env = {
      ...process.env,
      LIGHTPANDA_CDP_ENDPOINT: process.env.LIGHTPANDA_CDP_ENDPOINT || 'ws://127.0.0.1:9222',
      // 如果 sau 使用 Playwright，设置浏览器端点
      PLAYWRIGHT_BROWSERS_PATH: '0', // 禁用默认浏览器
      PLAYWRIGHT_CHROMIUM_URL: process.env.LIGHTPANDA_CDP_ENDPOINT || 'ws://127.0.0.1:9222',
    };

    // 构建命令
    const commandParts = [
      'sau',
      platform,
      'upload-video',
      `--account ${account}`,
      `--file ${file}`,
      `--title "${title}"`,
    ];

    if (desc) commandParts.push(`--desc "${desc}"`);
    if (tags?.length) commandParts.push(`--tags ${tags.join(',')}`);

    const command = commandParts.join(' ');

    console.log('[Social Upload] 执行命令:', command);
    console.log('[Social Upload] 使用 Lightpanda:', env.LIGHTPANDA_CDP_ENDPOINT);

    // 使用 Lightpanda 环境执行
    const { stdout, stderr } = await execAsync(command, {
      timeout: 300000,
      env,
    });

    if (stderr && !stdout) {
      console.error('[Social Upload] 错误:', stderr);
      return NextResponse.json(
        { error: '上传失败', details: stderr },
        { status: 500 }
      );
    }

    console.log('[Social Upload] 成功:', stdout);

    return NextResponse.json({
      success: true,
      message: '上传成功',
      platform,
      output: stdout,
    });
  } catch (error: any) {
    console.error('[Social Upload] 异常:', error);
    return NextResponse.json(
      {
        error: '上传失败',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
```

## 🐳 使用 Docker Compose（推荐）

创建 `docker-compose.yml` 一键启动所有服务：

```yaml
version: '3.8'

services:
  # Lightpanda 无头浏览器
  lightpanda:
    image: lightpanda/browser:nightly
    container_name: lightpanda
    ports:
      - "127.0.0.1:9222:9222"
    restart: unless-stopped
    environment:
      - LIGHTPANDA_DISABLE_TELEMETRY=true
    networks:
      - clipflow-network

  # ClipFlow 应用（如果也在 Docker 中）
  # clipflow:
  #   build: ./clipflow
  #   ports:
  #     - "3000:3000"
  #   environment:
  #     - LIGHTPANDA_CDP_ENDPOINT=ws://lightpanda:9222
  #   depends_on:
  #     - lightpanda
  #   networks:
  #     - clipflow-network

networks:
  clipflow-network:
    driver: bridge
```

启动：
```bash
docker-compose up -d
```

## 🧪 测试集成

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

### 2. 测试 Puppeteer 连接 Lightpanda

创建测试脚本 `test-lightpanda.js`：

```javascript
const puppeteer = require('puppeteer-core');

(async () => {
  try {
    const browser = await puppeteer.connect({
      browserWSEndpoint: 'ws://127.0.0.1:9222',
    });

    const page = await browser.newPage();
    await page.goto('https://example.com');
    const title = await page.title();
    console.log('页面标题:', title);

    await browser.close();
    console.log('✅ Lightpanda 连接成功！');
  } catch (error) {
    console.error('❌ 连接失败:', error);
  }
})();
```

运行：
```bash
npm install puppeteer-core
node test-lightpanda.js
```

### 3. 测试 social-auto-upload + Lightpanda

```bash
# 设置环境变量
export LIGHTPANDA_CDP_ENDPOINT="ws://127.0.0.1:9222"

# 测试登录
sau douyin login --account test_account

# 如果成功，应该会使用 Lightpanda 而不是 Chrome
```

## ⚠️ 注意事项

### 1. Lightpanda 目前是 Beta 状态

- 可能存在一些网站兼容性问题
- Web API 支持还在完善中
- 遇到问题可以到 GitHub 报告

### 2. 社交平台兼容性

有些平台可能对 Lightpanda 的支持不完美：
- ✅ 抖音：通常兼容
- ✅ 小红书：通常兼容
- ⚠️ Bilibili：可能需要测试
- ⚠️ 快手：可能需要测试

### 3. 性能监控

Lightpanda 虽然内存占用低，但建议：
- 监控 CPU 使用率
- 设置合理的超时时间
- 限制并发实例数

## 🔄 回退到 Chrome

如果遇到兼容性问题，可以随时切换回 Chrome：

```bash
# 停止使用 Lightpanda
unset LIGHTPANDA_CDP_ENDPOINT

# 或者在代码中检测失败后重试
if (error.message.includes('Lightpanda')) {
  // 使用 Chrome 重试
  delete env.LIGHTPANDA_CDP_ENDPOINT;
  delete env.PLAYWRIGHT_CHROMIUM_URL;
}
```

## 📚 参考资源

- [Lightpanda GitHub](https://github.com/lightpanda-io/browser)
- [Lightpanda 文档](https://docs.lightpanda.io)
- [social-auto-upload GitHub](https://github.com/dreammis/social-auto-upload)

## ✅ 部署清单

- [ ] 安装 Lightpanda（二进制或 Docker）
- [ ] 启动 Lightpanda CDP 服务器（端口 9222）
- [ ] 配置环境变量 `LIGHTPANDA_CDP_ENDPOINT`
- [ ] 测试 Lightpanda 连接
- [ ] 更新 ClipFlow API 使用 Lightpanda
- [ ] 测试登录和上传功能
- [ ] 监控性能和错误日志

需要我帮你：
1. 直接修改 API 代码集成 Lightpanda？
2. 创建 Docker Compose 配置？
3. 添加错误自动重试机制（Lightpanda 失败时切换到 Chrome）？
