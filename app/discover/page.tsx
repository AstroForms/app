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
  const channelIds = (channels || []).map((c: { id: string }) => c.id)
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

  const now = Date.now()

  // Add real member counts and prioritize:
  // 1) verified channels
  // 2) boosted (advertising) channels
  // 3) all others
  const channelsWithCounts = (channels || [])
    .map((c: { id: string; boosted_until?: string | null; [key: string]: unknown }) => {
      const boostedUntil = typeof c.boosted_until === "string" ? c.boosted_until : null
      const boostedUntilMs = boostedUntil ? new Date(boostedUntil).getTime() : 0
      const isBoosted = boostedUntilMs > now

      return {
        ...c,
        member_count: memberCounts[c.id] || 0,
        is_boosted: isBoosted,
      }
    })
    .sort(
      (
        a: {
          member_count: number
          is_boosted?: boolean
          boosted_until?: string | null
          is_verified?: boolean
        },
        b: {
          member_count: number
          is_boosted?: boolean
          boosted_until?: string | null
          is_verified?: boolean
        },
      ) => {
        const aVerified = !!a.is_verified
        const bVerified = !!b.is_verified
        if (aVerified !== bVerified) return aVerified ? -1 : 1

        const aBoosted = !!a.is_boosted
        const bBoosted = !!b.is_boosted
        if (aBoosted !== bBoosted) return aBoosted ? -1 : 1

        if (aBoosted && bBoosted) {
          const aBoostTime = a.boosted_until ? new Date(a.boosted_until).getTime() : 0
          const bBoostTime = b.boosted_until ? new Date(b.boosted_until).getTime() : 0
          if (aBoostTime !== bBoostTime) return bBoostTime - aBoostTime
        }

        return b.member_count - a.member_count
      },
    )

  const { data: memberships } = await supabase
    .from("channel_members")
    .select("channel_id")
    .eq("user_id", user.id)

  const joinedIds = new Set<string>((memberships || []).map((m: { channel_id: string }) => m.channel_id))

  return (
    <DashboardShell>
      <DiscoverContent channels={channelsWithCounts} joinedIds={joinedIds} userId={user.id} />
    </DashboardShell>
  )
}
