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
    CREATE TABLE IF NOT EXISTS \`admin_audit_logs\` (
      \`id\` VARCHAR(191) PRIMARY KEY,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`actor_id\` VARCHAR(191) NOT NULL,
      \`action\` VARCHAR(191) NOT NULL,
      \`target_user_id\` VARCHAR(191) NULL,
      \`details\` TEXT NULL
    )
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`admin_settings\` (
      \`key\` VARCHAR(191) PRIMARY KEY,
      \`value\` TEXT NULL,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

export async function getAuditWebhook() {
  await ensureAuditTables()
  const rows = await prisma.$queryRaw<{ value: string | null }[]>`
    SELECT \`value\`
    FROM \`admin_settings\`
    WHERE \`key\` = 'discord_webhook_url'
    LIMIT 1
  `
  return rows[0]?.value?.trim() || ""
}

export async function setAuditWebhook(url: string) {
  await ensureAuditTables()
  const value = url.trim()
  await prisma.$executeRaw`
    INSERT INTO \`admin_settings\` (\`key\`, \`value\`)
    VALUES ('discord_webhook_url', ${value})
    ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), \`updated_at\` = CURRENT_TIMESTAMP
  `
}

export async function listAuditLogs(limit = 100) {
  await ensureAuditTables()
  const cappedLimit = Math.min(Math.max(Math.trunc(limit), 1), 500)

  const rows = await prisma.$queryRaw<
    Array<{
      id: string
      created_at: Date | string
      actor_id: string
      action: string
      target_user_id: string | null
      details: string | null
    }>
  >`
    SELECT
      l.\`id\`,
      l.\`created_at\`,
      l.\`actor_id\`,
      l.\`action\`,
      l.\`target_user_id\`,
      l.\`details\`
    FROM \`admin_audit_logs\` l
    ORDER BY l.\`created_at\` DESC
    LIMIT ${cappedLimit}
  `

  const profileIds = Array.from(
    new Set(
      rows.flatMap((row) =>
        [row.actor_id, row.target_user_id].filter((value): value is string => Boolean(value)),
      ),
    ),
  )

  const profiles = profileIds.length
    ? await prisma.profile.findMany({
        where: { id: { in: profileIds } },
        select: { id: true, username: true },
      })
    : []

  const usernameById = new Map(profiles.map((p) => [p.id, p.username]))

  return rows.map((row) => ({
    id: row.id,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    actor_id: row.actor_id,
    actor_username: usernameById.get(row.actor_id) || null,
    action: row.action,
    target_user_id: row.target_user_id,
    target_username: row.target_user_id ? usernameById.get(row.target_user_id) || null : null,
    details: row.details,
  }))
}

async function sendAuditToDiscord(log: {
  createdAt: Date
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
  const createdAt = new Date()
  const details = input.details?.trim() || null

  await prisma.$executeRaw`
    INSERT INTO \`admin_audit_logs\` (
      \`id\`,
      \`created_at\`,
      \`actor_id\`,
      \`action\`,
      \`target_user_id\`,
      \`details\`
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

  const [actorProfile, targetProfile] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: input.actorId },
      select: { username: true },
    }),
    input.targetUserId
      ? prisma.profile.findUnique({
          where: { id: input.targetUserId },
          select: { username: true },
        })
      : Promise.resolve(null),
  ])

  await sendAuditToDiscord({
    createdAt,
    action: input.action,
    actorId: input.actorId,
    actorUsername: actorProfile?.username || null,
    targetUserId: input.targetUserId || null,
    targetUsername: targetProfile?.username || null,
    details,
  })
}
