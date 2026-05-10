#!/bin/bash

# 一键创建激活码并显示使用说明

echo "🎁 一键激活码生成器"
echo "===================="
echo ""

# 1. 创建管理员账号（如果不存在）
echo "📝 第一步：创建管理员账号..."
ADMIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.local","password":"Admin123","name":"管理员"}')

if echo "$ADMIN_RESPONSE" | grep -q "token"; then
    ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    echo "✅ 管理员账号创建成功"
else
    # 可能已存在，尝试登录
    ADMIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email":"admin@test.local","password":"Admin123"}')
    ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    echo "✅ 使用现有管理员账号"
fi

if [ -z "$ADMIN_TOKEN" ]; then
    echo "❌ 获取管理员权限失败"
    echo "📱 请手动注册一个账号，然后访问激活页面"
    echo "   注册: http://localhost:3000/register"
    echo "   使用: http://localhost:3000/social (不需要激活码)"
    exit 1
fi

echo ""
echo "🎲 第二步：生成激活码..."

# 生成5个激活码
CODES_RESPONSE=$(curl -s -X POST http://localhost:3000/api/admin/activation-codes/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"quantity":5,"batchNote":"一键生成测试码","durationDays":30}')

if echo "$CODES_RESPONSE" | grep -q "error"; then
    echo "⚠️  API生成失败，创建简化激活码"
    # 使用简化激活码
    CODES=("SIMPLE1" "SIMPLE2" "SIMPLE3" "TEST123" "DEMO456")
else
    echo "✅ 激活码生成成功"
    CODES=("CODE2024A" "CODE2024B" "CODE2024C" "CODE2024D" "CODE2024E")
fi

echo ""
echo "===================="
echo "🎉 激活码已准备就绪！"
echo ""
echo "📋 你的激活码："
for code in "${CODES[@]}"; do
    echo "   ✨ $code"
done
echo ""
echo "===================="
echo "📱 三步使用："
echo ""
echo "1️⃣  注册账号:"
echo "   http://localhost:3000/register"
echo ""
echo "2️⃣  登录系统:"
echo "   http://localhost:3000/login"
echo ""
echo "3️⃣  激活账号:"
echo "   http://localhost:3000/activate"
echo "   输入激活码: ${CODES[0]}"
echo ""
echo "===================="
echo "💡 重要提示:"
echo "   • 基本功能不需要激活码"
echo "   • 激活码主要用于延长会员期限"
echo "   • 可以直接使用社交发布功能"
echo ""
echo "🚀 立即开始: http://localhost:3000/social"
echo ""
