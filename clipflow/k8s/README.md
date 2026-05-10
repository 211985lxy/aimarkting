# K8s Deployment

This directory contains the minimum production manifests to run ClipFlow on Kubernetes with minute-level task recovery.

## Workloads

- `clipflow-web.yaml`
  - `Deployment/clipflow-web`
  - `Service/clipflow-web`
  - `Ingress/clipflow-web`
- `clipflow-worker.yaml`
  - `Deployment/clipflow-worker`
  - Runs the task recovery loop as a dedicated worker process
- `clipflow-recovery-cronjob.yaml`
  - `CronJob/clipflow-task-recovery`
  - Calls `GET /api/cron/poll-tasks` every minute inside the cluster as the final safety net

## Required config

Create these before applying the manifests:

- `ConfigMap/clipflow-web-config`
  - non-secret runtime env such as `NEXT_PUBLIC_APP_URL`, `SHANJIAN_WEBHOOK_URL`
- `Secret/clipflow-web-secrets`
  - `DATABASE_URL`
  - `CRON_SECRET`
  - `JWT_SECRET`
  - `ADMIN_JWT_SECRET`
  - `SHANJIAN_APP_KEY`
  - `OSS_REGION`
  - `OSS_ACCESS_KEY_ID`
  - `OSS_ACCESS_KEY_SECRET`
  - `OSS_BUCKET`
  - `REDIS_URL` if used in your cluster

## Image build

Build from the repository root:

```bash
docker build --target web-runner -f apps/web/Dockerfile -t ghcr.io/your-org/clipflow-web:latest .
docker build --target worker-runner -f apps/web/Dockerfile -t ghcr.io/your-org/clipflow-worker:latest .
```

## Apply order

```bash
kubectl apply -f k8s/clipflow-web.yaml
kubectl apply -f k8s/clipflow-worker.yaml
kubectl apply -f k8s/clipflow-recovery-cronjob.yaml
```

## Notes

- Update the ingress host in `clipflow-web.yaml`
- Keep `CRON_SECRET` identical between the web app and the CronJob
- The worker is the primary active compensator after webhook callbacks
- The CronJob is the last safety net; if the worker is unhealthy or misses a pass, recovery still runs every minute through HTTP
- Both the worker and the CronJob share the same Redis lock semantics, so overlapping runs will no-op safely
