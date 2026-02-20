import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import Discord from "next-auth/providers/discord"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import Passkey from "next-auth/providers/passkey"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { isUserCurrentlyBanned } from "@/lib/bans"
import { CURRENT_TERMS_VERSION } from "@/lib/legal-constants"

const isProd = process.env.NODE_ENV === "production"
const sessionCookieName = isProd ? "__Secure-authjs.session-token" : "authjs.session-token"
const csrfCookieName = isProd ? "__Host-authjs.csrf-token" : "authjs.csrf-token"
const callbackCookieName = isProd ? "__Secure-authjs.callback-url" : "authjs.callback-url"

function normalizeAuthSecret(value?: string) {
  if (!value) return ""
  const trimmed = value.trim()
  const unquoted =
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed

  // Some process managers/shell layers treat backslashes differently.
  // Canonicalize to avoid per-instance secret drift.
  return unquoted.replace(/\\/g, "")
}

const authSecret =
  normalizeAuthSecret(process.env.AUTH_SECRET) ||
  normalizeAuthSecret(process.env.NEXTAUTH_SECRET) ||
  ""

function deriveFallbackAuthSecret() {
  const seed =
    [
      process.env.DATABASE_URL,
      process.env.NEXTAUTH_URL,
      process.env.AUTH_TRUST_HOST,
      process.env.NODE_ENV,
    ]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join("|") || "astroforms-auth-fallback"

  return `unsafe-fallback-${Buffer.from(seed).toString("base64url").slice(0, 96)}`
}

const effectiveAuthSecret = authSecret || deriveFallbackAuthSecret()
if (isProd && !authSecret) {
  console.error("[auth] AUTH_SECRET/NEXTAUTH_SECRET missing in production, using fallback secret.")
}

async function isBannedSafe(userId: string) {
  try {
    return await isUserCurrentlyBanned(userId)
  } catch {
    return false
  }
}

async function resolveUserIdFromAuthCandidate(user: { id?: string | null; email?: string | null }) {
  if (user.id) return user.id
  if (!user.email) return null

  const existing = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true },
  })
  return existing?.id ?? null
}

async function getTwoFactorEnabled(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    })
    return Boolean(user?.twoFactorEnabled)
  } catch {
    return false
  }
}

async function getAcceptedTermsVersion(userId: string) {
  try {
    const acceptance = await prisma.termsAcceptance.findFirst({
      where: { userId },
      orderBy: { acceptedAt: "desc" },
      select: { version: true },
    })
    return acceptance?.version ?? null
  } catch {
    return null
  }
}

const AUTH_FAILURE_DELAY_MS = 350
async function slowAuthFailure() {
  await new Promise((resolve) => setTimeout(resolve, AUTH_FAILURE_DELAY_MS))
  return null
}

const providers: any[] = [
  GitHub({
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  }),
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }),
  Discord({
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
  }),
]

if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    }),
  )
}

