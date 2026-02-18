"use server"

import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"

// ==========================================
// PROFILE ACTIONS
// ==========================================

export async function getProfile(userId: string) {
  return prisma.profile.findUnique({
    where: { userId },
    include: {
      user: true,
    },
  })
}

export async function getProfileByUsername(username: string) {
  return prisma.profile.findUnique({
    where: { username },
    include: {
      user: true,
    },
  })
}

export async function updateProfile(data: {
  displayName?: string
  bio?: string
  avatarUrl?: string
  bannerUrl?: string
  isPrivate?: boolean
  showFollowers?: boolean
  showLikedPosts?: boolean
}) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.update({
    where: { userId: session.user.id },
    data,
  })

  revalidatePath("/profile")
  return profile
}

// ==========================================
// CHANNEL ACTIONS
// ==========================================

export async function getChannels() {
  return prisma.channel.findMany({
    include: {
      owner: true,
      _count: {
        select: { members: true, posts: true },
      },
    },
    orderBy: { memberCount: "desc" },
  })
}

export async function getChannel(id: string) {
  return prisma.channel.findUnique({
    where: { id },
    include: {
      owner: true,
      members: {
        include: { user: true },
      },
    },
  })
}

export async function createChannel(data: {
  name: string
  description?: string
  iconUrl?: string
}) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found")

  const channel = await prisma.channel.create({
    data: {
      ...data,
      ownerId: profile.id,
    },
  })

  // Add owner as member
  await prisma.channelMember.create({
    data: {
      channelId: channel.id,
      userId: profile.id,
      role: "OWNER",
    },
  })

  revalidatePath("/channels")
  return channel
}

