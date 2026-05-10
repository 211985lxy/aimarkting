#!/bin/bash

# ClipFlow 社交发布 - 完整启动脚本

echo "🚀 ClipFlow 社交发布服务 - 完整启动"
echo "======================================"
echo ""

# 检查虚拟环境
if [ ! -d ".venv" ]; then
    echo "❌ 虚拟环境不存在"
    echo "请先运行安装脚本"
    exit 1
fi

# 激活虚拟环境
echo "📦 激活虚拟环境..."
source .venv/bin/activate
echo "✅ 虚拟环境已激活"
echo ""

# 检查 Lightpanda
echo "🔍 检查 Lightpanda 状态..."
if docker ps | grep -q "clipflow-lightpanda"; then
    echo "✅ Lightpanda 容器正在运行"
else
    echo "⚠️  Lightpanda 未运行，正在启动..."
    docker compose up -d lightpanda
    if [ $? -eq 0 ]; then
        echo "✅ Lightpanda 启动成功"
    else
        echo "❌ Lightpanda 启动失败"
        exit 1
    fi
fi
echo ""

# 检查 sau 命令
echo "🔧 检查 social-auto-upload..."
if command -v sau &> /dev/null; then
    echo "✅ social-auto-upload 可用"
else
    echo "❌ social-auto-upload 未安装"
    echo "请运行: pip install -e ./social-auto-upload"
    exit 1
fi
echo ""

# 设置环境变量
echo "🔐 设置环境变量..."
export LIGHTPANDA_CDP_ENDPOINT=ws://127.0.0.1:9223
export LIGHTPANDA_DISABLE_TELEMETRY=true
echo "✅ 环境变量已设置"
echo ""

# 启动 ClipFlow
echo "🌐 启动 ClipFlow 应用..."
if [ ! -d "clipflow" ]; then
    echo "❌ ClipFlow 目录不存在"
    exit 1
fi

cd clipflow

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
fi

echo "✅ 启动开发服务器..."
echo ""
echo "======================================"
echo "🎉 ClipFlow 社交发布服务已启动！"
echo ""
echo "📍 访问地址："
echo "   - 主应用: http://localhost:3000"
echo "   - 社交发布: http://localhost:3000/social"
echo ""
echo "🔧 服务信息："
echo "   - Lightpanda: ws://127.0.0.1:9223"
echo "   - CDP 健康检查: curl http://127.0.0.1:9223/json/version"
echo ""
echo "🛑 停止服务: Ctrl+C"
echo "======================================"
echo ""

# 启动 Next.js 开发服务器
npm run dev
