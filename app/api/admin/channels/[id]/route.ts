import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

type Params = {
  params: Promise<{ id: string }>
}

async function requireAdmin() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return { meId: null, error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) }
  }

  const me = await prisma.profile.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  const hasAdminAccess = me?.role === "admin" || me?.role === "owner"
  if (!hasAdminAccess) {
    return { meId: null, error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) }
  }

  return { meId: userId, error: null }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { meId, error } = await requireAdmin()
    if (error) return error

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const name = typeof body?.name === "string" ? body.name.trim() : ""
    const descriptionRaw = typeof body?.description === "string" ? body.description.trim() : ""
    const isPublic = typeof body?.isPublic === "boolean" ? body.isPublic : null

    if (!name) {
      return NextResponse.json({ success: false, error: "Channel-Name darf nicht leer sein" }, { status: 400 })
    }
    if (name.length > 80) {
      return NextResponse.json({ success: false, error: "Channel-Name darf maximal 80 Zeichen haben" }, { status: 400 })
    }
    if (descriptionRaw.length > 500) {
      return NextResponse.json({ success: false, error: "Beschreibung darf maximal 500 Zeichen haben" }, { status: 400 })
    }
    if (isPublic === null) {
      return NextResponse.json({ success: false, error: "isPublic fehlt" }, { status: 400 })
    }

    const existing = await prisma.channel.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        ownerId: true,
        owner: { select: { username: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ success: false, error: "Channel not found" }, { status: 404 })
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
        isVerified: true,
        memberCount: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    })

    await createAuditLog({
      actorId: meId!,
      action: "edit_channel",
      targetUserId: existing.ownerId,
      details: `channel=${existing.name}(${id}) by @${existing.owner.username || "unknown"}`,
    })

    return NextResponse.json({
      success: true,
      channel: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        isPublic: updated.isPublic,
        isVerified: updated.isVerified,
        memberCount: updated.memberCount,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        ownerId: updated.owner.id,
        ownerUsername: updated.owner.username ?? "",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Edit channel failed"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { meId, error } = await requireAdmin()
    if (error) return error

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const confirmation = typeof body?.confirmation === "string" ? body.confirmation.trim() : ""

    const target = await prisma.channel.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        ownerId: true,
        owner: { select: { username: true } },
      },
    })

    if (!target) {
      return NextResponse.json({ success: false, error: "Channel not found" }, { status: 404 })
    }

    if (!confirmation || confirmation !== target.name.trim()) {
      return NextResponse.json(
        { success: false, error: "Bestaetigung stimmt nicht mit dem Channel-Namen ueberein" },
        { status: 400 },
      )
    }

    await prisma.channel.delete({
      where: { id },
    })

    await createAuditLog({
      actorId: meId!,
      action: "delete_channel",
      targetUserId: target.ownerId,
      details: `channel=${target.name}(${id}) by @${target.owner.username || "unknown"}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete channel failed"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
