"use client"

import { createDbClient } from "@/lib/db-client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Bot,
  BadgeCheck,
  Settings2,
  Zap,
  Users,
  Plus,
  Calendar,
  Shield,
  Image as ImageIcon,
  Edit2,
  ExternalLink,
  ScrollText,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

function resolveMediaUrl(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed
  }
  const normalized = trimmed.replace(/^\/+/, "").replace(/^uploads\//, "").replace(/^api\/media\//, "")
  return `/api/media/${normalized}`
}

interface BotRule {
  id: string
  bot_id: string
  rule_name: string
  rule_description: string
  rule_category: string
  is_active: boolean
}

interface Bot {
  id: string
  name: string
  description: string | null
  avatar_url: string | null
  banner_url: string | null
  is_verified: boolean
  is_active: boolean
  is_public: boolean
  created_at: string
  owner_id: string
  profiles: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
  }
}

interface Channel {
  id: string
  name: string
  avatar_url: string | null
  is_verified: boolean
}

interface Automation {
  id: string
  name: string
  description: string | null
  trigger_type: string
  action_type: string
  is_active: boolean
}

interface ChannelInvite {
  channel_id: string
  status: string
}

// Preset rules that users can select
const presetRules = [
  { category: "Moderation", name: "Keine Beleidigungen", description: "Lösche Posts mit Beleidigungen und sende eine Warnung an den Nutzer" },
  { category: "Moderation", name: "Keine Spam-Links", description: "Blockiere Posts mit verdächtigen oder Spam-Links automatisch" },
  { category: "Moderation", name: "Keine Werbung", description: "Entferne Posts die Werbung oder Promotions enthalten" },
  { category: "Moderation", name: "Keine NSFW-Inhalte", description: "Blockiere nicht jugendfreie Inhalte und Bilder" },
  { category: "Moderation", name: "Caps-Lock Filter", description: "Warne Nutzer bei übermäßiger Verwendung von Großbuchstaben" },
  { category: "Moderation", name: "Flood-Schutz", description: "Verhindere, dass Nutzer zu viele Posts in kurzer Zeit senden" },
  { category: "Moderation", name: "Keyword-Blacklist", description: "Filtere Posts mit bestimmten verbotenen Wörtern heraus" },
  { category: "Moderation", name: "Link-Whitelist", description: "Erlaube nur Links von vertrauenswürdigen Domains" },
  { category: "Engagement", name: "Willkommens-Nachricht", description: "Sende eine Willkommensnachricht wenn jemand dem Channel beitritt" },
  { category: "Engagement", name: "Täglicher Post", description: "Sende jeden Tag um eine bestimmte Uhrzeit einen Post" },
  { category: "Engagement", name: "Wöchentliches Update", description: "Sende jeden Montag eine Zusammenfassung der Woche" },
  { category: "Engagement", name: "Geburtstags-Glückwünsche", description: "Gratuliere Nutzern automatisch zum Geburtstag" },
  { category: "Engagement", name: "Aktivitäts-Reminder", description: "Erinnere Nutzer bei Inaktivität wieder aktiv zu werden" },
  { category: "Belohnungen", name: "XP für Posts", description: "Vergebe XP-Punkte für jeden Post den ein Nutzer schreibt" },
  { category: "Belohnungen", name: "XP für Likes", description: "Vergebe XP wenn Posts eines Nutzers geliked werden" },
  { category: "Belohnungen", name: "Streak-Bonus", description: "Bonus-XP für tägliche Aktivität in Folge" },
  { category: "Belohnungen", name: "Level-Up Nachricht", description: "Gratuliere Nutzern wenn sie ein neues Level erreichen" },
  { category: "Utility", name: "Auto-Tag", description: "Füge automatisch relevante Tags zu Posts hinzu" },
  { category: "Utility", name: "Statistik-Report", description: "Sende regelmäßig Channel-Statistiken an Admins" },
  { category: "Community", name: "Vorstellungs-Reminder", description: "Erinnere neue Mitglieder sich vorzustellen" },
  { category: "Community", name: "Regel-Reminder", description: "Erinnere regelmäßig an die Channel-Regeln" },
  { category: "Sicherheit", name: "Raid-Schutz", description: "Aktiviere Schutz bei massenhaften Beitritten" },
  { category: "Sicherheit", name: "Phishing-Erkennung", description: "Erkenne und blockiere Phishing-Versuche" },
]

