import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

const MAX_RESULTS = 10

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

    const username = new URL(req.url).searchParams.get("username")?.trim() ?? ""
    if (!username) return NextResponse.json({ users: [] })

    const users = await prisma.profile.findMany({
      where: {
        username: {
          contains: username,
        },
      },
      select: {
        id: true,
        username: true,
        displayName: true,
      },
      orderBy: {
        username: "asc",
      },
      take: MAX_RESULTS,
    })

    return NextResponse.json({
      users: users
        .filter((user) => Boolean(user.username))
        .map((user) => ({
          id: user.id,
          username: user.username ?? "",
          displayName: user.displayName,
        })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
