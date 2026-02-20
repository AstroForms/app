import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"
import { ensureBansTable, setUserBanCache } from "@/lib/bans"

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
    if (!profileId) {
      return NextResponse.json({ success: false, error: "No user id" }, { status: 400 })
    }

    await ensureBansTable()

    await prisma.$executeRaw`
      DELETE FROM \`bans\`
      WHERE \`user_id\` = ${profileId}
    `
    setUserBanCache(profileId, false)

    await createAuditLog({
      actorId: meId!,
      action: "unban_user",
      targetUserId: profileId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unban user failed"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
