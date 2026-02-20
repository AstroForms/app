"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, Hash, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"

type TargetChannel = {
  id: string
  name: string
  description: string | null
  isPublic: boolean
  isVerified: boolean
  memberCount: number
  createdAt: string
  ownerId: string
  ownerUsername: string
}

export function AdminChannelDetailContent({ targetChannel }: { targetChannel: TargetChannel }) {
  const router = useRouter()
  const [name, setName] = useState(targetChannel.name)
  const [description, setDescription] = useState(targetChannel.description || "")
  const [isPublic, setIsPublic] = useState(targetChannel.isPublic)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/channels/${targetChannel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          isPublic,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Channel konnte nicht gespeichert werden")
      }
      toast.success("Channel gespeichert.")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Channel konnte nicht gespeichert werden")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (deleteConfirmation.trim() !== targetChannel.name) {
      toast.error("Bestätigung stimmt nicht mit dem Channel-Namen überein.")
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/channels/${targetChannel.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: deleteConfirmation,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Channel konnte nicht gelöscht werden")
      }
      toast.success("Channel gelöscht.")
      router.push("/admin")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Channel konnte nicht gelöscht werden")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Channel ansehen</h1>
          <p className="text-sm text-muted-foreground">Admin-Aktionen für einen einzelnen Channel</p>
        </div>
        <Button variant="outline" asChild className="bg-transparent">
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4 mr-2" /> Zurück
          </Link>
        </Button>
      </div>

      <div className="glass rounded-xl p-6 space-y-2">
        <p className="text-sm text-muted-foreground">Channel</p>
        <p className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Hash className="h-4 w-4" />
          {targetChannel.name}
        </p>
        <p className="text-sm text-muted-foreground">Owner: @{targetChannel.ownerUsername || targetChannel.ownerId}</p>
        <p className="text-sm text-muted-foreground">Mitglieder: {targetChannel.memberCount}</p>
        <p className="text-sm text-muted-foreground">Sichtbarkeit: {targetChannel.isPublic ? "öffentlich" : "privat"}</p>
        <p className="text-sm text-muted-foreground">Verifiziert: {targetChannel.isVerified ? "ja" : "nein"}</p>
        <p className="text-sm text-muted-foreground">
          Erstellt am: {new Date(targetChannel.createdAt).toLocaleDateString("de-DE")}
        </p>
      </div>

      <div className="glass rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Channel bearbeiten</h2>
        <div className="grid gap-2">
          <Label className="text-foreground" htmlFor="channel-name">Name</Label>
          <Input
            id="channel-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-secondary/50 border-border/50"
            maxLength={80}
          />
        </div>
        <div className="grid gap-2">
          <Label className="text-foreground" htmlFor="channel-description">Beschreibung</Label>
          <Textarea
            id="channel-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-secondary/50 border-border/50"
            maxLength={500}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/20 p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Öffentlich</p>
            <p className="text-xs text-muted-foreground">Steuert, ob der Channel sichtbar/beitretbar ist.</p>
          </div>
          <Switch checked={isPublic} onCheckedChange={setIsPublic} disabled={isLoading} />
        </div>
        <Button onClick={handleSave} disabled={isLoading || !name.trim()}>
          <Save className="h-4 w-4 mr-2" /> Speichern
        </Button>
      </div>

      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-destructive mb-3">Gefährliche Aktion</h2>
        <p className="text-sm text-muted-foreground mb-2">
          Zur Bestätigung den Channel-Namen eingeben: <span className="font-medium text-foreground">{targetChannel.name}</span>
        </p>
        <div className="flex gap-2">
          <Input
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            placeholder={targetChannel.name}
            className="bg-secondary/50 border-border/50"
          />
          <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
            <Trash2 className="h-4 w-4 mr-2" /> Löschen
          </Button>
        </div>
      </div>
    </div>
  )
}
