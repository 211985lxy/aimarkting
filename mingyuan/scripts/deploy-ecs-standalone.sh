#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/mingyuan_aliyun_deploy}"
SSH_USER="${SSH_USER:-root}"
SSH_HOST="${SSH_HOST:-120.25.106.146}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/mingyuan/current}"
SERVICE_NAME="${SERVICE_NAME:-mingyuan-web}"
HEALTH_URL="${HEALTH_URL:-https://mingyuan-ai.cn/api/healthz}"

SSH=(ssh -i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$SSH_USER@$SSH_HOST")
RSYNC=(rsync -az --delete -e "ssh -i $SSH_KEY -o BatchMode=yes -o StrictHostKeyChecking=accept-new")

cd "$ROOT_DIR"

CI=true corepack pnpm --dir apps/web exec prisma generate
CI=true corepack pnpm --filter @mingyuan/web build

"${SSH[@]}" "mkdir -p '$REMOTE_DIR/apps/web/.next/static' '$REMOTE_DIR/apps/web/public' '$REMOTE_DIR/apps/web/messages'"

"${RSYNC[@]}" apps/web/.next/standalone/ "$SSH_USER@$SSH_HOST:$REMOTE_DIR/"
"${RSYNC[@]}" apps/web/.next/static/ "$SSH_USER@$SSH_HOST:$REMOTE_DIR/apps/web/.next/static/"
"${RSYNC[@]}" apps/web/public/ "$SSH_USER@$SSH_HOST:$REMOTE_DIR/apps/web/public/"
"${RSYNC[@]}" apps/web/messages/ "$SSH_USER@$SSH_HOST:$REMOTE_DIR/apps/web/messages/"

"${SSH[@]}" "if ! systemctl cat '$SERVICE_NAME' | grep -q 'ExecStart=/usr/bin/node server.js'; then sed -i 's#^ExecStart=.*#ExecStart=/usr/bin/node server.js#' /etc/systemd/system/'$SERVICE_NAME'.service && systemctl daemon-reload; fi"
"${SSH[@]}" "systemctl restart '$SERVICE_NAME' && systemctl is-active '$SERVICE_NAME'"
curl -fsS "$HEALTH_URL" >/dev/null
echo "deployed: $HEALTH_URL"
