import crypto from "crypto"
import { prisma } from "@/lib/db"

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function generateEmailVerificationToken() {
  return crypto.randomBytes(32).toString("hex")
}

export async function createEmailVerificationToken(email: string) {
  const identifier = normalizeEmail(email)
  const token = generateEmailVerificationToken()
  const expires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS)

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

export async function consumeEmailVerificationToken(token: string) {
  const existing = await prisma.verificationToken.findUnique({ where: { token } })
  if (!existing) {
    return { ok: false as const, reason: "invalid" as const }
  }

  if (existing.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { token } })
    return { ok: false as const, reason: "expired" as const }
  }

  const verifiedAt = new Date()
  const result = await prisma.$transaction(async (tx) => {
    await tx.verificationToken.delete({ where: { token } })
    const updated = await tx.user.updateMany({
      where: {
        email: existing.identifier,
      },
      data: {
        emailVerified: verifiedAt,
      },
    })

    return updated.count
  })

  if (!result) {
    return { ok: false as const, reason: "missing_user" as const }
  }

  return { ok: true as const, email: existing.identifier }
}

export async function removeExpiredVerificationTokens() {
  await prisma.verificationToken.deleteMany({
    where: {
      expires: {
        lt: new Date(),
      },
    },
  })
}
