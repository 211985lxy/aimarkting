# 🎁 ClipFlow 激活码系统使用指南

## 🚀 快速开始

### 第一步：创建管理员账号

```bash
# 1. 访问注册页面
http://localhost:3000/register

# 2. 注册管理员账号
- 姓名: 管理员
- 邮箱: admin@example.com
- 密码: 设置强密码
```

### 第二步：配置激活码脚本

编辑 `generate-codes.sh` 文件，修改管理员信息：

```bash
ADMIN_EMAIL="admin@example.com"  # 改为你的管理员邮箱
ADMIN_PASSWORD="admin123"         # 改为你的管理员密码
```

### 第三步：生成激活码

```bash
# 生成 10 个激活码，有效期 30 天
./generate-codes.sh 10 "测试用户" 30

# 生成 50 个激活码，有效期 1 年
./generate-codes.sh 50 "朋友邀请" 365

# 生成 100 个激活码，有效期 3 年
./generate-codes.sh 100 "VIP用户" 1095
```

## 📋 激活码格式

生成的激活码格式为：`XXXX-XXXX-XXXX-XXXX`

示例：
- `AB3K-7NM9-PQ2R-S4T5`
- `H8JK-3MN4-P6Q7-R9ST`
- `2VWX-4YZ1-AB3C-5DE7`

## 🎯 激活码使用流程

### 用户注册使用激活码

1. **访问注册页面**
   ```
   http://localhost:3000/register
   ```

2. **填写注册信息**
   - 姓名
   - 邮箱
   - 密码
   - **激活码**（输入生成的激活码）

3. **完成注册**
   - 系统自动验证激活码
   - 激活码被标记为已使用
   - 用户获得相应天数的会员权限

## 📊 激活码管理

### 查看所有激活码

访问管理后台：
```
http://localhost:3000/admin/activation-codes
```

### 导出激活码

```bash
# 查看批次列表（在管理后台获取批次ID）
# 然后导出特定批次

./export-codes.sh <批次ID>
```

导出文件格式：
```
ClipFlow 激活码批次
==================
批次ID: abc-123-def
导出时间: 2024-04-08 18:00:00

1. AB3K-7NM9-PQ2R-S4T5
   状态: unused
   有效期: 30 天

2. H8JK-3MN4-P6Q7-R9ST
   状态: used
   使用者: user@example.com
   使用时间: 2024-04-08 15:30:00
   有效期: 365 天
```

## 🔧 高级功能

### 批量管理

```bash
# 生成大量激活码
./generate-codes.sh 500 "批量用户" 365

# 按用途分类
./generate-codes.sh 20 "学生用户" 365
./generate-codes.sh 50 "企业用户" 365
./generate-codes.sh 100 "VIP用户" 1095
```

### 有效期管理

激活码支持的有效期：
- **7 天** - 周体验
- **30 天** - 月度体验
- **90 天** - 季度会员
- **365 天** - 年度会员
- **1095 天** - 三年会员
- **3650 天** - 十年会员

### 状态跟踪

每个激活码都有以下状态：
- **unused** - 未使用
- **used** - 已使用

可以查看：
- 激活码生成时间
- 激活码使用时间
- 使用者信息
- 批次信息

## 💡 使用场景

### 场景 1：邀请朋友测试

```bash
# 生成 10 个测试激活码
./generate-codes.sh 10 "朋友内测" 30

# 导出激活码
./export-codes.sh <批次ID>

# 分享给朋友
```

### 场景 2：学生推广

```bash
# 生成学生专用激活码
./generate-codes.sh 100 "学生优惠" 365

# 在校园活动中分发
```

### 场景 3：付费会员

```bash
# 生成付费激活码
./generate-codes.sh 50 "年度会员" 365

# 出售后提供激活码
```

## 🔒 安全建议

1. **保护管理员账号**
   - 使用强密码
   - 不要分享给他人
   - 定期更换密码

2. **激活码分发**
   - 记录激活码分发情况
   - 不要在公共场所公开
   - 一对一发送给用户

3. **监控使用情况**
   - 定期检查激活码使用情况
   - 发现异常及时处理
   - 导出数据进行备份

## 📱 API 接口

系统提供完整的 API 接口：

### 生成激活码
```http
POST /api/admin/activation-codes/generate
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "quantity": 10,
  "batchNote": "测试用户",
  "durationDays": 30
}
```

### 查询激活码
```http
GET /api/admin/activation-codes?batchId=xxx&pageSize=20
Authorization: Bearer <admin_token>
```

### 导出激活码
```http
GET /api/admin/activation-codes/export?batchId=xxx
Authorization: Bearer <admin_token>
```

## 🛠️ 故障排查

### 问题 1：登录失败
```
❌ 登录失败！请检查管理员账号密码
```

**解决方法：**
1. 检查 `generate-codes.sh` 中的邮箱和密码
2. 确认管理员账号已注册
3. 测试登录：`curl -X POST http://localhost:3000/api/auth/login ...`

### 问题 2：生成失败
```
❌ 生成失败！
```

**解决方法：**
1. 确认应用正在运行
2. 检查管理员权限
3. 查看应用日志

### 问题 3：激活码无效
```
激活码无效或已使用
```

**解决方法：**
1. 检查激活码是否正确
2. 确认激活码未使用
3. 联系管理员重新生成

## 📊 统计功能

访问管理后台查看统计：
- 总激活码数量
- 已使用数量
- 未使用数量
- 按批次统计
- 使用趋势分析

```
http://localhost:3000/admin/activation-codes
```

## 🎓 最佳实践

1. **批次管理**
   - 按用途创建不同批次
   - 添加清晰的备注
   - 定期整理和归档

2. **有效期设置**
   - 体验用户：7-30 天
   - 普通用户：365 天
   - VIP 用户：1095+ 天

3. **数量控制**
   - 避免一次性生成过多
   - 根据实际需求生成
   - 保持激活码稀缺性

4. **监控和审计**
   - 定期检查使用情况
   - 分析用户来源
   - 优化分发策略

---

**立即开始：**
```bash
# 1. 修改管理员信息
vim generate-codes.sh

# 2. 生成第一批激活码
./generate-codes.sh 10 "第一批用户" 30

# 3. 分享给朋友开始使用！
```

**需要帮助？** 查看 ClipFlow 管理后台或联系技术支持。