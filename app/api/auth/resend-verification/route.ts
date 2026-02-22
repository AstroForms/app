export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createEmailVerificationToken, normalizeEmail, removeExpiredVerificationTokens } from "@/lib/email-verification"
import { sendEmailVerificationMail } from "@/lib/mail"

const GENERIC_RESPONSE = {
  ok: true,
  message: "Wenn ein unbestaetigter Account existiert, wurde eine Mail versendet.",
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const rawEmail = typeof body?.email === "string" ? body.email : ""
    if (!rawEmail) {
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 })
    }

    const email = normalizeEmail(rawEmail)

    await removeExpiredVerificationTokens()

    const user = await prisma.user.findUnique({
      where: { email },
      select: { email: true, name: true, emailVerified: true },
    })

    if (!user || user.emailVerified) {
      return NextResponse.json(GENERIC_RESPONSE, { status: 200 })
    }

    const token = await createEmailVerificationToken(email)
    await sendEmailVerificationMail({
      email,
      name: user.name,
      token,
    })

    return NextResponse.json(GENERIC_RESPONSE, { status: 200 })
  } catch (error) {
    console.error("[auth] resend verification failed", error)
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 })
  }
}
