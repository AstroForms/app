import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ensureBansTable } from "@/lib/bans"
import { createAuditLog } from "@/lib/audit"

const DURATION_TO_HOURS: Record<string, number> = {
  "1h": 1,
  "6h": 6,
  "1d": 24,
  "3d": 72,
  "7d": 168,
  "30d": 720,
}

type ReportActionType =
  | "assign_to_me"
  | "set_priority"
  | "triage"
  | "escalate"
  | "resolve"
  | "dismiss"
  | "verify_user"
  | "verify_channel"
  | "lock_channel"
  | "delete_post"
  | "delete_comment"
  | "delete_message"
  | "ban_user_temp"
  | "ban_user_permanent"

async function requireAdmin() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return { meId: null, error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) }
  }

  const me = await prisma.profile.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (me?.role !== "admin" && me?.role !== "owner") {
    return { meId: null, error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) }
  }

  return { meId: userId, error: null }
}

async function ensureReportActionsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`report_actions\` (
      \`id\` VARCHAR(191) PRIMARY KEY,
      \`report_id\` VARCHAR(191) NOT NULL,
      \`actor_id\` VARCHAR(191) NOT NULL,
      \`action\` VARCHAR(64) NOT NULL,
      \`notes\` TEXT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY \`idx_report_actions_report\` (\`report_id\`),
      KEY \`idx_report_actions_actor\` (\`actor_id\`),
      KEY \`idx_report_actions_created\` (\`created_at\`)
    )
  `)
}

async function resolveTargetUserId(report: { targetType: string; targetId: string }) {
  if (report.targetType === "USER") {
    return report.targetId
  }
  if (report.targetType === "POST") {
    const post = await prisma.post.findUnique({
      where: { id: report.targetId },
      select: { userId: true },
    })
    return post?.userId || null
  }
  if (report.targetType === "COMMENT") {
    const comment = await prisma.postComment.findUnique({
      where: { id: report.targetId },
      select: { userId: true },
    })
    return comment?.userId || null
  }
  if (report.targetType === "MESSAGE") {
    const message = await prisma.message.findUnique({
      where: { id: report.targetId },
      select: { senderId: true },
    })
    return message?.senderId || null
  }
  if (report.targetType === "CHANNEL") {
    const channel = await prisma.channel.findUnique({
      where: { id: report.targetId },
      select: { ownerId: true },
    })
    return channel?.ownerId || null
  }
  return null
}

async function resolveTargetChannelId(report: { targetType: string; targetId: string }) {
  if (report.targetType === "CHANNEL") return report.targetId
  if (report.targetType === "POST") {
    const post = await prisma.post.findUnique({
      where: { id: report.targetId },
      select: { channelId: true },
    })
    return post?.channelId || null
  }
  return null
}

async function appendAdminNotes(reportId: string, notes: string | null) {
  if (!notes) return
  const existing = await prisma.report.findUnique({
    where: { id: reportId },
    select: { adminNotes: true },
  })
  const merged = existing?.adminNotes ? `${existing.adminNotes}\n${notes}` : notes
  await prisma.report.update({
    where: { id: reportId },
    data: { adminNotes: merged },
  })
}

