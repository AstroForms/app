"use client"

import React from "react"

import { createDbClient } from "@/lib/db-client"
import { DashboardShell } from "@/components/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Hash, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function CreateChannelPage() {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPublic, setIsPublic] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const supabase = createDbClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: channel, error } = await supabase
      .from("channels")
      .insert({ name, description, is_public: isPublic, owner_id: user.id })
      .select()
      .single()

    if (error) {
      toast.error("Fehler beim Erstellen: " + error.message)
      setIsLoading(false)
      return
    }

    // Auto-join as member with owner role
    const { error: memberError } = await supabase.from("channel_members").insert({
      channel_id: channel.id,
      user_id: user.id,
      role: "owner",
    })
    if (memberError) {
      toast.error("Konnte dich nicht als Owner beitreten lassen: " + memberError.message)
    }

    // Award XP for creating a channel
    await supabase.rpc("add_xp", { p_user_id: user.id, p_amount: 10, p_reason: "Channel erstellt" })

    toast.success("Channel erstellt!")
    router.push(`/channels/${channel.id}`)
  }

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto">
        <Link href="/channels" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>

        <div className="glass rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Hash className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Channel erstellen</h1>
              <p className="text-sm text-muted-foreground">Starte deine eigene Community</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="flex flex-col gap-5">
            <div className="grid gap-2">
              <Label className="text-foreground">Name</Label>
              <Input
                placeholder="Mein Channel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11 bg-secondary/50 border-border/50"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-foreground">Beschreibung</Label>
              <Textarea
                placeholder="Worum geht es in deinem Channel?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-secondary/50 border-border/50 min-h-[100px]"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-secondary/30 p-4">
              <div>
                <Label className="text-foreground">Oeffentlich</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Jeder kann diesen Channel finden und beitreten</p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
            <Button type="submit" disabled={isLoading} className="h-11 text-primary-foreground font-semibold">
              {isLoading ? "Erstellen..." : "Channel erstellen"}
            </Button>
          </form>
        </div>
      </div>
    </DashboardShell>
  )
}

