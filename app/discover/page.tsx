import { createDbServer } from "@/lib/db-server"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { DiscoverContent } from "@/components/discover-content"

export default async function DiscoverPage() {
  const supabase = await createDbServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: channels } = await supabase
    .from("channels")
    .select("*")
    .eq("is_public", true)
    .limit(50)

  // Get actual member counts
  const channelIds = channels?.map(c => c.id) || []
  const memberCounts: Record<string, number> = {}
  
  if (channelIds.length > 0) {
    for (const channelId of channelIds) {
      const { count } = await supabase
        .from("channel_members")
        .select("*", { count: "exact", head: true })
        .eq("channel_id", channelId)
      memberCounts[channelId] = count || 0
    }
  }

  // Add real member counts to channels
  const channelsWithCounts = channels?.map(c => ({
    ...c,
    member_count: memberCounts[c.id] || 0
  })).sort((a, b) => b.member_count - a.member_count) || []

  const { data: memberships } = await supabase
    .from("channel_members")
    .select("channel_id")
    .eq("user_id", user.id)

  const joinedIds = new Set(memberships?.map(m => m.channel_id) || [])

  return (
    <DashboardShell>
      <DiscoverContent channels={channelsWithCounts} joinedIds={joinedIds} userId={user.id} />
    </DashboardShell>
  )
}
