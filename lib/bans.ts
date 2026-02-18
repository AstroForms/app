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
