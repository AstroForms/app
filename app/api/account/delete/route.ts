import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

const DELETE_CONFIRM_TEXT = "KONTO LOESCHEN"

export async function DELETE(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const confirmation = typeof body?.confirmation === "string" ? body.confirmation.trim().toUpperCase() : ""
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : ""

  if (confirmation !== DELETE_CONFIRM_TEXT) {
    return NextResponse.json({ error: `Bitte gib zur Bestätigung '${DELETE_CONFIRM_TEXT}' ein.` }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      password: true,
      profile: { select: { role: true } },
    },
  })
  if (!user) {
    return NextResponse.json({ error: "User nicht gefunden" }, { status: 404 })
  }

  if (user.profile?.role === "owner") {
    return NextResponse.json({ error: "Owner-Accounts können nicht selbst gelöscht werden." }, { status: 400 })
  }

  if (user.password) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Aktuelles Passwort fehlt." }, { status: 400 })
    }
    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      return NextResponse.json({ error: "Aktuelles Passwort ist falsch." }, { status: 400 })
    }
  }

  await prisma.$transaction(async (tx) => {
    const txWithPromotion = tx as unknown as {
      channelPromotionRequest?: {
        updateMany: (args: { where: { reviewedBy: string }; data: { reviewedBy: null } }) => Promise<unknown>
      }
    }

    if (txWithPromotion.channelPromotionRequest) {
      await txWithPromotion.channelPromotionRequest.updateMany({
        where: { reviewedBy: userId },
        data: { reviewedBy: null },
      })
    }

    await tx.report.updateMany({
      where: { reviewedBy: userId },
      data: { reviewedBy: null },
    })
    await tx.user.delete({
      where: { id: userId },
    })
  })

  return NextResponse.json({ success: true })
}
