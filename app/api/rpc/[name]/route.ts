import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

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
    const newLevel = 1 + Math.floor(newXp / 100)
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
    return NextResponse.json({ data: true })
  }

  if (name === "send_dm_request") {
    const senderId = body.p_sender_id as string
    const recipientId = body.p_recipient_id as string
    const messagePreview = body.p_message_preview as string | undefined
    await prisma.dmRequest.create({
      data: { senderId, recipientId, messagePreview: messagePreview || null },
    })
    return NextResponse.json({ data: true })
  }

  if (name === "get_or_create_dm_conversation") {
    const userA = body.p_user_id as string
    const userB = body.p_target_id as string
    const existing = await prisma.conversation.findFirst({
      where: {
        participants: {
          every: { userId: { in: [userA, userB] } },
        },
      },
    })
    if (existing) {
      return NextResponse.json({ data: existing.id })
    }
    const convo = await prisma.conversation.create({ data: {} })
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
    await prisma.dmRequest.update({
      where: { id: requestId },
      data: { status: "ACCEPTED" },
    })
    return NextResponse.json({ data: true })
  }

  return NextResponse.json({ error: "Unknown RPC" }, { status: 400 })
}
