# Social-Auto-Upload 集成指南

## 方案选择

### 方案 A：使用新版 CLI (推荐) ✅

**优点：**
- 无需部署后端服务
- 配置简单，官方推荐
- 支持抖音、小红书、Bilibili、快手

**步骤：**

1. **安装 social-auto-upload**
   ```bash
   # 推荐使用官方方式
   pip install social-auto-upload

   # 或使用 uv (更快)
   uv pip install social-auto-upload
   ```

2. **登录账号**
   ```bash
   # 抖音
   sau douyin login --account my_account

   # 小红书
   sau xiaohongshu login --account my_account

   # Bilibili
   sau bilibili login --account my_account
   ```

3. **上传视频**
   ```bash
   # 抖音
   sau douyin upload-video \
     --account my_account \
     --file video.mp4 \
     --title "视频标题" \
     --desc "视频描述"
   ```

4. **在 ClipFlow 中集成**
   - 创建一个简单的上传页面
   - 调用 sau CLI 命令
   - 显示上传进度

---

### 方案 B：使用旧版 sau_backend + sau_frontend

**优点：**
- 有完整的 Web 管理界面
- 可视化操作

**缺点：**
- 需要部署 Python 后端服务
- 需要配置 Chrome 浏览器
- 需要配置 SQLite 数据库
- 配置复杂

---

## 推荐实施步骤（方案 A）

### 1. 安装 sau CLI

在你的服务器上安装：
```bash
pip install social-auto-upload
```

### 2. 在 ClipFlow 中创建上传页面

创建一个简单的页面，让用户：
- 选择平台
- 输入视频信息
- 点击上传
- 后端调用 sau CLI 命令

### 3. 示例代码

```typescript
// apps/web/src/app/api/social/upload/route.ts
import { exec } from 'child_process';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { platform, account, file, title, desc } = await req.json();

  const command = `sau ${platform} upload-video --account ${account} --file ${file} --title "${title}" --desc "${desc}"`;

  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve(NextResponse.json({ error: stderr }, { status: 500 }));
      } else {
        resolve(NextResponse.json({ success: true, output: stdout }));
      }
    });
  });
}
```

---

## 你想选择哪个方案？

- **方案 A (推荐)**：使用 sau CLI，简单直接
- **方案 B**：部署完整的 sau_backend + sau_frontend，有 Web 界面
