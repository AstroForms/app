import { prisma } from "@/lib/db"

export async function ensureBansTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "bans" (
      "id" TEXT PRIMARY KEY,
      "user_id" TEXT NOT NULL,
      "banned_by" TEXT NOT NULL,
      "reason" TEXT,
      "is_global" INTEGER NOT NULL DEFAULT 1,
      "banned_until" TEXT,
      "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "idx_bans_user_id"
    ON "bans" ("user_id")
  `)
}

export async function isUserCurrentlyBanned(userId: string) {
  if (!userId) return false

  await ensureBansTable()

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "bans"
    WHERE "user_id" = ${userId}
      AND ("banned_until" IS NULL OR julianday("banned_until") > julianday('now'))
    LIMIT 1
  `

  return rows.length > 0
}
