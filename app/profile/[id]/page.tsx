
import { createDbServer } from "@/lib/db-server"
import { redirect, notFound } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { ProfileContent } from "@/components/profile-content"


export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await createDbServer()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect("/auth/login")

  // Profil laden
  const { data: profile } = await db.from("profiles").eq("id", id).single()
  if (!profile) notFound()

  // Posts des Users
  const { data: posts } = await db.from("posts")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(20)

  // Badges
  const { data: badges } = await db.from("user_badges")
    .eq("user_id", id)

  // Follower Count
  const { count: followerCount } = await db.from("follows")
    .eq("following_id", id)
    .select("*", { count: "exact", head: true })

  // Following Count
  const { count: followingCount } = await db.from("follows")
    .eq("follower_id", id)
    .select("*", { count: "exact", head: true })

  // Is Following
  const { data: isFollowing } = await db.from("follows")
    .eq("follower_id", user.id)
    .eq("following_id", id)
    .maybeSingle()

  // Pending Follow Request
  const { data: pendingRequest } = await db.from("follow_requests")
    .eq("follower_id", user.id)
    .eq("following_id", id)
    .eq("status", "pending")
    .maybeSingle()

  // Following Profiles
  let followingProfiles: Array<{ id: string; username: string; display_name: string; avatar_url: string | null }> = []
  if (profile.show_followers) {
    const { data: followingData } = await db.from("follows")
      .eq("follower_id", id)
      .limit(20)
    followingProfiles = followingData?.map((f: any) => f.profiles).filter(Boolean) as typeof followingProfiles || []
  }

  // Pending Follow Requests (für eigenes Profil, wenn privat)
  let followRequests: Array<{ id: string; follower_id: string; profiles: { id: string; username: string; display_name: string; avatar_url: string | null }; created_at: string }> = []
  if (user.id === id && profile.is_private) {
    const { data: requestsData } = await db.from("follow_requests")
      .eq("following_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50)
    followRequests = (requestsData as typeof followRequests) || []
  }

  return (
    <DashboardShell>
      <ProfileContent
        profile={profile}
        posts={posts || []}
        badges={badges || []}
        followerCount={followerCount || 0}
        followingCount={followingCount || 0}
        isFollowing={!!isFollowing}
        isOwnProfile={user.id === id}
        currentUserId={user.id}
        followingProfiles={followingProfiles}
        hasPendingRequest={!!pendingRequest}
        followRequests={followRequests}
      />
    </DashboardShell>
  )
}
