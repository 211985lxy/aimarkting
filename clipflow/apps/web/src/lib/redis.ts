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
      if (times > 10) return null
      return Math.min(times * 200, 3000)
    },
    reconnectOnError(err) {
      return err.message.includes("READONLY")
    },
  })

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis
