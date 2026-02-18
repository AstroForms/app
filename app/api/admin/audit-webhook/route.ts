import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createAuditLog, getAuditWebhook, setAuditWebhook } from "@/lib/audit"

async function requireAdmin() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return { meId: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const me = await prisma.profile.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  const hasAdminAccess = me?.role === "admin" || me?.role === "owner"
  if (!hasAdminAccess) {
    return { meId: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { meId: userId, error: null }
}

export async function GET() {
  try {
    const { error } = await requireAdmin()
    if (error) return error
    const webhookUrl = await getAuditWebhook()
    return NextResponse.json({ webhookUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook fetch failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { meId, error } = await requireAdmin()
    if (error) return error

    const body = await req.json()
    const webhookUrl = typeof body?.webhookUrl === "string" ? body.webhookUrl.trim() : ""

    if (webhookUrl && !/^https:\/\/discord\.com\/api\/webhooks\/.+/i.test(webhookUrl)) {
      return NextResponse.json({ error: "Invalid Discord webhook URL." }, { status: 400 })
    }

    await setAuditWebhook(webhookUrl)
    await createAuditLog({
      actorId: meId!,
      action: "update_audit_webhook",
      details: webhookUrl ? "Webhook updated" : "Webhook cleared",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook save failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
