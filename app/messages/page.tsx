import { createDbServer } from "@/lib/db-server"
import { redirect } from "next/navigation"
import { MessagesContent } from "@/components/messages-content"
import { DashboardShell } from "@/components/dashboard-shell"

export default async function MessagesPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ user?: string }> 
}) {
  const supabase = await createDbServer()
  const params = await searchParams
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect("/auth/login")
  }

  return (
    <DashboardShell>
      <MessagesContent currentUserId={user.id} targetUserId={params.user} />
    </DashboardShell>
  )
}
