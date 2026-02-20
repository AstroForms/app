import { createDbServer } from "@/lib/db-server"
import { redirect } from "next/navigation"
import { MessagesContent } from "@/components/messages-content"
import { DashboardShell } from "@/components/dashboard-shell"
import { FeatureDisabledNotice } from "@/components/feature-disabled-notice"
import { isFeatureEnabled } from "@/lib/features"

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>
}) {
  const supabase = await createDbServer()
  const params = await searchParams

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const messagesEnabled = await isFeatureEnabled("messages").catch(() => true)
  if (!messagesEnabled) {
    return (
      <DashboardShell>
        <FeatureDisabledNotice
          title="Nachrichten sind deaktiviert"
          description="Diese Funktion wurde von der Administration deaktiviert und kann aktuell nicht verwendet werden."
        />
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <MessagesContent currentUserId={user.id} targetUserId={params.user} />
    </DashboardShell>
  )
}
