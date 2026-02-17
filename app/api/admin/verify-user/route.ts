import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

async function requireAdmin() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) }
  }

  const me = await prisma.profile.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (!me || me.role !== "admin") {
    return { error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) }
  }

  return { error: null }
}

async function ensureIsVerifiedColumn() {
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "profiles" ADD COLUMN "is_verified" BOOLEAN NOT NULL DEFAULT false',
    )
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ""
    const alreadyExists =
      message.includes("duplicate column") ||
      message.includes("already exists") ||
      message.includes("duplicate")
    if (!alreadyExists) throw error
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error } = await requireAdmin()
    if (error) return error

    const { id } = await req.json()
    const profileId = typeof id === "string" ? id.trim() : ""
    if (!profileId) {
      return NextResponse.json({ success: false, error: "No user id" }, { status: 400 })
    }

    await ensureIsVerifiedColumn()

    const updatedCount = await prisma.$executeRaw`
      UPDATE "profiles"
      SET "is_verified" = true
      WHERE "id" = ${profileId}
    `

    if (!updatedCount) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
