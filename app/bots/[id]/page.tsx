import { redirect, notFound } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { BotProfileContent } from "@/components/bot-profile-content"
import { FeatureDisabledNotice } from "@/components/feature-disabled-notice"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isFeatureEnabled } from "@/lib/features"

export default async function BotProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login")
  const userId = session.user.id
  const botsEnabled = await isFeatureEnabled("bots")

  if (!botsEnabled) {
    return (
      <DashboardShell>
        <FeatureDisabledNotice
          title="Bots sind deaktiviert"
          description="Diese Funktion wurde von der Administration deaktiviert und kann aktuell nicht verwendet werden."
        />
      </DashboardShell>
    )
  }

  const bot = await prisma.bot.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  })

  if (!bot) notFound()

  const activeRules = await prisma.botActiveRule.findMany({
    where: { botId: id },
    orderBy: { createdAt: "asc" },
  })

  const channelInvites = await prisma.botChannelInvite.findMany({
    where: { botId: id, status: "ACCEPTED" },
    include: { channel: { select: { id: true, name: true, iconUrl: true, isVerified: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  const channelCount = await prisma.botChannelInvite.count({
    where: { botId: id, status: "ACCEPTED" },
  })

  const automations = await prisma.botAutomation.findMany({
    where: { botId: id },
    select: { id: true, name: true, description: true, triggerType: true, actionType: true, isActive: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  const isOwner = bot.ownerId === userId

  const userChannels = await prisma.channel.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true },
  })

  const existingInvites = userChannels.length
    ? await prisma.botChannelInvite.findMany({
        where: { botId: id, channelId: { in: userChannels.map((c) => c.id) } },
        select: { channelId: true, status: true },
      })
    : []

  const verificationRequest = await prisma.botVerificationRequest.findUnique({
    where: { botId: id },
    select: { status: true, rejectionReason: true },
  })

  return (
    <DashboardShell>
      <BotProfileContent
        bot={{
          id: bot.id,
          name: bot.name,
          description: bot.description,
          avatar_url: bot.avatarUrl,
          banner_url: bot.bannerUrl,
          is_verified: bot.isVerified,
          is_active: bot.isActive,
          is_public: bot.isPublic,
          created_at: bot.createdAt.toISOString(),
          owner_id: bot.ownerId,
          profiles: {
            id: bot.owner.id,
            username: bot.owner.username || "",
            display_name: bot.owner.displayName || "",
            avatar_url: bot.owner.avatarUrl,
          },
        }}
        activeRules={activeRules.map((rule) => ({
          id: rule.id,
          bot_id: rule.botId,
          rule_name: rule.ruleName,
          rule_description: rule.ruleDescription,
          rule_category: rule.ruleCategory,
          is_active: rule.isActive,
        }))}
        channels={channelInvites.map((invite) => ({
          id: invite.channel.id,
          name: invite.channel.name,
          avatar_url: invite.channel.iconUrl,
          is_verified: invite.channel.isVerified,
        }))}
        channelCount={channelCount}
        automations={automations.map((auto) => ({
          id: auto.id,
          name: auto.name,
          description: auto.description,
          trigger_type: auto.triggerType,
          action_type: auto.actionType,
          is_active: auto.isActive,
        }))}
        isOwner={isOwner}
        currentUserId={userId}
        userChannels={userChannels}
        existingInvites={existingInvites.map((invite) => ({
          channel_id: invite.channelId,
          status: invite.status.toLowerCase(),
        }))}
        verificationStatus={verificationRequest?.status || null}
        rejectionReason={verificationRequest?.rejectionReason || null}
      />
    </DashboardShell>
  )
}
