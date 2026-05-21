#!/bin/bash

# ClipFlow 社交发布 - 服务状态检查

echo "📊 ClipFlow 社交发布 - 服务状态"
echo "================================"
echo ""

# 1. 检查 Python 版本
echo "1️⃣ Python 环境:"
if [ -f ".venv/bin/python" ]; then
    PYTHON_VERSION=$(.venv/bin/python --version 2>&1)
    echo "   ✅ $PYTHON_VERSION"
else
    echo "   ❌ 虚拟环境不存在"
fi
echo ""

# 2. 检查 social-auto-upload
echo "2️⃣ social-auto-upload:"
if [ -f ".venv/bin/sau" ]; then
    SAU_STATUS=$(.venv/bin/sau --help 2>&1 | head -n 1)
    echo "   ✅ 已安装"
    echo "   $SAU_STATUS"
else
    echo "   ❌ 未安装"
fi
echo ""

# 3. 检查 Lightpanda
echo "3️⃣ Lightpanda 容器:"
if docker ps | grep -q "clipflow-lightpanda"; then
    CONTAINER_STATUS=$(docker ps --filter "name=clipflow-lightpanda" --format "{{.Status}}")
    echo "   ✅ 运行中"
    echo "   状态: $CONTAINER_STATUS"

    # 测试 CDP 端点
    CDP_RESPONSE=$(curl -s http://127.0.0.1:9223/json/version)
    if echo "$CDP_RESPONSE" | grep -q "webSocketDebuggerUrl"; then
        echo "   ✅ CDP 端点: ws://127.0.0.1:9223"
    else
        echo "   ⚠️  CDP 端点不可访问"
    fi
else
    echo "   ❌ 未运行"
    echo "   启动: docker compose up -d lightpanda"
fi
echo ""

# 4. 检查 ClipFlow 应用
echo "4️⃣ ClipFlow 应用:"
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "   ✅ 运行中"
    echo "   地址: http://localhost:3000"
    echo "   社交发布: http://localhost:3000/social"
else
    echo "   ⚠️  未运行"
    echo "   启动: cd clipflow && npm run dev"
fi
echo ""

# 5. 系统资源
echo "5️⃣ 系统资源:"
if docker ps | grep -q "clipflow-lightpanda"; then
    DOCKER_STATS=$(docker stats clipflow-lightpanda --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" | tail -n 1)
    echo "   Lightpanda: $DOCKER_STATS"
fi
echo ""

# 6. 快速操作指南
echo "🔧 快速操作:"
echo "   启动所有服务: ./start-all.sh"
echo "   查看日志: docker compose logs -f lightpanda"
echo "   停止服务: docker compose down"
echo "   重启服务: docker compose restart lightpanda"
echo ""

echo "================================"
