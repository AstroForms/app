import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto"
import { generateSecret, generateURI, verifySync } from "otplib"
import { TWO_FACTOR_COOKIE_NAME } from "@/lib/two-factor-constants"

const DEFAULT_2FA_WINDOW_MS = 1000 * 60 * 60 * 8

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

export function getTwoFactorSigningSecret() {
  const candidate =
    normalizeSecret(process.env.AUTH_SECRET) ||
    normalizeSecret(process.env.NEXTAUTH_SECRET) ||
    (process.env.NODE_ENV === "production" ? "" : "dev-only-auth-secret-change-me")
  return `astroforms-2fa:${candidate || "fallback"}`
}

export function generateTwoFactorSecret() {
  return generateSecret()
}

export function buildOtpAuthUrl(secret: string, email: string) {
  return generateURI({
    issuer: "AstroForms",
    label: email || "konto",
    secret,
  })
}

export function verifyTotpToken(token: string, secret: string) {
  const sanitized = token.replace(/\s+/g, "")
  if (!/^\d{6}$/.test(sanitized)) return false
  const result = verifySync({ token: sanitized, secret })
  return typeof result === "object" && result !== null && "valid" in result
    ? Boolean(result.valid)
    : false
}

function normalizeBackupCode(code: string) {
  return code.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
}

function hashBackupCode(code: string) {
  return createHash("sha256").update(normalizeBackupCode(code)).digest("hex")
}

export function generateBackupCodes(count = 10) {
  const codes: string[] = []
  for (let i = 0; i < count; i += 1) {
    const raw = randomBytes(5).toString("hex").toUpperCase()
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`)
  }
  return codes
}

export function hashBackupCodes(codes: string[]) {
  return codes.map(hashBackupCode)
}

export function consumeBackupCode(input: string, storedHashes: string[]) {
  const hashed = hashBackupCode(input)
  const index = storedHashes.findIndex((value) => value === hashed)
  if (index < 0) {
    return { matched: false, remaining: storedHashes }
  }
  const remaining = storedHashes.filter((_, i) => i !== index)
  return { matched: true, remaining }
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex")
}

export function createTwoFactorProofValue(userId: string) {
  const ts = Date.now()
  const payload = `${userId}.${ts}`
  const sig = signPayload(payload, getTwoFactorSigningSecret())
  return `${payload}.${sig}`
}

export function verifyTwoFactorProofValue(value: string | undefined, userId: string) {
  if (!value || !userId) return false
  const [cookieUserId, tsRaw, sig] = value.split(".")
  if (!cookieUserId || !tsRaw || !sig) return false
  if (cookieUserId !== userId) return false

  const ts = Number(tsRaw)
  if (!Number.isFinite(ts) || ts <= 0) return false
  if (Date.now() - ts > DEFAULT_2FA_WINDOW_MS) return false

  const payload = `${cookieUserId}.${ts}`
  const expectedSig = signPayload(payload, getTwoFactorSigningSecret())
  const expectedBuf = Buffer.from(expectedSig)
  const receivedBuf = Buffer.from(sig)
  if (expectedBuf.length !== receivedBuf.length) return false
  return timingSafeEqual(expectedBuf, receivedBuf)
}
