import { NextRequest, NextResponse } from "next/server"

const TENOR_FALLBACK_KEY = "LIVDSRZULELA"

function buildTenorUrl(query: string) {
  const key =
    process.env.TENOR_API_KEY ||
    process.env.NEXT_PUBLIC_TENOR_API_KEY ||
    TENOR_FALLBACK_KEY

  const base = query
    ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}`
    : "https://tenor.googleapis.com/v2/featured"

  return `${base}&key=${encodeURIComponent(key)}&limit=20&media_filter=gif,tinygif&client_key=astroforms`
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim()
  const url = buildTenorUrl(q)

  try {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) {
      return NextResponse.json({ results: [], error: "gif_provider_error" }, { status: 502 })
    }

    const data = await res.json().catch(() => ({}))
    const results = Array.isArray(data?.results) ? data.results : []
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [], error: "gif_provider_unreachable" }, { status: 502 })
  }
}
