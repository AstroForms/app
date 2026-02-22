const LOCAL_FALLBACK_URL = "http://localhost:3000"

function ensureProtocol(value: string) {
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

export function getPublicSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || LOCAL_FALLBACK_URL
  const withProtocol = ensureProtocol(raw)

  try {
    const parsed = new URL(withProtocol)
    return parsed.toString().replace(/\/$/, "")
  } catch {
    return LOCAL_FALLBACK_URL
  }
}
