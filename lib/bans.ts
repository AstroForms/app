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
