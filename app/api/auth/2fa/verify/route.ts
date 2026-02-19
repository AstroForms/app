export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  consumeBackupCode,
  createTwoFactorProofValue,
  verifyTotpToken,
} from "@/lib/two-factor"
import { TWO_FACTOR_COOKIE_NAME } from "@/lib/two-factor-constants"

export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const token = typeof body?.token === "string" ? body.token : ""
  if (!token) {
    return NextResponse.json({ error: "Code erforderlich." }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true, twoFactorSecret: true, twoFactorBackupCodes: true },
  })
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
    return NextResponse.json({ error: "2FA nicht aktiv." }, { status: 400 })
  }

  let verified = verifyTotpToken(token, user.twoFactorSecret)
  let updatedBackupCodes = Array.isArray(user.twoFactorBackupCodes)
    ? user.twoFactorBackupCodes.filter((value): value is string => typeof value === "string")
    : []

  if (!verified) {
    const consumed = consumeBackupCode(token, updatedBackupCodes)
    verified = consumed.matched
    updatedBackupCodes = consumed.remaining
  }

  if (!verified) {
    return NextResponse.json({ error: "Ungueltiger 2FA- oder Backup-Code." }, { status: 400 })
  }

  if (updatedBackupCodes.length !== (Array.isArray(user.twoFactorBackupCodes) ? user.twoFactorBackupCodes.length : 0)) {
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorBackupCodes: updatedBackupCodes },
    })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set({
    name: TWO_FACTOR_COOKIE_NAME,
    value: createTwoFactorProofValue(userId),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  })
  return response
}
