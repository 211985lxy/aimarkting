#!/bin/bash

# 抖音登录快速解决方案

echo "🎯 抖音登录 - 快速解决方案"
echo "=========================="
echo ""

echo "📱 方法1: 使用现有的二维码（最快）"
echo ""
echo "1. 打开最新的二维码文件:"
echo "   open '/Users/xiangyu/Desktop/ai智能体-发布页面管理/social-auto-upload/cookies/douyin_web_test_login_qrcode_20260408_193840.png'"
echo ""
echo "2. 用抖音APP扫描二维码"
echo "3. 登录成功！"
echo ""

echo "📱 方法2: 在终端直接登录（推荐）"
echo ""
echo "运行以下命令:"
echo "  cd '/Users/xiangyu/Desktop/ai智能体-发布页面管理'"
echo "  source .venv/bin/activate"
echo "  export LIGHTPANDA_CDP_ENDPOINT=ws://127.0.0.1:9223"
echo "  sau douyin login --account my_account"
echo ""
echo "然后:"
echo "- 二维码会直接显示在终端"
echo "- 用抖音APP扫描终端中的二维码"
echo "- 登录成功！"
echo ""

echo "📱 方法3: 使用Web界面（修复后可用）"
echo ""
echo "访问: http://localhost:3000/social"
echo "- 选择平台: 抖音"
echo "- 账号名称: web_test"
echo "- 点击: 登录账号"
echo "- 等待二维码显示（需要8-10秒）"
echo "- 扫码登录"
echo ""

echo "=========================="
echo "💡 推荐使用方法1或方法2"
echo "   最快最稳定！"
echo ""

# 自动打开最新的二维码
LATEST_QR=$(ls -t "/Users/xiangyu/Desktop/ai智能体-发布页面管理/social-auto-upload/cookies" | grep "douyin.*qrcode" | head -1)
if [ -n "$LATEST_QR" ]; then
    echo "🔍 正在打开最新的二维码..."
    open "/Users/xiangyu/Desktop/ai智能体-发布页面管理/social-auto-upload/cookies/$LATEST_QR"
    echo "✅ 已打开: $LATEST_QR"
else
    echo "❌ 没有找到二维码文件"
    echo ""
    echo "请运行以下命令生成新二维码:"
    echo "  cd '/Users/xiangyu/Desktop/ai智能体-发布页面管理'"
    echo "  source .venv/bin/activate"
    echo "  sau douyin login --account my_account"
fi

echo ""
echo "=========================="
