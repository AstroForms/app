import { prisma } from "@/lib/db"

export type AccountSettings = {
  emailNotifications: boolean
  marketingEmails: boolean
  loginAlerts: boolean
  profileVisibilityTips: boolean
}

const DEFAULT_SETTINGS: AccountSettings = {
  emailNotifications: true,
  marketingEmails: false,
  loginAlerts: true,
  profileVisibilityTips: true,
}

export async function ensureAccountSettingsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`user_account_settings\` (
      \`user_id\` VARCHAR(191) PRIMARY KEY,
      \`email_notifications\` TINYINT(1) NOT NULL DEFAULT 1,
      \`marketing_emails\` TINYINT(1) NOT NULL DEFAULT 0,
      \`login_alerts\` TINYINT(1) NOT NULL DEFAULT 1,
      \`profile_visibility_tips\` TINYINT(1) NOT NULL DEFAULT 1,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)
}

export async function getAccountSettings(userId: string): Promise<AccountSettings> {
  await ensureAccountSettingsTable()
  const rows = await prisma.$queryRaw<
    Array<{
      email_notifications: number
      marketing_emails: number
      login_alerts: number
      profile_visibility_tips: number
    }>
  >`
    SELECT
      \`email_notifications\`,
      \`marketing_emails\`,
      \`login_alerts\`,
      \`profile_visibility_tips\`
    FROM \`user_account_settings\`
    WHERE \`user_id\` = ${userId}
    LIMIT 1
  `

  if (!rows.length) return DEFAULT_SETTINGS
  const row = rows[0]
  return {
    emailNotifications: row.email_notifications === 1,
    marketingEmails: row.marketing_emails === 1,
    loginAlerts: row.login_alerts === 1,
    profileVisibilityTips: row.profile_visibility_tips === 1,
  }
}

export async function setAccountSettings(userId: string, settings: AccountSettings) {
  await ensureAccountSettingsTable()
  await prisma.$executeRaw`
    INSERT INTO \`user_account_settings\` (
      \`user_id\`,
      \`email_notifications\`,
      \`marketing_emails\`,
      \`login_alerts\`,
      \`profile_visibility_tips\`
    )
    VALUES (
      ${userId},
      ${settings.emailNotifications ? 1 : 0},
      ${settings.marketingEmails ? 1 : 0},
      ${settings.loginAlerts ? 1 : 0},
      ${settings.profileVisibilityTips ? 1 : 0}
    )
    ON DUPLICATE KEY UPDATE
      \`email_notifications\` = VALUES(\`email_notifications\`),
      \`marketing_emails\` = VALUES(\`marketing_emails\`),
      \`login_alerts\` = VALUES(\`login_alerts\`),
      \`profile_visibility_tips\` = VALUES(\`profile_visibility_tips\`)
  `
}
