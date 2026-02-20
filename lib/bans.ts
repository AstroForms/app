import { prisma } from "@/lib/db"

export async function ensureBansTable() {
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
  await prisma.$executeRawUnsafe(`
    ALTER TABLE \`bans\`
      ADD COLUMN IF NOT EXISTS \`banned_by\` VARCHAR(191) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS \`reason\` TEXT NULL,
      ADD COLUMN IF NOT EXISTS \`is_global\` TINYINT(1) NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS \`banned_until\` DATETIME NULL,
      ADD COLUMN IF NOT EXISTS \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  `)

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
}

export async function isUserCurrentlyBanned(userId: string) {
  if (!userId) return false

  try {
    await ensureBansTable()

    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT \`id\`
      FROM \`bans\`
      WHERE \`user_id\` = ${userId}
        AND (\`banned_until\` IS NULL OR \`banned_until\` > NOW())
      LIMIT 1
    `

    return rows.length > 0
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
      return false
    }

    throw error
  }
}

export async function listRecentBans(limit = 50) {
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
}
