import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

export type FeatureKey = "bots" | "messages" | "automations"

export type FeatureFlags = Record<FeatureKey, boolean>

const FEATURE_KEYS: FeatureKey[] = ["bots", "messages", "automations"]

const DEFAULT_FLAGS: FeatureFlags = {
  bots: true,
  messages: true,
  automations: true,
}

let initPromise: Promise<void> | null = null
let flagsCache: { value: FeatureFlags; expiresAt: number } | null = null
const FLAGS_CACHE_TTL_MS = 30_000

async function ensureFeatureFlagsTable() {
  if (!initPromise) {
    initPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS feature_flags (
          \`key\` VARCHAR(64) PRIMARY KEY,
          enabled TINYINT(1) NOT NULL DEFAULT 1,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `)

      for (const key of FEATURE_KEYS) {
        await prisma.$executeRaw`
          INSERT INTO feature_flags (\`key\`, enabled)
          VALUES (${key}, 1)
          ON DUPLICATE KEY UPDATE \`key\` = VALUES(\`key\`)
        `
      }
    })().catch((error) => {
      initPromise = null
      throw error
    })
  }

  await initPromise
}

function normalizeEnabled(value: unknown): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1
  if (typeof value === "bigint") return value === BigInt(1)
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    return normalized === "1" || normalized === "true"
  }
  return false
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const now = Date.now()
  if (flagsCache && flagsCache.expiresAt > now) {
    return { ...flagsCache.value }
  }

  try {
    await ensureFeatureFlagsTable()

    const rows = await prisma.$queryRaw<Array<{ key: string; enabled: unknown }>>(
      Prisma.sql`SELECT \`key\`, enabled FROM feature_flags`,
    )

    const flags: FeatureFlags = { ...DEFAULT_FLAGS }
    for (const row of rows) {
      if ((FEATURE_KEYS as string[]).includes(row.key)) {
        flags[row.key as FeatureKey] = normalizeEnabled(row.enabled)
      }
    }

    flagsCache = {
      value: { ...flags },
      expiresAt: now + FLAGS_CACHE_TTL_MS,
    }
    return flags
  } catch {
    return { ...DEFAULT_FLAGS }
  }
}

export async function isFeatureEnabled(key: FeatureKey): Promise<boolean> {
  const flags = await getFeatureFlags()
  return flags[key]
}

export async function setFeatureFlag(key: FeatureKey, enabled: boolean): Promise<void> {
  await ensureFeatureFlagsTable()
  await prisma.$executeRaw`
    INSERT INTO feature_flags (\`key\`, enabled)
    VALUES (${key}, ${enabled ? 1 : 0})
    ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)
  `
  flagsCache = null
}
