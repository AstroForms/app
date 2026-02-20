import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { randomUUID } from "crypto"

const PROMOTE_PACKAGES: Record<string, { cost: number; days: number }> = {
  day: { cost: 300, days: 1 },
  week: { cost: 1000, days: 7 },
  month: { cost: 3500, days: 30 },
}

function pickString(body: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = body[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

function getLevelFromXp(totalXp: number) {
  const xp = Math.max(0, Math.floor(totalXp))
  let level = 1
  while (xp >= level * level * 50) {
    level += 1
  }
  return level
}

async function getDmPermissionState(senderId: string, recipientId: string) {
  if (!senderId || !recipientId || senderId === recipientId) {
    return { allowed: false, reason: "invalid_users" as const }
  }

  const blockedRelation = await prisma.blockedUser.findFirst({
    where: {
      OR: [
        { blockerId: senderId, blockedId: recipientId },
        { blockerId: recipientId, blockedId: senderId },
      ],
    },
    select: { id: true },
  })
  if (blockedRelation) {
    return { allowed: false, reason: "blocked" as const }
  }

  const recipient = await prisma.profile.findUnique({
    where: { id: recipientId },
    select: { dmPrivacy: true },
  })
  if (!recipient) {
    return { allowed: false, reason: "recipient_not_found" as const }
  }

  if (recipient.dmPrivacy === "EVERYONE") {
    return { allowed: true, reason: "allowed" as const }
  }
  if (recipient.dmPrivacy === "NOBODY") {
    return { allowed: false, reason: "privacy" as const }
  }
  if (recipient.dmPrivacy === "FOLLOWERS") {
    const follows = await prisma.follow.findFirst({
      where: { followerId: senderId, followingId: recipientId },
      select: { id: true },
    })
    return { allowed: Boolean(follows), reason: follows ? ("allowed" as const) : ("privacy" as const) }
  }

  const acceptedRequest = await prisma.dmRequest.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { senderId, recipientId },
        { senderId: recipientId, recipientId: senderId },
      ],
    },
    select: { id: true },
  })
  return {
    allowed: Boolean(acceptedRequest),
    reason: acceptedRequest ? ("allowed" as const) : ("request_required" as const),
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name } = await params
  const body = await req.json().catch(() => ({}))

  if (name === "add_xp") {
    const userId = body.p_user_id as string
    const amount = Number(body.p_amount || 0)
    if (userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const profile = await prisma.profile.findUnique({ where: { id: userId } })
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    const newXp = profile.xp + amount
    const newLevel = getLevelFromXp(newXp)
    await prisma.profile.update({
      where: { id: userId },
      data: { xp: newXp, level: newLevel },
    })
    return NextResponse.json({ data: { xp: newXp, level: newLevel } })
  }

  if (name === "promote_channel") {
    const userId = pickString(body, ["p_user_id"])
    const channelId = pickString(body, ["p_channel_id"])
    const packageKey = pickString(body, ["p_package"]).toLowerCase()
    const packageConfig = PROMOTE_PACKAGES[packageKey]

    if (!userId || !channelId || !packageConfig) {
      return NextResponse.json({ error: "Invalid promote request" }, { status: 400 })
    }
    if (userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const channel = await tx.channel.findUnique({
          where: { id: channelId },
          select: { ownerId: true, boostedUntil: true },
        })
        if (!channel) throw new Error("Channel not found")
        if (channel.ownerId !== userId) throw new Error("Only owner can promote this channel")

        const profile = await tx.profile.findUnique({
          where: { id: userId },
          select: { xp: true },
        })
        if (!profile) throw new Error("Profile not found")
        if (profile.xp < packageConfig.cost) throw new Error("Not enough XP")

        const promotionModel = (tx as unknown as {
          channelPromotionRequest?: {
            findFirst: (args: {
              where: { channelId: string; status: "PENDING" }
            }) => Promise<{ id: string } | null>
            create: (args: {
              data: {
                channelId: string
                requesterId: string
                packageKey: string
                packageDays: number
                cost: number
                status: "PENDING"
              }
            }) => Promise<{ id: string; status: string }>
          }
        }).channelPromotionRequest

        if (!promotionModel) {
          throw new Error("Promotion-Model nicht verfügbar. Bitte Server neu starten.")
        }

        const existingPendingRequest = await promotionModel.findFirst({
          where: {
            channelId,
            status: "PENDING",
          },
        })
        if (existingPendingRequest) {
          throw new Error("Es gibt bereits eine offene Werbeanfrage")
        }

        const request = await promotionModel.create({
          data: {
            channelId,
            requesterId: userId,
            packageKey,
            packageDays: packageConfig.days,
            cost: packageConfig.cost,
            status: "PENDING",
          },
        })

        return {
          request_id: request.id,
          status: request.status,
          xp: profile.xp,
          boosted_until: channel.boostedUntil ? channel.boostedUntil.toISOString() : null,
        }
      })

      return NextResponse.json({ data: result })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Promote channel failed"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  if (name === "search_hashtags") {
    const query = String(body.p_query || "").toLowerCase()
    const hashtags = await prisma.hashtag.findMany({
      where: { name: { contains: query } },
      orderBy: { usageCount: "desc" },
      take: 10,
    })
    return NextResponse.json({ data: hashtags.map((h) => ({ name: h.name })) })
  }

  if (name === "block_user") {
    const blockerId = body.p_blocker_id as string
    const blockedId = body.p_blocked_id as string
    if (!blockerId || !blockedId) {
      return NextResponse.json({ error: "Missing block users" }, { status: 400 })
    }
    if (blockerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (blockerId === blockedId) {
      return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 })
    }
    await prisma.blockedUser.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId, reason: (body.p_reason as string) || null },
      update: { reason: (body.p_reason as string) || null },
    })

    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: blockerId, followingId: blockedId },
          { followerId: blockedId, followingId: blockerId },
        ],
      },
    })

    await prisma.dmRequest.deleteMany({
      where: {
        OR: [
          { senderId: blockerId, recipientId: blockedId },
          { senderId: blockedId, recipientId: blockerId },
        ],
      },
    })
    return NextResponse.json({ data: true })
  }

  if (name === "unblock_user") {
    const blockerId = body.p_blocker_id as string
    const blockedId = body.p_blocked_id as string
    if (!blockerId || !blockedId) {
      return NextResponse.json({ error: "Missing unblock users" }, { status: 400 })
    }
    if (blockerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    await prisma.blockedUser.deleteMany({ where: { blockerId, blockedId } })
    return NextResponse.json({ data: true })
  }

  if (name === "is_blocked") {
    const currentUserId = pickString(body, ["p_current_user_id"])
    const otherUserId = pickString(body, ["p_other_user_id"])
    if (!currentUserId || !otherUserId) {
      return NextResponse.json({ error: "Missing users" }, { status: 400 })
    }
    if (currentUserId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [blockedByMe, blockedMe] = await Promise.all([
      prisma.blockedUser.findFirst({
        where: { blockerId: currentUserId, blockedId: otherUserId },
        select: { id: true },
      }),
      prisma.blockedUser.findFirst({
        where: { blockerId: otherUserId, blockedId: currentUserId },
        select: { id: true },
      }),
    ])

    return NextResponse.json({
      data: { blocked_by_me: Boolean(blockedByMe), blocked_me: Boolean(blockedMe) },
    })
  }

  if (name === "can_send_dm") {
    const senderId = pickString(body, ["p_sender_id", "p_from_user_id"])
    const recipientId = pickString(body, ["p_receiver_id", "p_to_user_id"])
    if (!senderId || !recipientId) {
      return NextResponse.json({ error: "Missing DM participants" }, { status: 400 })
    }
    if (senderId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const permission = await getDmPermissionState(senderId, recipientId)
    return NextResponse.json({ data: permission.allowed })
  }

  if (name === "send_dm_request") {
    const senderId = pickString(body, ["p_sender_id", "p_from_user_id"])
    const recipientId = pickString(body, ["p_recipient_id", "p_to_user_id"])
    const messagePreview = body.p_message_preview as string | undefined
    if (!senderId || !recipientId) {
      return NextResponse.json({ error: "Missing DM request users" }, { status: 400 })
    }
    if (senderId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const permission = await getDmPermissionState(senderId, recipientId)
    if (permission.reason === "blocked") {
      return NextResponse.json({ error: "User is blocked" }, { status: 403 })
    }
    const recipient = await prisma.profile.findUnique({
      where: { id: recipientId },
      select: { dmPrivacy: true },
    })
    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 })
    }
    if (recipient.dmPrivacy !== "REQUEST") {
      return NextResponse.json({ error: "DM requests are not allowed for this user" }, { status: 400 })
    }
    await prisma.dmRequest.upsert({
      where: { senderId_recipientId: { senderId, recipientId } },
      create: { senderId, recipientId, messagePreview: messagePreview || null, status: "PENDING" },
      update: { messagePreview: messagePreview || null, status: "PENDING" },
    })
    return NextResponse.json({ data: true })
  }

  if (name === "get_or_create_dm_conversation") {
    const userA = pickString(body, ["p_user_id", "p_user1_id"])
    const userB = pickString(body, ["p_target_id", "p_user2_id"])
    if (!userA || !userB) {
      return NextResponse.json({ error: "Missing conversation users" }, { status: 400 })
    }
    if (userA !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (userA === userB) {
      return NextResponse.json({ error: "Cannot create self conversation" }, { status: 400 })
    }
    const permission = await getDmPermissionState(userA, userB)
    if (!permission.allowed) {
      const status = permission.reason === "blocked" ? 403 : 400
      return NextResponse.json({ error: "Conversation not allowed" }, { status })
    }

    const existing = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { participants: { some: { userId: userA } } },
          { participants: { some: { userId: userB } } },
        ],
        participants: {
          every: { userId: { in: [userA, userB] } },
        },
      },
    })
    if (existing) {
      if (!existing.encryptionKeyId) {
        await prisma.conversation.update({
          where: { id: existing.id },
          data: { encryptionKeyId: randomUUID() },
        })
      }
      return NextResponse.json({ data: existing.id })
    }
    const convo = await prisma.conversation.create({ data: { encryptionKeyId: randomUUID() } })
    await prisma.conversationParticipant.createMany({
      data: [
        { conversationId: convo.id, userId: userA },
        { conversationId: convo.id, userId: userB },
      ],
    })
    return NextResponse.json({ data: convo.id })
  }

  if (name === "accept_dm_request") {
    const requestId = body.p_request_id as string
    const existingRequest = await prisma.dmRequest.findUnique({
      where: { id: requestId },
      select: { senderId: true, recipientId: true },
    })
    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }
    if (existingRequest.recipientId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const permission = await getDmPermissionState(existingRequest.senderId, existingRequest.recipientId)
    if (!permission.allowed) {
      return NextResponse.json({ error: "Conversation not allowed" }, { status: 403 })
    }
    const request = await prisma.dmRequest.update({
      where: { id: requestId },
      data: { status: "ACCEPTED" },
      select: { senderId: true, recipientId: true },
    })

    const existing = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { participants: { some: { userId: request.senderId } } },
          { participants: { some: { userId: request.recipientId } } },
        ],
        participants: {
          every: { userId: { in: [request.senderId, request.recipientId] } },
        },
      },
      select: { id: true, encryptionKeyId: true },
    })

    if (!existing) {
      const convo = await prisma.conversation.create({ data: { encryptionKeyId: randomUUID() } })
      await prisma.conversationParticipant.createMany({
        data: [
          { conversationId: convo.id, userId: request.senderId },
          { conversationId: convo.id, userId: request.recipientId },
        ],
      })
    } else if (!existing.encryptionKeyId) {
      await prisma.conversation.update({
        where: { id: existing.id },
        data: { encryptionKeyId: randomUUID() },
      })
    }

    return NextResponse.json({ data: true })
  }

  if (name === "decline_dm_request") {
    const requestId = body.p_request_id as string
    const request = await prisma.dmRequest.findUnique({
      where: { id: requestId },
      select: { recipientId: true },
    })
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }
    if (request.recipientId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    await prisma.dmRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED" },
    })
    return NextResponse.json({ data: true })
  }

  return NextResponse.json({ error: "Unknown RPC" }, { status: 400 })
}
