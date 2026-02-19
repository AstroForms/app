import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getAccountSettings, setAccountSettings } from "@/lib/account-settings"

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const settings = await getAccountSettings(userId)
  return NextResponse.json({ settings })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const settings = body?.settings
  if (!settings || typeof settings !== "object") {
    return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 })
  }

  await setAccountSettings(userId, {
    emailNotifications: Boolean((settings as any).emailNotifications),
    marketingEmails: Boolean((settings as any).marketingEmails),
    loginAlerts: Boolean((settings as any).loginAlerts),
    profileVisibilityTips: Boolean((settings as any).profileVisibilityTips),
  })

  return NextResponse.json({ success: true })
}
