import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

const MAX_RESULTS = 10
const MAX_LIST_RESULTS = 100

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

    const url = new URL(req.url)
    const username = url.searchParams.get("username")?.trim() ?? ""
    const parsedLimit = Number(url.searchParams.get("limit"))
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), MAX_LIST_RESULTS)
      : MAX_RESULTS

    const users = await prisma.profile.findMany({
      where: username
        ? {
            username: {
              contains: username,
            },
          }
        : undefined,
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
      },
      orderBy: {
        username: "asc",
      },
      take: limit,
    })

    return NextResponse.json({
      users: users
        .filter((user) => Boolean(user.username))
        .map((user) => ({
          id: user.id,
          username: user.username ?? "",
          displayName: user.displayName,
          role: user.role,
        })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