export async function joinChannel(channelId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found")

export async function leaveChannel(channelId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found")

  await prisma.channelMember.delete({
    where: {
      channelId_userId: {
        channelId,
        userId: profile.id,
      },
    },
  })

  await prisma.channel.update({
    where: { id: channelId },
    data: { memberCount: { decrement: 1 } },
  })

  revalidatePath(`/channels/${channelId}`)
}

// ==========================================
// POST ACTIONS
// ==========================================

export async function getPosts(channelId: string) {
  return prisma.post.findMany({
    where: { channelId },
    include: {
      user: true,
      _count: {
        select: { likes: true, comments: true, saves: true },
      },
      parentPost: {
        include: { user: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function createPost(data: {
  content: string
  channelId: string
  imageUrl?: string
  linkUrl?: string
  parentPostId?: string
}) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found")

  const post = await prisma.post.create({
    data: {
      ...data,
      userId: profile.id,
    },
  })

  // Process hashtags
  await processHashtags(post.id, data.content)

  revalidatePath(`/channels/${data.channelId}`)
  return post
}

export async function deletePost(postId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found")

  const post = await prisma.post.findUnique({
    where: { id: postId },
  })

  if (!post || post.userId !== profile.id) {
    throw new Error("Unauthorized")
  }

  await prisma.post.delete({
    where: { id: postId },
  })

  revalidatePath(`/channels/${post.channelId}`)
}

export async function likePost(postId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found")

  await prisma.postLike.create({
    data: {
      postId,
      userId: profile.id,
    },
  })
}

export async function unlikePost(postId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found")

  await prisma.postLike.delete({
    where: {
      postId_userId: {
        postId,
        userId: profile.id,
      },
    },
  })
}

export async function savePost(postId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found")

  await prisma.postSave.create({
    data: {
      postId,
      userId: profile.id,
    },
  })
}

export async function unsavePost(postId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found")

  await prisma.postSave.delete({
    where: {
      postId_userId: {
        postId,
        userId: profile.id,
      },
    },
  })
}

// ==========================================
// COMMENT ACTIONS
// ==========================================

export async function getComments(postId: string) {
  return prisma.postComment.findMany({
    where: { postId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  })
}

export async function createComment(postId: string, content: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found")

  return prisma.postComment.create({
    data: {
      postId,
      userId: profile.id,
      content,
    },
  })
}

// ==========================================
// FOLLOW ACTIONS
// ==========================================

export async function followUser(targetUserId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found")

  const targetProfile = await prisma.profile.findUnique({
    where: { id: targetUserId },
  })
  if (!targetProfile) throw new Error("Target user not found")

  // Check if target has private profile
  if (targetProfile.isPrivate) {
    // Create follow request instead
    await prisma.followRequest.create({
      data: {
        followerId: profile.id,
        followingId: targetUserId,
      },
    })
    return { requested: true }
  }

  await prisma.follow.create({
    data: {
      followerId: profile.id,
      followingId: targetUserId,
    },
  })

  // Update counts
  await prisma.profile.update({
    where: { id: profile.id },
    data: { followingCount: { increment: 1 } },
  })

  await prisma.profile.update({
    where: { id: targetUserId },
    data: { followersCount: { increment: 1 } },
  })

  return { followed: true }
}

export async function unfollowUser(targetUserId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found")

  await prisma.follow.delete({
    where: {
      followerId_followingId: {
        followerId: profile.id,
        followingId: targetUserId,
      },
    },
  })

  // Update counts
  await prisma.profile.update({
    where: { id: profile.id },
    data: { followingCount: { decrement: 1 } },
  })

  await prisma.profile.update({
    where: { id: targetUserId },
    data: { followersCount: { decrement: 1 } },
  })
}

// ==========================================
// HASHTAG ACTIONS
// ==========================================

export async function searchHashtags(query: string, limit = 10) {
  const cleanQuery = query.toLowerCase().replace(/[^a-z0-9_äöüß]/g, "")

  return prisma.hashtag.findMany({
    where: {
      name: {
        startsWith: cleanQuery,
      },
    },
    orderBy: { usageCount: "desc" },
    take: limit,
  })
}

export async function getTopHashtags(limit = 10) {
  return prisma.hashtag.findMany({
    orderBy: { usageCount: "desc" },
    take: limit,
  })
}

async function processHashtags(postId: string, content: string) {
  const hashtagRegex = /#([a-zA-Z0-9_äöüß]+)/g
  const matches = content.match(hashtagRegex)

  if (!matches) return

  const uniqueTags = [...new Set(matches.map((m) => m.slice(1).toLowerCase()))]

  for (const tagName of uniqueTags) {
    if (tagName.length > 0 && tagName.length <= 50) {
      // Get or create hashtag
      let hashtag = await prisma.hashtag.findUnique({
        where: { name: tagName },
      })

      if (!hashtag) {
        hashtag = await prisma.hashtag.create({
          data: { name: tagName },
        })
      }

      // Link to post
      await prisma.postHashtag.create({
        data: {
          postId,
          hashtagId: hashtag.id,
        },
      })

      // Increment usage
      await prisma.hashtag.update({
        where: { id: hashtag.id },
        data: { usageCount: { increment: 1 } },
      })
    }
  }
}

// ==========================================
// BOT ACTIONS
// ==========================================

export async function getBots(userId?: string) {
  const where = userId ? { ownerId: userId } : {}

  return prisma.bot.findMany({
    where,
    include: {
      owner: true,
      _count: {
        select: { channelInvites: true, automations: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getBot(id: string) {
  return prisma.bot.findUnique({
    where: { id },
    include: {
      owner: true,
      automations: true,
      activeRules: true,
      channelInvites: {
        include: { channel: true },
      },
    },
  })
}

export async function createBot(data: {
  name: string
  description?: string
  avatarUrl?: string
  isPublic?: boolean
}) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found")

  const bot = await prisma.bot.create({
    data: {
      ...data,
      ownerId: profile.id,
    },
  })

  revalidatePath("/bots")
  return bot
}

export async function updateBot(
  id: string,
  data: {
    name?: string
    description?: string
    avatarUrl?: string
    bannerUrl?: string
    isActive?: boolean
    isPublic?: boolean
  }
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found")

  const bot = await prisma.bot.findUnique({
    where: { id },
  })

  if (!bot || bot.ownerId !== profile.id) {
    throw new Error("Unauthorized")
  }

  const updated = await prisma.bot.update({
    where: { id },
    data,
  })

  revalidatePath("/bots")
  return updated
}

export async function deleteBot(id: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found")

  const bot = await prisma.bot.findUnique({
    where: { id },
  })

  if (!bot || bot.ownerId !== profile.id) {
    throw new Error("Unauthorized")
  }

  await prisma.bot.delete({
    where: { id },
  })

  revalidatePath("/bots")
}

// ==========================================
// BOT RULES ACTIONS
// ==========================================

export async function toggleBotRule(
  botId: string,
  ruleName: string,
  ruleDescription: string,
  ruleCategory: string
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found")

  const bot = await prisma.bot.findUnique({
    where: { id: botId },
  })

  if (!bot || bot.ownerId !== profile.id) {
    throw new Error("Unauthorized")
  }

  const existingRule = await prisma.botActiveRule.findUnique({
    where: {
      botId_ruleName: {
        botId,
        ruleName,
      },
    },
  })

  if (existingRule) {
    await prisma.botActiveRule.delete({
      where: { id: existingRule.id },
    })
    return { removed: true }
  } else {
    await prisma.botActiveRule.create({
      data: {
        botId,
        ruleName,
        ruleDescription,
        ruleCategory,
      },
    })
    return { added: true }
  }
}

export async function getBotActiveRules(botId: string) {
  return prisma.botActiveRule.findMany({
    where: { botId },
  })
}

// ==========================================
// BOT INVITE ACTIONS
// ==========================================

export async function inviteBotToChannel(botId: string, channelId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found")

  // Check if user owns the channel
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  })

  if (!channel || channel.ownerId !== profile.id) {
    throw new Error("You must be the channel owner to invite bots")
  }

  const invite = await prisma.botChannelInvite.create({
    data: {
      botId,
      channelId,
      invitedBy: profile.id,
    },
  })

  revalidatePath("/bots")
  return invite
}

export async function respondToBotInvite(inviteId: string, accept: boolean) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found")

  const invite = await prisma.botChannelInvite.findUnique({
    where: { id: inviteId },
    include: { bot: true },
  })

  if (!invite || invite.bot.ownerId !== profile.id) {
    throw new Error("Unauthorized")
  }

  await prisma.botChannelInvite.update({
    where: { id: inviteId },
    data: { status: accept ? "ACCEPTED" : "REJECTED" },
  })

  revalidatePath("/bots")
}

// ==========================================
// REPORT ACTIONS
// ==========================================

export async function createReport(data: {
  targetType: "USER" | "POST" | "CHANNEL" | "COMMENT" | "MESSAGE"
  targetId: string
  reason: "SPAM" | "HARASSMENT" | "HATE_SPEECH" | "VIOLENCE" | "INAPPROPRIATE" | "IMPERSONATION" | "MISINFORMATION" | "COPYRIGHT" | "OTHER"
  details?: string
}) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })
  if (!profile) throw new Error("Profile not found")

  return prisma.report.create({
    data: {
      ...data,
      reporterId: profile.id,
    },
  })
}

// ==========================================
// ADMIN ACTIONS
// ==========================================

export async function getAdminStats() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })

  if (!profile || !["ADMIN", "OWNER"].includes(profile.role)) {
    throw new Error("Unauthorized")
  }

  const [userCount, channelCount, postCount, reportCount] = await Promise.all([
    prisma.profile.count(),
    prisma.channel.count(),
    prisma.post.count(),
    prisma.report.count({ where: { status: "PENDING" } }),
  ])

  return {
    userCount,
    channelCount,
    postCount,
    pendingReports: reportCount,
  }
}

export async function getPendingReports() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  })

  if (!profile || !["ADMIN", "OWNER", "MODERATOR"].includes(profile.role)) {
    throw new Error("Unauthorized")
  }

  return prisma.report.findMany({
    where: { status: "PENDING" },
    include: { reporter: true },
    orderBy: { createdAt: "desc" },
  })
}
