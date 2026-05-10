#!/bin/bash

# Lightpanda 集成测试脚本

echo "🧪 测试 Lightpanda 集成"
echo "======================"
echo ""

# 测试 1: 检查 Docker 容器
echo "📦 测试 1: 检查 Lightpanda 容器状态..."
if docker ps | grep -q "clipflow-lightpanda"; then
    echo "✅ Lightpanda 容器正在运行"
else
    echo "❌ Lightpanda 容器未运行"
    echo "请先运行: ./start-lightpanda.sh"
    exit 1
fi
echo ""

# 测试 2: 检查 CDP 端点
echo "🔌 测试 2: 检查 CDP 端点..."
CDP_RESPONSE=$(curl -s http://127.0.0.1:9223/json/version)
if echo "$CDP_RESPONSE" | grep -q "webSocketDebuggerUrl"; then
    echo "✅ CDP 端点可访问"
    echo "   响应: $CDP_RESPONSE"
else
    echo "❌ CDP 端点不可访问"
    exit 1
fi
echo ""

# 测试 3: 检查 social-auto-upload
echo "🔧 测试 3: 检查 social-auto-upload..."
if [ -f ".venv/bin/sau" ]; then
    source .venv/bin/activate
    SAU_VERSION=$(sau --version 2>&1 || sau --help 2>&1 | head -n 1)
    echo "✅ social-auto-upload 已安装"
    echo "   版本: $SAU_VERSION"
elif command -v sau &> /dev/null; then
    SAU_VERSION=$(sau --version 2>&1 || sau --help 2>&1 | head -n 1)
    echo "✅ social-auto-upload 已安装"
    echo "   版本: $SAU_VERSION"
else
    echo "❌ social-auto-upload 未安装"
    echo "请运行: pip install social-auto-upload"
    exit 1
fi
echo ""

# 测试 4: 检查环境变量
echo "🔐 测试 4: 检查环境变量..."
if [ -n "$LIGHTPANDA_CDP_ENDPOINT" ]; then
    echo "✅ LIGHTPANDA_CDP_ENDPOINT 已设置: $LIGHTPANDA_CDP_ENDPOINT"
else
    echo "⚠️  LIGHTPANDA_CDP_ENDPOINT 未设置（将使用默认值）"
fi
echo ""

# 测试 5: 测试 API 端点（需要 ClipFlow 运行）
echo "🌐 测试 5: 测试 ClipFlow API..."
API_RESPONSE=$(curl -s http://localhost:3000/api/social/upload 2>&1)
if echo "$API_RESPONSE" | grep -q "platforms"; then
    echo "✅ API 端点可访问"
else
    echo "⚠️  ClipFlow API 未启动或不可访问"
    echo "   请启动 ClipFlow: cd clipflow && npm run dev"
fi
echo ""

# 测试总结
echo "======================"
echo "✅ 基础测试通过！"
echo ""
echo "📋 下一步："
echo "   1. 启动 ClipFlow: cd clipflow && npm run dev"
echo "   2. 访问: http://localhost:3000/social"
echo "   3. 测试登录和上传功能"
echo ""
