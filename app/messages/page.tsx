import { createDbServer } from "@/lib/db-server"
import { redirect } from "next/navigation"
import { MessagesContent } from "@/components/messages-content"
import { DashboardShell } from "@/components/dashboard-shell"
import { FeatureDisabledNotice } from "@/components/feature-disabled-notice"
import { isFeatureEnabled } from "@/lib/features"

export default async function MessagesPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ user?: string }> 
}) {
  try {
    const supabase = await createDbServer()
    const params = await searchParams
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      redirect("/auth/login")
    }

    const messagesEnabled = await isFeatureEnabled("messages")
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
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: unknown }).digest || "")
        : ""
    if (digest.startsWith("NEXT_REDIRECT")) throw error

    return (
      <DashboardShell>
        <div className="max-w-lg mx-auto glass rounded-2xl p-12 text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">Nachrichten vorübergehend nicht verfügbar</h1>
          <p className="text-muted-foreground">Bitte lade die Seite neu.</p>
        </div>
      </DashboardShell>
    )
  }
}
