import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

function loginUrl(req: NextRequest, params: Record<string, string>) {
  const url = new URL("/auth/login", req.url)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim() || ""
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase() || ""

  if (!token || !email) {
    return NextResponse.redirect(loginUrl(req, { error: "InvalidVerificationLink" }))
  }

  const verification = await prisma.verificationToken.findUnique({
    where: { token },
  })

  if (!verification || verification.identifier.toLowerCase() !== email) {
    return NextResponse.redirect(loginUrl(req, { error: "InvalidVerificationLink" }))
  }

  if (verification.expires < new Date()) {
    await prisma.verificationToken.deleteMany({
      where: { identifier: verification.identifier },
    })
    return NextResponse.redirect(loginUrl(req, { error: "VerificationLinkExpired" }))
  }

  await prisma.user.updateMany({
    where: { email: verification.identifier },
    data: { emailVerified: new Date() },
  })

  await prisma.verificationToken.deleteMany({
    where: { identifier: verification.identifier },
  })

  return NextResponse.redirect(loginUrl(req, { verified: "1" }))
}
