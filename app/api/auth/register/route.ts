export const runtime = "nodejs" // Required for bcrypt and Prisma
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { createEmailVerificationToken, normalizeEmail, removeExpiredVerificationTokens } from "@/lib/email-verification"
import { sendEmailVerificationMail } from "@/lib/mail"

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json()
    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 })
    }

    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    }
    if (password.length < 10) {
      return NextResponse.json({ error: "Password must be at least 10 characters" }, { status: 400 })
    }

    await removeExpiredVerificationTokens()

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existingUser) {
      if (existingUser.emailVerified) {
        return NextResponse.json({ error: "User already exists" }, { status: 409 })
      }

      const token = await createEmailVerificationToken(normalizedEmail)
      await sendEmailVerificationMail({
        email: normalizedEmail,
        name: existingUser.name,
        token,
      })

      return NextResponse.json(
        {
          requiresEmailVerification: true,
          email: normalizedEmail,
          message: "Verification mail sent",
        },
        { status: 200 },
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)


    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        ...(hashedPassword ? { password: hashedPassword } : {}),
        name,
      },
    })

    const requestedUsername =
      typeof name === "string"
        ? name.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24)
        : ""
    const baseUsername = requestedUsername || (normalizedEmail.split("@")[0] || `user_${Date.now()}`)
    let candidate = baseUsername
    let suffix = 0
    while (await prisma.profile.findUnique({ where: { username: candidate } })) {
      suffix += 1
      candidate = `${baseUsername}${suffix}`
    }

    await prisma.profile.create({
      data: {
        id: user.id,
        username: candidate,
        displayName: name || normalizedEmail.split("@")[0],
      },
    })

    const token = await createEmailVerificationToken(normalizedEmail)
    await sendEmailVerificationMail({
      email: normalizedEmail,
      name: user.name,
      token,
    })

    return NextResponse.json(
      {
        user: { id: user.id, email: user.email, name: user.name },
        requiresEmailVerification: true,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("register error", error)
    const message =
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : (error instanceof Error ? error.message : "Internal server error")
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
