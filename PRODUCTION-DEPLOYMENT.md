# 🚀 ClipFlow 社交发布 - 生产环境部署指南

## 📋 部署概览

将本地 ClipFlow 系统部署到云端，让朋友可以通过互联网访问。

## 🎯 推荐方案

### 方案 1：阿里云/腾讯云 VPS 部署（推荐）

**优势：**
- 完全控制服务器
- 成本较低（约 ¥50-100/月）
- 适合个人项目
- 朋友可以公网访问

### 方案 2：Vercel + Railway 部署

**优势：**
- 免费额度
- 自动 HTTPS
- 简单部署
- 但可能有功能限制

## 🏗️ 详细部署步骤（方案 1）

### 第一步：准备云服务器

#### 1. 购买云服务器

**阿里云 ECS：**
- 配置：2核4G内存
- 系统：Ubuntu 22.04
- 带宽：1Mbps起
- 成本：约 ¥60/月

**腾讯云：**
- 配置：2核4G内存  
- 系统：Ubuntu 22.04
- 带宽：1Mbps起
- 成本：约 ¥50/月

#### 2. 获取服务器信息

```bash
# 服务器信息
IP地址: 你的服务器公网IP
用户名: root (或 ubuntu)
密码: 设置的root密码
```

### 第二步：服务器基础配置

#### 1. 连接服务器

```bash
# SSH连接
ssh root@你的服务器IP

# 或使用密钥
ssh -i 你的密钥.pem root@你的服务器IP
```

#### 2. 安装基础环境

```bash
# 更新系统
apt update && apt upgrade -y

# 安装必要工具
apt install -y curl wget git nginx docker.io docker-compose

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 安装 Python 3.11
apt install -y python3.11 python3.11-venv python3-pip

# 安装 PM2（进程管理）
npm install -g pm2
```

### 第三步：部署应用代码

#### 1. 克隆代码到服务器

```bash
# 创建项目目录
mkdir -p /var/www/clipflow
cd /var/www/clipflow

# 克隆代码（从你的GitHub或直接上传）
git clone 你的仓库地址 .

# 或使用 scp 上传本地代码
# 在你的本地电脑执行：
scp -r /Users/xiangyu/Desktop/ai智能体-发布页面管理/clipflow root@服务器IP:/var/www/clipflow/
```

#### 2. 安装依赖

```bash
cd /var/www/clipflow/apps/web

# 安装 Node.js 依赖
npm install

# 安装 Python 依赖
python3.11 -m venv /var/www/clipflow/.venv
source /var/www/clipflow/.venv/bin/activate
pip install -e /var/www/clipflow/social-auto-upload
```

### 第四步：配置生产数据库

#### 1. 使用云数据库（推荐）

**阿里云 RDS MySQL：**
- 版本：MySQL 8.0
- 规格：1核2GB内存
- 存储：20GB SSD
- 成本：约 ¥30/月

**腾讯云 MySQL：**
- 类似配置

#### 2. 或在服务器安装 MySQL

```bash
# 安装 MySQL
apt install -y mysql-server

# 安全配置
mysql_secure_installation

# 创建数据库
mysql -u root -p
```

```sql
CREATE DATABASE clipflow;
CREATE USER 'clipflow'@'localhost' IDENTIFIED BY '强密码';
GRANT ALL PRIVILEGES ON clipflow.* TO 'clipflow'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 第五步：配置环境变量

```bash
cd /var/www/clipflow/apps/web

# 创建生产环境变量文件
cat > .env.production << 'EOF'
# 数据库配置
DATABASE_URL="mysql://clipflow:强密码@localhost:3306/clipflow"

# NextAuth 配置
NEXTAUTH_URL="https://你的域名.com"
NEXTAUTH_SECRET="生成的随机字符串"

# 应用配置
NODE_ENV="production"
PORT=3000

# Lightpanda 配置
LIGHTPANDA_CDP_ENDPOINT="ws://localhost:9223"
EOF

# 生成 NEXTAUTH_SECRET
openssl rand -base64 32
```

### 第六步：构建 Next.js 应用

```bash
cd /var/www/clipflow/apps/web

# 构建生产版本
npm run build

# 初始化数据库
npx prisma generate
npx prisma db push
```

### 第七步：启动应用

#### 1. 使用 PM2 启动

```bash
# 启动应用
pm2 start npm --name "clipflow" -- start

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status
pm2 logs clipflow
```

#### 2. 启动 Lightpanda

```bash
cd /var/www/clipflow
docker compose up -d lightpanda
```

### 第八步：配置 Nginx 反向代理

#### 1. 配置 Nginx

```bash
cat > /etc/nginx/sites-available/clipflow << 'EOF'
server {
    listen 80;
    server_name 你的域名.com;

    # 反向代理到 Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 社交上传 API 超时设置
    location /api/social/ {
        proxy_pass http://localhost:3000;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }
}
EOF

# 启用配置
ln -s /etc/nginx/sites-available/clipflow /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重启 Nginx
systemctl restart nginx
```

### 第九步：配置 SSL 证书（HTTPS）

```bash
# 安装 Certbot
apt install -y certbot python3-certbot-nginx

# 获取 SSL 证书
certbot --nginx -d 你的域名.com

# 自动续期
certbot renew --dry-run
```

### 第十步：域名配置

#### 1. 购买域名

- 阿里云：wanwang.aliyun.com
- 腾讯云：dnspod.cn
- Namesilo：namesilo.com

#### 2. 配置 DNS 解析

```
类型: A记录
主机记录: @
记录值: 你的服务器IP
TTL: 600
```

## 🔒 安全配置

### 1. 防火墙配置

```bash
# 配置 UFW 防火墙
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

### 2. 限制 SSH 访问

```bash
# 编辑 SSH 配置
vim /etc/ssh/sshd_config

# 修改以下配置
PermitRootLogin no
PasswordAuthentication no

# 重启 SSH
systemctl restart sshd
```

## 📊 监控和维护

### 1. 日志监控

```bash
# 应用日志
pm2 logs clipflow

# Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Lightpanda 日志
docker logs -f clipflow-lightpanda
```

### 2. 性能监控

```bash
# 系统资源
htop

# 磁盘使用
df -h

# 内存使用
free -m
```

## 💰 成本预算

### 月度成本估算

| 项目 | 配置 | 价格 |
|------|------|------|
| 云服务器 | 2核4GB | ¥60/月 |
| 云数据库 | 1核2GB | ¥30/月 |
| 域名 | .com | ¥10/年 |
| SSL证书 | Let's Encrypt | 免费 |
| **总计** | | **~¥90/月** |

### 优化方案

- 使用学生优惠：半价
- 使用按量付费：更灵活
- 选择长期套餐：更优惠

## 🎯 快速部署脚本

我可以为你创建一个自动化部署脚本，一键完成所有配置。

## 📱 给朋友访问

### 1. 分享访问链接

```
https://你的域名.com
```

### 2. 创建邀请链接

在应用中实现邀请码系统，限制注册人数。

### 3. 用户管理

- 设置注册审核
- 限制每日使用次数
- 添加用户权限控制

## 🚀 部署检查清单

- [ ] 服务器购买完成
- [ ] 域名购买完成
- [ ] DNS 解析配置完成
- [ ] 代码上传到服务器
- [ ] 数据库创建完成
- [ ] 环境变量配置完成
- [ ] 应用构建成功
- [ ] Nginx 配置完成
- [ ] SSL 证书安装完成
- [ ] 防火墙配置完成
- [ ] 朋友可以访问测试

需要我帮你创建具体的部署脚本吗？
