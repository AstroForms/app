import { createDbServer } from "@/lib/db-server"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { AdminContent } from "@/components/admin-content"
import { listRecentBans } from "@/lib/bans"

export default async function AdminPage() {
  try {
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

    const reports = await (async () => {
      try {
        const { data } = await supabase
          .from("reports")
          .select("*, profiles!reports_reporter_id_fkey(username)")
          .order("created_at", { ascending: false })
          .limit(50)
        return data || []
      } catch {
        return []
      }
    })()

    const unverifiedChannels = await (async () => {
      try {
        const { data } = await supabase
          .from("channels")
          .select("*, profiles!channels_owner_id_fkey(username)")
          .eq("is_verified", false)
          .order("created_at", { ascending: false })
        return data || []
      } catch {
        return []
      }
    })()

    const unverifiedBots = await (async () => {
      try {
        const { data } = await supabase
          .from("bots")
          .select("*, profiles!bots_owner_id_fkey(username)")
          .eq("is_verified", false)
          .order("created_at", { ascending: false })
        return data || []
      } catch {
        return []
      }
    })()

    const bans = await listRecentBans(50).catch(() => [])
    const promotionRequests: Array<{
      id: string
      channel_id: string
      channel_name: string
      requester_id: string
      requester_username: string
      package_key: string
      package_days: number
      cost: number
      created_at: string
    }> = []

    return (
      <DashboardShell>
        <AdminContent
          reports={reports}
          unverifiedChannels={unverifiedChannels}
          unverifiedBots={unverifiedBots}
          bans={bans}
          promotionRequests={promotionRequests}
          userId={user.id}
        />
      </DashboardShell>
    )
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: unknown }).digest || "")
        : ""

    if (digest.startsWith("NEXT_REDIRECT")) throw error

    return (
      <DashboardShell>
        <div className="max-w-lg mx-auto glass rounded-2xl p-12 text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">Admin vorübergehend nicht verfügbar</h1>
          <p className="text-muted-foreground">Bitte lade die Seite neu. Falls es bleibt, führe die SQL-Migrationen aus.</p>
        </div>
      </DashboardShell>
    )
  }
}
