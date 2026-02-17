import { createDbServer } from "@/lib/db-server"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { SettingsContent } from "@/components/settings-content"

export default async function SettingsPage() {
  const supabase = await createDbServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return (
    <DashboardShell>
      <SettingsContent profile={profile} />
    </DashboardShell>
  )
}
