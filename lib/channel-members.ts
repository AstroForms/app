import { prisma } from "@/lib/db"
import { ensureBotInfrastructure } from "@/lib/bot-infrastructure"

type JsonRecord = Record<string, unknown>

const JOIN_TRIGGER_TYPES = new Set(["on_join", "ON_JOIN"])
const JOIN_ACTION_TYPES = new Set([
  "send_welcome",
  "send_post",
  "send_announcement",
  "send_reminder",
  "auto_comment",
  "send_reply",
])

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeRole(value: unknown) {
  if (typeof value !== "string") return "MEMBER"
  const normalized = value.trim().toUpperCase()
  return normalized.length > 0 ? normalized : "MEMBER"
}

function renderWelcomeContent(
  template: string,
  ctx: {
    botName: string
    channelName: string
    memberName: string
    memberUsername: string
    date: string
  },
) {
  return template
    .replaceAll("{user}", ctx.botName)
    .replaceAll("{bot}", ctx.botName)
    .replaceAll("{channel}", ctx.channelName)
    .replaceAll("{member}", ctx.memberName)
    .replaceAll("{member_username}", ctx.memberUsername)
    .replaceAll("{date}", ctx.date)
}

export async function syncChannelMemberCount(channelId: string) {
  if (!channelId) return

  const count = await prisma.channelMember.count({
    where: { channelId },
  })

  await prisma.channel.update({
    where: { id: channelId },
    data: { memberCount: count },
  })
}

export async function runChannelJoinAutomations(channelId: string, joinedUserId: string) {
  if (!channelId || !joinedUserId) return { ran: 0, skipped: 0 }

  await ensureBotInfrastructure()

  const [channel, joinedProfile] = await Promise.all([
    prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, name: true, ownerId: true },
    }),
    prisma.profile.findUnique({
      where: { id: joinedUserId },
      select: { id: true, username: true, displayName: true },
    }),
  ])

  if (!channel) return { ran: 0, skipped: 0 }

  const automations = await prisma.botAutomation.findMany({
    where: {
      isActive: true,
      triggerType: { in: Array.from(JOIN_TRIGGER_TYPES) },
      OR: [{ channelId }, { channelId: null }],
    },
    include: {
      bot: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          isActive: true,
        },
      },
    },
  })

  const memberName = joinedProfile?.displayName || joinedProfile?.username || "Nutzer"
  const memberUsername = joinedProfile?.username || memberName
  const today = new Date().toLocaleDateString("de-DE")

  let ran = 0
  let skipped = 0

  for (const automation of automations) {
    try {
      if (!JOIN_ACTION_TYPES.has(automation.actionType)) {
        skipped += 1
        continue
      }

      if (!automation.bot || !automation.bot.isActive) {
        skipped += 1
        continue
      }

      const triggerConfig = (automation.triggerConfig || {}) as JsonRecord
      const actionConfig = (automation.actionConfig || {}) as JsonRecord

      const configuredChannelId =
        asNonEmptyString(actionConfig.channel_id) ||
        asNonEmptyString(triggerConfig.channel_id) ||
        automation.channelId

      if (configuredChannelId && configuredChannelId !== channelId) {
        skipped += 1
        continue
      }

      const rawTemplate = asNonEmptyString(actionConfig.content) || ""
      const content = renderWelcomeContent(rawTemplate, {
        botName: automation.bot.name,
        channelName: channel.name,
        memberName,
        memberUsername,
        date: today,
      }).trim()

      const authorId = automation.bot.ownerId || channel.ownerId
      if (!authorId) {
        skipped += 1
        continue
      }

      await prisma.post.create({
        data: {
          content: content || `Willkommen ${memberName}!`,
          userId: authorId,
          channelId,
          isAutomated: true,
          botId: automation.botId,
        },
      })

      await prisma.botAutomation.update({
        where: { id: automation.id },
        data: {
          triggerCount: { increment: 1 },
          lastTriggeredAt: new Date(),
        },
      })

      await prisma.botActionLog
        .create({
          data: {
            botId: automation.botId,
            automationId: automation.id,
            actionType: automation.actionType,
            triggerType: automation.triggerType,
            channelId,
            targetUserId: joinedUserId,
            details: {
              event: "channel_join",
              joined_user_id: joinedUserId,
            },
            success: true,
          },
        })
        .catch(() => {})

      ran += 1
    } catch (error) {
      skipped += 1
      const message = error instanceof Error ? error.message : "Join automation failed"
      await prisma.botActionLog
        .create({
          data: {
            botId: automation.botId,
            automationId: automation.id,
            actionType: automation.actionType,
            triggerType: automation.triggerType,
            channelId,
            targetUserId: joinedUserId,
            details: { error: message },
            success: false,
            errorMessage: message,
          },
        })
        .catch(() => {})
    }
  }

  return { ran, skipped }
}

export async function onChannelMemberCreated(input: {
  channelId: string
  userId: string
  role?: string | null
}) {
  await syncChannelMemberCount(input.channelId)

  const role = normalizeRole(input.role)
  if (role !== "MEMBER") return

  await runChannelJoinAutomations(input.channelId, input.userId)
}

export async function onChannelMemberDeleted(channelId: string) {
  await syncChannelMemberCount(channelId)
}
