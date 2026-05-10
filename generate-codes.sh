#!/bin/bash

# ClipFlow 激活码生成工具
# 使用方法: ./generate-codes.sh 数量 备注 有效期

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查参数
if [ $# -lt 1 ]; then
    echo -e "${BLUE}🎁 ClipFlow 激活码生成工具${NC}"
    echo ""
    echo "使用方法:"
    echo "  ./generate-codes.sh 数量 [备注] [有效期天数]"
    echo ""
    echo "示例:"
    echo "  ./generate-codes.sh 10 \"测试用户\" 30"
    echo "  ./generate-codes.sh 50 \"朋友邀请\" 365"
    echo ""
    exit 1
fi

QUANTITY=$1
BATCH_NOTE=${2:-"批量生成"}
DURATION_DAYS=${3:-365}

# API 配置
API_URL="http://localhost:3000/api/admin/activation-codes/generate"
ADMIN_EMAIL="admin@example.com"  # 修改为你的管理员邮箱
ADMIN_PASSWORD="admin123"         # 修改为你的管理员密码

echo -e "${BLUE}🎁 开始生成激活码${NC}"
echo "================================"
echo "数量: $QUANTITY"
echo "备注: $BATCH_NOTE"
echo "有效期: $DURATION_DAYS 天"
echo ""

# 获取管理员 Token
echo -e "${YELLOW}🔐 登录管理员账号...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ 登录失败！请检查管理员账号密码${NC}"
    echo ""
    echo "请修改脚本中的管理员信息："
    echo "  ADMIN_EMAIL=\"你的管理员邮箱\""
    echo "  ADMIN_PASSWORD=\"你的管理员密码\""
    exit 1
fi

echo -e "${GREEN}✅ 登录成功${NC}"
echo ""

# 生成激活码
echo -e "${YELLOW}🎲 正在生成激活码...${NC}"
RESPONSE=$(curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"quantity\":$QUANTITY,\"batchNote\":\"$BATCH_NOTE\",\"durationDays\":$DURATION_DAYS}")

# 检查是否成功
if echo "$RESPONSE" | grep -q "error"; then
    echo -e "${RED}❌ 生成失败！${NC}"
    echo "$RESPONSE"
    exit 1
fi

# 获取批次ID
BATCH_ID=$(echo $RESPONSE | grep -o '"batchId":"[^"]*' | cut -d'"' -f4)

echo -e "${GREEN}✅ 成功生成 $QUANTITY 个激活码${NC}"
echo ""
echo "批次ID: $BATCH_ID"
echo "有效期: $DURATION_DAYS 天"
echo "备注: $BATCH_NOTE"
echo ""

# 获取生成的激活码列表
echo -e "${BLUE}📋 激活码列表：${NC}"
echo "================================"

CODES_RESPONSE=$(curl -s "http://localhost:3000/api/admin/activation-codes?batchId=$BATCH_ID&pageSize=$QUANTITY" \
  -H "Authorization: Bearer $TOKEN")

# 提取激活码
echo "$CODES_RESPONSE" | grep -o '"code":"[^"]*' | cut -d'"' -f4 | nl

echo ""
echo "================================"
echo -e "${GREEN}✅ 激活码生成完成！${NC}"
echo ""
echo "📱 使用方法："
echo "   1. 访问: http://localhost:3000/register"
echo "   2. 注册账号时输入激活码"
echo "   3. 账号将获得 $DURATION_DAYS 天会员权限"
echo ""
echo "💾 导出激活码:"
echo "   ./export-codes.sh $BATCH_ID"
echo ""
