import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import path from "path"
import fs from "fs/promises"

// GET /api/profile/deliver-image?userId=123
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  })
  if (!profile || !profile.avatarUrl) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 })
  }

  const imagePath = path.join(
    process.cwd(),
    "public",
    profile.avatarUrl.replace(/^\/uploads\//, "uploads/")
  )
  try {
    const imageBuffer = await fs.readFile(imagePath)
    const ext = path.extname(imagePath).toLowerCase()
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : "application/octet-stream"
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: { "Content-Type": mime },
    })
  } catch (err) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 })
  }
}
