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

const isProd = process.env.NODE_ENV === "production"
const sessionCookieName = isProd ? "__Secure-authjs.session-token" : "authjs.session-token"
const csrfCookieName = isProd ? "__Host-authjs.csrf-token" : "authjs.csrf-token"
const callbackCookieName = isProd ? "__Secure-authjs.callback-url" : "authjs.callback-url"

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

const providers: any[] = [
  GitHub({
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    allowDangerousEmailAccountLinking: true,
  }),
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    allowDangerousEmailAccountLinking: true,
  }),
  Discord({
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    allowDangerousEmailAccountLinking: true,
  }),
]

if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
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
          return null
        }

        const identifier = String(credentials.email).trim()
        const plainPassword = String(credentials.password)
        if (!identifier || !plainPassword) {
          return null
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
          return null
        }

        if (!user.password) {
          return null
        }

        if (await isBannedSafe(user.id)) {
          return null
        }

        const isValid = await bcrypt.compare(
          plainPassword,
          user.password,
        )
        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
)

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  trustHost: process.env.AUTH_TRUST_HOST === "true",
  useSecureCookies: isProd,
  session: {
    strategy: "database",
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }

      const userId = typeof token.id === "string" ? token.id : typeof token.sub === "string" ? token.sub : null
      if (userId && (await isBannedSafe(userId))) {
        token.id = undefined
        token.sub = undefined
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

      // Fetch profile data
      const profile = await prisma.profile.findUnique({
        where: { id: resolvedUserId },
      })

      if (profile) {
        session.user.username = profile.username
        session.user.role = profile.role
        session.user.avatarUrl = profile.avatarUrl
      }

      return session
    },
    async signIn({ user }) {
      const userId = await resolveUserIdFromAuthCandidate({ id: user.id, email: user.email })
      if (!userId) return false
      if (await isBannedSafe(userId)) return false
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
    }
  }
}
