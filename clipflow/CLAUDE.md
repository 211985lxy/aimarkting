# Project Rules

read Agents.md
read PROJECT.md

## UI Rules

- All UI-related work must invoke the `ui-ux-pro-max` skill first to keep the design language and visuals consistent.
- UI components must use `shadcn/ui` only. No alternative UI component libraries or custom component systems are allowed.

## Zero Mock Rule

- This project forbids any mock, fake, stub, fixture fallback, demo data fallback, or simulated provider in production code, preview flows, admin flows, and test acceptance flows.
- Claude must use real APIs, real databases, real storage, and real external services whenever the feature is claimed to work.
- Do not add mock services, hard-coded response payloads, local JSON fallbacks, or temporary fake data just to unblock UI work.
- Do not use mock-based tests as the primary proof of completion. Validation must use real integration paths, real API routes, real database state, and real end-to-end execution whenever available.
- If a real dependency is missing or broken, report the blocker and fix the environment or implementation. Do not hide the problem with mock behavior.
- Reintroducing mock behavior requires explicit user approval. Otherwise, the default rule is: remove mocks, replace them with real calls, and keep the system honest.

## Production Flow (Direction A)

- **One-Click Generation Core**: The system strictly follows "Direction A" architecture. `/aim` (AIM 一键生成) serves as the primary content production pipeline, unifying both topic selection and copywriting into a single unified step.
- **Route & UI Integrity**:
  - The independent, incomplete placeholder routes (`/topic-planning`, `/copywriting`) are excluded from navigation and dashboard flow to prevent routing chaos.
  - The Workstation (`/home`) must align with the 4-step streamlined production flow: Information Setup (`/ip-profile`) -> AIM One-Click Gen (`/aim`) -> Quality Gate (`/quality-check`) -> Workstation Overview (`/home`).
  - Do NOT re-expose `/topic-planning` or `/copywriting` in the sidebar or workstation progress indicator without explicit restructuring.

## Commands & Configs Quick Reference

- **Run All Regression Tests**: Run `make test` from repo root.
- **Obsidian Sync CLI**: Run `pnpm tsx scripts/obsidian-sync.ts` (append `--force` for full push) from project root.
- **Run Quality Gate Tests**: Run `npx vitest run __tests__/unit/quality-gate.test.ts` from `clipflow/apps/web`.
- **Environment Variables**:
  - `OBSIDIAN_SYNC_TOKEN`: Sync gate authorization secret. Do not compromise this in production.

## Architecture Documents Index

- **Second Brain & AI HOT Integration Guide**: [second-brain-and-aihot-integration.md](file:///Users/xiangyu/Desktop/明动aim智能体/clipflow/docs/second-brain-and-aihot-integration.md)
- **E2E Testing & Quality Guardrails**: [e2e-testing-best-practices.md](file:///Users/xiangyu/Desktop/明动aim智能体/clipflow/docs/e2e-testing-best-practices.md)


