import crypto from "crypto"
import { prisma } from "@/lib/db"
import { normalizeEmail } from "@/lib/email-verification"

const PASSWORD_RESET_PREFIX = "password-reset:"
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000

function toPasswordResetIdentifier(email: string) {
  return `${PASSWORD_RESET_PREFIX}${normalizeEmail(email)}`
}

function fromPasswordResetIdentifier(identifier: string) {
  if (!identifier.startsWith(PASSWORD_RESET_PREFIX)) return null
  return identifier.slice(PASSWORD_RESET_PREFIX.length)
}

export function generatePasswordResetToken() {
  return crypto.randomBytes(32).toString("hex")
}

export async function createPasswordResetToken(email: string) {
  const normalized = normalizeEmail(email)
  const identifier = toPasswordResetIdentifier(normalized)
  const token = generatePasswordResetToken()
  const expires = new Date(Date.now() + PASSWORD_RESET_TTL_MS)

  await prisma.verificationToken.deleteMany({ where: { identifier } })
  await prisma.verificationToken.create({
    data: {
      identifier,
      token,
      expires,
    },
  })

  return token
}

export async function consumePasswordResetToken(token: string) {
  const existing = await prisma.verificationToken.findUnique({ where: { token } })
  if (!existing) {
    return { ok: false as const, reason: "invalid" as const }
  }

  const email = fromPasswordResetIdentifier(existing.identifier)
  if (!email) {
    await prisma.verificationToken.delete({ where: { token } })
    return { ok: false as const, reason: "invalid" as const }
  }

  if (existing.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } })
    return { ok: false as const, reason: "expired" as const }
  }

  await prisma.verificationToken.delete({ where: { token } })
  return { ok: true as const, email }
}
