import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

type Params = {
  params: Promise<{ id: string }>
}

async function requireOwner(channelId: string) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return {
      userId: null,
      channel: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, ownerId: true, name: true },
  })
  if (!channel) {
    return {
      userId,
      channel: null,
      response: NextResponse.json({ error: "Channel nicht gefunden" }, { status: 404 }),
    }
  }
  if (channel.ownerId !== userId) {
    return {
      userId,
      channel: null,
      response: NextResponse.json({ error: "Nur der Owner darf das" }, { status: 403 }),
    }
  }

  return { userId, channel, response: null }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const ownerCheck = await requireOwner(id)
  if (ownerCheck.response) return ownerCheck.response

  const body = await req.json().catch(() => ({}))
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const descriptionRaw = typeof body?.description === "string" ? body.description.trim() : ""
  const isPublic = Boolean(body?.isPublic)

  if (!name) {
    return NextResponse.json({ error: "Channel-Name darf nicht leer sein" }, { status: 400 })
  }
  if (name.length > 80) {
    return NextResponse.json({ error: "Channel-Name darf maximal 80 Zeichen haben" }, { status: 400 })
  }
  if (descriptionRaw.length > 500) {
    return NextResponse.json({ error: "Beschreibung darf maximal 500 Zeichen haben" }, { status: 400 })
  }

  const updated = await prisma.channel.update({
    where: { id },
    data: {
      name,
      description: descriptionRaw || null,
      isPublic,
    },
    select: {
      id: true,
      name: true,
      description: true,
      isPublic: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({
    success: true,
    channel: {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      is_public: updated.isPublic,
      updated_at: updated.updatedAt.toISOString(),
    },
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  const ownerCheck = await requireOwner(id)
  if (ownerCheck.response) return ownerCheck.response

  const body = await req.json().catch(() => ({}))
  const confirmation = typeof body?.confirmation === "string" ? body.confirmation.trim() : ""
  const expected = ownerCheck.channel?.name?.trim() || ""

  if (!confirmation || confirmation !== expected) {
    return NextResponse.json({ error: "Bestätigung stimmt nicht mit dem Channel-Namen überein" }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.channelMember.deleteMany({
      where: { channelId: id },
    })

    await tx.channel.delete({
      where: { id },
    })
  })

  return NextResponse.json({ success: true })
}
