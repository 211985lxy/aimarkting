# 🔧 激活码问题解决方案

## ❌ 问题：激活码没有激活成功

### 可能的原因：
1. **使用流程错误** - 激活码不是在注册时使用的
2. **激活码不存在** - 数据库中没有这个激活码
3. **权限问题** - 没有管理员权限创建激活码

---

## ✅ 正确的激活码使用流程

### 📋 完整流程：

#### 第一步：注册账号（不需要激活码）
```
访问: http://localhost:3000/register
填写:
- 姓名: 测试用户
- 邮箱: test@example.com
- 密码: password123
```

#### 第二步：登录账号
```
访问: http://localhost:3000/login
使用刚才注册的邮箱和密码登录
```

#### 第三步：激活账号（在这里使用激活码）
```
访问: http://localhost:3000/activate
输入激活码: TEST2024A
```

---

## 🎁 立即可用的测试方案

### 方案1: 先测试基本功能（不需要激活码）

```bash
# 1. 注册普通账号
http://localhost:3000/register

# 2. 直接使用社交发布功能
http://localhost:3000/social
```

普通用户也可以使用基本的社交发布功能！

### 方案2: 使用管理员API创建激活码

```bash
# 运行激活码创建脚本
./simple-code-creator.sh
```

### 方案3: 手动在数据库创建（高级用户）

```sql
-- 在MySQL中执行
INSERT INTO ActivationCode (id, code, batchId, batchNote, durationDays, status, createdBy, createdAt)
VALUES (UUID(), 'TEST2024A', UUID(), '测试', 30, 'unused', (SELECT id FROM User LIMIT 1), NOW());
```

---

## 🔍 检查激活码是否可用

### 方法1: 访问管理后台
```
http://localhost:3000/admin/activation-codes
```

### 方法2: 查询数据库
```bash
docker exec clipflow-mysql mysql -u clipflow -pclipflow123 clipflow -e "
SELECT code, status, durationDays FROM ActivationCode WHERE code = 'TEST2024A';
"
```

---

## 🚨 如果还是不行

### 临时解决方案：直接使用基本功能

1. **注册普通账号** - 不需要激活码
2. **使用社交发布功能** - 基本功能完全可用
3. **测试上传视频** - 所有平台都支持

**重要提示：** 激活码主要用于延长会员期限，基本功能不需要激活码！

---

## 💡 推荐做法

### 现在开始测试：
```bash
# 1. 注册账号（不需要激活码）
http://localhost:3000/register

# 2. 直接使用社交发布功能
http://localhost:3000/social

# 3. 测试上传视频到各个平台
```

### 如果确实需要激活码：
```bash
# 使用创建脚本
./simple-code-creator.sh
```

---

## 📱 当前可用的测试账号

你可以直接使用这些账号进行测试：

1. **admin@temp.local** / **TempPass123** (已创建)

或者自己注册新账号，完全不需要激活码！

---

**🎯 立即开始测试社交发布功能，不需要激活码！**
