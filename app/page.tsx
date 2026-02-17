
import { HomePage } from "@/components/home-page"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

export default async function Page() {
  const session = await auth()
  const userId = session?.user?.id || null

  const userProfile = userId
    ? await prisma.profile.findUnique({
        where: { id: userId },
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      })
    : null

  const trendingChannels = await prisma.channel.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, name: true },
  })

  const joinedChannels = userId
    ? await prisma.channelMember.findMany({
        where: { userId },
        include: { channel: true },
      })
    : []

  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      user: { select: { id: true, username: true, avatarUrl: true, displayName: true } },
      channel: { select: { id: true, name: true, isVerified: true } },
      parentPost: { include: { user: { select: { username: true } } } },
    },
  })

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
      trendingChannels={trendingChannels.map((ch) => ({ id: ch.id, name: ch.name, post_count: 0 }))}
      joinedChannels={joinedChannels.map((member) => ({
        id: member.channel.id,
        name: member.channel.name,
        is_verified: member.channel.isVerified,
      }))}
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
