# ClipFlow 生产部署指南

本文按当前代码结构整理：Next.js 应用位于 `clipflow/apps/web`，包管理使用 pnpm，数据库使用 MySQL/MariaDB，Prisma 7 通过 MariaDB adapter 连接。

## 推荐架构

| 组件 | 建议 |
|------|------|
| 应用服务器 | Ubuntu 22.04 / 24.04，2C4G 起 |
| Node.js | 20 LTS |
| 包管理 | pnpm 9 |
| 数据库 | MySQL 8 或 MariaDB |
| 缓存/队列 | Redis |
| 反向代理 | Nginx + HTTPS |
| 进程管理 | PM2 或 systemd |
| 对象存储 | 阿里云 OSS |

## 服务器准备

```bash
apt update && apt upgrade -y
apt install -y curl wget git nginx docker.io docker-compose-plugin mysql-client redis-tools

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pnpm@9 pm2
```

## 获取代码和安装依赖

```bash
mkdir -p /var/www/clipflow
cd /var/www/clipflow
git clone <your-repo-url> .

cd clipflow
pnpm install --frozen-lockfile
```

如果部署机没有使用 lockfile 固定安装，可先在本地确认 lockfile 与 `package.json` 已同步。

## 环境变量

生产环境变量放在：

```text
/var/www/clipflow/clipflow/apps/web/.env
```

最小可运行配置：

```bash
DATABASE_URL="mysql://clipflow:strong-password@db-host:3306/clipflow"
REDIS_URL="redis://localhost:6379"

JWT_SECRET="生成的随机字符串"
ADMIN_JWT_SECRET="生成的随机字符串"
ADMIN_EMAIL="admin@clipflow.com"
ADMIN_PASSWORD="设置强密码"

THEROUTER_API_KEY=""
THEROUTER_BASE_URL="https://api.therouter.ai/v1"
THEROUTER_MODEL="anthropic/claude-sonnet-4.5"

SHANJIAN_APP_KEY=""
SHANJIAN_BASE_URL="https://openapi.shanjian.tv"
SHANJIAN_WEBHOOK_URL="https://你的域名.com/api/webhook/shanjian"

OSS_REGION=""
OSS_ACCESS_KEY_ID=""
OSS_ACCESS_KEY_SECRET=""
OSS_BUCKET=""

CRON_SECRET="生成的随机字符串"
```

按需增加：

- `ALIYUN_NLS_APP_KEY`：AIM 语音转写。
- `ALIYUN_VIAPI_ACCESS_KEY_ID` / `ALIYUN_VIAPI_ACCESS_KEY_SECRET`：4K 增强。
- `TIKHUB_API_KEY`：同行对标数据。
- `PEXELS_API_KEY_1`、`PIXABAY_API_KEY_1`：素材搜索。

## 数据库初始化

```bash
cd /var/www/clipflow/clipflow/apps/web
npx prisma generate
npx prisma db push
pnpm prisma db seed
```

`pnpm prisma db seed` 会创建管理员、模板、视频结构、选题引擎和系统设置。管理员账号来自 `ADMIN_EMAIL` / `ADMIN_PASSWORD`。

## 构建和启动

```bash
cd /var/www/clipflow/clipflow
pnpm build

cd apps/web
pm2 start "pnpm start" --name clipflow-web
pm2 save
pm2 startup
```

后台任务按需启动：

```bash
cd /var/www/clipflow/clipflow/apps/web
pm2 start "pnpm worker:task-recovery" --name clipflow-task-recovery
pm2 start "pnpm worker:backfill-video-delivery" --name clipflow-delivery-backfill
pm2 save
```

## Nginx

```nginx
server {
    listen 80;
    server_name 你的域名.com;

    client_max_body_size 200m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/webhook/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }
}
```

启用 HTTPS：

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d 你的域名.com
certbot renew --dry-run
```

## 冒烟检查

```bash
curl -f https://你的域名.com/api/healthz
pm2 status
pm2 logs clipflow-web --lines 100
```

后台登录：

```text
https://你的域名.com/admin/login
```

核心页面：

- `/`：营销页
- `/login`、`/register`、`/activate`：用户认证与激活
- `/home`：工作台首页
- `/ip-profile`：IP 档案
- `/aim`：AIM 灵感生成
- `/create`：视频创建
- `/videos`：视频任务
- `/admin`：管理后台

## 运维注意

- 不要把 `.env`、数据库备份、OSS 密钥提交到仓库。
- `CRON_SECRET` 保护 `/api/cron/*`，生产必须设置。
- Shanjian 回调地址应配置为公网 HTTPS 的 `/api/webhook/shanjian`。
- OSS 权限需要支持上传、读取和生命周期管理。
- 生产中不要依赖 `.env.local`，统一使用 `.env`。
