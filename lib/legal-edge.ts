import { CURRENT_TERMS_VERSION } from "@/lib/legal-constants"

const DEFAULT_LEGAL_COOKIE_WINDOW_MS = 1000 * 60 * 60 * 24 * 365

function normalizeSecret(value?: string) {
  if (!value) return ""
  const trimmed = value.trim()
  const unquoted =
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed
  return unquoted.replace(/\\/g, "")
}

function getLegalSigningSecret() {
  const candidate =
    normalizeSecret(process.env.AUTH_SECRET) ||
    normalizeSecret(process.env.NEXTAUTH_SECRET) ||
    (process.env.NODE_ENV === "production" ? "" : "dev-only-auth-secret-change-me")
  return `astroforms-legal:${candidate || "fallback"}`
}

function toHex(bytes: Uint8Array) {
  let out = ""
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, "0")
  }
  return out
}

function timingSafeEqualString(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

async function signPayload(payload: string, secret: string) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto not available")
  }
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
  return toHex(new Uint8Array(signature))
}

export async function verifyLegalAcceptanceProofValueEdge(value: string | undefined, userId: string) {
  try {
    if (!value || !userId) return false
    const [cookieUserId, cookieVersion, tsRaw, sig] = value.split(".")
    if (!cookieUserId || !cookieVersion || !tsRaw || !sig) return false
    if (cookieUserId !== userId || cookieVersion !== CURRENT_TERMS_VERSION) return false

    const ts = Number(tsRaw)
    if (!Number.isFinite(ts) || ts <= 0) return false
    if (Date.now() - ts > DEFAULT_LEGAL_COOKIE_WINDOW_MS) return false

    const payload = `${cookieUserId}.${cookieVersion}.${ts}`
    const expectedSig = await signPayload(payload, getLegalSigningSecret())
    return timingSafeEqualString(expectedSig, sig)
  } catch {
    return false
  }
}
