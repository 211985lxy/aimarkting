#!/bin/bash

# ClipFlow 服务器管理脚本
# 用于监控和管理生产环境服务器

SERVER_IP=""
PROJECT_PATH="/var/www/clipflow"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 帮助信息
show_help() {
    echo "ClipFlow 服务器管理工具"
    echo ""
    echo "使用方法:"
    echo "  ./server-manager.sh 命令 服务器IP"
    echo ""
    echo "可用命令:"
    echo "  status    - 查看服务状态"
    echo "  logs      - 查看应用日志"
    echo "  restart   - 重启应用"
    echo "  update    - 更新应用代码"
    echo "  backup    - 备份数据库"
    echo "  monitor   - 系统监控"
    echo "  ssl       - 安装SSL证书"
    echo ""
    echo "示例:"
    echo "  ./server-manager.sh status 123.45.67.89"
    echo "  ./server-manager.sh logs 123.45.67.89"
}

# 检查参数
if [ $# -lt 2 ]; then
    show_help
    exit 1
fi

COMMAND=$1
SERVER_IP=$2

# 执行命令
case $COMMAND in
    status)
        echo -e "${BLUE}📊 检查服务状态...${NC}"
        ssh root@$SERVER_IP << 'ENDSSH'
echo "=== 系统状态 ==="
echo "CPU使用率:"
top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1"%"}'

echo ""
echo "内存使用:"
free -h

echo ""
echo "磁盘使用:"
df -h | grep -v tmpfs

echo ""
echo "=== PM2 进程状态 ==="
pm2 status

echo ""
echo "=== Docker 容器状态 ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=== Nginx 状态 ==="
systemctl status nginx --no-pager | head -3
ENDSSH
        ;;

    logs)
        echo -e "${BLUE}📋 查看应用日志 (Ctrl+C 退出)...${NC}"
        ssh root@$SERVER_IP 'pm2 logs clipflow'
        ;;

    restart)
        echo -e "${YELLOW}🔄 重启应用...${NC}"
        ssh root@$SERVER_IP << 'ENDSSH'
cd /var/www/clipflow/apps/web
pm2 restart clipflow
echo "✅ 应用已重启"
ENDSSH
        ;;

    update)
        echo -e "${YELLOW}🔄 更新应用代码...${NC}"
        echo "⚠️  此操作将从本地同步代码到服务器"
        read -p "确认继续? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rsync -avz --exclude 'node_modules' \
                --exclude '.next' \
                --exclude '.venv' \
                --exclude 'social-auto-upload/.venv' \
                --exclude 'social-auto-upload/node_modules' \
                "$PROJECT_PATH/clipflow/" \
                "root@${SERVER_IP}:/var/www/clipflow/"

            ssh root@$SERVER_IP << 'ENDSSH'
cd /var/www/clipflow/apps/web
npm install
npm run build
pm2 restart clipflow
echo "✅ 更新完成"
ENDSSH
        else
            echo "❌ 取消更新"
        fi
        ;;

    backup)
        echo -e "${BLUE}💾 备份数据库...${NC}"
        BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
        ssh root@$SERVER_IP "mysqldump -u root -p clipflow > /tmp/clipflow_backup_\${BACKUP_DATE}.sql"
        echo "✅ 备份完成: clipflow_backup_${BACKUP_DATE}.sql"
        ;;

    monitor)
        echo -e "${BLUE}📊 实时监控...${NC}"
        ssh root@$SERVER_IP 'htop'
        ;;

    ssl)
        echo -e "${BLUE}🔒 安装SSL证书...${NC}"
        read -p "请输入域名: " DOMAIN
        ssh root@$SERVER_IP "certbot --nginx -d $DOMAIN"
        ;;

    *)
        echo -e "${RED}❌ 未知命令: $COMMAND${NC}"
        show_help
        exit 1
        ;;
esac
