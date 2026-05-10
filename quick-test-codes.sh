#!/bin/bash

# 直接激活码生成脚本（不依赖数据库）
# 用于本地测试

echo "🎁 临时测试激活码"
echo "================"
echo ""

# 生成多个简单激活码
ACTIVATION_CODES=(
    "TEST2024A"
    "TEST2024B"
    "TEST2024C"
    "DEMO1234"
    "BETA5678"
    "ALPHA999"
)

echo "📋 可用的测试激活码："
echo ""

for code in "${ACTIVATION_CODES[@]}"; do
    echo "$code"
done

echo ""
echo "================"
echo "📱 使用方法："
echo "1. 访问: http://localhost:3000/register"
echo "2. 填写注册信息"
echo "3. 输入任意激活码"
echo "4. 完成注册！"
echo ""
echo "🎯 激活码有效期: 30天"
echo "⚠️  注意: 这些是临时测试激活码"
echo ""
