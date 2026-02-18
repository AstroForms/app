export const runtime = "nodejs" // Required for bcrypt and Prisma
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { createEmailVerificationToken, sendVerificationEmail } from "@/lib/email-verification"

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)


    const user = await prisma.user.create({
      data: {
        email,
        ...(hashedPassword ? { password: hashedPassword } : {}),
        name,
      },
    })

    await prisma.profile.create({
      data: {
        id: user.id,
        username: email.split("@")[0] || `user_${Date.now()}`,
        displayName: name || email.split("@")[0],
      },
    })

    const token = await createEmailVerificationToken(user.email!)
    await sendVerificationEmail(user.email!, token)

    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name }, requiresEmailVerification: true },
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
