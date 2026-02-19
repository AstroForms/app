import { PrismaClient } from "@prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL
  const databaseUrl =
    rawUrl && typeof rawUrl === "string"
      ? rawUrl
      : "mysql://astroforms:change_me@127.0.0.1:3306/astroforms"
  const parsed = new URL(databaseUrl)
  const configuredLimit = Number(process.env.DB_CONNECTION_LIMIT)
  const connectionLimit =
    Number.isFinite(configuredLimit) && configuredLimit > 0
      ? configuredLimit
      : process.env.NODE_ENV === "production"
        ? 5
        : 1

  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: safeDecode(parsed.username),
    password: safeDecode(parsed.password),
    database: parsed.pathname.replace(/^\/+/, ""),
    allowPublicKeyRetrieval: true,
    connectionLimit,
    acquireTimeout: 15000,
    connectTimeout: 10000,
  })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

export default prisma
