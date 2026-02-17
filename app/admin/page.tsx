import { createDbServer } from "@/lib/db-server"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { AdminContent } from "@/components/admin-content"

export default async function AdminPage() {
  const supabase = await createDbServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    return (
      <DashboardShell>
        <div className="max-w-lg mx-auto glass rounded-2xl p-12 text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">Kein Zugriff</h1>
          <p className="text-muted-foreground">Du benoetigst Admin-Rechte fuer diesen Bereich.</p>
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

  return (
    <DashboardShell>
      <AdminContent
        reports={reports || []}
        unverifiedChannels={unverifiedChannels || []}
        unverifiedBots={unverifiedBots || []}
        bans={bans || []}
        userId={user.id}
      />
    </DashboardShell>
  )
}
