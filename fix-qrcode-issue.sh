#!/bin/bash

# 抖音登录问题诊断和修复

echo "🔍 抖音登录问题诊断"
echo "======================"
echo ""

# 检查 Lightpanda 状态
echo "1️⃣  检查 Lightpanda 状态..."
if curl -s http://127.0.0.1:9223/json/version > /dev/null; then
    echo "✅ Lightpanda 正常运行"
else
    echo "❌ Lightpanda 未运行，正在重启..."
    cd "/Users/xiangyu/Desktop/ai智能体-发布页面管理"
    docker compose restart lightpanda
    sleep 5
fi

echo ""

# 测试 sau 命令
echo "2️⃣  测试 sau 命令..."
cd "/Users/xiangyu/Desktop/ai智能体-发布页面管理"
source .venv/bin/activate
export LIGHTPANDA_CDP_ENDPOINT=ws://127.0.0.1:9223

# 清理旧的二维码文件
rm -f social-auto-upload/cookies/douyin_web_test*qrcode*.png 2>/dev/null

echo "正在生成测试二维码..."
sau douyin login --account web_test &
SAU_PID=$!

echo "sau 进程 PID: $SAU_PID"
echo "等待二维码生成..."

# 等待二维码生成
for i in {1..15}; do
    sleep 1
    if [ -f "social-auto-upload/cookies/douyin_web_test_login_qrcode_"*.png ]; then
        echo "✅ 二维码生成成功！"
        break
    fi
    echo -n "."
done

echo ""

# 查找二维码文件
QR_FILE=$(ls -t social-auto-upload/cookies/douyin_web_test*qrcode*.png 2>/dev/null | head -1)

if [ -n "$QR_FILE" ]; then
    echo "📱 二维码文件: $QR_FILE"

    # 复制到可访问的位置
    PUBLIC_DIR="clipflow/apps/web/public"
    mkdir -p "$PUBLIC_DIR/qrcodes"
    cp "$QR_FILE" "$PUBLIC_DIR/qrcodes/douyin.png"

    echo "📋 复制到: $PUBLIC_DIR/qrcodes/douyin.png"
    echo ""

    # 打开二维码
    echo "正在打开二维码..."
    open "$QR_FILE"

    echo ""
    echo "======================"
    echo "✅ 问题解决方案："
    echo ""
    echo "🔗 方法1: 使用直接文件访问"
    echo "   访问: http://localhost:3000/qrcodes/douyin.png"
    echo ""
    echo "🔗 方法2: 继续使用终端"
    echo "   二维码已显示在终端中"
    echo "   用抖音APP扫码登录"
    echo ""
    echo "🔗 方法3: 查看图片文件"
    echo "   文件: $QR_FILE"
    echo ""
    echo "======================"
else
    echo "❌ 二维码生成失败"
    echo ""
    echo "🔧 手动生成二维码:"
    echo "   cd '/Users/xiangyu/Desktop/ai智能体-发布页面管理'"
    echo "   source .venv/bin/activate"
    echo "   export LIGHTPANDA_CDP_ENDPOINT=ws://127.0.0.1:9223"
    echo "   sau douyin login --account my_account"
fi

echo ""
echo "💡 建议: 如果 Web 界面二维码一直卡住，"
echo "   使用方法1或方法2更可靠！"
echo ""

# 停止后台 sau 进程
if ps -p $SAU_PID > /dev/null 2>&1; then
    echo "🛑 sau 进程仍在运行，将在30秒后自动结束"
    sleep 30
    kill $SAU_PID 2>/dev/null || true
fi
