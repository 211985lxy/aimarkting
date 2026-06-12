import Redis from "ioredis"

const globalForRedis = globalThis as unknown as { redis: Redis }

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 5,
    lazyConnect: true,
    connectTimeout: 5000,
    commandTimeout: 10000,
    retryStrategy(times) {
      return Math.min(times * 200, 3000)
    },
    reconnectOnError(err) {
      return err.message.includes("READONLY")
    },
  })

redis.on("error", () => {
  // Redis is an optional cache layer for most app flows. Callers fall back to
  // direct fetches, so avoid noisy unhandled error logs during builds/dev.
})

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis
