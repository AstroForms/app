import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

type ScheduleConfig = {
  schedule_type?: string
  time?: string
  days?: string[]
}

function parseTime(time: string | undefined) {
  if (!time) return { hour: 0, minute: 0 }
  const [h, m] = time.split(":").map((v) => Number(v))
  return { hour: Number.isFinite(h) ? h : 0, minute: Number.isFinite(m) ? m : 0 }
}

function dayKey(date: Date) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()]
}

function isSameMinute(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate() &&
    a.getHours() === b.getHours() &&
    a.getMinutes() === b.getMinutes()
  )
}

function shouldRun(now: Date, config: ScheduleConfig, lastTriggeredAt: Date | null) {
  const scheduleType = (config.schedule_type || "daily").toLowerCase()
  const { hour, minute } = parseTime(config.time)
  const days = config.days || []

  if (lastTriggeredAt && isSameMinute(now, lastTriggeredAt)) return false

  if (scheduleType === "hourly") {
    if (lastTriggeredAt && now.getHours() === lastTriggeredAt.getHours()) return false
    return now.getMinutes() === minute
  }

  if (scheduleType === "daily") {
    if (days.length > 0 && !days.includes(dayKey(now))) return false
    return now.getHours() === hour && now.getMinutes() === minute
  }

  if (scheduleType === "weekly") {
    if (days.length > 0 && !days.includes(dayKey(now))) return false
    return now.getHours() === hour && now.getMinutes() === minute
  }

  if (scheduleType === "monthly") {
    return now.getDate() === 1 && now.getHours() === hour && now.getMinutes() === minute
  }

  if (scheduleType === "once") {
    if (!lastTriggeredAt) {
      return now.getHours() === hour && now.getMinutes() === minute
    }
    return false
  }

  return false
}

function formatContent(template: string, ctx: { user?: string; channel?: string; date?: string }) {
  return template
    .replaceAll("{user}", ctx.user || "System")
    .replaceAll("{channel}", ctx.channel || "Channel")
    .replaceAll("{date}", ctx.date || new Date().toLocaleDateString("de-DE"))
}

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  const automations = await prisma.botAutomation.findMany({
    where: { isActive: true, triggerType: "scheduled" },
  })

  let ran = 0
  let skipped = 0

  for (const automation of automations) {
    const config = (automation.triggerConfig || {}) as ScheduleConfig
    if (!shouldRun(now, config, automation.lastTriggeredAt)) {
      skipped += 1
      continue
    }

    const actionConfig = (automation.actionConfig || {}) as Record<string, unknown>
    const channelId =
      (actionConfig.channel_id as string | undefined) ||
      (automation.channelId as string | null) ||
      (config as Record<string, unknown>).channel_id?.toString()

    if (!channelId) {
      await prisma.botActionLog.create({
        data: {
          botId: automation.botId,
          automationId: automation.id,
          actionType: automation.actionType,
          triggerType: automation.triggerType,
          channelId: null,
          details: { error: "Missing channel_id" },
          success: false,
        },
      })
      skipped += 1
      continue
    }

    let botOwnerId: string | null = null
    let botName: string | null = null
    if (automation.botId) {
      const bot = await prisma.bot.findUnique({ where: { id: automation.botId } })
      if (!bot || !bot.isActive) {
        skipped += 1
        continue
      }
      botOwnerId = bot.ownerId
      botName = bot.name
    }

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    const contentTemplate = String(actionConfig.content || "")

    if (
      ["send_post", "send_announcement", "send_reminder", "send_welcome", "send_reply", "auto_comment"].includes(
        automation.actionType,
      )
    ) {
      const postContent = formatContent(contentTemplate, {
        user: botName || "System",
        channel: channel?.name || "Channel",
        date: now.toLocaleDateString("de-DE"),
      })

      if (!botOwnerId) {
        botOwnerId = channel?.ownerId || null
      }

      if (!botOwnerId) {
        await prisma.botActionLog.create({
          data: {
            botId: automation.botId,
            automationId: automation.id,
            actionType: automation.actionType,
            triggerType: automation.triggerType,
            channelId,
            details: { error: "Missing user for post" },
            success: false,
          },
        })
        skipped += 1
        continue
      }

      await prisma.post.create({
        data: {
          content: postContent || "(Automatische Nachricht)",
          userId: botOwnerId,
          channelId,
          isAutomated: true,
          botId: automation.botId,
        },
      })
    } else {
      await prisma.botActionLog.create({
        data: {
          botId: automation.botId,
          automationId: automation.id,
          actionType: automation.actionType,
          triggerType: automation.triggerType,
          channelId,
          details: { info: "Action not implemented; logged only." },
          success: false,
        },
      })
    }

    await prisma.botAutomation.update({
      where: { id: automation.id },
      data: {
        triggerCount: { increment: 1 },
        lastTriggeredAt: now,
      },
    })
    ran += 1
  }

  return NextResponse.json({ ran, skipped })
}
