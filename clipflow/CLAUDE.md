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
