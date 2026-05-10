# 社交平台发布功能 - 部署和使用指南

## ✅ 已完成的工作

1. **后端 API 路由**
   - `/api/social/upload` - 视频上传 API
   - `/api/social/accounts/login` - 账号登录 API

2. **前端页面**
   - `/social` - 社交发布页面
   - 已添加到导航菜单（"社交发布"）

3. **支持的平台**
   - 抖音 (douyin)
   - 小红书 (xiaohongshu)
   - Bilibili (bilibili)
   - 快手 (kuaishou)

---

## 📋 部署步骤

### 1. 安装 social-auto-upload (sau)

在服务器上安装：

```bash
# 使用 pip 安装
pip install social-auto-upload

# 或使用 uv（更快）
uv pip install social-auto-upload
```

### 2. 验证安装

```bash
# 查看帮助
sau --help

# 查看支持的平台
sau --help
```

### 3. 启动 ClipFlow 应用

```bash
cd /path/to/clipflow
npm run dev
```

---

## 🚀 使用流程

### 第一步：登录社交平台账号

1. 打开 ClipFlow 应用
2. 点击导航菜单的"社交发布"
3. 选择平台（如：抖音）
4. 输入账号名称（如：my_douyin_account）
5. 点击"登录账号"按钮
6. **会自动打开浏览器**显示二维码
7. 用手机对应的 App 扫码授权
8. 等待登录成功提示

**注意：**
- 登录是**在服务器上**打开浏览器（如果是本地开发，就是你的电脑）
- 二维码会显示在服务器屏幕上
- 如果是远程服务器，需要配置远程显示或使用无头模式

### 第二步：发布视频

1. 在"社交发布"页面：
   - 选择平台和账号
   - 选择视频文件
   - 填写标题（必需）
   - 填写描述（可选）
   - 填写标签（可选，逗号分隔）
2. 点击"发布到社交平台"按钮
3. 等待上传完成
4. 查看结果反馈

---

## 🔧 配置说明

### 本地开发环境

**适用场景：** 在你的电脑上运行 ClipFlow

1. 安装 sau：
   ```bash
   pip install social-auto-upload
   ```

2. 启动开发服务器：
   ```bash
   cd clipflow
   npm run dev
   ```

3. 使用流程：
   - 登录时会在**你的屏幕**上显示二维码
   - 用手机扫码即可

### 生产服务器环境

**适用场景：** 部署在远程服务器上

有两种方案：

#### 方案 A：服务器有图形界面

1. 确保服务器有桌面环境（GNOME、KDE 等）
2. 安装 Chrome 浏览器：
   ```bash
   # Ubuntu/Debian
   sudo apt-get install chromium-browser

   # CentOS/RHEL
   sudo yum install chromium
   ```

3. 配置 sau 使用 Chrome：
   ```bash
   # 编辑配置文件（如果有的话）
   # 或设置环境变量
   export CHROME_PATH=/usr/bin/chromium-browser
   ```

#### 方案 B：无头模式（推荐）

1. 配置 sau 使用无头模式：
   ```bash
   # 需要安装 Xvfb（虚拟显示）
   sudo apt-get install xvfb

   # 使用 Xvfb 运行
   xvfb-run sau douyin login --account my_account
   ```

2. 二维码会保存为图片，需要：
   - 添加 API 读取二维码图片
   - 在前端显示二维码
   - 用户扫码后后端检测登录状态

---

## 📝 API 说明

### POST /api/social/upload

上传视频到社交平台

**请求体：**
```json
{
  "platform": "douyin",
  "account": "my_account",
  "file": "/path/to/video.mp4",
  "title": "视频标题",
  "desc": "视频描述（可选）",
  "tags": ["标签1", "标签2"]
}
```

**响应：**
```json
{
  "success": true,
  "message": "上传成功",
  "platform": "douyin",
  "output": "..."
}
```

### POST /api/social/accounts/login

启动登录流程

**请求体：**
```json
{
  "platform": "douyin",
  "account": "my_account"
}
```

**响应：**
```json
{
  "success": true,
  "message": "登录成功",
  "platform": "douyin",
  "account": "my_account"
}
```

---

## 🐛 常见问题

### Q1: 提示 "sau command not found"

**解决方法：**
```bash
# 检查安装
which sau

# 如果没有，重新安装
pip install social-auto-upload --upgrade
```

### Q2: 登录时看不到二维码

**原因：** 服务器是远程的，浏览器窗口在远程服务器上

**解决方法：**
- 方案 A：使用 VNC 或远程桌面查看服务器屏幕
- 方案 B：配置无头模式，二维码保存为图片（需要开发）
- 方案 C：在本地开发测试

### Q3: 上传失败

**检查：**
1. sau 是否正确安装：`sau --help`
2. 账号是否已登录：`sau douyin check --account my_account`
3. 视频文件路径是否正确
4. 视频格式是否支持

### Q4: 支持哪些视频格式？

根据平台不同，一般支持：
- MP4（推荐）
- MOV
- AVI

---

## 🎯 下一步优化建议

1. **二维码显示优化**
   - 保存二维码为图片
   - 在前端显示二维码
   - 轮询登录状态

2. **账号管理**
   - 保存登录状态到数据库
   - 显示已登录账号列表
   - 支持多个账号

3. **批量发布**
   - 一次选择多个平台
   - 自动适配不同平台的标题长度

4. **上传进度**
   - 显示实时进度
   - 支持取消上传

---

## 📚 参考文档

- [social-auto-upload GitHub](https://github.com/dreammis/social-auto-upload)
- [social-auto-upload 使用文档](https://github.com/dreammis/social-auto-upload#%F0%9F%8F%81%E5%BF%AB%E9%80%9F%E5%BC%80%E5%A7%8B)

---

## ✨ 功能清单

- [x] 基础上传 API
- [x] 账号登录 API
- [x] 前端上传页面
- [x] 导航菜单集成
- [ ] 二维码显示优化
- [ ] 账号状态保存
- [ ] 批量发布
- [ ] 上传进度显示
- [ ] 错误处理优化
