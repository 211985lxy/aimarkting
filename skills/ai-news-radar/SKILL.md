---
name: ai-news-radar
description: Use when adding, evaluating, or operating AI/industry/customer information sources for AIM agents, including RSS, OPML, public feeds, newsletters, GitHub feeds, Feishu/WeChat/social sources, source health checks, and customer-specific news radar workflows.
---

# AI News Radar

Use this skill to decide which sources are worth tracking for a customer before building crawlers or changing the app.

## First Reads

- `README.md` for the local customer-source workflow and intake table.
- `references/source-intake.md` before evaluating any new source.
- In this repo, search existing AIM/hot-topic code before adding app code:
  - `mingyuan/apps/web/src/app/api/hot-topics/route.ts`
  - `mingyuan/apps/web/src/lib/aihot-client.ts`
  - `mingyuan/apps/web/src/lib/hot-decisions.ts`
  - `mingyuan/apps/web/src/lib/market-insights/`

## Default Workflow

1. Ask for or extract a source list with: customer, source name, URL/account, type, private/public, why it matters.
2. Classify each source as RSS/Atom, OPML, public JSON/feed, public webpage, newsletter archive, GitHub feed, Feishu/knowledge-base, WeChat/social, email bridge, or login-only.
3. Route sources with the lazy ladder:
   - RSS/Atom/OPML first.
   - Public generated JSON/feed next.
   - Focused static-page parsing only when the source is valuable and stable.
   - Private bridges only when the customer explicitly needs them.
   - Skip login-only, cookie-bound, noisy, or low-signal sources by default.
4. Produce a decision table before implementation: `accept_public`, `accept_private`, `watchlist`, `skip`, or `needs_user_secret`.
5. Only implement the smallest useful path after classification is clear.

## Safety Rules

- Do not commit API keys, cookies, tokens, `.env`, private OPML files, mailbox addresses, raw emails, private newsletter text, browser exports, or customer-private source lists.
- Do not put customer-private sources into public default config.
- Do not rely on account login, browser automation, or cookies for a default source.
- If a source needs secrets, make it skip cleanly when secrets are missing.
- Keep raw customer data separate by customer; do not mix one customer's source list into another customer's radar.

## Output Shape

For source intake, answer with:

| 客户 | 信源 | 类型判断 | 接入方式 | 决策 | 原因 | 风险/条件 |
|---|---|---|---|---|---|---|

Then list the next runnable check, such as:

```bash
curl -I <feed-or-page-url>
```

For implementation, prefer one small fetcher/check over a new subsystem. Add database/UI only after at least one real customer source list proves the need.
