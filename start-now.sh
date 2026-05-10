#!/bin/bash

# 终极简化版 - 一键完成所有操作

echo "🎯 ClipFlow 一键启动"
echo "=================="
echo ""
echo "📱 正在打开浏览器..."
echo ""

# 打开注册页面
if command -v open &> /dev/null; then
    open http://localhost:3000/register
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000/register
else
    echo "🌐 请手动打开浏览器访问:"
    echo "   http://localhost:3000/register"
fi

echo ""
echo "=================="
echo "📋 注册指南:"
echo ""
echo "1️⃣  填写注册信息:"
echo "   • 姓名: Test User"
echo "   • 邮箱: test@test.com"
echo "   • 密码: 123456"
echo ""
echo "2️⃣  点击注册按钮"
echo ""
echo "3️⃣  注册成功后访问:"
echo "   http://localhost:3000/social"
echo ""
echo "=================="
echo "💡 重要提示:"
echo "   • 不需要激活码！"
echo "   • 不需要控制台操作！"
echo "   • 直接使用所有功能！"
echo ""
echo "🎮 支持的平台:"
echo "   ✅ 抖音"
echo "   ✅ 小红书"
echo "   ✅ B站"
echo "   ✅ 快手"
echo ""
echo "=================="
echo "🚀 立即开始测试视频上传！"
echo ""