export async function POST(req: NextRequest) {
  try {
    const { meId, error } = await requireAdmin()
    if (error) return error

    const body = await req.json().catch(() => ({}))
    const reportId = typeof body?.reportId === "string" ? body.reportId.trim() : ""
    const action = typeof body?.action === "string" ? body.action.trim() : ""
    const notes = typeof body?.notes === "string" ? body.notes.trim() : null
    const priority = typeof body?.priority === "string" ? body.priority.trim().toUpperCase() : ""
    const duration = typeof body?.duration === "string" ? body.duration.trim() : "1d"

    if (!reportId || !action) {
      return NextResponse.json({ success: false, error: "Missing report action payload" }, { status: 400 })
    }

    const validActions: ReportActionType[] = [
      "assign_to_me",
      "set_priority",
      "triage",
      "escalate",
      "resolve",
      "dismiss",
      "verify_user",
      "verify_channel",
      "lock_channel",
      "delete_post",
      "delete_comment",
      "delete_message",
      "ban_user_temp",
      "ban_user_permanent",
    ]
    if (!validActions.includes(action as ReportActionType)) {
      return NextResponse.json({ success: false, error: "Unknown report action" }, { status: 400 })
    }

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        status: true,
        reason: true,
      },
    })
    if (!report) {
      return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 })
    }

    if (action === "assign_to_me") {
      await prisma.report.update({
        where: { id: reportId },
        data: {
          assignedTo: meId!,
          queueStatus: "TRIAGED",
          lastActionAt: new Date(),
        },
      })
    } else if (action === "set_priority") {
      if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(priority)) {
        return NextResponse.json({ success: false, error: "Invalid priority" }, { status: 400 })
      }
      await prisma.report.update({
        where: { id: reportId },
        data: { priority: priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", lastActionAt: new Date() },
      })
    } else if (action === "triage") {
      await prisma.report.update({
        where: { id: reportId },
        data: { queueStatus: "TRIAGED", assignedTo: meId!, lastActionAt: new Date() },
      })
    } else if (action === "escalate") {
      await prisma.report.update({
        where: { id: reportId },
        data: { queueStatus: "ESCALATED", assignedTo: meId!, lastActionAt: new Date() },
      })
    } else if (action === "resolve" || action === "dismiss") {
      const resolved = action === "resolve"
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: resolved ? "RESOLVED" : "DISMISSED",
          queueStatus: resolved ? "RESOLVED" : "DISMISSED",
          reviewedBy: meId!,
          reviewedAt: new Date(),
          lastActionAt: new Date(),
          resolutionAction: resolved ? "manual_resolve" : "manual_dismiss",
        },
      })
    } else if (action === "verify_user") {
      const targetUserId = await resolveTargetUserId(report)
      if (!targetUserId) {
        return NextResponse.json({ success: false, error: "Target user not found" }, { status: 400 })
      }
      await prisma.profile.update({
        where: { id: targetUserId },
        data: { isVerified: true },
      })
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: "RESOLVED",
          queueStatus: "RESOLVED",
          reviewedBy: meId!,
          reviewedAt: new Date(),
          lastActionAt: new Date(),
          resolutionAction: "verify_user",
        },
      })
    } else if (action === "verify_channel") {
      const channelId = await resolveTargetChannelId(report)
      if (!channelId) {
        return NextResponse.json({ success: false, error: "Target channel not found" }, { status: 400 })
      }
      await prisma.channel.update({
        where: { id: channelId },
        data: { isVerified: true },
      })
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: "RESOLVED",
          queueStatus: "RESOLVED",
          reviewedBy: meId!,
          reviewedAt: new Date(),
          lastActionAt: new Date(),
          resolutionAction: "verify_channel",
        },
      })
    } else if (action === "lock_channel") {
      const channelId = await resolveTargetChannelId(report)
      if (!channelId) {
        return NextResponse.json({ success: false, error: "Target channel not found" }, { status: 400 })
      }
      await prisma.channel.update({
        where: { id: channelId },
        data: { isLocked: true },
      })
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: "RESOLVED",
          queueStatus: "RESOLVED",
          reviewedBy: meId!,
          reviewedAt: new Date(),
          lastActionAt: new Date(),
          resolutionAction: "lock_channel",
        },
      })
    } else if (action === "delete_post") {
      if (report.targetType !== "POST") {
        return NextResponse.json({ success: false, error: "Report target is not a post" }, { status: 400 })
      }
      await prisma.post.deleteMany({ where: { id: report.targetId } })
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: "RESOLVED",
          queueStatus: "RESOLVED",
          reviewedBy: meId!,
          reviewedAt: new Date(),
          lastActionAt: new Date(),
          resolutionAction: "delete_post",
        },
      })
    } else if (action === "delete_comment") {
      if (report.targetType !== "COMMENT") {
        return NextResponse.json({ success: false, error: "Report target is not a comment" }, { status: 400 })
      }
      await prisma.postComment.deleteMany({ where: { id: report.targetId } })
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: "RESOLVED",
          queueStatus: "RESOLVED",
          reviewedBy: meId!,
          reviewedAt: new Date(),
          lastActionAt: new Date(),
          resolutionAction: "delete_comment",
        },
      })
    } else if (action === "delete_message") {
      if (report.targetType !== "MESSAGE") {
        return NextResponse.json({ success: false, error: "Report target is not a message" }, { status: 400 })
      }
      await prisma.message.updateMany({
        where: { id: report.targetId },
        data: { isDeleted: true, deletedAt: new Date() },
      })
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: "RESOLVED",
          queueStatus: "RESOLVED",
          reviewedBy: meId!,
          reviewedAt: new Date(),
          lastActionAt: new Date(),
          resolutionAction: "delete_message",
        },
      })
    } else if (action === "ban_user_temp" || action === "ban_user_permanent") {
      const targetUserId = await resolveTargetUserId(report)
      if (!targetUserId) {
        return NextResponse.json({ success: false, error: "Target user not found" }, { status: 400 })
      }

      const bannedUntil =
        action === "ban_user_permanent"
          ? null
          : new Date(Date.now() + (DURATION_TO_HOURS[duration] || 24) * 60 * 60 * 1000)

      await ensureBansTable()
      await prisma.$executeRaw`
        DELETE FROM \`bans\`
        WHERE \`user_id\` = ${targetUserId}
      `
      await prisma.$executeRaw`
        INSERT INTO \`bans\` (\`id\`, \`user_id\`, \`banned_by\`, \`reason\`, \`is_global\`, \`banned_until\`)
        VALUES (${randomUUID()}, ${targetUserId}, ${meId!}, ${notes || "Report moderation ban"}, ${1}, ${bannedUntil})
      `
      await prisma.session.deleteMany({ where: { userId: targetUserId } })
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: "RESOLVED",
          queueStatus: "RESOLVED",
          reviewedBy: meId!,
          reviewedAt: new Date(),
          lastActionAt: new Date(),
          resolutionAction: action === "ban_user_permanent" ? "ban_user_permanent" : "ban_user_temp",
        },
      })
    }

    await appendAdminNotes(reportId, notes)
    await ensureReportActionsTable()
    await prisma.$executeRaw`
      INSERT INTO \`report_actions\` (\`id\`, \`report_id\`, \`actor_id\`, \`action\`, \`notes\`)
      VALUES (${randomUUID()}, ${reportId}, ${meId!}, ${action}, ${notes})
    `

    await createAuditLog({
      actorId: meId!,
      action: `report_action:${action}`,
      details: `report=${reportId}; type=${report.targetType}; target=${report.targetId}; reason=${report.reason}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report action failed"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

