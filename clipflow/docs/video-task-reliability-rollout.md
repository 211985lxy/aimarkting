# Video Task Reliability Rollout

## Scope

This rollout hardens the existing video-generation backend without redesigning the current console pages.

Included:

- local task reservation before upstream submission
- `pending` + `processing` active-task concurrency accounting
- shared terminal settlement for webhook and recovery
- explicit `deliveryStatus`, `deliveryWarning`, and `deliveryExpiresAt`
- unified upstream-readable URL resolution for task inputs
- streaming-safe result archival and degraded-delivery persistence
- one-off backfill worker for historical completed tasks

Not included:

- create-page gating UX changes
- detail/list degraded-delivery UI redesign
- script quality-score product changes

## Deployment Order

1. Apply the additive schema change for `VideoTask.deliveryStatus`, `deliveryWarning`, and `deliveryExpiresAt`.
2. Deploy the API changes for:
   - `POST /api/tasks`
   - `GET /api/tasks/[id]`
   - `POST /api/webhook/shanjian`
   - task recovery worker
   - avatar / voice upstream-readable URL normalization
3. Restart the task-recovery worker after the new code is live.
4. Verify new task submissions on a low-traffic environment or a single canary instance first.
5. Run the historical delivery backfill worker in batches.

## Recommended Runtime Controls

This change ships without a hard feature flag because the schema is additive and the API contract is backward-compatible.

Recommended operational controls:

- canary deploy the task API first
- keep the recovery worker rollout separate from the API rollout
- run the backfill worker with a small `VIDEO_TASK_DELIVERY_BACKFILL_LIMIT` first, e.g. `10`

## Verification Checklist

### Submission path

- create a new task and confirm the database shows:
  - `status = pending` before upstream acceptance
  - `status = processing` after upstream acceptance
  - production plan `status = confirmed` during reservation
  - production plan `status = used` after acceptance

### Failure compensation

- simulate upstream submission failure and confirm:
  - task ends as `failed`
  - production plan returns from `confirmed` to `draft`
  - duplicate retries do not double-transition the task

### Terminal settlement

- webhook success should mark the task `completed`
- webhook failure should mark the task `failed`
- recovery polling should produce the same terminal result as webhook
- `GET /api/tasks/[id]` should no longer query upstream or mutate task state

### Delivery durability

- durable archival should set:
  - `deliveryStatus = durable`
  - `deliveryWarning = null`
  - `deliveryExpiresAt = null`
- degraded archival should set:
  - `deliveryStatus = degraded`
  - a non-null `deliveryWarning`
  - `deliveryExpiresAt` when expiry is knowable

### API compatibility

- `GET /api/tasks` still returns existing fields used by current pages
- `GET /api/tasks/[id]` still returns existing fields used by current pages
- new delivery fields are present but additive

## Backfill

Use:

```bash
npm run worker:backfill-video-delivery
```

Optional batch size:

```bash
VIDEO_TASK_DELIVERY_BACKFILL_LIMIT=10 npm run worker:backfill-video-delivery
```

The backfill scans completed tasks whose delivery state is still `pending` or `degraded`, attempts durable re-archival, and updates delivery metadata in place.

## Rollback

1. Stop the backfill worker if it is running.
2. Roll back the API and worker code to the previous deployment.
3. Keep the new `VideoTask` columns in place; they are additive and do not block old code.
4. If task submission anomalies appear during rollback, temporarily disable new task creation at the ingress layer instead of deleting data.

## Post-Rollout Monitoring

- task creation 5xx rate on `POST /api/tasks`
- ratio of `pending` tasks older than 2 minutes
- ratio of `degraded` completed tasks
- recovery worker pass failures
- webhook dedup hit rate and terminal-settlement error logs
