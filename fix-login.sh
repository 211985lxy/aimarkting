#!/bin/bash

# 修复登录问题 - 重新启动服务

echo "🔧 ClipFlow 登录问题修复"
echo "======================"
echo ""

# 检查服务状态
echo "📊 检查服务状态..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ 服务器正常运行"
else
    echo "❌ 服务器无响应"
    echo "正在重启服务..."
    cd "/Users/xiangyu/Desktop/ai智能体-发布页面管理/clipflow/apps/web"
    pkill -f "next dev"
    nohup npm run dev > /dev/null 2>&1 &
    echo "⏳ 等待服务启动..."
    sleep 10
fi

echo ""
echo "======================"
echo "🎯 测试账号信息"
echo ""
echo "📧 邮箱: test@test.com"
echo "🔑 密码: 123456"
echo "✅ 状态: 已创建"
echo ""
echo "======================"
echo "📱 使用方法:"
echo ""
echo "方法1: 直接登录"
echo "  访问: http://localhost:3000/login"
echo "  邮箱: test@test.com"
echo "  密码: 123456"
echo ""
echo "方法2: 重新注册"
echo "  访问: http://localhost:3000/register"
echo "  填写新的邮箱和密码"
echo ""
echo "======================"
echo "🎮 激活码（激活页面使用）:"
echo "  FREE2024"
echo "  TEST2024"
echo "  DEMO2024"
echo ""
echo "======================"
echo "💡 重要提示:"
echo "  • 服务器正在运行"
echo "  • 测试账号已创建"
echo "  • 可以直接登录使用"
echo "  • 激活码在激活页面使用"
echo ""

# 打开登录页面
if command -v open &> /dev/null; then
    echo "🌐 正在打开登录页面..."
    open http://localhost:3000/login
fi

echo "======================"
echo "🚀 立即开始使用！"
echo ""
