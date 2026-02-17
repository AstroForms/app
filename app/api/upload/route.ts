import { randomUUID } from "crypto"
import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
const MAX_FILE_BYTES = 10 * 1024 * 1024

function extensionFromFile(file: File): string {
  const ext = path.extname(file.name).toLowerCase()
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) return ext

  if (file.type === "image/jpeg") return ".jpg"
  if (file.type === "image/png") return ".png"
  if (file.type === "image/webp") return ".webp"
  return ".gif"
}

function normalizeUploadPath(inputPath: string | null, file: File): string {
  const raw = (inputPath ?? "").trim()
  const cleaned = raw.replace(/\\/g, "/").replace(/^\/+/, "")
  const noTraversal = cleaned
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/")

  if (noTraversal.length === 0) {
    return `avatars/${Date.now()}-${randomUUID()}${extensionFromFile(file)}`
  }
  return noTraversal
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get("file")
  const requestedPath = formData.get("path")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.byteLength > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 400 })
  }

  const relativePath = normalizeUploadPath(
    typeof requestedPath === "string" ? requestedPath : null,
    file
  )
  const targetPath = path.join(process.cwd(), "public", "uploads", relativePath)
  const uploadsDir = path.dirname(targetPath)

  await mkdir(uploadsDir, { recursive: true })
  await writeFile(targetPath, buffer)

  return NextResponse.json({ url: `/uploads/${relativePath}`, path: relativePath })
}
