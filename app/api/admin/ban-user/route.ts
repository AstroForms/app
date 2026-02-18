import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { ensureBansTable } from "@/lib/bans"

const DURATION_TO_HOURS: Record<string, number> = {
  "1h": 1,
  "6h": 6,
  "1d": 24,
  "3d": 72,
  "7d": 168,
  "30d": 720,
}

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

  const hasAdminAccess = me?.role === "admin" || me?.role === "owner"
  if (!hasAdminAccess) {
    return { meId: null, error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) }
  }

  return { meId: userId, error: null }
}

export async function POST(req: NextRequest) {
  try {
    const { meId, error } = await requireAdmin()
    if (error) return error

    const body = await req.json()
    const profileId = typeof body?.id === "string" ? body.id.trim() : ""
    const reason = typeof body?.reason === "string" ? body.reason.trim() : ""
    const duration = typeof body?.duration === "string" ? body.duration : "permanent"

    if (!profileId) {
      return NextResponse.json({ success: false, error: "No user id" }, { status: 400 })
    }
    if (profileId === meId) {
      return NextResponse.json({ success: false, error: "Du kannst deinen eigenen Account nicht bannen." }, { status: 400 })
    }

    const target = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { role: true, username: true },
    })

    if (!target) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    if (target.role === "owner") {
      return NextResponse.json({ success: false, error: "Owner kann nicht gebannt werden." }, { status: 400 })
    }

    const bannedUntil =
      duration === "permanent"
        ? null
        : new Date(Date.now() + (DURATION_TO_HOURS[duration] || 24) * 60 * 60 * 1000).toISOString()

    await ensureBansTable()
    await prisma.$executeRaw`
      DELETE FROM "bans"
      WHERE "user_id" = ${profileId}
    `

    await prisma.$executeRaw`
      INSERT INTO "bans" ("id", "user_id", "banned_by", "reason", "is_global", "banned_until")
      VALUES (${randomUUID()}, ${profileId}, ${meId}, ${reason || null}, ${1}, ${bannedUntil})
    `
    await prisma.session.deleteMany({
      where: { userId: profileId },
    })

    await createAuditLog({
      actorId: meId,
      action: "ban_user",
      targetUserId: profileId,
      details: `duration=${duration}${target.username ? `; target=@${target.username}` : ""}${reason ? `; reason=${reason}` : ""}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ban user failed"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
