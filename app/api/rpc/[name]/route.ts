import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { randomUUID } from "crypto"

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
    await prisma.blockedUser.create({
      data: { blockerId, blockedId, reason: body.p_reason || null },
    })
    return NextResponse.json({ data: true })
  }

  if (name === "unblock_user") {
    const blockerId = body.p_blocker_id as string
    const blockedId = body.p_blocked_id as string
    await prisma.blockedUser.deleteMany({ where: { blockerId, blockedId } })
    return NextResponse.json({ data: true })
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
    return NextResponse.json({ data: true })
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
