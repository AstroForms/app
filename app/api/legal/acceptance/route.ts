export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { CURRENT_TERMS_VERSION, LEGAL_ACCEPTANCE_COOKIE_NAME } from "@/lib/legal-constants"
import {
  createLegalAcceptanceProofValue,
} from "@/lib/legal"

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const history = await prisma.termsAcceptance.findMany({
    where: { userId },
    orderBy: { acceptedAt: "desc" },
    select: {
      version: true,
      acceptedAt: true,
    },
  })

  const latestVersion = history[0]?.version ?? null

  return NextResponse.json({
    currentVersion: CURRENT_TERMS_VERSION,
    latestAcceptedVersion: latestVersion,
    requiresAcceptance: latestVersion !== CURRENT_TERMS_VERSION,
    history,
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const version = typeof body?.version === "string" ? body.version : CURRENT_TERMS_VERSION
  if (version !== CURRENT_TERMS_VERSION) {
    return NextResponse.json({ error: "Nur die aktuelle Version kann akzeptiert werden." }, { status: 400 })
  }

  await prisma.termsAcceptance.upsert({
    where: {
      userId_version: {
        userId,
        version,
      },
    },
    update: {
      acceptedAt: new Date(),
    },
    create: {
      userId,
      version,
    },
  })

  const response = NextResponse.json({
    success: true,
    acceptedVersion: version,
  })
  response.cookies.set({
    name: LEGAL_ACCEPTANCE_COOKIE_NAME,
    value: createLegalAcceptanceProofValue(userId, version),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
  return response
}
