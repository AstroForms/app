import { randomUUID } from "crypto"
import { prisma } from "@/lib/db"

export type AuditLogItem = {
  id: string
  created_at: string
  actor_id: string
  actor_username: string | null
  action: string
  target_user_id: string | null
  target_username: string | null
  details: string | null
}

type AuditLogInput = {
  actorId: string
  action: string
  targetUserId?: string | null
  details?: string | null
}

async function ensureAuditTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
      "id" TEXT PRIMARY KEY,
      "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "actor_id" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "target_user_id" TEXT,
      "details" TEXT
    )
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "admin_settings" (
      "key" TEXT PRIMARY KEY,
      "value" TEXT,
      "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

export async function getAuditWebhook() {
  await ensureAuditTables()
  const rows = await prisma.$queryRaw<{ value: string | null }[]>`
    SELECT "value"
    FROM "admin_settings"
    WHERE "key" = 'discord_webhook_url'
    LIMIT 1
  `
  return rows[0]?.value?.trim() || ""
}

export async function setAuditWebhook(url: string) {
  await ensureAuditTables()
  const value = url.trim()
  await prisma.$executeRaw`
    INSERT INTO "admin_settings" ("key", "value")
    VALUES ('discord_webhook_url', ${value})
    ON CONFLICT("key")
    DO UPDATE SET "value" = excluded."value", "updated_at" = CURRENT_TIMESTAMP
  `
}

export async function listAuditLogs(limit = 100) {
  await ensureAuditTables()
  const cappedLimit = Math.min(Math.max(Math.trunc(limit), 1), 500)

  const rows = await prisma.$queryRaw<AuditLogItem[]>`
    SELECT
      l."id",
      l."created_at",
      l."actor_id",
      l."action",
      l."target_user_id",
      l."details",
      a."username" AS "actor_username",
      t."username" AS "target_username"
    FROM "admin_audit_logs" l
    LEFT JOIN "profiles" a ON a."id" = l."actor_id"
    LEFT JOIN "profiles" t ON t."id" = l."target_user_id"
    ORDER BY l."created_at" DESC
    LIMIT ${cappedLimit}
  `

  return rows
}

async function sendAuditToDiscord(log: {
  createdAt: string
  action: string
  actorId: string
  actorUsername: string | null
  targetUserId: string | null
  targetUsername: string | null
  details: string | null
}) {
  const webhookUrl = await getAuditWebhook()
  if (!webhookUrl) return

  const actor = log.actorUsername ? `@${log.actorUsername}` : log.actorId
  const target = log.targetUsername
    ? `@${log.targetUsername}`
    : log.targetUserId || "-"

  const embed = {
    title: "Audit Log",
    color: 0x3b82f6,
    timestamp: new Date(log.createdAt).toISOString(),
    fields: [
      { name: "Action", value: log.action.slice(0, 1024), inline: true },
      { name: "Actor", value: actor.slice(0, 1024), inline: true },
      { name: "Target", value: target.slice(0, 1024), inline: true },
      {
        name: "Details",
        value: (log.details?.slice(0, 1024) || "-"),
        inline: false,
      },
    ],
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    })
  } catch {
    // Logging to webhook must never break admin actions.
  }
}

export async function createAuditLog(input: AuditLogInput) {
  await ensureAuditTables()

  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const details = input.details?.trim() || null

  await prisma.$executeRaw`
    INSERT INTO "admin_audit_logs" (
      "id",
      "created_at",
      "actor_id",
      "action",
      "target_user_id",
      "details"
    )
    VALUES (
      ${id},
      ${createdAt},
      ${input.actorId},
      ${input.action},
      ${input.targetUserId || null},
      ${details}
    )
  `

  const usernames = await prisma.$queryRaw<{ actor_username: string | null; target_username: string | null }[]>`
    SELECT
      (SELECT "username" FROM "profiles" WHERE "id" = ${input.actorId} LIMIT 1) AS "actor_username",
      (SELECT "username" FROM "profiles" WHERE "id" = ${input.targetUserId || null} LIMIT 1) AS "target_username"
  `

  const resolved = usernames[0] || { actor_username: null, target_username: null }
  await sendAuditToDiscord({
    createdAt,
    action: input.action,
    actorId: input.actorId,
    actorUsername: resolved.actor_username,
    targetUserId: input.targetUserId || null,
    targetUsername: resolved.target_username,
    details,
  })
}