const triggerLabels: Record<string, string> = {
  on_post: "📝 Wenn gepostet wird",
  on_join: "👋 Wenn jemand beitritt",
  on_leave: "👋 Wenn jemand verlässt",
  scheduled: "⏰ Geplant",
  on_keyword: "🔍 Bei Keyword",
  on_like: "❤️ Bei Like",
  on_comment: "💬 Bei Kommentar",
}

const actionLabels: Record<string, string> = {
  send_post: "📝 Post senden",
  send_reply: "💬 Antworten",
  delete_post: "🗑️ Post löschen",
  warn_user: "⚠️ Warnen",
  add_xp: "⭐ XP vergeben",
  assign_badge: "🏅 Badge vergeben",
}

export function BotProfileContent({
  bot,
  activeRules,
  channels,
  channelCount,
  automations,
  isOwner,
  currentUserId,
  userChannels,
  existingInvites,
  verificationStatus,
  rejectionReason,
}: {
  bot: Bot
  activeRules: BotRule[]
  channels: Channel[]
  channelCount: number
  automations: Automation[]
  isOwner: boolean
  currentUserId: string
  userChannels: { id: string; name: string }[]
  existingInvites: ChannelInvite[]
  verificationStatus: string | null
  rejectionReason: string | null
}) {
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [showVerifyDialog, setShowVerifyDialog] = useState(false)
  const [showRulesDialog, setShowRulesDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // Edit form state
  const [editName, setEditName] = useState(bot.name)
  const [editDesc, setEditDesc] = useState(bot.description || "")
  const [editIsPublic, setEditIsPublic] = useState(bot.is_public)
  const [editIsActive, setEditIsActive] = useState(bot.is_active)
  
  // Image upload state
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(resolveMediaUrl(bot.avatar_url))
  const [bannerPreview, setBannerPreview] = useState<string | null>(resolveMediaUrl(bot.banner_url))
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  
  // Invite state
  const [selectedChannelForInvite, setSelectedChannelForInvite] = useState("")
  
  // Verification form state
  const [botPurpose, setBotPurpose] = useState("")
  const [targetAudience, setTargetAudience] = useState("")
  const [uniqueFeatures, setUniqueFeatures] = useState("")
  const [expectedUsers, setExpectedUsers] = useState("")
  const [hasPrivacyPolicy, setHasPrivacyPolicy] = useState(false)
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [additionalInfo, setAdditionalInfo] = useState("")
  
  const router = useRouter()

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
    }
  }

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setBannerFile(file)
      setBannerPreview(URL.createObjectURL(file))
    }
  }

  const uploadImage = async (file: File, type: "avatar" | "banner"): Promise<string | null> => {
    const supabase = createDbClient()
    const ext = file.name.split(".").pop()
    const fileName = `${bot.id}/${type}_${Date.now()}.${ext}`
    
    const { error } = await supabase.storage
      .from("bot-images")
      .upload(fileName, file, { upsert: true })
    
    if (error) {
      toast.error(`Fehler beim Hochladen: ${error.message}`)
      return null
    }
    
    const { data: urlData } = supabase.storage
      .from("bot-images")
      .getPublicUrl(fileName)
    
    return resolveMediaUrl(urlData.publicUrl)
  }

  const handleSaveBot = async () => {
    setIsLoading(true)
    const supabase = createDbClient()
    
    let newAvatarUrl = resolveMediaUrl(bot.avatar_url)
    let newBannerUrl = resolveMediaUrl(bot.banner_url)
    
    if (avatarFile) {
      newAvatarUrl = await uploadImage(avatarFile, "avatar")
    }
    if (bannerFile) {
      newBannerUrl = await uploadImage(bannerFile, "banner")
    }
    
    const { error } = await supabase
      .from("bots")
      .update({
        name: editName,
        description: editDesc || null,
        is_public: editIsPublic,
        is_active: editIsActive,
        avatar_url: newAvatarUrl,
        banner_url: newBannerUrl,
      })
      .eq("id", bot.id)
    
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Bot aktualisiert!")
      setShowEditDialog(false)
      router.refresh()
    }
    setIsLoading(false)
  }

  const handleInviteBot = async () => {
    if (!selectedChannelForInvite) return
    setIsLoading(true)
    const supabase = createDbClient()
    
    const { error } = await supabase
      .from("bot_channel_invites")
      .insert({
        bot_id: bot.id,
        channel_id: selectedChannelForInvite,
        invited_by: currentUserId,
        status: "pending",
      })
    
    if (error) {
      if (error.code === "23505") {
        toast.error("Dieser Bot wurde bereits zu diesem Channel eingeladen")
      } else {
        toast.error(error.message)
      }
    } else {
      toast.success("Bot eingeladen! Der Bot-Besitzer muss die Einladung noch annehmen.")
      setShowInviteDialog(false)
      setSelectedChannelForInvite("")
      router.refresh()
    }
    setIsLoading(false)
  }

  const handleSubmitVerification = async () => {
    if (!botPurpose || !targetAudience || !uniqueFeatures || !expectedUsers || !contactEmail) {
      toast.error("Bitte fülle alle Pflichtfelder aus")
      return
    }
    
    setIsLoading(true)
    const supabase = createDbClient()
    
    const { error } = await supabase
      .from("bot_verification_requests")
      .insert({
        bot_id: bot.id,
        owner_id: currentUserId,
        bot_purpose: botPurpose,
        target_audience: targetAudience,
        unique_features: uniqueFeatures,
        expected_users: expectedUsers,
        channel_count: channelCount,
        has_privacy_policy: hasPrivacyPolicy,
        privacy_policy_url: privacyPolicyUrl || null,
        contact_email: contactEmail,
        additional_info: additionalInfo || null,
      })
    
    if (error) {
      if (error.code === "23505") {
        toast.error("Du hast bereits eine Verifizierungsanfrage für diesen Bot")
      } else {
        toast.error(error.message)
      }
    } else {
      toast.success("Verifizierungsanfrage eingereicht!")
      setShowVerifyDialog(false)
      router.refresh()
    }
    setIsLoading(false)
  }

  const toggleRule = async (ruleName: string, ruleDesc: string, ruleCategory: string) => {
    const supabase = createDbClient()
    const existingRule = activeRules.find(r => r.rule_name === ruleName)
    
    if (existingRule) {
      // Toggle or remove
      if (existingRule.is_active) {
        await supabase.from("bot_active_rules").delete().eq("id", existingRule.id)
        toast.success("Regel deaktiviert")
      } else {
        await supabase.from("bot_active_rules").update({ is_active: true }).eq("id", existingRule.id)
        toast.success("Regel aktiviert")
      }
    } else {
      // Add new rule
      await supabase.from("bot_active_rules").insert({
        bot_id: bot.id,
        rule_name: ruleName,
        rule_description: ruleDesc,
        rule_category: ruleCategory,
        is_active: true,
      })
      toast.success("Regel hinzugefügt")
    }
    router.refresh()
  }

  const canRequestVerification = channelCount >= 50 && !verificationStatus

  const availableChannelsForInvite = userChannels.filter(
    c => !existingInvites.some(i => i.channel_id === c.id)
  )

  const ruleCategories = [...new Set(presetRules.map(r => r.category))]

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="relative h-48 rounded-xl overflow-hidden bg-gradient-to-r from-primary/20 to-primary/5">
        {resolveMediaUrl(bot.banner_url) && (
          <img src={resolveMediaUrl(bot.banner_url) || undefined} alt="Banner" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
      </div>

      {/* Bot Info Header */}
      <div className="flex flex-col md:flex-row gap-6 -mt-16 px-6 relative z-10">
        <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
          <AvatarImage src={resolveMediaUrl(bot.avatar_url) || undefined} />
          <AvatarFallback className="text-4xl bg-primary/10">
            <Bot className="h-16 w-16" />
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-2 pt-4 md:pt-8">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold">{bot.name}</h1>
            {bot.is_verified && (
              <Badge variant="secondary" className="gap-1">
                <BadgeCheck className="h-3 w-3" />
                Verifiziert
              </Badge>
            )}
            {!bot.is_active && (
              <Badge variant="outline" className="text-muted-foreground">
                Inaktiv
              </Badge>
            )}
            {bot.is_public && (
              <Badge variant="outline" className="text-green-500 border-green-500/30">
                Öffentlich
              </Badge>
            )}
          </div>

          <p className="text-muted-foreground">{bot.description || "Keine Beschreibung"}</p>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href={`/profile/${bot.profiles.id}`} className="flex items-center gap-2 hover:text-foreground transition-colors">
              <Avatar className="h-5 w-5">
                <AvatarImage src={bot.profiles.avatar_url || undefined} />
                <AvatarFallback>{bot.profiles.username[0]}</AvatarFallback>
              </Avatar>
              <span>von {bot.profiles.display_name || bot.profiles.username}</span>
            </Link>
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {channelCount} Channels
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(bot.created_at).toLocaleDateString("de-DE")}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-4 md:pt-8">
          {isOwner ? (
            <>
              <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Edit2 className="h-4 w-4 mr-2" />
                    Bearbeiten
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Bot bearbeiten</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {/* Avatar Upload */}
                    <div className="space-y-2">
                      <Label>Profilbild</Label>
                      <div className="flex items-center gap-4">
                        <Avatar className="h-20 w-20">
                          <AvatarImage src={resolveMediaUrl(avatarPreview) || undefined} />
                          <AvatarFallback><Bot className="h-10 w-10" /></AvatarFallback>
                        </Avatar>
                        <Button variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()}>
                          <ImageIcon className="h-4 w-4 mr-2" />
                          Bild wählen
                        </Button>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarChange}
                        />
                      </div>
                    </div>

                    {/* Banner Upload */}
                    <div className="space-y-2">
                      <Label>Banner</Label>
                      <div 
                        className="relative h-24 rounded-lg overflow-hidden bg-muted cursor-pointer hover:bg-muted/80 transition-colors"
                        onClick={() => bannerInputRef.current?.click()}
                      >
                        {bannerPreview ? (
                          <img src={resolveMediaUrl(bannerPreview) || undefined} alt="Banner Preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            <ImageIcon className="h-8 w-8 mr-2" />
                            Banner hinzufügen
                          </div>
                        )}
                      </div>
                      <input
                        ref={bannerInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleBannerChange}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={editName} onChange={e => setEditName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Beschreibung</Label>
                      <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Öffentlich sichtbar</Label>
                        <p className="text-xs text-muted-foreground">Andere können diesen Bot finden und einladen</p>
                      </div>
                      <Switch checked={editIsPublic} onCheckedChange={setEditIsPublic} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Bot aktiviert</Label>
                        <p className="text-xs text-muted-foreground">Bot reagiert auf Events</p>
                      </div>
                      <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
                    </div>
                    <Button className="w-full" onClick={handleSaveBot} disabled={isLoading}>
                      {isLoading ? "Speichern..." : "Speichern"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={showRulesDialog} onOpenChange={setShowRulesDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ScrollText className="h-4 w-4 mr-2" />
                    Regeln
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Bot-Regeln verwalten</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {ruleCategories.map(category => (
                      <div key={category} className="space-y-2">
                        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                          {category}
                        </h3>
                        <div className="space-y-1">
                          {presetRules.filter(r => r.category === category).map(rule => {
                            const isActive = activeRules.some(
                              ar => ar.rule_name === rule.name && ar.is_active
                            )
                            return (
                              <div
                                key={rule.name}
                                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                                  isActive ? "bg-primary/10 border-primary/30" : "hover:bg-muted/50"
                                }`}
                                onClick={() => toggleRule(rule.name, rule.description, rule.category)}
                              >
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{rule.name}</p>
                                  <p className="text-xs text-muted-foreground">{rule.description}</p>
                                </div>
                                <Checkbox checked={isActive} />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>

              {canRequestVerification && (
                <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <BadgeCheck className="h-4 w-4 mr-2" />
                      Verifizierung anfragen
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Bot-Verifizierung beantragen</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <p className="text-sm text-muted-foreground">
                        Dein Bot ist in {channelCount} Channels aktiv. Beantworte die folgenden Fragen für die Verifizierung.
                      </p>

                      <div className="space-y-2">
                        <Label>Was ist der Zweck deines Bots? *</Label>
                        <Textarea
                          value={botPurpose}
                          onChange={e => setBotPurpose(e.target.value)}
                          placeholder="Beschreibe den Hauptzweck deines Bots..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Wer ist die Zielgruppe? *</Label>
                        <Textarea
                          value={targetAudience}
                          onChange={e => setTargetAudience(e.target.value)}
                          placeholder="Für welche Art von Communities ist dein Bot gedacht?"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Was macht deinen Bot einzigartig? *</Label>
                        <Textarea
                          value={uniqueFeatures}
                          onChange={e => setUniqueFeatures(e.target.value)}
                          placeholder="Welche besonderen Features bietet dein Bot?"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Erwartete Nutzerzahl *</Label>
                        <Input
                          value={expectedUsers}
                          onChange={e => setExpectedUsers(e.target.value)}
                          placeholder="z.B. 1000-5000 Nutzer"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Kontakt-Email *</Label>
                        <Input
                          type="email"
                          value={contactEmail}
                          onChange={e => setContactEmail(e.target.value)}
                          placeholder="support@example.com"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="privacy"
                          checked={hasPrivacyPolicy}
                          onCheckedChange={c => setHasPrivacyPolicy(!!c)}
                        />
                        <Label htmlFor="privacy" className="text-sm">
                          Mein Bot hat eine Datenschutzerklärung
                        </Label>
                      </div>

                      {hasPrivacyPolicy && (
                        <div className="space-y-2">
                          <Label>URL zur Datenschutzerklärung</Label>
                          <Input
                            value={privacyPolicyUrl}
                            onChange={e => setPrivacyPolicyUrl(e.target.value)}
                            placeholder="https://..."
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Zusätzliche Informationen</Label>
                        <Textarea
                          value={additionalInfo}
                          onChange={e => setAdditionalInfo(e.target.value)}
                          placeholder="Gibt es noch etwas, das wir wissen sollten?"
                        />
                      </div>

                      <Button className="w-full" onClick={handleSubmitVerification} disabled={isLoading}>
                        {isLoading ? "Einreichen..." : "Verifizierung beantragen"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {verificationStatus && (
                <Badge
                  variant={
                    verificationStatus === "approved"
                      ? "default"
                      : verificationStatus === "rejected"
                      ? "destructive"
                      : "secondary"
                  }
                  className="gap-1"
                >
                  {verificationStatus === "pending" && <Clock className="h-3 w-3" />}
                  {verificationStatus === "approved" && <CheckCircle className="h-3 w-3" />}
                  {verificationStatus === "rejected" && <XCircle className="h-3 w-3" />}
                  {verificationStatus === "pending" && "Prüfung läuft"}
                  {verificationStatus === "approved" && "Genehmigt"}
                  {verificationStatus === "rejected" && "Abgelehnt"}
                </Badge>
              )}
            </>
          ) : (
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={availableChannelsForInvite.length === 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  Bot einladen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bot zu Channel einladen</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Wähle einen deiner Channels aus, um diesen Bot einzuladen.
                  </p>
                  <Select value={selectedChannelForInvite} onValueChange={setSelectedChannelForInvite}>
                    <SelectTrigger>
                      <SelectValue placeholder="Channel wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableChannelsForInvite.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {availableChannelsForInvite.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Du hast keinen Channel, dessen Owner du bist.
                    </p>
                  )}
                  <Button className="w-full" onClick={handleInviteBot} disabled={isLoading || !selectedChannelForInvite}>
                    {isLoading ? "Einladen..." : "Einladen"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Verification Rejection Notice */}
      {verificationStatus === "rejected" && rejectionReason && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Verifizierung abgelehnt</p>
                <p className="text-sm text-muted-foreground">{rejectionReason}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules" className="gap-2">
            <Shield className="h-4 w-4" />
            Regeln
          </TabsTrigger>
          <TabsTrigger value="automations" className="gap-2">
            <Zap className="h-4 w-4" />
            Automationen
          </TabsTrigger>
          <TabsTrigger value="channels" className="gap-2">
            <Users className="h-4 w-4" />
            Channels
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          {activeRules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <ScrollText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Keine aktiven Regeln</p>
                {isOwner && <p className="text-sm mt-1">Klicke auf "Regeln" um Regeln hinzuzufügen</p>}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {activeRules.filter(r => r.is_active).map(rule => (
                <Card key={rule.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge variant="outline" className="mb-2 text-xs">
                          {rule.rule_category}
                        </Badge>
                        <h3 className="font-medium">{rule.rule_name}</h3>
                        <p className="text-sm text-muted-foreground">{rule.rule_description}</p>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="automations" className="space-y-4">
          {automations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Keine Automationen</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {automations.map(auto => (
                <Card key={auto.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{auto.name}</h3>
                          {!auto.is_active && (
                            <Badge variant="outline" className="text-xs">Pausiert</Badge>
                          )}
                        </div>
                        {auto.description && (
                          <p className="text-sm text-muted-foreground mb-2">{auto.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="secondary">
                            {triggerLabels[auto.trigger_type] || auto.trigger_type}
                          </Badge>
                          <span>→</span>
                          <Badge variant="secondary">
                            {actionLabels[auto.action_type] || auto.action_type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          {channels.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Noch nicht in Channels aktiv</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {channels.map(channel => (
                <Link key={channel.id} href={`/channels/${channel.id}`}>
                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={channel.avatar_url || undefined} />
                          <AvatarFallback>{channel.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-medium truncate">{channel.name}</span>
                            {channel.is_verified && <BadgeCheck className="h-4 w-4 text-primary flex-shrink-0" />}
                          </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

