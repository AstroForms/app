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

const providers = [
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
  Passkey(),
  Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { profile: true },
        })

        if (!user) {
          return null
        }

        if (!user.password) {
          return null
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
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
  session: {
    strategy: "jwt",
  },
  experimental: {
    enableWebAuthn: true,
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
      }

      // Handle session update
      if (trigger === "update" && session) {
        token = { ...token, ...session }
      }

      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        
        // Fetch profile data
        const profile = await prisma.profile.findUnique({
          where: { id: token.id as string },
        })

        if (profile) {
          session.user.username = profile.username
          session.user.role = profile.role
          session.user.avatarUrl = profile.avatarUrl
        }
      }
      return session
    },
    async signIn() {
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
