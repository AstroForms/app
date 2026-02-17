import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

function canRemoveProvider(params: {
  providerToRemove: string
  providers: string[]
  hasPassword: boolean
  passkeyCount: number
}) {
  const remainingProviders = params.providers.filter((provider) => provider !== params.providerToRemove)
  return remainingProviders.length > 0 || params.hasPassword || params.passkeyCount > 0
}

function canRemovePasskey(params: {
  passkeyCount: number
  providersCount: number
  hasPassword: boolean
}) {
  const remainingPasskeys = params.passkeyCount - 1
  return remainingPasskeys > 0 || params.providersCount > 0 || params.hasPassword
}

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [user, accounts, passkeys] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, password: true },
    }),
    prisma.account.findMany({
      where: { userId },
      select: {
        provider: true,
        providerAccountId: true,
      },
    }),
    prisma.authenticator.findMany({
      where: { userId },
      select: {
        credentialID: true,
        credentialDeviceType: true,
        credentialBackedUp: true,
        transports: true,
      },
    }),
  ])

  return NextResponse.json({
    email: user?.email ?? null,
    hasPassword: Boolean(user?.password),
    providers: accounts,
    passkeys,
  })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const type = body?.type

  if (type !== "provider" && type !== "passkey") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 })
  }

  const [user, accounts, passkeys] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    }),
    prisma.account.findMany({
      where: { userId },
      select: { provider: true },
    }),
    prisma.authenticator.findMany({
      where: { userId },
      select: { credentialID: true },
    }),
  ])

  const hasPassword = Boolean(user?.password)
  const providers = accounts.map((account) => account.provider)

  if (type === "provider") {
    const provider = body?.provider
    if (!provider || typeof provider !== "string") {
      return NextResponse.json({ error: "Missing provider" }, { status: 400 })
    }

    if (!providers.includes(provider)) {
      return NextResponse.json({ error: "Provider not linked" }, { status: 404 })
    }

    if (!canRemoveProvider({ providerToRemove: provider, providers, hasPassword, passkeyCount: passkeys.length })) {
      return NextResponse.json(
        { error: "You need at least one login method on your account" },
        { status: 400 }
      )
    }

    await prisma.account.deleteMany({
      where: { userId, provider },
    })

    return NextResponse.json({ ok: true })
  }

  const credentialID = body?.credentialID
  if (!credentialID || typeof credentialID !== "string") {
    return NextResponse.json({ error: "Missing credentialID" }, { status: 400 })
  }

  const passkeyExists = passkeys.some((entry) => entry.credentialID === credentialID)
  if (!passkeyExists) {
    return NextResponse.json({ error: "Passkey not found" }, { status: 404 })
  }

  if (!canRemovePasskey({ passkeyCount: passkeys.length, providersCount: providers.length, hasPassword })) {
    return NextResponse.json(
      { error: "You need at least one login method on your account" },
      { status: 400 }
    )
  }

  await prisma.authenticator.delete({
    where: { credentialID },
  })

  return NextResponse.json({ ok: true })
}
