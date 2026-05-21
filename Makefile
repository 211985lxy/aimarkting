# ClipFlow Makefile — 统一命令入口
# 使用: make <command>

.PHONY: help dev build start stop status deploy db-push db-migrate db-studio lint test

# 默认显示帮助
help:
	@echo "ClipFlow 命令列表:"
	@echo ""
	@echo "  开发:"
	@echo "    make dev          启动开发服务器"
	@echo "    make build        构建生产版本"
	@echo "    make lint         代码检查"
	@echo "    make test         运行测试"
	@echo ""
	@echo "  数据库:"
	@echo "    make db-push      推送 Schema 到数据库"
	@echo "    make db-migrate   运行数据库迁移"
	@echo "    make db-studio    打开 Prisma Studio"
	@echo ""
	@echo "  部署:"
	@echo "    make start        启动所有服务"
	@echo "    make stop         停止所有服务"
	@echo "    make status       查看服务状态"
	@echo "    make deploy       生产环境部署"

# --- 开发命令 ---
dev:
	cd clipflow && pnpm dev

build:
	cd clipflow && pnpm build

lint:
	cd clipflow && pnpm lint

test:
	cd clipflow && pnpm --filter @clipflow/web test

# --- 数据库命令 ---
db-push:
	cd clipflow/apps/web && npx prisma db push

db-migrate:
	cd clipflow/apps/web && npx prisma migrate dev

db-studio:
	cd clipflow/apps/web && npx prisma studio

# --- 服务管理 ---
start:
	bash scripts/start-all.sh

stop:
	docker-compose down

status:
	bash scripts/status.sh

deploy:
	bash scripts/deploy-production.sh
