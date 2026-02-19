export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import QRCode from "qrcode"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  buildOtpAuthUrl,
  consumeBackupCode,
  generateBackupCodes,
  hashBackupCodes,
  generateTwoFactorSecret,
  verifyTotpToken,
} from "@/lib/two-factor"
import { TWO_FACTOR_COOKIE_NAME } from "@/lib/two-factor-constants"

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true, twoFactorTempSecret: true, twoFactorBackupCodes: true },
  })

  return NextResponse.json({
    enabled: Boolean(user?.twoFactorEnabled),
    setupPending: Boolean(user?.twoFactorTempSecret),
    backupCodesRemaining: Array.isArray(user?.twoFactorBackupCodes) ? user.twoFactorBackupCodes.length : 0,
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const mode = typeof body?.mode === "string" ? body.mode : ""
  const token = typeof body?.token === "string" ? body.token : ""

  if (mode === "setup") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, twoFactorEnabled: true },
    })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    if (user.twoFactorEnabled) {
      return NextResponse.json({ error: "2FA ist bereits aktiviert." }, { status: 400 })
    }

    const secret = generateTwoFactorSecret()
    const otpAuthUrl = buildOtpAuthUrl(secret, user.email || "konto")
    const qrDataUrl = await QRCode.toDataURL(otpAuthUrl, { width: 220, margin: 1 })

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorTempSecret: secret },
    })

    return NextResponse.json({
      enabled: Boolean(user.twoFactorEnabled),
      secret,
      otpAuthUrl,
      qrDataUrl,
    })
  }

  if (mode === "enable") {
    if (!token) {
      return NextResponse.json({ error: "Code erforderlich." }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorTempSecret: true },
    })
    if (!user?.twoFactorTempSecret) {
      return NextResponse.json({ error: "Kein 2FA-Setup aktiv." }, { status: 400 })
    }

    if (!verifyTotpToken(token, user.twoFactorTempSecret)) {
      return NextResponse.json({ error: "Ungueltiger 2FA-Code." }, { status: 400 })
    }

    const backupCodes = generateBackupCodes(10)
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: user.twoFactorTempSecret,
        twoFactorTempSecret: null,
        twoFactorBackupCodes: hashBackupCodes(backupCodes),
      },
    })

    return NextResponse.json({ success: true, enabled: true, backupCodes, backupCodesRemaining: 10 })
  }

  if (mode === "cancel") {
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorTempSecret: null },
    })
    return NextResponse.json({ success: true, setupPending: false })
  }

  if (mode === "regenerate-backup-codes") {
    if (!token) {
      return NextResponse.json({ error: "Code erforderlich." }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    })
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json({ error: "2FA ist nicht aktiviert." }, { status: 400 })
    }

    let verified = verifyTotpToken(token, user.twoFactorSecret)
    let remainingHashes = Array.isArray(user.twoFactorBackupCodes)
      ? user.twoFactorBackupCodes.filter((value): value is string => typeof value === "string")
      : []

    if (!verified) {
      const consumed = consumeBackupCode(token, remainingHashes)
      verified = consumed.matched
      remainingHashes = consumed.remaining
    }

    if (!verified) {
      return NextResponse.json({ error: "Ungueltiger 2FA- oder Backup-Code." }, { status: 400 })
    }

    const backupCodes = generateBackupCodes(10)
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorBackupCodes: hashBackupCodes(backupCodes),
      },
    })

    return NextResponse.json({ success: true, backupCodes, backupCodesRemaining: 10 })
  }

  return NextResponse.json({ error: "Unsupported mode" }, { status: 400 })
}

export async function DELETE(req: NextRequest) {
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
    return NextResponse.json({ error: "2FA ist nicht aktiviert." }, { status: 400 })
  }

  let verified = verifyTotpToken(token, user.twoFactorSecret)
  if (!verified) {
    const hashes = Array.isArray(user.twoFactorBackupCodes)
      ? user.twoFactorBackupCodes.filter((value): value is string => typeof value === "string")
      : []
    const consumed = consumeBackupCode(token, hashes)
    verified = consumed.matched
  }

  if (!verified) {
    return NextResponse.json({ error: "Ungueltiger 2FA- oder Backup-Code." }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorTempSecret: null,
      twoFactorBackupCodes: Prisma.DbNull,
    },
  })

  const response = NextResponse.json({ success: true, enabled: false })
  response.cookies.delete(TWO_FACTOR_COOKIE_NAME)
  return response
}
