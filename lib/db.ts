import { PrismaClient } from "@prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL
  const databaseUrl =
    rawUrl && typeof rawUrl === "string"
      ? rawUrl
      : "mysql://astroforms:change_me@127.0.0.1:3306/astroforms"
  const connectionLimit = Number(process.env.DB_CONNECTION_LIMIT || "2")
  const acquireTimeout = Number(process.env.DB_ACQUIRE_TIMEOUT_MS || "15000")
  const connectTimeout = Number(process.env.DB_CONNECT_TIMEOUT_MS || "10000")

  const parsed = new URL(databaseUrl)
  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\/+/, ""),
    allowPublicKeyRetrieval: true,
    connectionLimit: Number.isFinite(connectionLimit) && connectionLimit > 0 ? connectionLimit : 2,
    acquireTimeout: Number.isFinite(acquireTimeout) && acquireTimeout > 0 ? acquireTimeout : 15000,
    connectTimeout: Number.isFinite(connectTimeout) && connectTimeout > 0 ? connectTimeout : 10000,
  })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

export default prisma
