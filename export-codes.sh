#!/bin/bash

# ClipFlow 激活码导出工具
# 使用方法: ./export-codes.sh 批次ID

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

if [ $# -lt 1 ]; then
    echo -e "${BLUE}📦 ClipFlow 激活码导出工具${NC}"
    echo ""
    echo "使用方法:"
    echo "  ./export-codes.sh 批次ID"
    echo ""
    echo "获取批次ID:"
    echo "  访问 http://localhost:3000/admin/activation-codes"
    echo ""
    exit 1
fi

BATCH_ID=$1
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="admin123"
OUTPUT_FILE="activation-codes-$BATCH_ID.txt"

echo -e "${BLUE}📦 导出激活码批次: $BATCH_ID${NC}"
echo ""

# 获取管理员 Token
echo -e "${YELLOW}🔐 登录管理员账号...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ 登录失败！${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 登录成功${NC}"
echo ""

# 获取激活码
echo -e "${YELLOW}📥 正在导出激活码...${NC}"
curl -s "http://localhost:3000/api/admin/activation-codes?batchId=$BATCH_ID&pageSize=500" \
  -H "Authorization: Bearer $TOKEN" \
  -o /tmp/codes_response.json

# 提取激活码信息
echo "" > "$OUTPUT_FILE"
echo "ClipFlow 激活码批次" >> "$OUTPUT_FILE"
echo "==================" >> "$OUTPUT_FILE"
echo "批次ID: $BATCH_ID" >> "$OUTPUT_FILE"
echo "导出时间: $(date)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# 解析 JSON 并格式化输出
python3 - << PYTHON_SCRIPT
import json
import sys

with open('/tmp/codes_response.json', 'r') as f:
    data = json.load(f)

if 'data' in data and 'results' in data['data']:
    results = data['data']['results']

    with open('$OUTPUT_FILE', 'a') as f:
        for idx, code in enumerate(results, 1):
            f.write(f"{idx}. {code['code']}\n")
            f.write(f"   状态: {code['status']}\n")
            if code['status'] == 'used':
                f.write(f"   使用者: {code.get('user', {}).get('email', 'N/A')}\n")
                f.write(f"   使用时间: {code.get('usedAt', 'N/A')}\n")
            f.write(f"   有效期: {code['durationDays']} 天\n")
            f.write("\n")

    print(f"✅ 成功导出 {len(results)} 个激活码")
else:
    print("❌ 未找到激活码数据")
    sys.exit(1)
PYTHON_SCRIPT

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 导出成功！${NC}"
    echo ""
    echo "📄 文件: $OUTPUT_FILE"
    echo ""
    echo "📋 激活码列表："
    cat "$OUTPUT_FILE" | grep -E "^[0-9]+\." | head -10
    TOTAL=$(cat "$OUTPUT_FILE" | grep -c "^[0-9]+\.")
    if [ $TOTAL -gt 10 ]; then
        echo "... 还有 $((TOTAL-10)) 个激活码"
    fi
else
    echo -e "${RED}❌ 导出失败${NC}"
    exit 1
fi

echo ""
echo "================================"
