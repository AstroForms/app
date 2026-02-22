import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendPasswordChangedMail } from "@/lib/mail"

export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : ""
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : ""

  if (!newPassword || newPassword.length < 10) {
    return NextResponse.json({ error: "Neues Passwort muss mindestens 10 Zeichen haben." }, { status: 400 })
  }
  if (newPassword.length > 128) {
    return NextResponse.json({ error: "Neues Passwort ist zu lang." }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, email: true, name: true },
  })
  if (!user) {
    return NextResponse.json({ error: "User nicht gefunden." }, { status: 404 })
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

  const hashedPassword = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  })

  if (user.email) {
    await sendPasswordChangedMail({
      email: user.email,
      name: user.name,
    }).catch((error) => {
      console.error("[mail] password changed notice failed", error)
    })
  }

  return NextResponse.json({ success: true })
}
