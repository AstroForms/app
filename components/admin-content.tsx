"use client"

import { createDbClient } from "@/lib/db-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
  Shield, BadgeCheck, Flag, Ban, Hash, Bot,
  CheckCircle, XCircle, Trash2, AlertTriangle, Lock, User, Clock, Eye, ScrollText, BarChart3, Megaphone
} from "lucide-react"
import { useEffect, useState } from "react"
// ...existing code...
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"

interface Report {
  id: string
  target_type: string
  target_id: string
  reason: string
  status: string
  details?: string | null
  admin_notes?: string | null
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

interface PromotionRequest {
  id: string
  channel_id: string
  channel_name: string
  requester_id: string
  requester_username: string
  package_key: string
  package_days: number
  cost: number
  created_at: string
}

type FeatureFlags = {
  bots: boolean
  messages: boolean
  automations: boolean
}

type TrustSafetyKpis = {
  pendingReports: number
  newReports24h: number
  activeBans: number
  banRate7d: number
  topReasons: Array<{ reason: string; count: number }>
}

export function AdminContent({
  reports,
  unverifiedChannels,
  unverifiedBots,
  bans,
  promotionRequests,
  userId,
}: {
  reports: Report[]
  unverifiedChannels: UnverifiedChannel[]
  unverifiedBots: UnverifiedBot[]
  bans: BanRecord[]
  promotionRequests: PromotionRequest[]
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
  type User = {
    id: string
    username: string
    displayName?: string
    role?: string
  }
  const [userSearchResults, setUserSearchResults] = useState<User[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [userFilter, setUserFilter] = useState("")
  const [features, setFeatures] = useState<FeatureFlags>({
    bots: true,
    messages: true,
    automations: true,
  })
  const [featuresLoading, setFeaturesLoading] = useState(false)
  const [featuresSaving, setFeaturesSaving] = useState<null | keyof FeatureFlags>(null)
  const [reportStatusFilter, setReportStatusFilter] = useState<"pending" | "resolved" | "dismissed" | "all">("pending")
  const [kpis, setKpis] = useState<TrustSafetyKpis | null>(null)
  const [kpisLoading, setKpisLoading] = useState(false)
  const [promotionActionId, setPromotionActionId] = useState<string | null>(null)

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
        await loadUsers()
        router.refresh()
      } else {
        toast.error(data?.error || "Fehler beim Verifizieren")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Verifizieren")
    }
  }

  const loadUsers = async () => {
    setSearchLoading(true)
    try {
      const res = await fetch("/api/admin/search-user?limit=100")
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

  useEffect(() => {
    void loadUsers()
  }, [])

  const loadFeatures = async () => {
    setFeaturesLoading(true)
    try {
      const res = await fetch("/api/admin/features", { cache: "no-store" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Fehler beim Laden der Funktionen")
      }
      if (data?.features) {
        setFeatures({
          bots: Boolean(data.features.bots),
          messages: Boolean(data.features.messages),
          automations: Boolean(data.features.automations),
        })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Laden der Funktionen")
    } finally {
      setFeaturesLoading(false)
    }
  }

  useEffect(() => {
    void loadFeatures()
  }, [])

  const loadTrustSafety = async () => {
    setKpisLoading(true)
    try {
      const res = await fetch("/api/admin/trust-safety", { cache: "no-store" })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Trust-&-Safety-Daten konnten nicht geladen werden")
      }
      setKpis(data?.kpis || null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Trust-&-Safety-Daten konnten nicht geladen werden")
      setKpis(null)
    } finally {
      setKpisLoading(false)
    }
  }

  useEffect(() => {
    void loadTrustSafety()
  }, [])

  const toggleFeature = async (feature: keyof FeatureFlags, enabled: boolean) => {
    const previous = features
    setFeatures((current) => ({ ...current, [feature]: enabled }))
    setFeaturesSaving(feature)
    try {
      const res = await fetch("/api/admin/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature, enabled }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Speichern fehlgeschlagen")
      }
      if (data?.features) {
        setFeatures({
          bots: Boolean(data.features.bots),
          messages: Boolean(data.features.messages),
          automations: Boolean(data.features.automations),
        })
      }
      toast.success(`Funktion ${enabled ? "aktiviert" : "deaktiviert"}`)
    } catch (error) {
      setFeatures(previous)
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen")
    } finally {
      setFeaturesSaving(null)
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
      await loadUsers()
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Rollen-Update")
    }
  }

  const removeAdmin = async (profileId: string) => {
    if (!profileId.trim()) return
    try {
      const res = await fetch("/api/admin/remove-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: profileId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Fehler beim Rollen-Update")
      }

      if (data?.alreadyUser) {
        toast.info("Nutzer hat keine Admin-Rechte.")
      } else {
        toast.success("Admin-Rolle entfernt!")
      }
      await loadUsers()
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Rollen-Update")
    }
  }

  const resolveReport = async (reportId: string, status: "resolved" | "dismissed") => {
    const supabase = createDbClient()
    await supabase
      .from("reports")
      .update({
        status,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        admin_notes: modReason || null,
      })
      .eq("id", reportId)
    toast.success(`Report ${status === "resolved" ? "aufgeloest" : "abgelehnt"}`)
    router.refresh()
  }

  const banUserById = async (targetUserId: string, reason: string, duration: string) => {
    const res = await fetch("/api/admin/ban-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: targetUserId, reason, duration }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || "Ban fehlgeschlagen")
    }
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
    const channelRow = channel as { owner_id?: string } | null

    if (action === "lock_channel" || action === "lock_and_ban") {
      await supabase.from("channels").update({ is_locked: true }).eq("id", selectedReport.target_id)
      toast.success("Channel gesperrt!")
    }

    if ((action === "ban_owner" || action === "lock_and_ban") && channelRow?.owner_id) {
      await banUserById(channelRow.owner_id, modReason || "Channel-Report", "permanent")
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
      const postRow = post as { user_id?: string } | null
      if (postRow?.user_id) targetUserId = postRow.user_id
    }

    if (userModAction === "temp_ban") {
      const duration = ["1h", "6h", "1d", "3d", "7d", "30d"].includes(userModDuration) ? userModDuration : "1d"
      await banUserById(targetUserId, modReason || "Temporarer Ban", duration)
      toast.success(`Nutzer fuer ${duration} gebannt!`)
    } else if (userModAction === "perma_ban") {
      await banUserById(targetUserId, modReason || "Permanenter Ban", "permanent")
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
    try {
      await banUserById(banUserId, banReason || "", banDuration)
      toast.success(banDuration === "permanent" ? "Nutzer permanent gebannt" : `Nutzer fuer ${banDuration} gebannt`)
      setBanUserId("")
      setBanReason("")
      setBanDuration("permanent")
      setShowBanDialog(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ban fehlgeschlagen")
    }
  }

  const removeBan = async (targetUserId: string) => {
    try {
      const res = await fetch("/api/admin/unban-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: targetUserId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Unban fehlgeschlagen")
      }
      toast.success("Ban aufgehoben")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unban fehlgeschlagen")
    }
  }

  const formatPackageLabel = (request: PromotionRequest) => {
    if (request.package_key === "day") return "1 Tag"
    if (request.package_key === "week") return "7 Tage"
    if (request.package_key === "month") return "30 Tage"
    return `${request.package_days} Tage`
  }

  const handlePromotionRequestAction = async (requestId: string, action: "approve" | "reject") => {
    setPromotionActionId(requestId)
    try {
      const res = await fetch("/api/admin/promotion-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Aktion fehlgeschlagen")
      }
      toast.success(action === "approve" ? "Werbeanfrage angenommen" : "Werbeanfrage abgelehnt")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aktion fehlgeschlagen")
    } finally {
      setPromotionActionId(null)
    }
  }

  const filteredReports = reports.filter((report) => {
    if (reportStatusFilter === "all") return true
    return String(report.status || "").toLowerCase() === reportStatusFilter
  })
  const pendingReports = reports.filter((r) => String(r.status || "").toLowerCase() === "pending")
  const filteredUsers = userSearchResults.filter((user) => {
    const filterValue = userFilter.trim().toLowerCase()
    if (!filterValue) return true
    const username = user.username.toLowerCase()
    const displayName = user.displayName?.toLowerCase() || ""
    return username.includes(filterValue) || displayName.includes(filterValue)
  })

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
                placeholder="Grund fÃ¼r die Aktion..." 
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
              <Label className="text-foreground">Aktion auswÃ¤hlen</Label>
              <Select value={userModAction} onValueChange={setUserModAction}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue placeholder="Aktion wÃ¤hlen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="temp_ban">TemporÃ¤r bannen</SelectItem>
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
                placeholder="Grund fÃ¼r die Aktion..." 
                className="bg-secondary/50 border-border/50" 
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowUserModDialog(false)} className="bg-transparent text-foreground border-border/50">
              Abbrechen
            </Button>
            <Button onClick={handleUserModAction} disabled={!userModAction} variant={userModAction === "perma_ban" ? "destructive" : "default"}>
              AusfÃ¼hren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-3 mb-8">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground text-sm">Verwalte Reports, Verifizierungen, Werbeanfragen und Bans</p>
        </div>
        <div className="ml-auto">
          <Button variant="outline" asChild className="bg-transparent">
            <Link href="/admin/audit-logs">
              <ScrollText className="h-4 w-4 mr-2" /> Audit-Logs
            </Link>
          </Button>
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
          <TabsTrigger value="trust">Trust & Safety</TabsTrigger>
          <TabsTrigger value="verify">Verifizierung</TabsTrigger>
          <TabsTrigger value="users">Nutzer</TabsTrigger>
          <TabsTrigger value="bans">Bans</TabsTrigger>
          <TabsTrigger value="features">Funktionen</TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          <div className="mb-4 flex items-center gap-2">
            <Button size="sm" variant={reportStatusFilter === "pending" ? "default" : "outline"} className={reportStatusFilter === "pending" ? "" : "bg-transparent"} onClick={() => setReportStatusFilter("pending")}>Offen</Button>
            <Button size="sm" variant={reportStatusFilter === "resolved" ? "default" : "outline"} className={reportStatusFilter === "resolved" ? "" : "bg-transparent"} onClick={() => setReportStatusFilter("resolved")}>Resolved</Button>
            <Button size="sm" variant={reportStatusFilter === "dismissed" ? "default" : "outline"} className={reportStatusFilter === "dismissed" ? "" : "bg-transparent"} onClick={() => setReportStatusFilter("dismissed")}>Dismissed</Button>
            <Button size="sm" variant={reportStatusFilter === "all" ? "default" : "outline"} className={reportStatusFilter === "all" ? "" : "bg-transparent"} onClick={() => setReportStatusFilter("all")}>Alle</Button>
          </div>
          {filteredReports.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Flag className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Keine Reports in diesem Filter</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredReports.map((report) => (
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
                      {report.details ? <p className="text-xs text-muted-foreground mt-1">{report.details}</p> : null}
                      <p className="text-[10px] text-muted-foreground mt-1">Target: {report.target_type} #{report.target_id}</p>
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
                        title="Aktion durchfÃ¼hren"
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

        <TabsContent value="trust">
          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Trust & Safety
              </h3>
              <Button size="sm" variant="outline" className="bg-transparent" onClick={loadTrustSafety}>Aktualisieren</Button>
            </div>
            {kpisLoading ? (
              <p className="text-sm text-muted-foreground">Daten werden geladen...</p>
            ) : !kpis ? (
              <p className="text-sm text-muted-foreground">Keine Daten verfÃ¼gbar.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
                    <p className="text-xs text-muted-foreground">Offene Reports</p>
                    <p className="text-xl font-semibold text-foreground">{kpis.pendingReports}</p>
                  </div>
                  <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
                    <p className="text-xs text-muted-foreground">Neue Reports (24h)</p>
                    <p className="text-xl font-semibold text-foreground">{kpis.newReports24h}</p>
                  </div>
                  <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
                    <p className="text-xs text-muted-foreground">Aktive Bans</p>
                    <p className="text-xl font-semibold text-foreground">{kpis.activeBans}</p>
                  </div>
                  <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
                    <p className="text-xs text-muted-foreground">Ban-Rate (7d)</p>
                    <p className="text-xl font-semibold text-foreground">{kpis.banRate7d}%</p>
                  </div>
                </div>
                <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
                  <p className="text-sm font-medium text-foreground mb-2">Top Report-GrÃ¼nde (7d)</p>
                  {kpis.topReasons.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Keine EintrÃ¤ge.</p>
                  ) : (
                    <div className="space-y-1">
                      {kpis.topReasons.map((entry) => (
                        <div key={entry.reason} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{entry.reason}</span>
                          <span className="text-foreground font-medium">{entry.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="verify">
          <div className="grid gap-6 xl:grid-cols-3">
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

            {/* Promotion Requests */}
            <div>
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" /> Werbeanfragen
              </h3>
              {promotionRequests.length === 0 ? (
                <div className="glass rounded-xl p-6 text-center">
                  <p className="text-sm text-muted-foreground">Keine offenen Werbeanfragen</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {promotionRequests.map((request) => {
                    const isActionLoading = promotionActionId === request.id
                    return (
                      <div key={request.id} className="glass rounded-xl p-4">
                        <div className="mb-2">
                          <p className="font-medium text-foreground text-sm">{request.channel_name}</p>
                          <p className="text-xs text-muted-foreground">von @{request.requester_username}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Paket: {formatPackageLabel(request)} - {request.cost} XP
                          </p>
                          <p className="text-[10px] text-muted-foreground/80 mt-1">
                            Eingegangen: {new Date(request.created_at).toLocaleString("de-DE")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            disabled={isActionLoading}
                            onClick={() => handlePromotionRequestAction(request.id, "approve")}
                            className="text-primary-foreground"
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Annehmen
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isActionLoading}
                            onClick={() => handlePromotionRequestAction(request.id, "reject")}
                            className="bg-transparent"
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Ablehnen
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="glass rounded-xl p-6">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-primary" /> Nutzerliste & Rollen
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Alle Nutzer mit direkten Admin-Aktionen in einer Liste.
            </p>
            <div className="flex gap-2 mb-4">
              <Input 
                placeholder="In Liste filtern..." 
                className="bg-secondary/50 border-border/50 flex-1"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
              />
              <Button onClick={loadUsers} disabled={searchLoading} className="text-primary-foreground">
                Aktualisieren
              </Button>
            </div>
            {searchLoading ? (
              <p className="text-sm text-muted-foreground">Nutzer werden geladen...</p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Nutzer gefunden.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="glass rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground text-sm">@{user.username}</p>
                      <p className="text-xs text-muted-foreground">{user.displayName}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80 mt-1">
                        Rolle: {user.role || "user"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" asChild className="bg-transparent">
                        <Link href={`/admin/users/${user.id}`}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> Benutzer ansehen
                        </Link>
                      </Button>
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeAdmin(user.id)}
                        disabled={user.role !== "admin"}
                        className="bg-transparent"
                      >
                        <Shield className="h-3.5 w-3.5 mr-1" /> Admin entfernen
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
                          <Clock className="h-3 w-3" /> TemporÃ¤r
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
                  <Button size="sm" variant="outline" onClick={() => removeBan(ban.user_id)} className="bg-transparent text-foreground border-border/50">
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Aufheben
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="features">
          <div className="glass rounded-xl p-6">
            <h3 className="font-semibold text-foreground mb-2">Funktionen</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Hier kannst du zentrale App-Bereiche global aktivieren oder deaktivieren.
            </p>
            {featuresLoading ? (
              <p className="text-sm text-muted-foreground">Funktionen werden geladen...</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/20 p-4">
                  <div>
                    <p className="font-medium text-foreground">Bots</p>
                    <p className="text-xs text-muted-foreground">Steuert alle Bot-Seiten und Bot-Verwendung.</p>
                  </div>
                  <Switch
                    checked={features.bots}
                    disabled={featuresSaving !== null}
                    onCheckedChange={(checked) => toggleFeature("bots", checked)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/20 p-4">
                  <div>
                    <p className="font-medium text-foreground">Nachrichten</p>
                    <p className="text-xs text-muted-foreground">Steuert die Direktnachrichten-Funktion.</p>
                  </div>
                  <Switch
                    checked={features.messages}
                    disabled={featuresSaving !== null}
                    onCheckedChange={(checked) => toggleFeature("messages", checked)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/20 p-4">
                  <div>
                    <p className="font-medium text-foreground">Automatisierung</p>
                    <p className="text-xs text-muted-foreground">Steuert die Ausfuehrung und Verwaltung von Automationen.</p>
                  </div>
                  <Switch
                    checked={features.automations}
                    disabled={featuresSaving !== null}
                    onCheckedChange={(checked) => toggleFeature("automations", checked)}
                  />
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

