import fs from "fs/promises"
import path from "path"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

function contentTypeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === ".png") return "image/png"
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg"
  if (ext === ".webp") return "image/webp"
  if (ext === ".gif") return "image/gif"
  if (ext === ".svg") return "image/svg+xml"
  return "application/octet-stream"
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } | Promise<{ path: string[] }> },
) {
  const resolvedParams = params instanceof Promise ? await params : params
  const segments = (resolvedParams.path || [])
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..")

  if (segments.length === 0) {
    return NextResponse.json({ error: "Missing media path" }, { status: 400 })
  }

  const relativePath = segments.join("/")
  const absolutePath = path.join(process.cwd(), "public", "uploads", relativePath)

  try {
    const file = await fs.readFile(absolutePath)
    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(absolutePath),
        "Cache-Control": "no-store, max-age=0",
      },
    })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}
