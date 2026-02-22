import nodemailer from "nodemailer"

type MailPayload = {
  to: string
  subject: string
  text: string
  html?: string
}

function normalizeBoolean(value: string | undefined) {
  return value === "1" || value === "true" || value === "yes"
}

function getBaseUrl() {
  const direct = process.env.APP_URL || process.env.NEXTAUTH_URL
  if (direct) return direct.replace(/\/$/, "")

  const vercelUrl = process.env.VERCEL_URL
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, "")}`
  }

  return "http://localhost:3000"
}

function getMailTimeoutMs() {
  const value = Number(process.env.MAIL_SEND_TIMEOUT_MS || "8000")
  if (!Number.isFinite(value) || value <= 0) return 8000
  return Math.min(value, 30_000)
}

function createTransporter() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || "587")
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    return null
  }

  const timeoutMs = getMailTimeoutMs()

  return nodemailer.createTransport({
    host,
    port,
    secure: normalizeBoolean(process.env.SMTP_SECURE),
    auth: { user, pass },
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  })
}

export async function sendMail(payload: MailPayload) {
  const transporter = createTransporter()
  if (!transporter) {
    console.warn("[mail] SMTP configuration missing. Skipping real mail delivery.")
    console.info("[mail] Preview", { to: payload.to, subject: payload.subject, text: payload.text })
    return
  }

  const timeoutMs = getMailTimeoutMs()
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`mail send timeout after ${timeoutMs}ms`)), timeoutMs)
  })

  await Promise.race([
    transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    }),
    timeoutPromise,
  ])
}

export async function sendEmailVerificationMail(params: {
  email: string
  name?: string | null
  token: string
}) {
  const verificationUrl = `${getBaseUrl()}/api/auth/verify-email?token=${encodeURIComponent(params.token)}`
  const greetingName = params.name?.trim() || "dort"

  const text = [
    `Hi ${greetingName},`,
    "",
    "bitte bestätige deine E-Mail-Adresse für AstroForms:",
    verificationUrl,
    "",
    "Der Link ist 24 Stunden gültig.",
    "",
    "Sicherheits-Hinweis:",
    "- Wir fragen dich niemals per Mail nach deinem Passwort.",
    "- Öffne nur Links mit der korrekten AstroForms-Domain.",
  ].join("\n")

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">E-Mail bestätigen</h2>
      <p>Hi ${greetingName},</p>
      <p>bitte bestätige deine E-Mail-Adresse für AstroForms:</p>
      <p><a href="${verificationUrl}">${verificationUrl}</a></p>
      <p>Der Link ist <strong>24 Stunden</strong> gültig.</p>
      <p><strong>Sicherheits-Hinweis:</strong><br />
      Wir fragen dich niemals nach deinem Passwort per Mail.<br />
      Öffne nur Links mit der offiziellen AstroForms-Domain.</p>
    </div>
  `

  await sendMail({
    to: params.email,
    subject: "Bitte bestätige deine E-Mail-Adresse",
    text,
    html,
  })
}

export async function sendPasswordResetMail(params: {
  email: string
  name?: string | null
  token: string
}) {
  const resetUrl = `${getBaseUrl()}/auth/reset-password?token=${encodeURIComponent(params.token)}`
  const greetingName = params.name?.trim() || "dort"

  const text = [
    `Hi ${greetingName},`,
    "",
    "du hast eine Zurücksetzung deines Passworts angefordert.",
    "Hier kannst du ein neues Passwort setzen:",
    resetUrl,
    "",
    "Der Link ist 1 Stunde gültig.",
    "Wenn du das nicht warst, ignoriere diese E-Mail.",
  ].join("\n")

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">Passwort zurücksetzen</h2>
      <p>Hi ${greetingName},</p>
      <p>du hast eine Zurücksetzung deines Passworts angefordert.</p>
      <p><a href="${resetUrl}">Neues Passwort setzen</a></p>
      <p>Der Link ist <strong>1 Stunde</strong> gültig.</p>
      <p>Wenn du das nicht warst, ignoriere diese E-Mail.</p>
    </div>
  `

  await sendMail({
    to: params.email,
    subject: "Passwort zurücksetzen",
    text,
    html,
  })
}

export async function sendPasswordChangedMail(params: { email: string; name?: string | null }) {
  const greetingName = params.name?.trim() || "dort"
  const text = [
    `Hi ${greetingName},`,
    "",
    "dein Passwort wurde erfolgreich geändert.",
    "Wenn du das nicht warst, setze dein Passwort sofort zurück und kontaktiere den Support.",
  ].join("\n")

  await sendMail({
    to: params.email,
    subject: "Sicherheitsinfo: Passwort geändert",
    text,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
        <h2 style="margin:0 0 12px">Passwort geändert</h2>
        <p>Hi ${greetingName},</p>
        <p>dein Passwort wurde erfolgreich geändert.</p>
        <p>Wenn du das nicht warst, setze dein Passwort sofort zurück und kontaktiere den Support.</p>
      </div>
    `,
  })
}

export async function sendLoginActivityMail(params: { email: string; name?: string | null }) {
  const greetingName = params.name?.trim() || "dort"
  const text = [
    `Hi ${greetingName},`,
    "",
    "es gab gerade eine neue Anmeldung in deinem Konto.",
    "Wenn du das nicht warst, ändere bitte umgehend dein Passwort.",
  ].join("\n")

  await sendMail({
    to: params.email,
    subject: "Sicherheitsinfo: Neuer Login",
    text,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
        <h2 style="margin:0 0 12px">Neuer Login</h2>
        <p>Hi ${greetingName},</p>
        <p>es gab gerade eine neue Anmeldung in deinem Konto.</p>
        <p>Wenn du das nicht warst, ändere bitte umgehend dein Passwort.</p>
      </div>
    `,
  })
}

export async function sendAccountBannedMail(params: {
  email: string
  name?: string | null
  reason?: string | null
  bannedUntil?: Date | null
}) {
  const greetingName = params.name?.trim() || "dort"
  const untilText = params.bannedUntil ? params.bannedUntil.toLocaleString("de-DE") : "dauerhaft"
  const reasonText = params.reason?.trim() ? params.reason.trim() : "Nicht angegeben"

  const text = [
    `Hi ${greetingName},`,
    "",
    "dein Konto wurde gesperrt.",
    `Dauer: ${untilText}`,
    `Grund: ${reasonText}`,
    "",
    "Wenn du Rückfragen hast, kontaktiere bitte den Support.",
  ].join("\n")

  await sendMail({
    to: params.email,
    subject: "Wichtige Info: Konto gesperrt",
    text,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
        <h2 style="margin:0 0 12px">Konto gesperrt</h2>
        <p>Hi ${greetingName},</p>
        <p>dein Konto wurde gesperrt.</p>
        <p><strong>Dauer:</strong> ${untilText}<br /><strong>Grund:</strong> ${reasonText}</p>
        <p>Wenn du Rückfragen hast, kontaktiere bitte den Support.</p>
      </div>
    `,
  })
}
