import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("q") || "").trim()
  const limitParam = Number(req.nextUrl.searchParams.get("limit") || "6")
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 20) : 6

  if (query.length < 2) {
    return NextResponse.json({ profiles: [] })
  }

  const profiles = await prisma.profile.findMany({
    where: {
      username: {
        contains: query,
      },
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
    orderBy: { username: "asc" },
    take: limit,
  })

  return NextResponse.json({
    profiles: profiles
      .filter((p) => Boolean(p.username))
      .map((p) => ({
        id: p.id,
        username: p.username || "",
        display_name: p.displayName || "",
        avatar_url: p.avatarUrl,
      })),
  })
}
