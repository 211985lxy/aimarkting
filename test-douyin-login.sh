#!/bin/bash

# 抖音账号登录测试脚本

echo "🔍 抖音账号登录问题诊断"
echo "========================"
echo ""

# 1. 检查 Lightpanda 状态
echo "1️⃣  检查 Lightpanda 状态..."
if docker ps | grep -q "clipflow-lightpanda"; then
    echo "✅ Lightpanda 容器运行中"
    CDP_TEST=$(curl -s http://127.0.0.1:9223/json/version)
    if echo "$CDP_TEST" | grep -q "webSocketDebuggerUrl"; then
        echo "✅ CDP 端点可访问"
    else
        echo "❌ CDP 端点不可访问"
        echo "   重启 Lightpanda..."
        docker restart clipflow-lightpanda
        sleep 5
    fi
else
    echo "❌ Lightpanda 未运行"
    echo "   启动 Lightpanda..."
    cd "/Users/xiangyu/Desktop/ai智能体-发布页面管理"
    docker compose up -d lightpanda
    sleep 5
fi

echo ""

# 2. 检查 sau 命令
echo "2️⃣  检查 social-auto-upload..."
if [ -f ".venv/bin/sau" ]; then
    echo "✅ sau 命令可用"
else
    echo "❌ sau 命令不可用"
    exit 1
fi

echo ""

# 3. 测试抖音登录（带界面模式）
echo "3️⃣  测试抖音登录..."
echo "   启动带界面的浏览器（方便扫码）..."
echo ""

cd "/Users/xiangyu/Desktop/ai智能体-发布页面管理"
source .venv/bin/activate
export LIGHTPANDA_CDP_ENDPOINT=ws://127.0.0.1:9223

# 使用 headed 模式启动浏览器
echo "📱 正在启动抖音登录..."
echo "   如果浏览器窗口没有打开，请检查："
echo "   1. Lightpanda 是否正常运行"
echo "   2. CDP 端点是否正确配置"
echo ""

# 尝试执行登录命令
sau douyin login --account test_user --headed &
SAU_PID=$!

echo "📋 sau 进程 PID: $SAU_PID"
echo ""
echo "========================"
echo "💡 使用说明:"
echo ""
echo "🔍 如果看到浏览器窗口："
echo "   1. 等待二维码显示"
echo "   2. 用抖音APP扫码登录"
echo "   3. 登录成功后可以关闭"
echo ""
echo "📱 如果没有浏览器窗口："
echo "   方案1: 检查项目根目录下是否生成了 qrcode.png"
echo "   方案2: 使用 Lightpanda 模式（无头浏览器）"
echo ""
echo "🛑 停止测试: Ctrl+C 或 kill $SAU_PID"
echo ""
echo "========================"

# 等待一段时间让用户观察
sleep 10

# 检查进程是否还在运行
if ps -p $SAU_PID > /dev/null 2>&1; then
    echo ""
    echo "⏳ sau 进程仍在运行..."
    echo "   如果浏览器已打开，请扫码登录"
    echo "   如果没有浏览器，请查看下方解决方案"
else
    echo ""
    echo "⚠️  sau 进程已结束"
    echo "   可能遇到了问题，请查看解决方案"
fi

echo ""
echo "========================"
echo "🔧 常见问题解决:"
echo ""
echo "❓ 问题1: 浏览器没有打开"
echo "   解决: 使用 --debug 模式查看详细日志"
echo ""
echo "❓ 问题2: 二维码不显示"
echo "   解决: 检查项目目录下的 qrcode.png 文件"
echo ""
echo "❓ 问题3: CDP 连接失败"
echo "   解决: 重启 Lightpanda: docker restart clipflow-lightpanda"
echo ""
echo "❓ 问题4: sau 命令失败"
echo "   解决: 重新安装: pip install -e ./social-auto-upload"
echo ""
