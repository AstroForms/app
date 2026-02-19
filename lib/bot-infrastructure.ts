import { prisma } from "@/lib/db"

const BOT_SCHEMA_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS \`bots\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`description\` TEXT NULL,
      \`owner_id\` VARCHAR(191) NOT NULL,
      \`avatar_url\` TEXT NULL,
      \`banner_url\` TEXT NULL,
      \`is_verified\` TINYINT(1) NOT NULL DEFAULT 0,
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`is_public\` TINYINT(1) NOT NULL DEFAULT 0,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_bots_owner_id\` (\`owner_id\`),
      KEY \`idx_bots_is_public\` (\`is_public\`)
    ) ENGINE=InnoDB
  `,
  `
    CREATE TABLE IF NOT EXISTS \`bot_automations\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`bot_id\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`description\` TEXT NULL,
      \`trigger_type\` VARCHAR(191) NOT NULL,
      \`trigger_config\` JSON NOT NULL,
      \`action_type\` VARCHAR(191) NOT NULL,
      \`action_config\` JSON NOT NULL,
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`channel_id\` VARCHAR(191) NULL,
      \`cooldown_seconds\` INT NOT NULL DEFAULT 0,
      \`trigger_count\` INT NOT NULL DEFAULT 0,
      \`last_triggered_at\` DATETIME NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_bot_automations_bot_id\` (\`bot_id\`),
      KEY \`idx_bot_automations_active\` (\`is_active\`),
      KEY \`idx_bot_automations_trigger_type\` (\`trigger_type\`),
      KEY \`idx_bot_automations_channel_id\` (\`channel_id\`),
      KEY \`idx_bot_automations_last_triggered\` (\`last_triggered_at\`)
    ) ENGINE=InnoDB
  `,
  `
    CREATE TABLE IF NOT EXISTS \`bot_active_rules\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`bot_id\` VARCHAR(191) NOT NULL,
      \`rule_name\` VARCHAR(191) NOT NULL,
      \`rule_description\` TEXT NOT NULL,
      \`rule_category\` VARCHAR(191) NOT NULL,
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_bot_active_rules\` (\`bot_id\`, \`rule_name\`),
      KEY \`idx_bot_active_rules_bot_id\` (\`bot_id\`)
    ) ENGINE=InnoDB
  `,
  `
    CREATE TABLE IF NOT EXISTS \`bot_channel_invites\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`bot_id\` VARCHAR(191) NOT NULL,
      \`channel_id\` VARCHAR(191) NOT NULL,
      \`invited_by\` VARCHAR(191) NOT NULL,
      \`status\` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_bot_channel_invites\` (\`bot_id\`, \`channel_id\`),
      KEY \`idx_bot_channel_invites_status\` (\`status\`),
      KEY \`idx_bot_channel_invites_channel\` (\`channel_id\`)
    ) ENGINE=InnoDB
  `,
  `
    CREATE TABLE IF NOT EXISTS \`bot_verification_requests\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`bot_id\` VARCHAR(191) NOT NULL,
      \`owner_id\` VARCHAR(191) NOT NULL,
      \`status\` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
      \`bot_purpose\` TEXT NOT NULL,
      \`target_audience\` TEXT NOT NULL,
      \`unique_features\` TEXT NOT NULL,
      \`expected_users\` VARCHAR(191) NOT NULL,
      \`channel_count\` INT NOT NULL DEFAULT 0,
      \`has_privacy_policy\` TINYINT(1) NOT NULL DEFAULT 0,
      \`privacy_policy_url\` TEXT NULL,
      \`contact_email\` VARCHAR(191) NOT NULL,
      \`additional_info\` TEXT NULL,
      \`reviewed_by\` VARCHAR(191) NULL,
      \`reviewed_at\` DATETIME NULL,
      \`rejection_reason\` TEXT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_bot_verification_bot\` (\`bot_id\`),
      KEY \`idx_bot_verification_owner\` (\`owner_id\`),
      KEY \`idx_bot_verification_status\` (\`status\`)
    ) ENGINE=InnoDB
  `,
  `
    CREATE TABLE IF NOT EXISTS \`bot_channel_rules\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`bot_id\` VARCHAR(191) NOT NULL,
      \`channel_id\` VARCHAR(191) NOT NULL,
      \`rule_name\` VARCHAR(191) NOT NULL,
      \`rule_category\` VARCHAR(191) NOT NULL,
      \`is_enabled\` TINYINT(1) NOT NULL DEFAULT 1,
      \`config\` JSON NOT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_bot_channel_rules\` (\`bot_id\`, \`channel_id\`, \`rule_name\`),
      KEY \`idx_bot_channel_rules_bot\` (\`bot_id\`),
      KEY \`idx_bot_channel_rules_channel\` (\`channel_id\`)
    ) ENGINE=InnoDB
  `,
  `
    CREATE TABLE IF NOT EXISTS \`bot_execution_logs\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`bot_id\` VARCHAR(191) NOT NULL,
      \`channel_id\` VARCHAR(191) NOT NULL,
      \`rule_name\` VARCHAR(191) NOT NULL,
      \`trigger_type\` VARCHAR(191) NOT NULL,
      \`trigger_data\` JSON NULL,
      \`action_result\` JSON NULL,
      \`executed_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_bot_execution_bot\` (\`bot_id\`),
      KEY \`idx_bot_execution_channel\` (\`channel_id\`),
      KEY \`idx_bot_execution_executed\` (\`executed_at\`)
    ) ENGINE=InnoDB
  `,
  `
    CREATE TABLE IF NOT EXISTS \`bot_action_logs\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`bot_id\` VARCHAR(191) NULL,
      \`automation_id\` VARCHAR(191) NULL,
      \`action_type\` VARCHAR(191) NOT NULL,
      \`trigger_type\` VARCHAR(191) NULL,
      \`target_user_id\` VARCHAR(191) NULL,
      \`target_post_id\` VARCHAR(191) NULL,
      \`channel_id\` VARCHAR(191) NULL,
      \`details\` JSON NOT NULL,
      \`success\` TINYINT(1) NOT NULL DEFAULT 1,
      \`error_message\` TEXT NULL,
      \`executed_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_bot_action_bot\` (\`bot_id\`),
      KEY \`idx_bot_action_channel\` (\`channel_id\`),
      KEY \`idx_bot_action_executed\` (\`executed_at\`)
    ) ENGINE=InnoDB
  `,
  `
    CREATE TABLE IF NOT EXISTS \`scheduled_tasks\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`automation_id\` VARCHAR(191) NOT NULL,
      \`next_run_at\` DATETIME NOT NULL,
      \`last_run_at\` DATETIME NULL,
      \`schedule_type\` ENUM('ONCE', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM') NOT NULL,
      \`schedule_config\` JSON NOT NULL,
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`run_count\` INT NOT NULL DEFAULT 0,
      \`bot_id\` VARCHAR(191) NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_scheduled_tasks_automation\` (\`automation_id\`),
      KEY \`idx_scheduled_tasks_bot\` (\`bot_id\`),
      KEY \`idx_scheduled_tasks_next_run\` (\`next_run_at\`)
    ) ENGINE=InnoDB
  `,
]

