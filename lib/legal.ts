import { createHmac, timingSafeEqual } from "crypto"
import { CURRENT_TERMS_VERSION, LEGAL_ACCEPTANCE_COOKIE_NAME } from "@/lib/legal-constants"
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

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex")
}

export function createLegalAcceptanceProofValue(userId: string, version: string) {
  const ts = Date.now()
  const payload = `${userId}.${version}.${ts}`
  const sig = signPayload(payload, getLegalSigningSecret())
  return `${payload}.${sig}`
}

export function verifyLegalAcceptanceProofValue(value: string | undefined, userId: string, version: string) {
  if (!value || !userId || !version) return false
  const [cookieUserId, cookieVersion, tsRaw, sig] = value.split(".")
  if (!cookieUserId || !cookieVersion || !tsRaw || !sig) return false
  if (cookieUserId !== userId || cookieVersion !== version) return false

  const ts = Number(tsRaw)
  if (!Number.isFinite(ts) || ts <= 0) return false
  if (Date.now() - ts > DEFAULT_LEGAL_COOKIE_WINDOW_MS) return false

  const payload = `${cookieUserId}.${cookieVersion}.${ts}`
  const expectedSig = signPayload(payload, getLegalSigningSecret())
  const expectedBuf = Buffer.from(expectedSig)
  const receivedBuf = Buffer.from(sig)
  if (expectedBuf.length !== receivedBuf.length) return false
  return timingSafeEqual(expectedBuf, receivedBuf)
}
