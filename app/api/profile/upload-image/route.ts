import { NextRequest, NextResponse } from "next/server"

// Beispiel: Upload an externen CDN (z.B. Cloudflare Images, S3, etc.)
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get("image") as File
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 })

  // Beispiel: Upload zu externem CDN
  // Hier Cloudflare Images API, du kannst S3 oder andere nutzen
  const CDN_UPLOAD_URL = 'https://cdn.astro.aveen.systems/upload' // Ersetze durch deine CDN-Upload-URL
  const CDN_API_KEY = 'yQw2J9k8Zp1sB3v4T6xL0aN7mR5cE8uQ2wS4tV6bH9dF1gK3lP5zX7nC0rA2jM4qU6yS8vW0eT2'

  const uploadRes = await fetch(CDN_UPLOAD_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CDN_API_KEY}`,
    },
    body: file,
  })

  if (!uploadRes.ok) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }

  const data = await uploadRes.json()
  // data.result.url enthält die Bild-URL

  // Bild-URL im Profil speichern
  const userId = req.headers.get("x-user-id") // User-ID aus Header oder Session
  if (userId && data.result.url) {
    try {
      const { prisma } = await import("@/lib/db")
      await prisma.profile.update({
        where: { id: userId },
        data: { avatarUrl: data.result.url }
      })
    } catch (e) {
      // Fehler ignorieren, Bild-Upload bleibt erfolgreich
    }
  }

  return NextResponse.json({ url: data.result.url })
}
