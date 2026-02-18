import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { listAuditLogs } from "@/lib/audit"

async function requireAdmin() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const me = await prisma.profile.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  const hasAdminAccess = me?.role === "admin" || me?.role === "owner"
  if (!hasAdminAccess) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { error: null }
}

export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAdmin()
    if (error) return error

    const rawLimit = Number(new URL(req.url).searchParams.get("limit") || 100)
    const logs = await listAuditLogs(rawLimit)
    return NextResponse.json({ logs })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audit logs fetch failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
