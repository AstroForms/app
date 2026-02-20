import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { BotsContent } from "@/components/bots-content"
import { FeatureDisabledNotice } from "@/components/feature-disabled-notice"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getFeatureFlags } from "@/lib/features"
import { ensureBotInfrastructure } from "@/lib/bot-infrastructure"

export default async function BotsPage() {
  const session = await auth().catch(() => null)
  if (!session?.user?.id) redirect("/auth/login")
  const userId = session.user.id
  const featureFlags = await getFeatureFlags().catch(() => ({ bots: true, messages: true, automations: true }))

  if (!featureFlags.bots) {
    return (
      <DashboardShell>
        <FeatureDisabledNotice
          title="Bots sind deaktiviert"
          description="Diese Funktion wurde von der Administration deaktiviert und kann aktuell nicht verwendet werden."
        />
      </DashboardShell>
    )
  }

  await ensureBotInfrastructure().catch(() => undefined)

  const bots = await prisma.bot
    .findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
    })
    .catch(() => [])

  const botIds = bots.map((bot) => bot.id)
  const [automations, channels, activeRules, pendingInvites] = await Promise.all([
    botIds.length
      ? prisma.botAutomation
          .findMany({
            where: { botId: { in: botIds } },
            include: { bot: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
          })
          .catch(() => [])
      : Promise.resolve([]),
    prisma.channel
      .findMany({
        where: { ownerId: userId },
        select: { id: true, name: true },
      })
      .catch(() => []),
    botIds.length
      ? prisma.botActiveRule
          .findMany({
            where: { botId: { in: botIds } },
          })
          .catch(() => [])
      : Promise.resolve([]),
    botIds.length
      ? prisma.botChannelInvite
          .findMany({
            where: { botId: { in: botIds }, status: "PENDING" },
            include: { channel: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
          })
          .catch(() => [])
      : Promise.resolve([]),
  ])

  return (
    <DashboardShell>
      <BotsContent
        bots={bots.map((bot) => ({
          id: bot.id,
          name: bot.name,
          description: bot.description,
          avatar_url: bot.avatarUrl,
          banner_url: bot.bannerUrl,
          is_verified: bot.isVerified,
          is_active: bot.isActive,
          is_public: bot.isPublic,
          created_at: bot.createdAt.toISOString(),
        }))}
        automations={automations.map((auto) => ({
          id: auto.id,
          name: auto.name,
          description: auto.description,
          trigger_type: auto.triggerType,
          action_type: auto.actionType,
          trigger_config: auto.triggerConfig as Record<string, unknown>,
          action_config: auto.actionConfig as Record<string, unknown>,
          is_active: auto.isActive,
          bot_id: auto.botId,
          bots: auto.bot ? { name: auto.bot.name } : null,
          cooldown_seconds: auto.cooldownSeconds,
          trigger_count: auto.triggerCount,
          last_triggered_at: auto.lastTriggeredAt?.toISOString(),
        }))}
        channels={channels}
        userId={userId}
        activeRules={activeRules.map((rule) => ({
          id: rule.id,
          bot_id: rule.botId,
          rule_name: rule.ruleName,
          rule_description: rule.ruleDescription,
          rule_category: rule.ruleCategory,
          is_active: rule.isActive,
        }))}
        pendingInvites={pendingInvites.map((invite) => ({
          id: invite.id,
          bot_id: invite.botId,
          channel_id: invite.channelId,
          status: invite.status.toLowerCase(),
          channels: invite.channel,
        }))}
        automationsEnabled={featureFlags.automations}
      />
    </DashboardShell>
  )
}
