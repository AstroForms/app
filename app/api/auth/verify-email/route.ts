export const runtime = "nodejs"

import { NextRequest, NextResponse } from "next/server"
import { consumeEmailVerificationToken } from "@/lib/email-verification"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  if (!token) {
    return NextResponse.redirect(new URL("/auth/login?error=Verification", req.url))
  }

  const result = await consumeEmailVerificationToken(token)
  if (!result.ok) {
    const errorCode = result.reason === "expired" ? "VerificationExpired" : "Verification"
    return NextResponse.redirect(new URL(`/auth/login?error=${errorCode}`, req.url))
  }

  return NextResponse.redirect(new URL("/auth/login?verified=1", req.url))
}
