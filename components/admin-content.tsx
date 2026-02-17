"use client"

import { createDbClient } from "@/lib/db-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
  Shield, BadgeCheck, Flag, Ban, Hash, Bot,
  CheckCircle, XCircle, Trash2, AlertTriangle, Lock, User, Clock
} from "lucide-react"
import { useState } from "react"
// ...existing code...
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Report {
  id: string
  target_type: string
  target_id: string
  reason: string
  status: string
  created_at: string
  profiles: { username: string }
}

interface UnverifiedChannel {
  id: string
  name: string
  description: string | null
  created_at: string
  owner_id: string
  profiles: { username: string }
}

interface UnverifiedBot {
  id: string
  name: string
  description: string | null
  created_at: string
  profiles: { username: string }
}

interface BanRecord {
  id: string
  user_id: string
  reason: string | null
  is_global: boolean
  banned_until: string | null
  created_at: string
  profiles: { username: string }
}

export function AdminContent({
  reports,
  unverifiedChannels,
  unverifiedBots,
  bans,
  userId,
}: {
  reports: Report[]
  unverifiedChannels: UnverifiedChannel[]
  unverifiedBots: UnverifiedBot[]
  bans: BanRecord[]
  userId: string
}) {
  const router = useRouter()
  const [banUserId, setBanUserId] = useState("")
  const [banReason, setBanReason] = useState("")
  const [banDuration, setBanDuration] = useState<string>("permanent")
  const [showBanDialog, setShowBanDialog] = useState(false)
  
  // Moderation dialogs
  const [showChannelModDialog, setShowChannelModDialog] = useState(false)
  const [showUserModDialog, setShowUserModDialog] = useState(false)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [modReason, setModReason] = useState("")
  const [userModAction, setUserModAction] = useState<string>("")
  const [userModDuration, setUserModDuration] = useState<string>("1d")
  const [verifyUserInput, setVerifyUserInput] = useState("")
  type User = {
    id: string;
    username: string;
    displayName?: string;
    role?: string;
  }
  const [userSearchResults, setUserSearchResults] = useState<User[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const verifyChannel = async (channelId: string) => {
    const supabase = createDbClient()
    await supabase.from("channels").update({ is_verified: true }).eq("id", channelId)
    toast.success("Channel verifiziert!")
    router.refresh()
  }

  const verifyBot = async (botId: string) => {
    const supabase = createDbClient()
    await supabase.from("bots").update({ is_verified: true }).eq("id", botId)
    toast.success("Bot verifiziert!")
    router.refresh()
  }

  const verifyUser = async (profileId: string) => {
    if (!profileId.trim()) return
    try {
      const res = await fetch("/api/admin/verify-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: profileId })
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Fehler beim Verifizieren")
      }
      if (data?.success) {
        toast.success("Nutzer verifiziert!")
        setVerifyUserInput("")
        setUserSearchResults([])
        router.refresh()
      } else {
        toast.error(data?.error || "Fehler beim Verifizieren")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Verifizieren")
    }
  }

  const searchUserByUsername = async () => {
    const query = verifyUserInput.trim()
    if (!query) {
      setUserSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      const res = await fetch(`/api/admin/search-user?username=${encodeURIComponent(query)}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Fehler bei der Suche")
      }
      setUserSearchResults(Array.isArray(data?.users) ? data.users : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fehler bei der Suche")
      setUserSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }

  const grantAdmin = async (profileId: string) => {
    if (!profileId.trim()) return
    try {
      const res = await fetch("/api/admin/grant-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: profileId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Fehler beim Rollen-Update")
      }

      if (data?.alreadyAdmin) {
        toast.info("Nutzer hat bereits Admin-Rechte.")
      } else {
        toast.success("Admin-Rechte vergeben!")
      }
      await searchUserByUsername()
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Rollen-Update")
    }
  }

  const resolveReport = async (reportId: string, status: string) => {
    const supabase = createDbClient()
    await supabase.from("reports").update({ status }).eq("id", reportId)
    toast.success(`Report ${status === "resolved" ? "aufgeloest" : "abgelehnt"}`)
    router.refresh()
  }

  const handleReportAction = (report: Report) => {
    setSelectedReport(report)
    if (report.target_type === "channel") {
      setShowChannelModDialog(true)
    } else if (report.target_type === "user" || report.target_type === "post") {
      setShowUserModDialog(true)
    }
  }

  const handleChannelModAction = async (action: "lock_channel" | "ban_owner" | "lock_and_ban") => {
    if (!selectedReport) return
    const supabase = createDbClient()
    
    // Get channel info
    const { data: channel } = await supabase
      .from("channels")
      .select("owner_id")
      .eq("id", selectedReport.target_id)
      .single()

    if (action === "lock_channel" || action === "lock_and_ban") {
      await supabase.from("channels").update({ is_locked: true }).eq("id", selectedReport.target_id)
      toast.success("Channel gesperrt!")
    }

    if ((action === "ban_owner" || action === "lock_and_ban") && channel?.owner_id) {
      await supabase.from("bans").insert({
        user_id: channel.owner_id,
        banned_by: userId,
        reason: modReason || "Channel-Report",
        is_global: true,
      })
      toast.success("Owner gebannt!")
    }

    await resolveReport(selectedReport.id, "resolved")
    setShowChannelModDialog(false)
    setSelectedReport(null)
    setModReason("")
  }

  const handleUserModAction = async () => {
    if (!selectedReport || !userModAction) return
    const supabase = createDbClient()
    
    // Get user ID from post if needed
    let targetUserId = selectedReport.target_id
    if (selectedReport.target_type === "post") {
      const { data: post } = await supabase
        .from("posts")
        .select("user_id")
        .eq("id", selectedReport.target_id)
        .single()
      if (post) targetUserId = post.user_id
    }

    if (userModAction === "warn") {
      await supabase.from("warnings").insert({
        user_id: targetUserId,
        warned_by: userId,
        reason: modReason || "Verwarnung",
      })
      toast.success("Nutzer verwarnt!")
    } else if (userModAction === "temp_ban") {
      const durations: Record<string, number> = {
        "1h": 1, "6h": 6, "1d": 24, "3d": 72, "7d": 168, "30d": 720
      }
      const hours = durations[userModDuration] || 24
      const bannedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
      
      await supabase.from("bans").insert({
        user_id: targetUserId,
        banned_by: userId,
        reason: modReason || "Temporärer Ban",
        is_global: true,
        banned_until: bannedUntil,
      })
      toast.success(`Nutzer für ${userModDuration} gebannt!`)
    } else if (userModAction === "perma_ban") {
      await supabase.from("bans").insert({
        user_id: targetUserId,
        banned_by: userId,
        reason: modReason || "Permanenter Ban",
        is_global: true,
        banned_until: null,
      })
      toast.success("Nutzer permanent gebannt!")
    }

    await resolveReport(selectedReport.id, "resolved")
    setShowUserModDialog(false)
    setSelectedReport(null)
    setModReason("")
    setUserModAction("")
  }

  const handleBan = async () => {
    if (!banUserId.trim()) return
    const supabase = createDbClient()
    
    let bannedUntil: string | null = null
    if (banDuration !== "permanent") {
      const durations: Record<string, number> = {
        "1h": 1, "6h": 6, "1d": 24, "3d": 72, "7d": 168, "30d": 720
      }
      const hours = durations[banDuration] || 24
      bannedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
    }
    
    const { error } = await supabase.from("bans").insert({
      user_id: banUserId,
      banned_by: userId,
      reason: banReason || null,
      is_global: true,
      banned_until: bannedUntil,
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(banDuration === "permanent" ? "Nutzer permanent gebannt" : `Nutzer für ${banDuration} gebannt`)
      setBanUserId("")
      setBanReason("")
      setBanDuration("permanent")
      setShowBanDialog(false)
      router.refresh()
    }
  }

  const removeBan = async (banId: string) => {
    const supabase = createDbClient()
    await supabase.from("bans").delete().eq("id", banId)
    toast.success("Ban aufgehoben")
    router.refresh()
  }

  // Filter only pending reports
  const pendingReports = reports.filter(r => r.status === "pending")

  return (
    <div className="max-w-5xl mx-auto">
      {/* Channel Moderation Dialog */}
      <Dialog open={showChannelModDialog} onOpenChange={setShowChannelModDialog}>
        <DialogContent className="glass border-border/50">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" />
              Channel-Moderation
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-4">
            <div className="grid gap-2">
              <Label className="text-foreground">Grund (optional)</Label>
              <Textarea 
                value={modReason} 
                onChange={(e) => setModReason(e.target.value)} 
                placeholder="Grund für die Aktion..." 
                className="bg-secondary/50 border-border/50" 
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button 
                variant="outline" 
                onClick={() => handleChannelModAction("lock_channel")} 
                className="justify-start bg-transparent text-foreground border-border/50"
              >
                <Lock className="h-4 w-4 mr-2" /> Channel sperren
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleChannelModAction("ban_owner")} 
                className="justify-start bg-transparent text-foreground border-border/50"
              >
                <Ban className="h-4 w-4 mr-2" /> Owner bannen
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => handleChannelModAction("lock_and_ban")} 
                className="justify-start"
              >
                <AlertTriangle className="h-4 w-4 mr-2" /> Channel sperren & Owner bannen
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChannelModDialog(false)} className="bg-transparent text-foreground border-border/50">
              Abbrechen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Moderation Dialog */}
      <Dialog open={showUserModDialog} onOpenChange={setShowUserModDialog}>
        <DialogContent className="glass border-border/50">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Nutzer-Moderation
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-4">
            <div className="grid gap-2">
              <Label className="text-foreground">Aktion auswählen</Label>
              <Select value={userModAction} onValueChange={setUserModAction}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue placeholder="Aktion wählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warn">Nutzer verwarnen</SelectItem>
                  <SelectItem value="temp_ban">Temporär bannen</SelectItem>
                  <SelectItem value="perma_ban">Permanent bannen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {userModAction === "temp_ban" && (
              <div className="grid gap-2">
                <Label className="text-foreground">Dauer</Label>
                <Select value={userModDuration} onValueChange={setUserModDuration}>
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
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="grid gap-2">
              <Label className="text-foreground">Grund</Label>
              <Textarea 
                value={modReason} 
                onChange={(e) => setModReason(e.target.value)} 
                placeholder="Grund für die Aktion..." 
                className="bg-secondary/50 border-border/50" 
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowUserModDialog(false)} className="bg-transparent text-foreground border-border/50">
              Abbrechen
            </Button>
            <Button onClick={handleUserModAction} disabled={!userModAction} variant={userModAction === "perma_ban" ? "destructive" : "default"}>
              Ausführen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-3 mb-8">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground text-sm">Verwalte Reports, Verifizierungen und Bans</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Flag className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">Offene Reports</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{pendingReports.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Hash className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">Unverifizierte Channels</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{unverifiedChannels.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">Unverifizierte Bots</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{unverifiedBots.length}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Ban className="h-4 w-4 text-destructive" />
            <span className="text-sm text-muted-foreground">Aktive Bans</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{bans.length}</p>
        </div>
      </div>

      <Tabs defaultValue="reports">
        <TabsList className="glass mb-6">
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="verify">Verifizierung</TabsTrigger>
          <TabsTrigger value="users">Nutzer</TabsTrigger>
          <TabsTrigger value="bans">Bans</TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          {pendingReports.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Flag className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Keine offenen Reports</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingReports.map((report) => (
                <div key={report.id} className="glass rounded-xl p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                          {report.status}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">{report.target_type}</span>
                      </div>
                      <p className="text-sm text-foreground">{report.reason}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        von @{report.profiles?.username} - {new Date(report.created_at).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => handleReportAction(report)} 
                        className="text-green-400 hover:text-green-300"
                        title="Aktion durchführen"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => resolveReport(report.id, "dismissed")} 
                        className="text-muted-foreground hover:text-destructive"
                        title="Report ablehnen"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="verify">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Channels */}
            <div>
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Hash className="h-4 w-4 text-primary" /> Channels verifizieren
              </h3>
              {unverifiedChannels.length === 0 ? (
                <div className="glass rounded-xl p-6 text-center">
                  <p className="text-sm text-muted-foreground">Alle Channels verifiziert</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {unverifiedChannels.map((ch) => (
                    <div key={ch.id} className="glass rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground text-sm">{ch.name}</p>
                        <p className="text-xs text-muted-foreground">von @{ch.profiles?.username}</p>
                      </div>
                      <Button size="sm" onClick={() => verifyChannel(ch.id)} className="text-primary-foreground">
                        <BadgeCheck className="h-3.5 w-3.5 mr-1" /> Verifizieren
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bots */}
            <div>
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" /> Bots verifizieren
              </h3>
              {unverifiedBots.length === 0 ? (
                <div className="glass rounded-xl p-6 text-center">
                  <p className="text-sm text-muted-foreground">Alle Bots verifiziert</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {unverifiedBots.map((bot) => (
                    <div key={bot.id} className="glass rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground text-sm">{bot.name}</p>
                        <p className="text-xs text-muted-foreground">von @{bot.profiles?.username}</p>
                      </div>
                      <Button size="sm" onClick={() => verifyBot(bot.id)} className="text-primary-foreground">
                        <BadgeCheck className="h-3.5 w-3.5 mr-1" /> Verifizieren
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="glass rounded-xl p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-primary" /> Nutzer verifizieren
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Suche nach Username und verifiziere mit einem Klick.
            </p>
            <div className="flex gap-2 mb-4">
              <Input 
                placeholder="Username suchen..." 
                className="bg-secondary/50 border-border/50 flex-1"
                value={verifyUserInput}
                onChange={(e) => setVerifyUserInput(e.target.value)}
              />
              <Button onClick={searchUserByUsername} disabled={searchLoading} className="text-primary-foreground">
                Suchen
              </Button>
            </div>
            {userSearchResults.length > 0 && (
              <div className="flex flex-col gap-2">
                {userSearchResults.map((user) => (
                  <div key={user.id} className="glass rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground text-sm">@{user.username}</p>
                      <p className="text-xs text-muted-foreground">{user.displayName}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80 mt-1">
                        Rolle: {user.role || "user"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => verifyUser(user.id)} className="text-primary-foreground">
                        <BadgeCheck className="h-3.5 w-3.5 mr-1" /> Verifizieren
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => grantAdmin(user.id)}
                        disabled={user.role === "admin" || user.role === "owner"}
                      >
                        <Shield className="h-3.5 w-3.5 mr-1" /> Admin geben
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="bans">
          <div className="flex justify-end mb-4">
            <Dialog open={showBanDialog} onOpenChange={setShowBanDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive"><Ban className="h-4 w-4 mr-2" /> Nutzer bannen</Button>
              </DialogTrigger>
              <DialogContent className="glass border-border/50">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Nutzer bannen</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 mt-4">
                  <div className="grid gap-2">
                    <Label className="text-foreground">User ID</Label>
                    <Input value={banUserId} onChange={(e) => setBanUserId(e.target.value)} placeholder="UUID des Nutzers" className="bg-secondary/50 border-border/50" />
                  </div>
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
                    <Textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Grund fuer den Ban..." className="bg-secondary/50 border-border/50" />
                  </div>
                  <Button variant="destructive" onClick={handleBan}>
                    <Ban className="h-4 w-4 mr-2" /> Bannen
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {bans.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Ban className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Keine aktiven Bans</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {bans.map((ban) => (
                <div key={ban.id} className="glass rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground text-sm">@{ban.profiles?.username}</p>
                      {ban.banned_until ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                          <Clock className="h-3 w-3" /> Temporär
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                          Permanent
                        </span>
                      )}
                    </div>
                    {ban.reason && <p className="text-xs text-muted-foreground mt-0.5">{ban.reason}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {ban.is_global ? "Global" : "Channel"} - {new Date(ban.created_at).toLocaleDateString("de-DE")}
                      {ban.banned_until && ` - Bis: ${new Date(ban.banned_until).toLocaleDateString("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => removeBan(ban.id)} className="bg-transparent text-foreground border-border/50">
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Aufheben
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

