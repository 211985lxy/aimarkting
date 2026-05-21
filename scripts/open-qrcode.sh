#!/bin/bash

# 打开最新抖音二维码
echo "📱 正在打开抖音登录二维码..."

LATEST_QR=$(ls -t "/Users/xiangyu/Desktop/ai智能体-发布页面管理/social-auto-upload/cookies" | grep "douyin.*qrcode" | head -1)

if [ -n "$LATEST_QR" ]; then
    open "/Users/xiangyu/Desktop/ai智能体-发布页面管理/social-auto-upload/cookies/$LATEST_QR"
    echo "✅ 二维码已打开: $LATEST_QR"
    echo ""
    echo "📱 请用抖音APP扫描二维码登录"
else
    echo "❌ 没有找到二维码，正在生成..."
    cd "/Users/xiangyu/Desktop/ai智能体-发布页面管理"
    source .venv/bin/activate
    export LIGHTPANDA_CDP_ENDPOINT=ws://127.0.0.1:9223
    sau douyin login --account quick_login
fi
