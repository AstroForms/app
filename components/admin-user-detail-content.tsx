"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, Ban, BadgeCheck, Shield, Trash2, UserRoundX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type TargetUser = {
  id: string
  username: string
  displayName: string
  email: string
  name: string
  role: string
  isVerified: boolean
  createdAt: string
  avatarUrl: string | null
}

export function AdminUserDetailContent({ targetUser }: { targetUser: TargetUser }) {
  const router = useRouter()
  const [role, setRole] = useState(targetUser.role)
  const [isVerified, setIsVerified] = useState(targetUser.isVerified)
  const [banReason, setBanReason] = useState("")
  const [banDuration, setBanDuration] = useState("permanent")
  const [isLoading, setIsLoading] = useState(false)

  const runAction = async (path: string, body: Record<string, unknown>, successMessage: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Aktion fehlgeschlagen")
      }
      toast.success(successMessage)
      router.refresh()
      return data
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aktion fehlgeschlagen")
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleVerify = async () => {
    const desired = !isVerified
    const data = await runAction(
      "/api/admin/verify-user",
      { id: targetUser.id, verified: desired },
      desired ? "Nutzer verifiziert." : "Verifizierung entfernt.",
    )
    if (data?.success) {
      setIsVerified(desired)
    }
  }

  const handleGrantAdmin = async () => {
    const data = await runAction("/api/admin/grant-admin", { id: targetUser.id }, "Admin-Rechte vergeben.")
    if (data?.success && !data?.alreadyAdmin) setRole("admin")
  }

  const handleRemoveAdmin = async () => {
    const data = await runAction("/api/admin/remove-admin", { id: targetUser.id }, "Admin-Rolle entfernt.")
    if (data?.success && !data?.alreadyUser) setRole("user")
  }

  const handleBanAccount = async () => {
    await runAction(
      "/api/admin/ban-user",
      { id: targetUser.id, reason: banReason, duration: banDuration },
      banDuration === "permanent" ? "Account permanent gebannt." : `Account für ${banDuration} gebannt.`,
    )
  }

  const handleUnbanAccount = async () => {
    await runAction("/api/admin/unban-user", { id: targetUser.id }, "Aktive Bans entfernt.")
  }

  const handleDeleteAccount = async () => {
    const ok = window.confirm(
      `Account @${targetUser.username} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
    )
    if (!ok) return
    const data = await runAction("/api/admin/delete-user", { id: targetUser.id }, "Account gelöscht.")
    if (data?.success) {
      router.push("/admin")
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Benutzer ansehen</h1>
          <p className="text-sm text-muted-foreground">Admin-Aktionen für einen einzelnen Account</p>
        </div>
        <Button variant="outline" asChild className="bg-transparent">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4 mr-2" /> Zurück
          </Link>
        </Button>
      </div>

      <div className="glass rounded-xl p-6 space-y-2">
        <p className="text-sm text-muted-foreground">Username</p>
        <p className="text-lg font-semibold text-foreground">@{targetUser.username}</p>
        <p className="text-sm text-muted-foreground">Name: {targetUser.displayName || targetUser.name || "-"}</p>
        <p className="text-sm text-muted-foreground">E-Mail: {targetUser.email || "-"}</p>
        <p className="text-sm text-muted-foreground">Rolle: {role}</p>
        <p className="text-sm text-muted-foreground">Verifiziert: {isVerified ? "ja" : "nein"}</p>
        <p className="text-sm text-muted-foreground">
          Erstellt am: {new Date(targetUser.createdAt).toLocaleDateString("de-DE")}
        </p>
      </div>

      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Rollen & Verifizierung</h2>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleToggleVerify} disabled={isLoading} variant={isVerified ? "outline" : "default"} className={isVerified ? "bg-transparent" : ""}>
            <BadgeCheck className="h-4 w-4 mr-2" /> {isVerified ? "Verifizierung entfernen" : "Verifizieren"}
          </Button>
          <Button onClick={handleGrantAdmin} disabled={isLoading || role === "admin" || role === "owner"} variant="secondary">
            <Shield className="h-4 w-4 mr-2" /> Admin geben
          </Button>
          <Button onClick={handleRemoveAdmin} disabled={isLoading || role !== "admin"} variant="outline" className="bg-transparent">
            <Shield className="h-4 w-4 mr-2" /> Admin entfernen
          </Button>
        </div>
      </div>

      <div className="glass rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Account-Ban</h2>
        <div className="grid gap-2">
          <Label className="text-foreground">Dauer</Label>
          <Select value={banDuration} onValueChange={setBanDuration}>
            <SelectTrigger className="bg-secondary/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1 Stunde</SelectItem>
              <SelectItem value="6h">6 Stunden</SelectItem>
              <SelectItem value="1d">1 Tag</SelectItem>
              <SelectItem value="3d">3 Tage</SelectItem>
              <SelectItem value="7d">7 Tage</SelectItem>
              <SelectItem value="30d">30 Tage</SelectItem>
              <SelectItem value="permanent">Permanent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label className="text-foreground">Grund</Label>
          <Textarea
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="Grund für den Ban..."
            className="bg-secondary/50 border-border/50"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" onClick={handleBanAccount} disabled={isLoading}>
            <Ban className="h-4 w-4 mr-2" /> Account bannen
          </Button>
          <Button variant="outline" className="bg-transparent" onClick={handleUnbanAccount} disabled={isLoading}>
            <UserRoundX className="h-4 w-4 mr-2" /> Bans entfernen
          </Button>
        </div>
      </div>

      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-destructive mb-3">Gefährliche Aktion</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Löscht den gesamten Account inklusive zugehörigem Profil.
        </p>
        <Button variant="destructive" onClick={handleDeleteAccount} disabled={isLoading}>
          <Trash2 className="h-4 w-4 mr-2" /> Account löschen
        </Button>
      </div>
    </div>
  )
}
