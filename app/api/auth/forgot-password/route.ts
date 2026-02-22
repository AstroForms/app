export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { normalizeEmail, removeExpiredVerificationTokens } from "@/lib/email-verification"
import { createPasswordResetToken } from "@/lib/password-reset"
import { sendPasswordResetMail } from "@/lib/mail"

const GENERIC_RESPONSE = {
  ok: true,
  message: "Wenn ein Konto mit dieser E-Mail existiert, wurde eine Nachricht versendet.",
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const rawEmail = typeof body?.email === "string" ? body.email : ""
    if (!rawEmail) {
      return NextResponse.json(GENERIC_RESPONSE)
    }

    const email = normalizeEmail(rawEmail)
    await removeExpiredVerificationTokens()

    const user = await prisma.user.findUnique({
      where: { email },
      select: { email: true, name: true },
    })

    if (!user?.email) {
      return NextResponse.json(GENERIC_RESPONSE)
    }

    const token = await createPasswordResetToken(user.email)
    await sendPasswordResetMail({
      email: user.email,
      name: user.name,
      token,
    })

    return NextResponse.json(GENERIC_RESPONSE)
  } catch (error) {
    console.error("[auth] forgot password failed", error)
    return NextResponse.json(GENERIC_RESPONSE)
  }
}
