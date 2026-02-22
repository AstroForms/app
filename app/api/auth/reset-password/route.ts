export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { consumePasswordResetToken } from "@/lib/password-reset"
import { sendPasswordChangedMail } from "@/lib/mail"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const token = typeof body?.token === "string" ? body.token : ""
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : ""

    if (!token || !newPassword) {
      return NextResponse.json({ error: "Token und neues Passwort sind erforderlich." }, { status: 400 })
    }

    if (newPassword.length < 10) {
      return NextResponse.json({ error: "Das neue Passwort muss mindestens 10 Zeichen haben." }, { status: 400 })
    }

    const consumed = await consumePasswordResetToken(token)
    if (!consumed.ok) {
      const message = consumed.reason === "expired" ? "Der Link ist abgelaufen." : "Ungültiger Link."
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: consumed.email },
      select: { id: true, email: true, name: true },
    })

    if (!user?.id || !user.email) {
      return NextResponse.json({ error: "Konto nicht gefunden." }, { status: 404 })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      })

      await tx.session.deleteMany({
        where: { userId: user.id },
      })
    })

    await sendPasswordChangedMail({
      email: user.email,
      name: user.name,
    }).catch((error) => {
      console.error("[mail] password changed notice failed", error)
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[auth] reset password failed", error)
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 })
  }
}
