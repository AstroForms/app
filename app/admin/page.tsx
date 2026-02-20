import { createDbServer } from "@/lib/db-server"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { AdminContent } from "@/components/admin-content"
import { prisma } from "@/lib/db"

export default async function AdminPage() {
  const supabase = await createDbServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const hasAdminAccess = profile?.role === "admin" || profile?.role === "owner"

  if (!hasAdminAccess) {
    return (
      <DashboardShell>
        <div className="max-w-lg mx-auto glass rounded-2xl p-12 text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">Kein Zugriff</h1>
          <p className="text-muted-foreground">Du benötigst Admin-Rechte für diesen Bereich.</p>
        </div>
      </DashboardShell>
    )
  }

  const { data: reports } = await supabase
    .from("reports")
    .select("*, profiles!reports_reporter_id_fkey(username)")
    .order("created_at", { ascending: false })
    .limit(50)

  const { data: unverifiedChannels } = await supabase
    .from("channels")
    .select("*, profiles!channels_owner_id_fkey(username)")
    .eq("is_verified", false)
    .order("created_at", { ascending: false })

  const { data: unverifiedBots } = await supabase
    .from("bots")
    .select("*, profiles!bots_owner_id_fkey(username)")
    .eq("is_verified", false)
    .order("created_at", { ascending: false })

  const { data: bans } = await supabase
    .from("bans")
    .select("*, profiles!bans_user_id_fkey(username)")
    .order("created_at", { ascending: false })
    .limit(50)

  const promotionModel = (prisma as unknown as {
    channelPromotionRequest?: {
      findMany: (args: {
        where: { status: "PENDING" }
        orderBy: { createdAt: "asc" }
        take: number
        include: {
          channel: { select: { id: true; name: true } }
          requester: { select: { id: true; username: true } }
        }
      }) => Promise<
        Array<{
          id: string
          channelId: string
          requesterId: string
          packageKey: string
          packageDays: number
          cost: number
          createdAt: Date
          channel: { id: string; name: string }
          requester: { id: string; username: string | null }
        }>
      >
    }
  }).channelPromotionRequest

  const promotionRequests = promotionModel
    ? await promotionModel.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: 100,
        include: {
          channel: { select: { id: true, name: true } },
          requester: { select: { id: true, username: true } },
        },
      })
    : []

  return (
    <DashboardShell>
      <AdminContent
        reports={reports || []}
        unverifiedChannels={unverifiedChannels || []}
        unverifiedBots={unverifiedBots || []}
        bans={bans || []}
        promotionRequests={promotionRequests.map((request) => ({
          id: request.id,
          channel_id: request.channelId,
          channel_name: request.channel.name,
          requester_id: request.requesterId,
          requester_username: request.requester.username || "unknown",
          package_key: request.packageKey,
          package_days: request.packageDays,
          cost: request.cost,
          created_at: request.createdAt.toISOString(),
        }))}
        userId={user.id}
      />
    </DashboardShell>
  )
}
