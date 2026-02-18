import { randomBytes } from "crypto"
import nodemailer from "nodemailer"
import { prisma } from "@/lib/db"

const TOKEN_TTL_HOURS = 24

function getBaseUrl() {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "")
}

function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || "587")
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error("SMTP is not configured")
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

export async function createEmailVerificationToken(email: string) {
  const token = randomBytes(32).toString("hex")
  const expires = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000)

  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  })

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  })

  return token
}

export async function sendVerificationEmail(email: string, token: string) {
  const transporter = getTransporter()
  const from = process.env.SMTP_FROM || process.env.SMTP_USER
  if (!from) throw new Error("SMTP_FROM is not configured")

  const verifyUrl = `${getBaseUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`

  await transporter.sendMail({
    from,
    to: email,
    subject: "Bitte bestaetige deine E-Mail",
    text: `Bitte bestaetige deine E-Mail-Adresse ueber diesen Link: ${verifyUrl}`,
    html: `<p>Bitte bestaetige deine E-Mail-Adresse:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  })
}
