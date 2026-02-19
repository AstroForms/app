
import type { Metadata } from "next"
import { HomePage } from "@/components/home-page"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

export const metadata: Metadata = {
  title: "AstroForms Startseite",
  description:
    "Entdecke AstroForms: Community-Channels, Social-Posts, Bots und Automatisierungen auf einer Plattform.",
  alternates: { canonical: "/" },
}

export default async function Page() {
  const session = await auth()
  const userId = session?.user?.id || null

  const now = Date.now()
  let userProfile: {
    id: string
    username: string | null
    displayName: string | null
    avatarUrl: string | null
  } | null = null
  let trendingChannels: Array<{
    id: string
    name: string
    boostedUntil: Date | null
    memberCount: number
    createdAt: Date
  }> = []
  let joinedChannels: Array<{ channel: { id: string; name: string; isVerified: boolean } }> = []
  let posts: any[] = []
  let sponsoredChannel: { id: string; name: string } | null = null

  try {
    userProfile = userId
      ? await prisma.profile.findUnique({
          where: { id: userId },
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        })
      : null

    const trendingCandidates = await prisma.channel.findMany({
      where: { isPublic: true },
      take: 100,
      select: {
        id: true,
        name: true,
        boostedUntil: true,
        memberCount: true,
        createdAt: true,
      },
    })

    trendingChannels = trendingCandidates
      .sort((a, b) => {
        const aBoosted = !!a.boostedUntil && a.boostedUntil.getTime() > now
        const bBoosted = !!b.boostedUntil && b.boostedUntil.getTime() > now
        if (aBoosted !== bBoosted) return aBoosted ? -1 : 1

        if (aBoosted && bBoosted) {
          const aBoostTime = a.boostedUntil?.getTime() || 0
          const bBoostTime = b.boostedUntil?.getTime() || 0
          if (aBoostTime !== bBoostTime) return bBoostTime - aBoostTime
        }

        if (a.memberCount !== b.memberCount) {
          return b.memberCount - a.memberCount
        }

        return b.createdAt.getTime() - a.createdAt.getTime()
      })
      .slice(0, 5)

    const activeBoostedChannels = trendingCandidates.filter(
      (channel) => !!channel.boostedUntil && channel.boostedUntil.getTime() > now,
    )
    const activeBoostedChannel =
      activeBoostedChannels.length > 0
        ? activeBoostedChannels[Math.floor(Math.random() * activeBoostedChannels.length)]
        : null

    sponsoredChannel = activeBoostedChannel
      ? { id: activeBoostedChannel.id, name: activeBoostedChannel.name }
      : null

    joinedChannels = userId
      ? await prisma.channelMember.findMany({
          where: { userId },
          include: { channel: true },
        })
      : []

    posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: { select: { id: true, username: true, avatarUrl: true, displayName: true } },
        channel: { select: { id: true, name: true, isVerified: true } },
        parentPost: { include: { user: { select: { username: true } } } },
      },
    })
  } catch (error) {
    console.error("Home page database query failed:", error)
  }

  return (
    <HomePage
      user={
        userProfile
          ? {
              id: userProfile.id,
              username: userProfile.username || "",
              display_name: userProfile.displayName || "",
              avatar_url: userProfile.avatarUrl,
            }
          : null
      }
      trendingChannels={trendingChannels.map((ch) => ({
        id: ch.id,
        name: ch.name,
        post_count: 0,
        is_boosted: !!ch.boostedUntil && ch.boostedUntil.getTime() > now,
      }))}
      joinedChannels={joinedChannels.map((member) => ({
        id: member.channel.id,
        name: member.channel.name,
        is_verified: member.channel.isVerified,
      }))}
      sponsoredChannel={sponsoredChannel}
      posts={posts.map((post) => ({
        id: post.id,
        content: post.content,
        is_automated: post.isAutomated,
        created_at: post.createdAt.toISOString(),
        user_id: post.userId,
        channel_id: post.channelId,
        image_url: post.imageUrl,
        link_url: post.linkUrl,
        link_title: post.linkTitle,
        link_description: post.linkDescription,
        link_image: post.linkImage,
        parent_post_id: post.parentPostId,
        profiles: {
          id: post.user.id,
          username: post.user.username || "",
          avatar_url: post.user.avatarUrl,
          display_name: post.user.displayName || "",
        },
        channels: {
          id: post.channel.id,
          name: post.channel.name,
          is_verified: post.channel.isVerified,
        },
        parent_post: post.parentPost
          ? {
              id: post.parentPost.id,
              content: post.parentPost.content,
              profiles: { username: post.parentPost.user?.username || "" },
            }
          : null,
      }))}
    />
  )
}
