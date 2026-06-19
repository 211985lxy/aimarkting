FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat ffmpeg
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="mysql://build:build@localhost:3306/build"
ENV REDIS_URL="redis://localhost:6379"

COPY --from=deps /app/ ./
COPY . .

RUN pnpm --dir apps/web exec prisma generate
RUN pnpm --filter @mingyuan/web build

FROM base AS web-runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/messages ./apps/web/messages

EXPOSE 3000

CMD ["node", "apps/web/server.js"]

FROM base AS worker-runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web ./apps/web
COPY --from=builder /app/packages/shared ./packages/shared

CMD ["pnpm", "--dir", "apps/web", "worker:task-recovery"]
