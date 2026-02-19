import { createDbServer } from "@/lib/db-server"
import { redirect, notFound } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { ChannelDetail } from "@/components/channel-detail"
import { prisma } from "@/lib/db"
import { ensureBotInfrastructure } from "@/lib/bot-infrastructure"

export default async function ChannelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createDbServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: channel } = await supabase
    .from("channels")
    .select("*")
    .eq("id", id)
    .single()

  if (!channel) notFound()

  const { data: membership } = await supabase
    .from("channel_members")
    .select("*")
    .eq("channel_id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  const { data: posts } = await supabase
    .from("posts")
    .select("*, profiles(id, username, avatar_url, display_name), parent_post:posts!parent_post_id(id, content, profiles(username))")
    .eq("channel_id", id)
    .order("created_at", { ascending: false })
    .limit(50)

  const { data: members } = await supabase
    .from("channel_members")
    .select("*, profiles(id, username, avatar_url, display_name)")
    .eq("channel_id", id)
    .limit(20)

  const promotionModel = (prisma as unknown as {
    channelPromotionRequest?: {
      findFirst: (args: {
        where: { channelId: string; status: "PENDING" }
        select: { id: true }
      }) => Promise<{ id: string } | null>
    }
  }).channelPromotionRequest

  const pendingPromotionRequest = promotionModel
    ? await promotionModel.findFirst({
        where: {
          channelId: id,
          status: "PENDING",
        },
        select: { id: true },
      })
    : null

  await ensureBotInfrastructure()

  const botInvites = await prisma.botChannelInvite.findMany({
    where: { channelId: id, status: "ACCEPTED" },
    include: { bot: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  const botMembers = botInvites
    .filter((invite) => invite.bot)
    .map((invite) => ({
      user_id: invite.bot!.id,
      role: "bot",
      profiles: {
        id: invite.bot!.id,
        username: invite.bot!.name,
        avatar_url: invite.bot!.avatarUrl,
        display_name: invite.bot!.name,
      },
    }))

  return (
    <DashboardShell>
      <ChannelDetail
        channel={{
          ...(channel as Record<string, unknown>),
          has_pending_promotion_request: !!pendingPromotionRequest,
        } as {
          id: string
          name: string
          description: string | null
          owner_id: string
          is_verified: boolean
          member_count: number
          icon_url: string | null
          banner_url: string | null
          boosted_until?: string | null
          has_pending_promotion_request?: boolean
        }}
        posts={posts || []}
        members={[...(members || []), ...botMembers]}
        membership={membership}
        userId={user.id}
      />
    </DashboardShell>
  )
}