providers.push(
  Passkey({}),
  Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email or username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return slowAuthFailure()
        }

        const identifier = String(credentials.email).trim()
        const plainPassword = String(credentials.password)
        if (!identifier || !plainPassword) {
          return slowAuthFailure()
        }

        let user = await prisma.user.findUnique({
          where: { email: identifier },
          include: { profile: true },
        })

        // Fallback: allow login by profile username.
        if (!user) {
          const profile = await prisma.profile.findUnique({
            where: { username: identifier },
            select: {
              user: {
                include: { profile: true },
              },
            },
          })
          user = profile?.user ?? null
        }

        // Backward compatibility: older registrations stored the entered username in users.name.
        if (!user) {
          user = await prisma.user.findFirst({
            where: { name: identifier },
            include: { profile: true },
          })
        }

        if (!user) {
          return slowAuthFailure()
        }

        if (!user.password) {
          return slowAuthFailure()
        }

        const isValid = await bcrypt.compare(
          plainPassword,
          user.password,
        )
        if (!isValid) {
          return slowAuthFailure()
        }

        const isBanned = await isBannedSafe(user.id)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          banned: isBanned,
        }
      },
    }),
)

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  secret: effectiveAuthSecret,
  trustHost: process.env.AUTH_TRUST_HOST === "true",
  useSecureCookies: isProd,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
    updateAge: 60 * 30,
  },
  cookies: {
    sessionToken: {
      name: sessionCookieName,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProd,
      },
    },
    csrfToken: {
      name: csrfCookieName,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProd,
      },
    },
    callbackUrl: {
      name: callbackCookieName,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProd,
        maxAge: 60,
      },
    },
  },
  experimental: {
    enableWebAuthn: true,
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`
      try {
        const target = new URL(url)
        const base = new URL(baseUrl)
        if (target.origin === base.origin) return url
      } catch {
        return baseUrl
      }
      return baseUrl
    },
    async jwt({ token, user }) {
      const tokenWith2fa = token as typeof token & {
        twoFactorEnabled?: boolean
        twoFactorVerified?: boolean
        acceptedTermsVersion?: string | null
      }

      if (user) {
        token.id = user.id
      }

      const userId = typeof token.id === "string" ? token.id : typeof token.sub === "string" ? token.sub : null
      if (userId && (await isBannedSafe(userId))) {
        token.id = undefined
        token.sub = undefined
        tokenWith2fa.twoFactorEnabled = false
        tokenWith2fa.twoFactorVerified = false
      }

      if (userId) {
        if (typeof tokenWith2fa.twoFactorEnabled !== "boolean" || user) {
          tokenWith2fa.twoFactorEnabled = await getTwoFactorEnabled(userId)
        }
        if (!tokenWith2fa.twoFactorEnabled) {
          tokenWith2fa.twoFactorVerified = true
        } else if (user) {
          tokenWith2fa.twoFactorVerified = false
        }

        if (
          user ||
          typeof tokenWith2fa.acceptedTermsVersion === "undefined" ||
          tokenWith2fa.acceptedTermsVersion !== CURRENT_TERMS_VERSION
        ) {
          tokenWith2fa.acceptedTermsVersion = await getAcceptedTermsVersion(userId)
        }
      }

      return token
    },
    async session({ session, token, user }) {
      const resolvedUserId =
        typeof token?.id === "string"
          ? token.id
          : typeof user?.id === "string"
            ? user.id
            : null

      if (!resolvedUserId || !session.user) {
        return session
      }

      if (await isBannedSafe(resolvedUserId)) {
        return { ...session, user: undefined as never }
      }

      session.user.id = resolvedUserId
      session.user.twoFactorEnabled = Boolean((token as { twoFactorEnabled?: unknown })?.twoFactorEnabled)
      session.user.twoFactorVerified = Boolean((token as { twoFactorVerified?: unknown })?.twoFactorVerified)
      session.user.acceptedTermsVersion = ((token as { acceptedTermsVersion?: unknown })?.acceptedTermsVersion as string | null | undefined) ?? null
      session.user.requiresTermsAcceptance = session.user.acceptedTermsVersion !== CURRENT_TERMS_VERSION

      try {
        // Profile enrichment is optional; login/session must not fail if DB lookup hiccups.
        const profile = await prisma.profile.findUnique({
          where: { id: resolvedUserId },
        })

        if (profile) {
          session.user.username = profile.username
          session.user.role = profile.role
          session.user.avatarUrl = profile.avatarUrl
        }
      } catch {
        return session
      }

      return session
    },
    async signIn({ user }) {
      if ((user as { banned?: boolean } | null)?.banned) {
        return "/auth/login?error=AccountBanned"
      }

      const userId = await resolveUserIdFromAuthCandidate({ id: user.id, email: user.email })
      if (!userId) return false
      if (await isBannedSafe(userId)) {
        return "/auth/login?error=AccountBanned"
      }
      return true
    },
  },
  events: {
    async createUser({ user }) {
      if (!user?.id) return
      const existingProfile = await prisma.profile.findUnique({
        where: { id: user.id },
      })
      if (existingProfile) return
      const baseUsername = (user.email?.split("@")[0] || `user_${Date.now()}`).toLowerCase().replace(/[^a-z0-9_]/g, "")
      let candidate = baseUsername || `user_${Date.now()}`
      let suffix = 0
      // ensure unique username by appending numbers
      while (await prisma.profile.findUnique({ where: { username: candidate } })) {
        suffix += 1
        candidate = `${baseUsername}${suffix}`
      }
      await prisma.profile.create({
        data: {
          id: user.id,
          username: candidate,
          displayName: user.name || user.email?.split("@")[0],
          avatarUrl: user.image,
        },
      })
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
})

// Type augmentation for session
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string
      username?: string | null
      role?: string
      avatarUrl?: string | null
      twoFactorEnabled?: boolean
      twoFactorVerified?: boolean
      acceptedTermsVersion?: string | null
      requiresTermsAcceptance?: boolean
    }
  }
}
