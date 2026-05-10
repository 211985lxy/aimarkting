# Python 版本升级指南

social-auto-upload 需要 **Python 3.10 或更高版本**，但当前系统是 Python 3.9.6。

## 🔧 解决方案

### 选项 1：使用 Homebrew 安装 Python 3.11（推荐）

```bash
# 1. 安装 Python 3.11
brew install python@3.11

# 2. 创建新的虚拟环境
python3.11 -m venv .venv311

# 3. 激活虚拟环境
source .venv311/bin/activate

# 4. 安装 social-auto-upload
cd social-auto-upload
pip install -e .

# 5. 验证安装
sau --help
```

### 选项 2：使用 pyenv 管理 Python 版本

```bash
# 1. 安装 pyenv
brew install pyenv

# 2. 安装 Python 3.11
pyenv install 3.11.9

# 3. 在项目目录设置本地 Python 版本
cd /Users/xiangyu/Desktop/ai智能体-发布页面管理
pyenv local 3.11.9

# 4. 重新创建虚拟环境
python -m venv .venv

# 5. 激活虚拟环境
source .venv/bin/activate

# 6. 安装 social-auto-upload
cd social-auto-upload
pip install -e .
```

### 选项 3：使用在线 Python 环境（临时方案）

如果不想升级系统 Python，可以使用在线 Python 环境：

```bash
# 使用 Docker 运行 Python 3.11
docker run -it --rm -v "$(pwd):/app" -w /app/social-auto-upload python:3.11 bash

# 在容器内安装
pip install -e .
```

## ✅ 验证安装

安装完成后，运行以下命令验证：

```bash
# 检查 Python 版本
python --version

# 检查 sau 命令
sau --help

# 测试登录
sau douyin login --help
```

## 🚨 常见问题

### Q: 为什么要升级 Python？
A: social-auto-upload 使用了现代 Python 特性，需要 3.10+ 版本才能运行。

### Q: 升级会影响现有项目吗？
A: 不会。使用虚拟环境可以隔离不同项目的 Python 版本和依赖。

### Q: 如何在虚拟环境中切换 Python 版本？
A: 删除旧虚拟环境，用新版本 Python 重新创建即可。

```bash
# 删除旧环境
rm -rf .venv

# 用新版本创建
python3.11 -m venv .venv

# 激活
source .venv/bin/activate
```

## 📚 推荐流程

```bash
# 1. 安装 Python 3.11
brew install python@3.11

# 2. 创建虚拟环境
cd /Users/xiangyu/Desktop/ai智能体-发布页面管理
rm -rf .venv
python3.11 -m venv .venv

# 3. 激活环境
source .venv/bin/activate

# 4. 升级 pip
pip install --upgrade pip

# 5. 安装 social-auto-upload
cd social-auto-upload
pip install -e .

# 6. 测试
sau --help
```

完成后，你就可以继续使用 Lightpanda 集成了！
