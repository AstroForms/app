"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Save, ScrollText, Webhook } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type AuditLogItem = {
  id: string
  created_at: string
  actor_id: string
  actor_username: string | null
  action: string
  target_user_id: string | null
  target_username: string | null
  details: string | null
}

export function AdminAuditLogsContent({
  initialLogs,
  initialWebhookUrl,
}: {
  initialLogs: AuditLogItem[]
  initialWebhookUrl: string
}) {
  const router = useRouter()
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl)
  const [isSavingWebhook, setIsSavingWebhook] = useState(false)

  const sortedLogs = useMemo(
    () =>
      [...initialLogs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [initialLogs],
  )

  const saveWebhook = async () => {
    setIsSavingWebhook(true)
    try {
      const res = await fetch("/api/admin/audit-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Webhook konnte nicht gespeichert werden.")
      toast.success("Webhook gespeichert.")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Webhook konnte nicht gespeichert werden.")
    } finally {
      setIsSavingWebhook(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">Admin-Aktionen mit optionalem Discord Webhook</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.refresh()} className="bg-transparent">
            Aktualisieren
          </Button>
          <Button variant="outline" asChild className="bg-transparent">
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4 mr-2" /> Zurück
            </Link>
          </Button>
        </div>
      </div>

      <div className="glass rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Webhook className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-foreground">Discord Webhook</h2>
        </div>
        <div className="flex gap-2">
          <Input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="bg-secondary/50 border-border/50"
          />
          <Button onClick={saveWebhook} disabled={isSavingWebhook} className="text-primary-foreground">
            <Save className="h-4 w-4 mr-2" /> Speichern
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Leer lassen und speichern entfernt den Webhook.
        </p>
      </div>

      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <ScrollText className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-foreground">Einträge ({sortedLogs.length})</h2>
        </div>

        {sortedLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Audit-Logs vorhanden.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sortedLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                <p className="text-sm text-foreground font-medium">{log.action}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(log.created_at).toLocaleString("de-DE")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Actor: {log.actor_username ? `@${log.actor_username}` : log.actor_id}
                </p>
                <p className="text-xs text-muted-foreground">
                  Target: {log.target_username ? `@${log.target_username}` : log.target_user_id || "-"}
                </p>
                {log.details && <p className="text-xs text-muted-foreground mt-1">Details: {log.details}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
