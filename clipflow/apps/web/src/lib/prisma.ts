// BigInt → Number in JSON.stringify (Prisma BigInt fields)
// eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
;(BigInt.prototype as BigInt & { toJSON(): number }).toJSON = function () {
  return Number(this)
}

import { PrismaClient } from "@/generated/prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

type PrismaGlobal = {
  prisma?: PrismaClient
}

const globalForPrisma = globalThis as unknown as PrismaGlobal

function hasRequiredDelegates(client: PrismaClient): boolean {
  const prismaClient = client as PrismaClient & {
    publicAvatarPreviewCache?: { findUnique?: unknown }
    publicAvatarPreviewPreference?: { findUnique?: unknown }
    hotTopicFitCache?: { findUnique?: unknown; upsert?: unknown }
    contentTemplate?: { fields?: { expressionBlueprint?: unknown } }
    videoProductionPlan?: { fields?: { recommendationContext?: unknown } }
    pexelsMedia?: { fields?: { provider?: unknown } }
    pexelsQueryCache?: { fields?: { provider?: unknown } }
    clientProject?: { findMany?: unknown }
  }

  return (
    typeof prismaClient.publicAvatarPreviewCache?.findUnique === "function"
    && typeof prismaClient.publicAvatarPreviewPreference?.findUnique === "function"
    && typeof prismaClient.hotTopicFitCache?.findUnique === "function"
    && typeof prismaClient.hotTopicFitCache?.upsert === "function"
    && prismaClient.contentTemplate?.fields?.expressionBlueprint !== undefined
    && prismaClient.videoProductionPlan?.fields?.recommendationContext !== undefined
    && prismaClient.pexelsMedia?.fields?.provider !== undefined
    && prismaClient.pexelsQueryCache?.fields?.provider !== undefined
    && typeof prismaClient.clientProject?.findMany === "function"
  )
}

function createPrismaClient() {
  const url = new URL(
    (process.env.DATABASE_URL ?? "").replace(/^mysql:\/\//, "mariadb://")
  )
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: parseInt(url.port || "3306"),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    charset: "utf8mb4",
    connectionLimit: 20,
    idleTimeout: 30000,
    connectTimeout: 5000,
  })
  return new PrismaClient({ adapter })
}

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma && hasRequiredDelegates(globalForPrisma.prisma)) {
    return globalForPrisma.prisma
  }

  const nextClient = createPrismaClient()
  globalForPrisma.prisma = nextClient
  return nextClient
}

export const prisma = getPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
