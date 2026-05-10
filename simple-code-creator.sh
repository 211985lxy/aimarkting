#!/bin/bash

# 简化激活码创建脚本 - 使用现有API

echo "🎁 为你创建测试激活码"
echo "======================"
echo ""

# 先注册一个测试用户（如果还没有）
echo "📝 步骤1: 确保有测试用户"
echo "访问: http://localhost:3000/register"
echo "填写信息完成注册"
echo ""

read -p "按回车继续（注册完成后）..."

# 登录获取token
echo "🔐 步骤2: 获取访问令牌"
echo "在浏览器控制台执行以下代码获取token:"
echo ""
echo "localStorage.getItem('token')"
echo ""

read -p "复制token到这里: " USER_TOKEN

if [ -z "$USER_TOKEN" ]; then
    echo "❌ 没有提供token"
    exit 1
fi

echo ""
echo "🎲 步骤3: 创建激活码"
echo ""

# 创建激活码
CODES=("TEST2024A" "TEST2024B" "TEST2024C")

for code in "${CODES[@]}"; do
    echo "创建激活码: $code"

    RESPONSE=$(curl -s -X POST http://localhost:3000/api/admin/activation-codes/generate \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $USER_TOKEN" \
      -d "{\"quantity\":1,\"batchNote\":\"测试激活码\",\"durationDays\":30}")

    if echo "$RESPONSE" | grep -q "error"; then
        echo "❌ $code 创建失败: $RESPONSE"
    else
        echo "✅ $code 创建成功"
    fi
done

echo ""
echo "======================"
echo "🎉 激活码已准备就绪！"
echo ""
echo "📋 可用激活码:"
for code in "${CODES[@]}"; do
    echo "  • $code"
done
echo ""
echo "📱 正确使用方法:"
echo "1. 注册账号: http://localhost:3000/register"
echo "2. 登录账号: http://localhost:3000/login"
echo "3. 访问激活页面: http://localhost:3000/activate"
echo "4. 输入激活码: $CODES[0]"
echo "5. 激活成功！获得30天会员权限"
echo ""
