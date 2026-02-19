import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { FeatureKey, getFeatureFlags, setFeatureFlag } from "@/lib/features"

const FEATURE_KEYS: FeatureKey[] = ["bots", "messages", "automations"]

async function ensureAdmin(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return profile?.role === "admin" || profile?.role === "owner"
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!(await ensureAdmin(session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const features = await getFeatureFlags()
  return NextResponse.json({ features })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!(await ensureAdmin(session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const feature = body?.feature as FeatureKey | undefined
  const enabled = body?.enabled

  if (!feature || !FEATURE_KEYS.includes(feature)) {
    return NextResponse.json({ error: "Invalid feature key" }, { status: 400 })
  }
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid enabled value" }, { status: 400 })
  }

  await setFeatureFlag(feature, enabled)
  const features = await getFeatureFlags()

  return NextResponse.json({ success: true, features })
}
