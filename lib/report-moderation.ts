import { prisma } from "@/lib/db"

function isAlreadyExistsError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ""
  return (
    message.includes("duplicate column") ||
    message.includes("already exists") ||
    message.includes("duplicate key name") ||
    message.includes("duplicate")
  )
}

async function ensureColumn(table: string, columnDefinition: string) {
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`${table}\`
      ADD COLUMN ${columnDefinition}
    `)
  } catch (error) {
    if (!isAlreadyExistsError(error)) throw error
  }
}

async function ensureIndex(indexName: string, table: string, columnsSql: string) {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX \`${indexName}\`
      ON \`${table}\` (${columnsSql})
    `)
  } catch (error) {
    if (!isAlreadyExistsError(error)) throw error
  }
}

export async function ensureReportActionsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`report_actions\` (
      \`id\` VARCHAR(191) PRIMARY KEY,
      \`report_id\` VARCHAR(191) NOT NULL,
      \`actor_id\` VARCHAR(191) NOT NULL,
      \`action\` VARCHAR(64) NOT NULL,
      \`notes\` TEXT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await ensureIndex("idx_report_actions_report", "report_actions", "`report_id`")
  await ensureIndex("idx_report_actions_actor", "report_actions", "`actor_id`")
  await ensureIndex("idx_report_actions_created", "report_actions", "`created_at`")
}

export async function ensureAdminModerationSchema() {
  await ensureColumn("profiles", "`is_verified` TINYINT(1) NOT NULL DEFAULT 0")
  await ensureColumn("channels", "`is_locked` TINYINT(1) NOT NULL DEFAULT 0")

  await ensureColumn("reports", "`priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM'")
  await ensureColumn(
    "reports",
    "`queue_status` ENUM('PENDING', 'TRIAGED', 'ESCALATED', 'RESOLVED', 'DISMISSED') NOT NULL DEFAULT 'PENDING'",
  )
  await ensureColumn("reports", "`assigned_to` VARCHAR(191) NULL")
  await ensureColumn("reports", "`severity_score` INT NOT NULL DEFAULT 0")
  await ensureColumn("reports", "`resolution_action` VARCHAR(191) NULL")
  await ensureColumn("reports", "`last_action_at` DATETIME NULL")
  await ensureColumn("reports", "`admin_notes` TEXT NULL")

  await ensureIndex("idx_reports_queue_status", "reports", "`queue_status`")
  await ensureIndex("idx_reports_priority_created", "reports", "`priority`, `created_at`")
  await ensureIndex("idx_reports_assigned_status", "reports", "`assigned_to`, `queue_status`")
  await ensureIndex("idx_reports_last_action", "reports", "`last_action_at`")

  await ensureReportActionsTable()
}
