> **⚠️ OUTDATED — 路径和数据库名（clipflow）已过时，当前项目为 mingyuan。** 保留仅作历史参考。

# ClipFlow 激活码管理指南（历史）

激活码用于限制注册和延长用户会员有效期。当前实现以管理后台和 Next.js API 为主，不再依赖根目录下的 `generate-codes.sh` / `export-codes.sh` 旧脚本。

## 管理员准备

1. 在 `clipflow/apps/web/.env.local` 配置数据库和管理后台密钥：

```bash
DATABASE_URL="mysql://user:password@localhost:3306/clipflow"
JWT_SECRET="生成的随机字符串"
ADMIN_JWT_SECRET="生成的随机字符串"
ADMIN_EMAIL="admin@clipflow.com"
ADMIN_PASSWORD="设置强密码"
```

2. 初始化数据库并种子数据：

```bash
cd clipflow/apps/web
npx prisma generate
npx prisma db push
pnpm prisma db seed
```

3. 访问管理后台：

```text
http://localhost:3000/admin/login
```

## 管理后台流程

1. 登录 `/admin/login`。
2. 进入 `/admin/activation-codes`。
3. 设置生成数量、批次备注、有效期天数。
4. 生成后可按批次或状态筛选、查看统计、导出 CSV。

激活码格式在导出时显示为 `XXXX-XXXX-XXXX-XXXX`。数据库中保存的是 16 位无分隔符代码。

## 用户使用流程

用户可在注册或激活页输入激活码：

```text
http://localhost:3000/register
http://localhost:3000/activate
```

系统会校验激活码是否存在且未使用。激活成功后，激活码状态变为 `used`，并绑定到用户；用户 `expiresAt` 会按激活码 `durationDays` 顺延。

## API 速查

所有管理接口都需要管理后台 JWT：

```http
Authorization: Bearer <admin_token>
```

### 管理员登录

```http
POST /api/admin/auth/login
Content-Type: application/json

{
  "email": "admin@clipflow.com",
  "password": "your-password"
}
```

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

约束：

- `quantity`: 1-500
- `durationDays`: 1-3650

### 查询激活码

```http
GET /api/admin/activation-codes?page=1&pageSize=20&status=unused&batchId=<batchId>
Authorization: Bearer <admin_token>
```

### 查看统计

```http
GET /api/admin/activation-codes/stats
Authorization: Bearer <admin_token>
```

### 导出 CSV

```http
GET /api/admin/activation-codes/export?batchId=<batchId>&status=unused
Authorization: Bearer <admin_token>
```

## 数据模型

核心表：`ActivationCode`

| 字段 | 说明 |
|------|------|
| `code` | 16 位激活码，唯一 |
| `batchId` | 批次 ID |
| `batchNote` | 批次备注 |
| `durationDays` | 激活后增加的会员天数 |
| `status` | `unused` 或 `used` |
| `usedBy` / `usedAt` | 使用者和使用时间 |
| `createdBy` | 创建该码的管理员 ID |

## 故障排查

- 管理员无法登录：确认 `ADMIN_PASSWORD` 已设置，并已执行 `pnpm prisma db seed`。
- 接口返回 `Unauthorized`：重新登录管理后台，或检查 `Authorization` header。
- 接口返回 `Forbidden`：当前管理员不是 `admin` 角色，生成激活码要求管理员权限。
- 用户提示激活码无效：确认代码未加多余空格、未被使用，并在 `/admin/activation-codes` 中可查到。
