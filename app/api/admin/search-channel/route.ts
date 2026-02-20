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
    const name = url.searchParams.get("name")?.trim() ?? ""
    const parsedLimit = Number(url.searchParams.get("limit"))
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), MAX_LIST_RESULTS)
      : MAX_RESULTS

    const channels = await prisma.channel.findMany({
      where: name
        ? {
            name: {
              contains: name,
            },
          }
        : undefined,
      select: {
        id: true,
        name: true,
        description: true,
        isPublic: true,
        isVerified: true,
        isLocked: true,
        memberCount: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
      take: limit,
    })

    return NextResponse.json({
      channels: channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        description: channel.description,
        isPublic: channel.isPublic,
        isVerified: channel.isVerified,
        isLocked: channel.isLocked,
        memberCount: channel.memberCount,
        createdAt: channel.createdAt.toISOString(),
        ownerId: channel.owner.id,
        ownerUsername: channel.owner.username ?? "",
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
