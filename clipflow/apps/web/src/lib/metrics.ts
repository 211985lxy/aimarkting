import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from "prom-client"

export const metricsRegistry = new Registry()

metricsRegistry.setDefaultLabels({ service: "clipflow-web" })
collectDefaultMetrics({ register: metricsRegistry })

// ─── HTTP Request Metrics ───────────────────────────────

export const httpRequestsTotal = new Counter({
  name: "clipflow_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "path", "status"] as const,
  registers: [metricsRegistry],
})

export const httpRequestDuration = new Histogram({
  name: "clipflow_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "path", "status"] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [metricsRegistry],
})

// ─── Business Metrics ───────────────────────────────────

export const videoTasksTotal = new Counter({
  name: "clipflow_video_tasks_total",
  help: "Total video tasks created",
  labelNames: ["type", "status"] as const,
  registers: [metricsRegistry],
})

export const videoTaskDuration = new Histogram({
  name: "clipflow_video_task_duration_seconds",
  help: "Video task creation API duration in seconds",
  labelNames: ["type"] as const,
  buckets: [1, 5, 10, 30, 60, 120],
  registers: [metricsRegistry],
})

export const activeVideoTasks = new Gauge({
  name: "clipflow_active_video_tasks",
  help: "Number of video tasks currently in progress",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
})

// ─── External API Metrics ───────────────────────────────

export const externalApiRequestsTotal = new Counter({
  name: "clipflow_external_api_requests_total",
  help: "Total external API requests (Shanjian, LLM, Pexels, etc)",
  labelNames: ["service", "endpoint", "status"] as const,
  registers: [metricsRegistry],
})

export const externalApiDuration = new Histogram({
  name: "clipflow_external_api_duration_seconds",
  help: "External API request duration in seconds",
  labelNames: ["service", "endpoint"] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [metricsRegistry],
})

// ─── Task Recovery Metrics ──────────────────────────────

export const taskRecoveryTotal = new Counter({
  name: "clipflow_task_recovery_total",
  help: "Total task recovery passes",
  labelNames: ["trigger", "type"] as const,
  registers: [metricsRegistry],
})

export const taskRecoveryErrors = new Counter({
  name: "clipflow_task_recovery_errors_total",
  help: "Total task recovery errors",
  labelNames: ["trigger", "type"] as const,
  registers: [metricsRegistry],
})

// ─── Webhook Metrics ────────────────────────────────────

export const webhookTotal = new Counter({
  name: "clipflow_webhook_total",
  help: "Total webhook callbacks received",
  labelNames: ["type", "status"] as const,
  registers: [metricsRegistry],
})

// ─── Database & Redis Health ────────────────────────────

export const dbConnectionPoolActive = new Gauge({
  name: "clipflow_db_connection_pool_active",
  help: "Active database connections",
  registers: [metricsRegistry],
})

export const redisConnectionStatus = new Gauge({
  name: "clipflow_redis_connection_status",
  help: "Redis connection status (1=connected, 0=disconnected)",
  registers: [metricsRegistry],
})
