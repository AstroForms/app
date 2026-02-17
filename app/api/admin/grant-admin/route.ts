import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

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

    const { id } = await req.json()
    const profileId = typeof id === "string" ? id.trim() : ""
    if (!profileId) {
      return NextResponse.json({ success: false, error: "No user id" }, { status: 400 })
    }

    if (profileId === meId) {
      return NextResponse.json({ success: false, error: "Du hast bereits Admin-Rechte." }, { status: 400 })
    }

    const target = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { role: true },
    })

    if (!target) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    if (target.role === "owner") {
      return NextResponse.json({ success: false, error: "Owner-Rolle kann nicht geaendert werden." }, { status: 400 })
    }

    if (target.role === "admin") {
      return NextResponse.json({ success: true, alreadyAdmin: true })
    }

    await prisma.profile.update({
      where: { id: profileId },
      data: { role: "admin" },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Grant admin failed"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
