#!/bin/bash

# ClipFlow 生产环境一键部署脚本
# 使用方法: ./deploy-production.sh 服务器IP 域名

SERVER_IP=$1
DOMAIN_NAME=$2
PROJECT_PATH="/Users/xiangyu/Desktop/ai智能体-发布页面管理"

if [ -z "$SERVER_IP" ] || [ -z "$DOMAIN_NAME" ]; then
    echo "❌ 使用方法: ./deploy-production.sh 服务器IP 域名"
    echo "示例: ./deploy-production.sh 123.45.67.89 clipflow.example.com"
    exit 1
fi

echo "🚀 ClipFlow 生产环境部署"
echo "================================"
echo "服务器IP: $SERVER_IP"
echo "域名: $DOMAIN_NAME"
echo ""

# 1. 检查本地文件
echo "📋 检查本地文件..."
if [ ! -d "$PROJECT_PATH/clipflow" ]; then
    echo "❌ ClipFlow 目录不存在: $PROJECT_PATH/clipflow"
    exit 1
fi
echo "✅ 本地文件检查完成"
echo ""

# 2. 生成环境变量文件
echo "🔐 生成生产环境变量..."
NEXTAUTH_SECRET=$(openssl rand -base64 32)
DB_PASSWORD=$(openssl rand -base64 16)

cat > "$PROJECT_PATH/clipflow/apps/web/.env.production" << EOF
# 数据库配置
DATABASE_URL="mysql://clipflow:${DB_PASSWORD}@localhost:3306/clipflow"

# NextAuth 配置
NEXTAUTH_URL="https://${DOMAIN_NAME}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"

# 应用配置
NODE_ENV="production"
PORT=3000

# Lightpanda 配置
LIGHTPANDA_CDP_ENDPOINT="ws://localhost:9223"
EOF

echo "✅ 环境变量文件已生成"
echo "   数据库密码: ${DB_PASSWORD}"
echo "   NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}"
echo ""

# 3. 上传代码到服务器
echo "📦 上传代码到服务器..."
echo "   正在上传 clipflow 目录..."

# 使用 rsync 同步文件（排除 node_modules）
rsync -avz --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.venv' \
    --exclude 'social-auto-upload/.venv' \
    --exclude 'social-auto-upload/node_modules' \
    "$PROJECT_PATH/clipflow/" \
    "root@${SERVER_IP}:/var/www/clipflow/"

if [ $? -eq 0 ]; then
    echo "✅ 代码上传成功"
else
    echo "❌ 代码上传失败"
    exit 1
fi
echo ""

# 4. 在服务器上执行配置命令
echo "🔧 配置服务器环境..."
ssh root@$SERVER_IP << 'ENDSSH'
# 更新系统
apt update && apt upgrade -y

# 安装基础工具
apt install -y curl wget git nginx docker.io docker-compose

# 安装 Node.js 18
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
fi

# 安装 Python 3.11
apt install -y python3.11 python3.11-venv python3-pip

# 安装 PM2
npm install -g pm2

echo "✅ 服务器环境配置完成"
ENDSSH

if [ $? -ne 0 ]; then
    echo "❌ 服务器配置失败"
    exit 1
fi
echo ""

# 5. 安装应用依赖
echo "📚 安装应用依赖..."
ssh root@$SERVER_IP << 'ENDSSH'
cd /var/www/clipflow/apps/web

# 安装 Node.js 依赖
npm install

# 创建 Python 虚拟环境
cd /var/www/clipflow
python3.11 -m venv .venv
source .venv/bin/activate

# 安装 social-auto-upload
if [ -d "social-auto-upload" ]; then
    cd social-auto-upload
    pip install -e .
    cd ..
fi

echo "✅ 依赖安装完成"
ENDSSH

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi
echo ""

# 6. 构建应用
echo "🏗️  构建应用..."
ssh root@$SERVER_IP << 'ENDSSH'
cd /var/www/clipflow/apps/web

# 构建生产版本
npm run build

# 初始化数据库
npx prisma generate
npx prisma db push

echo "✅ 应用构建完成"
ENDSSH

if [ $? -ne 0 ]; then
    echo "❌ 应用构建失败"
    exit 1
fi
echo ""

# 7. 配置 Nginx
echo "🌐 配置 Nginx..."
ssh root@$SERVER_IP "DOMAIN_NAME=$DOMAIN_NAME" << 'ENDSSH'
cat > /etc/nginx/sites-available/clipflow << EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /api/social/ {
        proxy_pass http://localhost:3000;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }
}
EOF

# 启用配置
ln -sf /etc/nginx/sites-available/clipflow /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重启 Nginx
systemctl restart nginx

echo "✅ Nginx 配置完成"
ENDSSH

if [ $? -ne 0 ]; then
    echo "❌ Nginx 配置失败"
    exit 1
fi
echo ""

# 8. 启动服务
echo "🚀 启动服务..."
ssh root@$SERVER_IP << 'ENDSSH'
cd /var/www/clipflow

# 启动 Lightpanda
docker compose up -d lightpanda

# 启动应用（使用 PM2）
cd /var/www/clipflow/apps/web
pm2 stop clipflow 2>/dev/null || true
pm2 delete clipflow 2>/dev/null || true
pm2 start npm --name "clipflow" -- start

# 设置 PM2 开机自启
pm2 startup systemd
pm2 save

echo "✅ 服务启动完成"
ENDSSH

if [ $? -ne 0 ]; then
    echo "❌ 服务启动失败"
    exit 1
fi
echo ""

# 9. 配置防火墙
echo "🔒 配置防火墙..."
ssh root@$SERVER_IP << 'ENDSSH'
# 配置 UFW 防火墙
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS

echo "✅ 防火墙配置完成"
ENDSSH

if [ $? -ne 0 ]; then
    echo "❌ 防火墙配置失败"
    exit 1
fi
echo ""

# 10. 部署完成信息
echo "================================"
echo "🎉 部署完成！"
echo ""
echo "📍 访问信息："
echo "   HTTP:  http://${DOMAIN_NAME}"
echo "   服务器: root@${SERVER_IP}"
echo ""
echo "🔧 后续步骤："
echo "   1. 配置域名 DNS 解析到 ${SERVER_IP}"
echo "   2. 安装 SSL 证书: certbot --nginx -d ${DOMAIN_NAME}"
echo "   3. 创建管理员账号: 访问 http://${DOMAIN_NAME}/register"
echo "   4. 设置数据库密码: ${DB_PASSWORD}"
echo ""
echo "🛠️  管理命令："
echo "   查看应用状态: ssh root@${SERVER_IP} 'pm2 status'"
echo "   查看应用日志: ssh root@${SERVER_IP} 'pm2 logs clipflow'"
echo "   重启应用: ssh root@${SERVER_IP} 'pm2 restart clipflow'"
echo "   查看Nginx日志: ssh root@${SERVER_IP} 'tail -f /var/log/nginx/access.log'"
echo ""
echo "================================"

# 保存重要信息
cat > "$PROJECT_PATH/deployment-info.txt" << EOF
ClipFlow 部署信息
==================

服务器IP: ${SERVER_IP}
域名: ${DOMAIN_NAME}
访问地址: http://${DOMAIN_NAME}

数据库密码: ${DB_PASSWORD}
NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}

SSH连接: ssh root@${SERVER_IP}

部署时间: $(date)
EOF

echo "📋 部署信息已保存到: $PROJECT_PATH/deployment-info.txt"
