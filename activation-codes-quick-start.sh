#!/bin/bash

# 激活码快速生成示例
# 这是一个完整的示例，展示如何使用激活码系统

echo "🎁 ClipFlow 激活码快速开始"
echo "=============================="
echo ""

# 检查是否已设置管理员
echo "📋 第一步：确认管理员账号"
echo "----------------------------"

# 需要先创建管理员账号
echo "请先访问以下地址创建管理员账号："
echo "http://localhost:3000/register"
echo ""
echo "注册信息："
echo "- 姓名: 管理员"
echo "- 邮箱: admin@example.com"
echo "- 密码: (设置一个强密码)"
echo ""
read -p "按回车继续（创建完管理员账号后）..."

# 更新脚本配置
echo ""
echo "📝 第二步：配置激活码脚本"
echo "----------------------------"
echo "请编辑 generate-codes.sh 文件："
echo ""
echo "1. 打开文件: vim generate-codes.sh 或 nano generate-codes.sh"
echo "2. 找到以下行："
echo "   ADMIN_EMAIL=\"admin@example.com\""
echo "   ADMIN_PASSWORD=\"admin123\""
echo "3. 修改为你的管理员邮箱和密码"
echo "4. 保存文件"
echo ""
read -p "按回车继续（配置完成后）..."

# 生成激活码
echo ""
echo "🎲 第三步：生成激活码"
echo "----------------------------"
echo ""
echo "选择激活码类型："
echo "1) 10个测试激活码（30天）"
echo "2) 50个朋友邀请码（365天）"
echo "3) 自定义数量和有效期"
echo ""
read -p "请选择 (1-3): " choice

case $choice in
    1)
        echo ""
        echo "生成 10 个测试激活码（30天）..."
        ./generate-codes.sh 10 "测试用户" 30
        ;;
    2)
        echo ""
        echo "生成 50 个朋友邀请码（365天）..."
        ./generate-codes.sh 50 "朋友邀请" 365
        ;;
    3)
        echo ""
        read -p "数量: " quantity
        read -p "备注: " note
        read -p "有效期(天): " duration
        echo ""
        echo "生成 $quantity 个激活码（$duration 天）..."
        ./generate-codes.sh $quantity "$note" $duration
        ;;
    *)
        echo "无效选择"
        exit 1
        ;;
esac

echo ""
echo "=============================="
echo "✅ 激活码生成完成！"
echo ""
echo "📱 下一步："
echo "1. 复制生成的激活码"
echo "2. 分享给朋友或用户"
echo "3. 他们注册时输入激活码即可使用"
echo ""
echo "🎯 使用说明："
echo "访问: http://localhost:3000/register"
echo "填写信息并输入激活码"
echo ""
echo "📚 更多信息请查看: ACTIVATION-CODE-GUIDE.md"
echo ""
