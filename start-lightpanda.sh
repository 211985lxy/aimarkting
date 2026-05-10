#!/bin/bash

# Lightpanda + ClipFlow 快速启动脚本

echo "🚀 ClipFlow 社交发布服务 - Lightpanda 集成"
echo "=========================================="
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误：未找到 Docker"
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# 检查 Docker Compose 是否可用
if ! docker compose version &> /dev/null; then
    echo "❌ 错误：未找到 Docker Compose"
    echo "请先安装 Docker Compose"
    exit 1
fi

echo "✅ Docker 环境检查通过"
echo ""

# 启动 Lightpanda 容器
echo "📦 启动 Lightpanda 无头浏览器..."
docker compose up -d lightpanda

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Lightpanda 启动成功！"
    echo ""
    echo "📋 服务信息："
    echo "   - CDP 端点: ws://127.0.0.1:9223"
    echo "   - 健康检查: curl http://127.0.0.1:9223/json/version"
    echo ""
    echo "🔧 下一步："
    echo "   1. 确保 social-auto-upload 已安装:"
    echo "      pip install social-auto-upload"
    echo ""
    echo "   2. 启动 ClipFlow 应用:"
    echo "      cd clipflow && npm run dev"
    echo ""
    echo "   3. 访问社交发布页面:"
    echo "      http://localhost:3000/social"
    echo ""
    echo "🛑 停止服务:"
    echo "   docker compose down"
    echo ""
else
    echo ""
    echo "❌ Lightpanda 启动失败"
    echo "请检查 Docker 日志: docker compose logs lightpanda"
    exit 1
fi
