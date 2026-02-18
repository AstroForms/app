import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { AdminAuditLogsContent } from "@/components/admin-audit-logs-content"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getAuditWebhook, listAuditLogs } from "@/lib/audit"

export default async function AuditLogsPage() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect("/auth/login")

  const me = await prisma.profile.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  const hasAdminAccess = me?.role === "admin" || me?.role === "owner"
  if (!hasAdminAccess) redirect("/admin")

  const [logs, webhookUrl] = await Promise.all([
    listAuditLogs(200),
    getAuditWebhook(),
  ])

  return (
    <DashboardShell>
      <AdminAuditLogsContent initialLogs={logs} initialWebhookUrl={webhookUrl} />
    </DashboardShell>
  )
}
