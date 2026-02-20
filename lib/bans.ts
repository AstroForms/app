import { prisma } from "@/lib/db"

let bansSchemaInitPromise: Promise<void> | null = null
const BAN_STATUS_TTL_MS = 20_000
const banStatusCache = new Map<string, { banned: boolean; expiresAt: number }>()

async function ensureBanColumn(columnDefinition: string) {
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`bans\`
      ADD COLUMN ${columnDefinition}
    `)
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ""
    const alreadyExists =
      message.includes("duplicate column") ||
      message.includes("already exists") ||
      message.includes("duplicate")
    if (!alreadyExists) throw error
  }
}

export async function ensureBansTable() {
  if (!bansSchemaInitPromise) {
    bansSchemaInitPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`bans\` (
          \`id\` VARCHAR(191) PRIMARY KEY,
          \`user_id\` VARCHAR(191) NOT NULL,
          \`banned_by\` VARCHAR(191) NOT NULL,
          \`reason\` TEXT NULL,
          \`is_global\` TINYINT(1) NOT NULL DEFAULT 1,
          \`banned_until\` DATETIME NULL,
          \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Backfill/repair for older table variants.
      await ensureBanColumn("`banned_by` VARCHAR(191) NOT NULL DEFAULT ''")
      await ensureBanColumn("`reason` TEXT NULL")
      await ensureBanColumn("`is_global` TINYINT(1) NOT NULL DEFAULT 1")
      await ensureBanColumn("`banned_until` DATETIME NULL")
      await ensureBanColumn("`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")

      try {
        await prisma.$executeRawUnsafe(`
          CREATE INDEX \`idx_bans_user_id\`
          ON \`bans\` (\`user_id\`)
        `)
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : ""
        const alreadyExists =
          message.includes("duplicate key name") ||
          message.includes("already exists")
        if (!alreadyExists) throw error
      }
    })().catch((error) => {
      bansSchemaInitPromise = null
      throw error
    })
  }

  await bansSchemaInitPromise
}

export function setUserBanCache(userId: string, banned: boolean) {
  if (!userId) return
  banStatusCache.set(userId, { banned, expiresAt: Date.now() + BAN_STATUS_TTL_MS })
}

export function clearUserBanCache(userId: string) {
  if (!userId) return
  banStatusCache.delete(userId)
}

export async function isUserCurrentlyBanned(userId: string) {
  if (!userId) return false

  const cached = banStatusCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.banned
  }

  try {
    await ensureBansTable()

    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT \`id\`
      FROM \`bans\`
      WHERE \`user_id\` = ${userId}
        AND (\`banned_until\` IS NULL OR \`banned_until\` > NOW())
      LIMIT 1
    `

    const banned = rows.length > 0
    setUserBanCache(userId, banned)
    return banned
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ""
    const isMissingTable =
      message.includes("no such table") ||
      message.includes("doesn't exist") ||
      message.includes("does not exist")
    const isPermissionIssue =
      message.includes("access denied") ||
      message.includes("permission denied")

    if (isMissingTable || isPermissionIssue) {
      setUserBanCache(userId, false)
      return false
    }

    throw error
  }
}

export async function listRecentBans(limit = 50) {
  try {
    await ensureBansTable()
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500)

    const rows = await prisma.$queryRaw<
      Array<{
        id: string
        user_id: string
        reason: string | null
        is_global: number | boolean
        banned_until: Date | string | null
        created_at: Date | string
        username: string | null
      }>
    >`
      SELECT
        b.\`id\`,
        b.\`user_id\`,
        b.\`reason\`,
        b.\`is_global\`,
        b.\`banned_until\`,
        b.\`created_at\`,
        p.\`username\`
      FROM \`bans\` b
      LEFT JOIN \`profiles\` p ON p.\`id\` = b.\`user_id\`
      ORDER BY b.\`created_at\` DESC
      LIMIT ${safeLimit}
    `

    return rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      reason: row.reason,
      is_global: Boolean(row.is_global),
      banned_until:
        row.banned_until instanceof Date
          ? row.banned_until.toISOString()
          : row.banned_until
            ? String(row.banned_until)
            : null,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      profiles: { username: row.username || "unknown" },
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ""
    const isRecoverable =
      message.includes("access denied") ||
      message.includes("permission denied") ||
      message.includes("denied to user") ||
      message.includes("command denied") ||
      message.includes("doesn't exist") ||
      message.includes("does not exist") ||
      message.includes("no such table") ||
      message.includes("unknown column")

    if (isRecoverable) return []
    throw error
  }
}

export async function listActiveBans(limit = 50) {
  try {
    await ensureBansTable()
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500)

    const rows = await prisma.$queryRaw<
      Array<{
        id: string
        user_id: string
        reason: string | null
        is_global: number | boolean
        banned_until: Date | string | null
        created_at: Date | string
      }>
    >`
      SELECT
        b.\`id\`,
        b.\`user_id\`,
        b.\`reason\`,
        b.\`is_global\`,
        b.\`banned_until\`,
        b.\`created_at\`
      FROM \`bans\` b
      WHERE b.\`banned_until\` IS NULL OR b.\`banned_until\` > NOW()
      ORDER BY b.\`created_at\` DESC
      LIMIT ${safeLimit}
    `

    const ids = rows.map((row) => row.user_id)
    const usernames = new Map<string, string>()

    if (ids.length > 0) {
      try {
        const profiles = await prisma.profile.findMany({
          where: { id: { in: ids } },
          select: { id: true, username: true },
        })
        for (const profile of profiles) {
          usernames.set(profile.id, profile.username || "unknown")
        }
      } catch {
        // If profile lookup fails, keep fallback username below.
      }
    }

    return rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      reason: row.reason,
      is_global: Boolean(row.is_global),
      banned_until:
        row.banned_until instanceof Date
          ? row.banned_until.toISOString()
          : row.banned_until
            ? String(row.banned_until)
            : null,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      profiles: { username: usernames.get(row.user_id) || "unknown" },
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ""
    const isRecoverable =
      message.includes("access denied") ||
      message.includes("permission denied") ||
      message.includes("denied to user") ||
      message.includes("command denied") ||
      message.includes("doesn't exist") ||
      message.includes("does not exist") ||
      message.includes("no such table") ||
      message.includes("unknown column")

    if (isRecoverable) return []
    throw error
  }
}
