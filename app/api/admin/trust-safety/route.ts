import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ensureBansTable } from "@/lib/bans"

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

export async function GET() {
  try {
    const { error } = await requireAdmin()
    if (error) return error

    await ensureBansTable()

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [pendingReports, newReports24h, activeBans, reports7d, bans7d, topReasons] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS count
        FROM \`reports\`
        WHERE LOWER(\`status\`) = 'pending'
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS count
        FROM \`reports\`
        WHERE \`created_at\` >= ${since24h}
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS count
        FROM \`bans\`
        WHERE \`banned_until\` IS NULL OR \`banned_until\` > NOW()
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS count
        FROM \`reports\`
        WHERE \`created_at\` >= ${since7d}
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS count
        FROM \`bans\`
        WHERE \`created_at\` >= ${since7d}
      `,
      prisma.$queryRaw<Array<{ reason: string; count: bigint }>>`
        SELECT \`reason\`, COUNT(*) AS count
        FROM \`reports\`
        WHERE \`created_at\` >= ${since7d}
        GROUP BY \`reason\`
        ORDER BY COUNT(*) DESC
        LIMIT 5
      `,
    ])

    const reportCount7d = Number(reports7d[0]?.count || 0)
    const banCount7d = Number(bans7d[0]?.count || 0)
    const banRate = reportCount7d > 0 ? Number(((banCount7d / reportCount7d) * 100).toFixed(2)) : 0

    return NextResponse.json({
      kpis: {
        pendingReports: Number(pendingReports[0]?.count || 0),
        newReports24h: Number(newReports24h[0]?.count || 0),
        activeBans: Number(activeBans[0]?.count || 0),
        banRate7d: banRate,
        topReasons: topReasons.map((entry) => ({
          reason: entry.reason,
          count: Number(entry.count || 0),
        })),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load trust safety data"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