const BOT_REQUIRED_COLUMNS: Array<{ table: string; column: string; definition: string }> = [
  { table: "bots", column: "is_active", definition: "TINYINT(1) NOT NULL DEFAULT 1" },
  { table: "bots", column: "is_public", definition: "TINYINT(1) NOT NULL DEFAULT 0" },
  { table: "bot_automations", column: "cooldown_seconds", definition: "INT NOT NULL DEFAULT 0" },
  { table: "bot_automations", column: "trigger_count", definition: "INT NOT NULL DEFAULT 0" },
  { table: "bot_automations", column: "last_triggered_at", definition: "DATETIME NULL" },
]

export const BOT_RELATED_TABLES = new Set([
  "bots",
  "automations",
  "bot_active_rules",
  "bot_channel_invites",
  "bot_verification_requests",
  "bot_channel_rules",
  "bot_execution_logs",
  "bot_action_logs",
  "scheduled_tasks",
])

let initPromise: Promise<void> | null = null

function normalizeCount(value: unknown) {
  if (typeof value === "number") return value
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "string") return Number(value)
  return 0
}

async function columnExists(table: string, column: string) {
  const result = await prisma.$queryRawUnsafe<Array<{ present: unknown }>>(
    `
      SELECT COUNT(*) AS present
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = '${table}'
        AND COLUMN_NAME = '${column}'
    `,
  )
  return normalizeCount(result?.[0]?.present) > 0
}

async function ensureColumn(table: string, column: string, definition: string) {
  if (await columnExists(table, column)) return
  await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
}

async function initializeBotSchema() {
  for (const statement of BOT_SCHEMA_STATEMENTS) {
    await prisma.$executeRawUnsafe(statement)
  }
  for (const requirement of BOT_REQUIRED_COLUMNS) {
    await ensureColumn(requirement.table, requirement.column, requirement.definition)
  }
}

export async function ensureBotInfrastructure() {
  if (!initPromise) {
    initPromise = initializeBotSchema().catch((error) => {
      initPromise = null
      throw error
    })
  }
  await initPromise
}
