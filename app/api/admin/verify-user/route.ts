import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

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

    const { id, verified } = await req.json()
    const profileId = typeof id === "string" ? id.trim() : ""
    const shouldVerify = typeof verified === "boolean" ? verified : true
    if (!profileId) {
      return NextResponse.json({ success: false, error: "No user id" }, { status: 400 })
    }

    const target = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { id: true, username: true, isVerified: true },
    })
    if (!target) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    if (target.isVerified === shouldVerify) {
      return NextResponse.json({ success: true, alreadySet: true, verified: target.isVerified })
    }

    await prisma.profile.update({
      where: { id: profileId },
      data: { isVerified: shouldVerify },
    })

    await createAuditLog({
      actorId: meId!,
      action: shouldVerify ? "verify_user" : "unverify_user",
      targetUserId: profileId,
      details: target.username ? `target=@${target.username}` : undefined,
    })

    return NextResponse.json({ success: true, verified: shouldVerify })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
