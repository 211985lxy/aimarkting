# 🎴 ClipFlow 激活码快速参考卡

## ⚡ 3步快速生成

### 1️⃣ 创建管理员账号
```
访问: http://localhost:3000/register
填写: 管理员信息
```

### 2️⃣ 配置脚本
```bash
# 编辑 generate-codes.sh
ADMIN_EMAIL="你的管理员邮箱"
ADMIN_PASSWORD="你的管理员密码"
```

### 3️⃣ 生成激活码
```bash
./generate-codes.sh 10 "测试用户" 30
```

## 📋 常用命令

### 生成激活码
```bash
# 10个测试码（30天）
./generate-codes.sh 10 "测试" 30

# 50个邀请码（365天）
./generate-codes.sh 50 "邀请" 365

# 100个VIP码（3年）
./generate-codes.sh 100 "VIP" 1095
```

### 导出激活码
```bash
./export-codes.sh <批次ID>
```

### 查看管理后台
```
http://localhost:3000/admin/activation-codes
```

## 🎯 激活码格式

```
XXXX-XXXX-XXXX-XXXX
```

示例：
- `AB3K-7NM9-PQ2R-S4T5`
- `H8JK-3MN4-P6Q7-R9ST`

## 👥 用户使用流程

1. 访问注册页面
2. 填写注册信息
3. 输入激活码
4. 完成注册

## 💡 快速开始

```bash
# 运行交互式向导
./activation-codes-quick-start.sh

# 或直接生成
./generate-codes.sh 10 "第一批" 30
```

## 📚 详细文档

查看完整文档：[ACTIVATION-CODE-GUIDE.md](ACTIVATION-CODE-GUIDE.md)

## 🔧 管理命令

```bash
# 查看状态
./status.sh

# 查看应用日志
cd clipflow/apps/web && npm run dev

# 重启服务
pm2 restart clipflow
```

## 🆘 遇到问题？

1. **登录失败** → 检查管理员邮箱和密码
2. **生成失败** → 确认应用正在运行
3. **激活码无效** → 检查激活码是否已使用

---

**立即开始：** `./activation-codes-quick-start.sh` 🚀
