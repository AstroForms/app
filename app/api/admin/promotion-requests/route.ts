import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

function getLevelFromXp(totalXp: number) {
  const xp = Math.max(0, Math.floor(totalXp))
  let level = 1
  while (xp >= level * level * 50) {
    level += 1
  }
  return level
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

export async function POST(req: NextRequest) {
  try {
    const { meId, error } = await requireAdmin()
    if (error) return error

    const promotionModel = (prisma as unknown as {
      channelPromotionRequest?: {
        findUnique: (args: {
          where: { id: string }
          select: {
            id: true
            status: true
            requesterId: true
            channelId: true
          }
        }) => Promise<{
          id: string
          status: "PENDING" | "APPROVED" | "REJECTED"
          requesterId: string
          channelId: string
        } | null>
        update: (args: {
          where: { id: string }
          data: {
            status: "REJECTED"
            reviewedBy: string
            reviewedAt: Date
            rejectionReason: string | null
          }
        }) => Promise<unknown>
      }
    }).channelPromotionRequest

    if (!promotionModel) {
      return NextResponse.json(
        { success: false, error: "Promotion-Model nicht verfügbar. Bitte Server neu starten." },
        { status: 503 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : ""
    const action = typeof body?.action === "string" ? body.action.trim().toLowerCase() : ""
    const note = typeof body?.note === "string" ? body.note.trim() : ""

    if (!requestId || (action !== "approve" && action !== "reject")) {
      return NextResponse.json({ success: false, error: "Invalid request payload" }, { status: 400 })
    }

    if (action === "approve") {
      const result = await prisma.$transaction(async (tx) => {
        const txPromotionModel = (tx as unknown as {
          channelPromotionRequest?: {
            findUnique: (args: {
              where: { id: string }
              select: {
                id: true
                status: true
                channelId: true
                requesterId: true
                packageDays: true
                cost: true
                channel: {
                  select: {
                    id: true
                    name: true
                    boostedUntil: true
                  }
                }
              }
            }) => Promise<{
              id: string
              status: "PENDING" | "APPROVED" | "REJECTED"
              channelId: string
              requesterId: string
              packageDays: number
              cost: number
              channel: {
                id: string
                name: string
                boostedUntil: Date | null
              }
            } | null>
            update: (args: {
              where: { id: string }
              data: {
                status: "APPROVED"
                reviewedBy: string
                reviewedAt: Date
                rejectionReason: null
              }
            }) => Promise<unknown>
          }
        }).channelPromotionRequest

        if (!txPromotionModel) {
          throw new Error("Promotion-Model nicht verfügbar. Bitte Server neu starten.")
        }

        const promoRequest = await txPromotionModel.findUnique({
          where: { id: requestId },
          select: {
            id: true,
            status: true,
            channelId: true,
            requesterId: true,
            packageDays: true,
            cost: true,
            channel: {
              select: {
                id: true,
                name: true,
                boostedUntil: true,
              },
            },
          },
        })

        if (!promoRequest) throw new Error("Werbeanfrage nicht gefunden")
        if (promoRequest.status !== "PENDING") {
          throw new Error("Werbeanfrage wurde bereits bearbeitet")
        }

        const requesterProfile = await tx.profile.findUnique({
          where: { id: promoRequest.requesterId },
          select: { xp: true },
        })
        if (!requesterProfile) throw new Error("Profil nicht gefunden")
        if (requesterProfile.xp < promoRequest.cost) {
          throw new Error("Owner hat nicht genug XP für diese Werbeanfrage")
        }

        const newXp = requesterProfile.xp - promoRequest.cost
        const newLevel = getLevelFromXp(newXp)
        await tx.profile.update({
          where: { id: promoRequest.requesterId },
          data: { xp: newXp, level: newLevel },
        })

        const now = new Date()
        const baseDate =
          promoRequest.channel.boostedUntil && promoRequest.channel.boostedUntil.getTime() > now.getTime()
            ? promoRequest.channel.boostedUntil
            : now
        const boostedUntil = new Date(
          baseDate.getTime() + promoRequest.packageDays * 24 * 60 * 60 * 1000,
        )

        await tx.channel.update({
          where: { id: promoRequest.channelId },
          data: { boostedUntil },
        })

        await txPromotionModel.update({
          where: { id: promoRequest.id },
          data: {
            status: "APPROVED",
            reviewedBy: meId!,
            reviewedAt: now,
            rejectionReason: null,
          },
        })

        return {
          requesterId: promoRequest.requesterId,
          channelId: promoRequest.channelId,
          channelName: promoRequest.channel.name,
          boostedUntil,
        }
      })

      await createAuditLog({
        actorId: meId!,
        action: "approve_channel_promotion_request",
        targetUserId: result.requesterId,
        details: `channel=${result.channelId}; until=${result.boostedUntil.toISOString()}`,
      })

      return NextResponse.json({ success: true })
    }

    const promoRequest = await promotionModel.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        requesterId: true,
        channelId: true,
      },
    })

    if (!promoRequest) {
      return NextResponse.json({ success: false, error: "Werbeanfrage nicht gefunden" }, { status: 404 })
    }
    if (promoRequest.status !== "PENDING") {
      return NextResponse.json({ success: false, error: "Werbeanfrage wurde bereits bearbeitet" }, { status: 400 })
    }

    await promotionModel.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        reviewedBy: meId!,
        reviewedAt: new Date(),
        rejectionReason: note || null,
      },
    })

    await createAuditLog({
      actorId: meId!,
      action: "reject_channel_promotion_request",
      targetUserId: promoRequest.requesterId,
      details: `channel=${promoRequest.channelId}; note=${note || "-"}`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process promotion request"
    const status =
      message.includes("nicht gefunden") ||
      message.includes("bereits bearbeitet") ||
      message.includes("nicht genug XP")
        ? 400
        : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
