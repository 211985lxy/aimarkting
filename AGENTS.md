# Project Rules

## Repository Shape

- Root project: `ClipFlow`, an AI content production agent for IP positioning, topic ideation, script generation, video packaging, and quality checks.
- Main application: `clipflow/apps/web` (`@clipflow/web`), a Next.js 16 App Router app backed by Prisma 7 and MySQL/MariaDB.
- Upload automation: `social-auto-upload`, a Python CLI/uploader module. Treat its browser automation as a separate subsystem from the Next.js app unless an integration is explicitly requested.
- Root docs live in `README.md` and `docs/`. Deep product and architecture references live under `clipflow/docs/`.

## Commands

- Install app dependencies from `clipflow/`: `pnpm install`.
- Run the web app from `clipflow/`: `pnpm dev` or from the repo root: `make dev`.
- Build from `clipflow/`: `pnpm build` or from the repo root: `make build`.
- Lint from `clipflow/`: `pnpm lint` or from the repo root: `make lint`.
- Test the web app from the repo root: `make test`.
- Push Prisma schema from the repo root: `make db-push`.
- Seed database from `clipflow/apps/web`: `pnpm prisma db seed`.
- Run Obsidian sync CLI from `clipflow/`: `pnpm tsx scripts/obsidian-sync.ts`.
- Run Quality Gate tests from `clipflow/apps/web`: `npx vitest run __tests__/unit/quality-gate.test.ts`.

## Hard Rules

- No mock, fake, stub, fixture fallback, demo data fallback, or simulated provider in production code, preview flows, admin flows, or acceptance flows.
- UI work in `clipflow/apps/web` must use the existing shadcn/ui components in `src/components/ui`.
- Video creation has three distinct layers: Director (`VideoStructure`), Scriptwriter (`ContentTemplate`, IP profile, script generation), and Packaging (`VideoPackagingTemplate`, Shanjian payload, materials, BGM, subtitles). Keep UI, prompts, API contracts, task lineage, and analytics clear about which layer changed.
- Shanjian packaging templates are packaging-layer templates; do not model them as content structure templates or script templates.
- Do not commit secrets. `clipflow/apps/web/.env.example` is the reference for required environment variables.
