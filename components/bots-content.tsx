"use client"

import { createDbClient } from "@/lib/db-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"
import { Bot, Plus, Zap, BadgeCheck, PlayCircle, PauseCircle, Trash2, Settings2, ScrollText, Edit2, GripVertical, Image as ImageIcon, ExternalLink, Check, X, Bell, UserPlus } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { useState, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

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

interface BotActiveRule {
  id: string
  bot_id: string
  rule_name: string
  rule_description: string
  rule_category: string
  is_active: boolean
}

interface BotChannelInvite {
  id: string
  bot_id: string
  channel_id: string
  status: string
  channels: { id: string; name: string }
}

interface BotType {
  id: string
  name: string
  description: string | null
  avatar_url: string | null
  banner_url: string | null
  is_verified: boolean
  is_active: boolean
  is_public: boolean
  created_at: string
}

interface AutomationType {
  id: string
  name: string
  description: string | null
  trigger_type: string
  action_type: string
  trigger_config: Record<string, unknown>
  action_config: Record<string, unknown>
  is_active: boolean
  bot_id: string | null
  bots: { name: string } | null
  cooldown_seconds?: number
  trigger_count?: number
  last_triggered_at?: string
}

interface Channel {
  id: string
  name: string
}

const triggerTypes = [
  // Post triggers
  { value: "on_post", label: "📝 Wenn gepostet wird", category: "Posts" },
  { value: "on_post_edit", label: "✏️ Wenn Post bearbeitet wird", category: "Posts" },
  { value: "on_post_delete", label: "🗑️ Wenn Post gelöscht wird", category: "Posts" },
  { value: "on_first_post", label: "🎉 Erster Post eines Nutzers", category: "Posts" },
  // User triggers
  { value: "on_join", label: "👋 Wenn jemand beitritt", category: "Nutzer" },
  { value: "on_leave", label: "👋 Wenn jemand verlässt", category: "Nutzer" },
  // Interaction triggers
  { value: "on_like", label: "❤️ Wenn Post geliked wird", category: "Interaktion" },
  { value: "on_comment", label: "💬 Wenn kommentiert wird", category: "Interaktion" },
  { value: "on_share", label: "🔗 Wenn Post geteilt wird", category: "Interaktion" },
  { value: "on_remix", label: "🔄 Wenn Post remixt wird", category: "Interaktion" },
  { value: "on_save", label: "🔖 Wenn Post gespeichert wird", category: "Interaktion" },
  // Content triggers
  { value: "on_keyword", label: "🔍 Wenn Keyword erkannt wird", category: "Inhalt" },
  { value: "on_mention", label: "@ Wenn erwähnt wird", category: "Inhalt" },
  { value: "on_hashtag", label: "# Wenn Hashtag verwendet", category: "Inhalt" },
  { value: "on_link", label: "🔗 Wenn Link gepostet wird", category: "Inhalt" },
  { value: "on_image", label: "🖼️ Wenn Bild gepostet wird", category: "Inhalt" },
  { value: "on_gif", label: "🎬 Wenn GIF gepostet wird", category: "Inhalt" },
  // Milestone triggers
  { value: "on_streak", label: "🔥 Bei Streak-Erreichen", category: "Meilensteine" },
  { value: "on_post_count", label: "📊 Bei Post-Meilenstein", category: "Meilensteine" },
  // Time triggers
  { value: "scheduled", label: "⏰ Geplant (zeitbasiert)", category: "Zeit" },
  { value: "on_time_inactive", label: "💤 Bei Inaktivität", category: "Zeit" },
  // Moderation triggers
  { value: "on_report", label: "🚨 Wenn gemeldet wird", category: "Moderation" },
  { value: "on_spam_detected", label: "🛑 Bei Spam-Erkennung", category: "Moderation" },
  { value: "on_bad_word", label: "🚫 Bei verbotenem Wort", category: "Moderation" },
  // Special triggers
  { value: "on_birthday", label: "🎂 Am Geburtstag", category: "Events" },
  { value: "on_anniversary", label: "🎊 Am Beitritts-Jubiläum", category: "Events" },
  { value: "manual", label: "🖱️ Manuell auslösen", category: "Sonstiges" },
]

const actionTypes = [
  // Messaging actions
  { value: "send_post", label: "📝 Post senden", category: "Nachrichten" },
  { value: "send_reply", label: "💬 Antworten", category: "Nachrichten" },
  { value: "send_welcome", label: "👋 Willkommensnachricht", category: "Nachrichten" },
  { value: "send_reminder", label: "⏰ Erinnerung senden", category: "Nachrichten" },
  { value: "send_announcement", label: "📢 Ankündigung", category: "Nachrichten" },
  // Moderation actions
  { value: "delete_post", label: "🗑️ Post löschen", category: "Moderation" },
  { value: "warn_user", label: "⚠️ Nutzer warnen", category: "Moderation" },
  { value: "mute_user", label: "🔇 Nutzer stummschalten", category: "Moderation" },
  { value: "kick_user", label: "👢 Nutzer entfernen", category: "Moderation" },
  { value: "ban_user", label: "🚫 Nutzer bannen", category: "Moderation" },
  { value: "pin_post", label: "📌 Post anpinnen", category: "Moderation" },
  { value: "unpin_post", label: "📌 Post lösen", category: "Moderation" },
  { value: "lock_post", label: "🔒 Post sperren", category: "Moderation" },
  { value: "hide_post", label: "👁️ Post verstecken", category: "Moderation" },
  // Reward actions
  { value: "assign_badge", label: "🏅 Badge vergeben", category: "Belohnungen" },
  { value: "remove_badge", label: "🏅 Badge entfernen", category: "Belohnungen" },
  { value: "assign_role", label: "👑 Rolle zuweisen", category: "Belohnungen" },
  { value: "add_streak", label: "🔥 Streak hinzufügen", category: "Belohnungen" },
  // Utility actions
  { value: "auto_tag", label: "🏷️ Auto-Tag hinzufügen", category: "Utility" },
  { value: "translate_post", label: "🌐 Post übersetzen", category: "Utility" },
  { value: "create_poll", label: "📊 Umfrage erstellen", category: "Utility" },
  { value: "archive_post", label: "📦 Post archivieren", category: "Utility" },
  { value: "log_action", label: "📋 Aktion loggen", category: "Utility" },
  // Engagement actions
  { value: "auto_like", label: "❤️ Auto-Like", category: "Engagement" },
  { value: "auto_comment", label: "💬 Auto-Kommentar", category: "Engagement" },
  { value: "feature_post", label: "⭐ Post featuren", category: "Engagement" },
  { value: "share_to_channel", label: "📤 In Channel teilen", category: "Engagement" },
  // Chain actions
  { value: "trigger_automation", label: "🔗 Automation auslösen", category: "Verkettung" },
]

const triggerCategories = [...new Set(triggerTypes.map(t => t.category))]
const actionCategories = [...new Set(actionTypes.map(a => a.category))]

// Preset rules that users can select
const presetRules = [
  // Moderation Rules
  { 
    category: "Moderation",
    name: "Keine Beleidigungen", 
    description: "Lösche Posts mit Beleidigungen und sende eine Warnung an den Nutzer" 
  },
  { 
    category: "Moderation",
    name: "Keine Spam-Links", 
    description: "Blockiere Posts mit verdächtigen oder Spam-Links automatisch" 
  },
  { 
    category: "Moderation",
    name: "Keine Werbung", 
    description: "Entferne Posts die Werbung oder Promotions enthalten" 
  },
  { 
    category: "Moderation",
    name: "Keine NSFW-Inhalte", 
    description: "Blockiere nicht jugendfreie Inhalte und Bilder" 
  },
  { 
    category: "Moderation",
    name: "Caps-Lock Filter", 
    description: "Warne Nutzer bei übermäßiger Verwendung von Großbuchstaben" 
  },
  { 
    category: "Moderation",
    name: "Flood-Schutz", 
    description: "Verhindere, dass Nutzer zu viele Posts in kurzer Zeit senden" 
  },
  { 
    category: "Moderation",
    name: "Keyword-Blacklist", 
    description: "Filtere Posts mit bestimmten verbotenen Wörtern heraus" 
  },
  { 
    category: "Moderation",
    name: "Link-Whitelist", 
    description: "Erlaube nur Links von vertrauenswürdigen Domains" 
  },
  
  // Engagement Rules
  { 
    category: "Engagement",
    name: "Willkommens-Nachricht", 
    description: "Sende eine Willkommensnachricht wenn jemand dem Channel beitritt" 
  },
  { 
    category: "Engagement",
    name: "Täglicher Post", 
    description: "Sende jeden Tag um eine bestimmte Uhrzeit einen Post" 
  },
  { 
    category: "Engagement",
    name: "Wöchentliches Update", 
    description: "Sende jeden Montag eine Zusammenfassung der Woche" 
  },
  { 
    category: "Engagement",
    name: "Geburtstags-Glückwünsche", 
    description: "Gratuliere Nutzern automatisch zum Geburtstag" 
  },
  { 
    category: "Engagement",
    name: "Aktivitäts-Reminder", 
    description: "Erinnere Nutzer bei Inaktivität wieder aktiv zu werden" 
  },
  { 
    category: "Engagement",
    name: "Umfrage erstellen", 
    description: "Erstelle regelmäßig Umfragen um Feedback zu sammeln" 
  },
  
  // Rewards Rules
  { 
    category: "Belohnungen",
    name: "Streak-Bonus", 
    description: "Belohnung für tägliche Aktivität in Folge" 
  },
  { 
    category: "Belohnungen",
    name: "Erste-Post-Badge", 
    description: "Vergebe ein Badge für den ersten Post im Channel" 
  },
  { 
    category: "Belohnungen",
    name: "Top-Poster Badge", 
    description: "Vergebe monatlich ein Badge an den aktivsten Nutzer" 
  },
  { 
    category: "Belohnungen",
    name: "Meilenstein-Belohnung", 
    description: "Belohne Nutzer bei bestimmten Post-Meilensteinen (10, 50, 100...)" 
  },
  
  // Utility Rules
  { 
    category: "Utility",
    name: "Auto-Tag", 
    description: "Füge automatisch relevante Tags zu Posts hinzu" 
  },
  { 
    category: "Utility",
    name: "Link-Preview", 
    description: "Generiere automatisch Vorschauen für gepostete Links" 
  },
  { 
    category: "Utility",
    name: "Bild-Komprimierung", 
    description: "Komprimiere automatisch große Bilder in Posts" 
  },
  { 
    category: "Utility",
    name: "Übersetzung", 
    description: "Übersetze Posts automatisch in andere Sprachen" 
  },
  { 
    category: "Utility",
    name: "Zusammenfassung", 
    description: "Erstelle automatische Zusammenfassungen von langen Posts" 
  },
  { 
    category: "Utility",
    name: "Statistik-Report", 
    description: "Sende regelmäßig Channel-Statistiken an Admins" 
  },
  
  // Community Rules
  { 
    category: "Community",
    name: "Vorstellungs-Reminder", 
    description: "Erinnere neue Mitglieder sich vorzustellen" 
  },
  { 
    category: "Community",
    name: "Inaktive-Warnung", 
    description: "Warne vor dem Entfernen bei langer Inaktivität" 
  },
  { 
    category: "Community",
    name: "Event-Ankündigung", 
    description: "Kündige geplante Events automatisch an" 
  },
  { 
    category: "Community",
    name: "Feedback-Sammlung", 
    description: "Sammle regelmäßig Feedback von der Community" 
  },
  { 
    category: "Community",
    name: "Mentor-Zuweisung", 
    description: "Weise neuen Mitgliedern automatisch einen Mentor zu" 
  },
  { 
    category: "Community",
    name: "Regel-Reminder", 
    description: "Erinnere regelmäßig an die Channel-Regeln" 
  },
  { 
    category: "Community",
    name: "AMA-Session", 
    description: "Starte automatisch Ask-Me-Anything Sessions" 
  },
  
  // Security Rules
  { 
    category: "Sicherheit",
    name: "Neue-Account-Prüfung", 
    description: "Prüfe neue Accounts auf verdächtiges Verhalten" 
  },
  { 
    category: "Sicherheit",
    name: "Phishing-Erkennung", 
    description: "Erkenne und blockiere Phishing-Versuche" 
  },
  { 
    category: "Sicherheit",
    name: "Bot-Erkennung", 
    description: "Identifiziere und blockiere verdächtige Bot-Accounts" 
  },
]

const ruleCategories = [...new Set(presetRules.map(r => r.category))]

export function BotsContent({
  bots,
  automations,
  channels,
  userId,
  activeRules,
  pendingInvites,
}: {
  bots: BotType[]
  automations: AutomationType[]
  channels: Channel[]
  userId: string
  activeRules: BotActiveRule[]
  pendingInvites: BotChannelInvite[]
}) {
  const [showCreateBot, setShowCreateBot] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [inviteBot, setInviteBot] = useState<BotType | null>(null)
  const [inviteChannelId, setInviteChannelId] = useState("")
  const [showCreateAutomation, setShowCreateAutomation] = useState(false)
  const [showRulesDialog, setShowRulesDialog] = useState(false)
  const [showInvitesDialog, setShowInvitesDialog] = useState(false)
  const [selectedBotForRules, setSelectedBotForRules] = useState<BotType | null>(null)
  const [selectedBotRules, setSelectedBotRules] = useState<BotActiveRule[]>([])
  const [botName, setBotName] = useState("")
  const [botDesc, setBotDesc] = useState("")
  const [botIsPublic, setBotIsPublic] = useState(false)
  
  // Image upload state
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  
  const [autoName, setAutoName] = useState("")
  const [autoDesc, setAutoDesc] = useState("")
  const [triggerType, setTriggerType] = useState("")
  const [actionType, setActionType] = useState("")
  const [selectedBot, setSelectedBot] = useState("")
  const [selectedChannel, setSelectedChannel] = useState("")
  const [actionContent, setActionContent] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  
  // Advanced trigger config
  const [triggerKeyword, setTriggerKeyword] = useState("")
  const [triggerHashtag, setTriggerHashtag] = useState("")
  const [triggerPostCount, setTriggerPostCount] = useState("10")
  const [triggerStreakDays, setTriggerStreakDays] = useState("7")
  const [scheduledTime, setScheduledTime] = useState("09:00")
  const [scheduledDays, setScheduledDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"])
  const [scheduleType, setScheduleType] = useState("daily")
  const [inactivityMinutes, setInactivityMinutes] = useState("60")
  const [badgeType, setBadgeType] = useState("")
  const [roleType, setRoleType] = useState("")
  const [warnSeverity, setWarnSeverity] = useState("warning")
  const [muteDuration, setMuteDuration] = useState("60")
  const [banDuration, setBanDuration] = useState("")
  const [targetChannelId, setTargetChannelId] = useState("")
  const [cooldownSeconds, setCooldownSeconds] = useState("0")
  
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

  const uploadImage = async (file: File, botId: string, type: "avatar" | "banner"): Promise<string | null> => {
    const supabase = createDbClient()
    const ext = file.name.split(".").pop()
    const fileName = `${botId}/${type}_${Date.now()}.${ext}`
    
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

  const openRulesDialog = (bot: BotType) => {
    setSelectedBotForRules(bot)
    setSelectedBotRules(activeRules.filter(r => r.bot_id === bot.id))
    setShowRulesDialog(true)
  }

  const toggleRule = async (ruleName: string, ruleDesc: string, ruleCategory: string) => {
    if (!selectedBotForRules) return
    const supabase = createDbClient()
    const existingRule = selectedBotRules.find(r => r.rule_name === ruleName)
    
    if (existingRule) {
      // Remove rule
      await supabase.from("bot_active_rules").delete().eq("id", existingRule.id)
      setSelectedBotRules(selectedBotRules.filter(r => r.id !== existingRule.id))
      toast.success("Regel deaktiviert")
    } else {
      // Add new rule
      const { data, error } = await supabase.from("bot_active_rules").insert({
        bot_id: selectedBotForRules.id,
        rule_name: ruleName,
        rule_description: ruleDesc,
        rule_category: ruleCategory,
        is_active: true,
      }).select().single()
      
      if (!error && data) {
        setSelectedBotRules([...selectedBotRules, data as BotActiveRule])
        toast.success("Regel aktiviert")
      }
    }
    router.refresh()
  }

  const handleInviteResponse = async (inviteId: string, accept: boolean) => {
    const supabase = createDbClient()
    const { error } = await supabase
      .from("bot_channel_invites")
      .update({ status: accept ? "accepted" : "rejected" })
      .eq("id", inviteId)
    
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(accept ? "Bot-Einladung angenommen!" : "Bot-Einladung abgelehnt")
      router.refresh()
    }
  }

  const handleCreateBot = async () => {
    if (!botName.trim()) return
    setIsLoading(true)
    const supabase = createDbClient()
    
    // First create the bot to get the ID
    const { data: newBot, error } = await supabase.from("bots").insert({
      name: botName,
      description: botDesc || null,
      owner_id: userId,
      is_public: botIsPublic,
    }).select().single()
    
    if (error) {
      toast.error(error.message)
      setIsLoading(false)
      return
    }
    const createdBot = newBot as { id: string }
    
    // Upload images if provided
    let avatarUrl = null
    let bannerUrl = null
    
    if (avatarFile) {
      avatarUrl = await uploadImage(avatarFile, createdBot.id, "avatar")
    }
    if (bannerFile) {
      bannerUrl = await uploadImage(bannerFile, createdBot.id, "banner")
    }
    
    // Update bot with image URLs if we have them
    if (avatarUrl || bannerUrl) {
      await supabase.from("bots").update({
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
      }).eq("id", createdBot.id)
    }
    
    await supabase.rpc("add_xp", { p_user_id: userId, p_amount: 10, p_reason: "Bot erstellt" })
    toast.success("Bot erstellt!")
    setBotName("")
    setBotDesc("")
    setBotIsPublic(false)
    setAvatarFile(null)
    setBannerFile(null)
    setAvatarPreview(null)
    setBannerPreview(null)
    setShowCreateBot(false)
    router.refresh()
    setIsLoading(false)
  }

  const buildTriggerConfig = () => {
    const config: Record<string, unknown> = { channel_id: selectedChannel }
    
    switch (triggerType) {
      case "on_keyword":
      case "on_bad_word":
        config.keyword = triggerKeyword
        break
      case "on_hashtag":
        config.hashtag = triggerHashtag
        break
      case "on_post_count":
        config.post_count = parseInt(triggerPostCount)
        break
      case "on_streak":
        config.streak_days = parseInt(triggerStreakDays)
        break
      case "scheduled":
        config.schedule_type = scheduleType
        config.time = scheduledTime
        config.days = scheduledDays
        break
      case "on_time_inactive":
        config.inactive_minutes = parseInt(inactivityMinutes)
        break
    }
    
    return config
  }
  
  const buildActionConfig = () => {
    const config: Record<string, unknown> = { 
      content: actionContent, 
      channel_id: selectedChannel 
    }
    
    switch (actionType) {
      case "assign_badge":
      case "remove_badge":
        config.badge_type = badgeType
        break
      case "assign_role":
        config.role = roleType
        break
      case "warn_user":
        config.severity = warnSeverity
        break
      case "mute_user":
        config.duration_minutes = parseInt(muteDuration)
        break
      case "ban_user":
        config.duration_days = banDuration ? parseInt(banDuration) : null
        break
      case "share_to_channel":
        config.target_channel_id = targetChannelId
        break
    }
    
    return config
  }

  const resetAutomationForm = () => {
    setAutoName("")
    setAutoDesc("")
    setTriggerType("")
    setActionType("")
    setSelectedBot("")
    setSelectedChannel("")
    setActionContent("")
    setTriggerKeyword("")
    setTriggerHashtag("")
    setTriggerPostCount("10")
    setTriggerStreakDays("7")
    setScheduledTime("09:00")
    setScheduledDays(["Mon", "Tue", "Wed", "Thu", "Fri"])
    setScheduleType("daily")
    setInactivityMinutes("60")
    setBadgeType("")
    setRoleType("")
    setWarnSeverity("warning")
    setMuteDuration("60")
    setBanDuration("")
    setTargetChannelId("")
    setCooldownSeconds("0")
  }

  const handleCreateAutomation = async () => {
    if (!autoName.trim() || !triggerType || !actionType) return
    if (!selectedBot) {
      toast.error("Bitte einen Bot auswählen.")
      return
    }
    const actionNeedsChannel = ["send_post", "send_reply", "send_welcome", "send_reminder", "send_announcement", "auto_comment"]
      .includes(actionType)
    if (actionNeedsChannel && !selectedChannel) {
      toast.error("Bitte einen Ziel-Channel auswählen.")
      return
    }
    setIsLoading(true)
    const supabase = createDbClient()
    const { error } = await supabase.from("automations").insert({
      name: autoName,
      description: autoDesc || null,
      bot_id: selectedBot,
      trigger_type: triggerType,
      trigger_config: buildTriggerConfig(),
      action_type: actionType,
      action_config: buildActionConfig(),
      channel_id: selectedChannel || null,
      cooldown_seconds: parseInt(cooldownSeconds) || 0,
    })
    if (error) {
      toast.error(error.message)
    } else {
      await supabase.rpc("add_xp", { p_user_id: userId, p_amount: 10, p_reason: "Automation erstellt" })
      toast.success("Automation erstellt!")
      resetAutomationForm()
      setShowCreateAutomation(false)
      router.refresh()
    }
    setIsLoading(false)
  }

  const toggleBot = async (bot: BotType) => {
    const supabase = createDbClient()
    await supabase.from("bots").update({ is_active: !bot.is_active }).eq("id", bot.id)
    toast.success(bot.is_active ? "Bot deaktiviert" : "Bot aktiviert")
    router.refresh()
  }

  const deleteBot = async (botId: string) => {
    const supabase = createDbClient()
    await supabase.from("bots").delete().eq("id", botId)
    toast.success("Bot geloescht")
    router.refresh()
  }

  const toggleAutomation = async (auto: AutomationType) => {
    const supabase = createDbClient()
    await supabase.from("automations").update({ is_active: !auto.is_active }).eq("id", auto.id)
    toast.success(auto.is_active ? "Automation deaktiviert" : "Automation aktiviert")
    router.refresh()
  }

  const handleInviteBot = async () => {
    if (!inviteBot || !inviteChannelId) return
    setIsLoading(true)
    const supabase = createDbClient()
    const { error } = await supabase.from("bot_channel_invites").insert({
      bot_id: inviteBot.id,
      channel_id: inviteChannelId,
      invited_by: userId,
      status: "pending",
    })
    if (error) {
      if (error.code === "23505") {
        toast.error("Dieser Bot wurde bereits zu diesem Channel eingeladen")
      } else {
        toast.error(error.message)
      }
    } else {
      toast.success("Bot eingeladen! Der Bot-Besitzer muss die Einladung annehmen.")
      setShowInviteDialog(false)
      setInviteBot(null)
      setInviteChannelId("")
      router.refresh()
    }
    setIsLoading(false)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Bots & Automation</h1>
        <p className="text-muted-foreground mt-1">Erstelle Bots und automatisiere Aktionen in deinen Channels</p>
      </div>

      <Tabs defaultValue="bots">
        <TabsList className="glass mb-6">
          <TabsTrigger value="bots">Bots ({bots.length})</TabsTrigger>
          <TabsTrigger value="automations">Automationen ({automations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="bots">
          <div className="flex justify-between items-center mb-4">
            <Button variant="outline" asChild className="bg-transparent">
              <Link href="/bots/discover">Bots entdecken</Link>
            </Button>
            {pendingInvites.length > 0 && (
              <Dialog open={showInvitesDialog} onOpenChange={setShowInvitesDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Bell className="h-4 w-4" />
                    {pendingInvites.length} Einladung{pendingInvites.length > 1 ? "en" : ""}
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass border-border/50">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Bot-Einladungen</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 mt-4">
                    {pendingInvites.map((invite) => (
                      <div key={invite.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                        <div>
                          <p className="font-medium text-sm">{invite.channels.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Bot: {bots.find(b => b.id === invite.bot_id)?.name}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleInviteResponse(invite.id, false)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                          <Button size="sm" onClick={() => handleInviteResponse(invite.id, true)}>
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <div className="flex-1" />
            <Dialog open={showCreateBot} onOpenChange={(open) => {
              setShowCreateBot(open)
              if (!open) {
                setAvatarFile(null)
                setBannerFile(null)
                setAvatarPreview(null)
                setBannerPreview(null)
              }
            }}>
              <DialogTrigger asChild>
                <Button className="text-primary-foreground"><Plus className="h-4 w-4 mr-2" /> Bot erstellen</Button>
              </DialogTrigger>
              <DialogContent className="glass border-border/50 max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Neuen Bot erstellen</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 mt-4">
                  {/* Avatar Upload */}
                  <div className="space-y-2">
                    <Label className="text-foreground">Profilbild</Label>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16">
                          <AvatarImage src={resolveMediaUrl(avatarPreview) || undefined} />
                        <AvatarFallback><Bot className="h-8 w-8" /></AvatarFallback>
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
                    <Label className="text-foreground">Banner</Label>
                    <div 
                      className="relative h-20 rounded-lg overflow-hidden bg-secondary/50 cursor-pointer hover:bg-secondary/70 transition-colors border border-border/50"
                      onClick={() => bannerInputRef.current?.click()}
                    >
                      {bannerPreview ? (
                        <img src={resolveMediaUrl(bannerPreview) || undefined} alt="Banner Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                          <ImageIcon className="h-5 w-5 mr-2" />
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

                  <div className="grid gap-2">
                    <Label className="text-foreground">Name</Label>
                    <Input value={botName} onChange={(e) => setBotName(e.target.value)} placeholder="Mein Bot" className="bg-secondary/50 border-border/50" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-foreground">Beschreibung</Label>
                    <Textarea value={botDesc} onChange={(e) => setBotDesc(e.target.value)} placeholder="Was macht der Bot?" className="bg-secondary/50 border-border/50" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-foreground">Öffentlich sichtbar</Label>
                      <p className="text-xs text-muted-foreground">Andere können diesen Bot finden und einladen</p>
                    </div>
                    <Switch checked={botIsPublic} onCheckedChange={setBotIsPublic} />
                  </div>
                  <Button onClick={handleCreateBot} disabled={isLoading} className="text-primary-foreground">
                    {isLoading ? "Erstellen..." : "Bot erstellen"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {bots.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Bot className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-1">Keine Bots</h3>
              <p className="text-sm text-muted-foreground">Erstelle deinen ersten Bot</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {bots.map((bot) => (
                <Link key={bot.id} href={`/bots/${bot.id}`} className="block">
                  <div className="glass rounded-xl p-5 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={resolveMediaUrl(bot.avatar_url) || undefined} />
                          <AvatarFallback className="bg-primary/10">
                            <Bot className="h-5 w-5 text-primary" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{bot.name}</h3>
                            {bot.is_verified && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex">
                                      <BadgeCheck className="h-4 w-4 text-primary" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Verifizierter Bot</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {bot.is_public && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-400">
                                Öffentlich
                              </span>
                            )}
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${bot.is_active ? "bg-green-500/10 text-green-400" : "bg-secondary text-muted-foreground"}`}>
                              {bot.is_active ? "Aktiv" : "Inaktiv"}
                            </span>
                          </div>
                          {bot.description && <p className="text-sm text-muted-foreground">{bot.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                        <Button variant="ghost" size="icon" onClick={() => openRulesDialog(bot)} className="text-muted-foreground hover:text-primary">
                          <ScrollText className="h-4 w-4" />
                        </Button>
                        {!bot.is_public && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setInviteBot(bot)
                              setInviteChannelId("")
                              setShowInviteDialog(true)
                            }}
                            disabled={channels.length === 0}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => toggleBot(bot)} className="text-muted-foreground">
                          {bot.is_active ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteBot(bot.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="automations">
          <div className="flex justify-end mb-4">
            <Dialog
              open={showCreateAutomation}
              onOpenChange={(open) => {
                setShowCreateAutomation(open)
                if (open && bots.length > 0) {
                  setSelectedBot((prev) => prev || bots[0].id)
                }
                if (!open) resetAutomationForm()
              }}
            >
              <DialogTrigger asChild>
                <Button className="text-primary-foreground"><Plus className="h-4 w-4 mr-2" /> Automation erstellen</Button>
              </DialogTrigger>
              <DialogContent className="glass border-border/50 max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Neue Automation erstellen</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-auto">
                  <div className="flex flex-col gap-4 py-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label className="text-foreground">Name *</Label>
                        <Input value={autoName} onChange={(e) => setAutoName(e.target.value)} placeholder="z.B. Willkommens-Bot" className="bg-secondary/50 border-border/50" />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-foreground">Cooldown (Sekunden)</Label>
                        <Input type="number" value={cooldownSeconds} onChange={(e) => setCooldownSeconds(e.target.value)} placeholder="0" className="bg-secondary/50 border-border/50" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-foreground">Beschreibung</Label>
                      <Textarea value={autoDesc} onChange={(e) => setAutoDesc(e.target.value)} placeholder="Was macht diese Automation?" className="bg-secondary/50 border-border/50" />
                    </div>

                    {/* Trigger Block */}
                    <div className="rounded-xl bg-secondary/30 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Settings2 className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">Trigger - Wann soll die Automation ausgelöst werden?</span>
                      </div>
                      <Select value={triggerType} onValueChange={setTriggerType}>
                        <SelectTrigger className="bg-secondary/50 border-border/50 text-foreground"><SelectValue placeholder="Trigger wählen..." /></SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {triggerCategories.map((category) => (
                            <div key={category}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-secondary/50">{category}</div>
                              {triggerTypes.filter(t => t.category === category).map(t => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {/* Trigger-specific config */}
                      {(triggerType === "on_keyword" || triggerType === "on_bad_word") && (
                        <div className="mt-3">
                          <Label className="text-xs text-muted-foreground">Keyword / Wort</Label>
                          <Input value={triggerKeyword} onChange={(e) => setTriggerKeyword(e.target.value)} placeholder="z.B. hilfe, spam, ..." className="bg-secondary/50 border-border/50 mt-1" />
                        </div>
                      )}
                      {triggerType === "on_hashtag" && (
                        <div className="mt-3">
                          <Label className="text-xs text-muted-foreground">Hashtag (ohne #)</Label>
                          <Input value={triggerHashtag} onChange={(e) => setTriggerHashtag(e.target.value)} placeholder="z.B. frage, neu, ..." className="bg-secondary/50 border-border/50 mt-1" />
                        </div>
                      )}
                      {triggerType === "on_post_count" && (
                        <div className="mt-3">
                          <Label className="text-xs text-muted-foreground">Bei Post-Anzahl</Label>
                          <Input type="number" value={triggerPostCount} onChange={(e) => setTriggerPostCount(e.target.value)} placeholder="10" className="bg-secondary/50 border-border/50 mt-1" />
                        </div>
                      )}
                      {triggerType === "on_streak" && (
                        <div className="mt-3">
                          <Label className="text-xs text-muted-foreground">Streak-Tage</Label>
                          <Input type="number" value={triggerStreakDays} onChange={(e) => setTriggerStreakDays(e.target.value)} placeholder="7" className="bg-secondary/50 border-border/50 mt-1" />
                        </div>
                      )}
                      {triggerType === "on_time_inactive" && (
                        <div className="mt-3">
                          <Label className="text-xs text-muted-foreground">Inaktiv nach (Minuten)</Label>
                          <Input type="number" value={inactivityMinutes} onChange={(e) => setInactivityMinutes(e.target.value)} placeholder="60" className="bg-secondary/50 border-border/50 mt-1" />
                        </div>
                      )}
                      {triggerType === "scheduled" && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Zeitplan-Typ</Label>
                            <Select value={scheduleType} onValueChange={setScheduleType}>
                              <SelectTrigger className="bg-secondary/50 border-border/50 text-foreground mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="once">Einmalig</SelectItem>
                                <SelectItem value="hourly">Stündlich</SelectItem>
                                <SelectItem value="daily">Täglich</SelectItem>
                                <SelectItem value="weekly">Wöchentlich</SelectItem>
                                <SelectItem value="monthly">Monatlich</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Uhrzeit</Label>
                            <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="bg-secondary/50 border-border/50 mt-1" />
                          </div>
                          {(scheduleType === "weekly" || scheduleType === "daily") && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Wochentage</Label>
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                                  <Button 
                                    key={day} 
                                    type="button"
                                    size="sm" 
                                    variant={scheduledDays.includes(day) ? "default" : "outline"}
                                    className={`h-8 w-10 text-xs ${scheduledDays.includes(day) ? "text-primary-foreground" : ""}`}
                                    onClick={() => setScheduledDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                                  >
                                    {day}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Block */}
                    <div className="rounded-xl bg-secondary/30 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">Aktion - Was soll passieren?</span>
                      </div>
                      <Select value={actionType} onValueChange={setActionType}>
                        <SelectTrigger className="bg-secondary/50 border-border/50 text-foreground"><SelectValue placeholder="Aktion wählen..." /></SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {actionCategories.map((category) => (
                            <div key={category}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-secondary/50">{category}</div>
                              {actionTypes.filter(a => a.category === category).map(a => (
                                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {/* Action-specific config */}
                      {(actionType === "send_post" || actionType === "send_reply" || actionType === "send_welcome" || actionType === "send_reminder" || actionType === "send_announcement" || actionType === "auto_comment") && (
                        <div className="mt-3">
                          <Label className="text-xs text-muted-foreground">Nachricht / Inhalt</Label>
                          <Textarea value={actionContent} onChange={(e) => setActionContent(e.target.value)} placeholder="Nachrichteninhalt... Verwende {user} für den Nutzernamen" className="bg-secondary/50 border-border/50 mt-1 min-h-[80px]" />
                          <p className="text-[10px] text-muted-foreground mt-1">Variablen: {"{user}"} = Nutzername, {"{channel}"} = Channel, {"{date}"} = Datum</p>
                        </div>
                      )}
                      {(actionType === "assign_badge" || actionType === "remove_badge") && (
                        <div className="mt-3">
                          <Label className="text-xs text-muted-foreground">Badge-Typ</Label>
                          <Select value={badgeType} onValueChange={setBadgeType}>
                            <SelectTrigger className="bg-secondary/50 border-border/50 text-foreground mt-1"><SelectValue placeholder="Badge wählen..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="verified">✓ Verifiziert</SelectItem>
                              <SelectItem value="top_contributor">🏆 Top Contributor</SelectItem>
                              <SelectItem value="early_adopter">🌟 Early Adopter</SelectItem>
                              <SelectItem value="bot_developer">🤖 Bot Developer</SelectItem>
                              <SelectItem value="moderator">🛡️ Moderator</SelectItem>
                              <SelectItem value="admin">👑 Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {actionType === "assign_role" && (
                        <div className="mt-3">
                          <Label className="text-xs text-muted-foreground">Rolle</Label>
                          <Select value={roleType} onValueChange={setRoleType}>
                            <SelectTrigger className="bg-secondary/50 border-border/50 text-foreground mt-1"><SelectValue placeholder="Rolle wählen..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="member">Mitglied</SelectItem>
                              <SelectItem value="moderator">Moderator</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {actionType === "warn_user" && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Warn-Grund</Label>
                            <Textarea value={actionContent} onChange={(e) => setActionContent(e.target.value)} placeholder="Grund für die Warnung..." className="bg-secondary/50 border-border/50 mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Schweregrad</Label>
                            <Select value={warnSeverity} onValueChange={setWarnSeverity}>
                              <SelectTrigger className="bg-secondary/50 border-border/50 text-foreground mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="info">ℹ️ Info</SelectItem>
                                <SelectItem value="warning">⚠️ Warnung</SelectItem>
                                <SelectItem value="severe">🚨 Schwer</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                      {actionType === "mute_user" && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Mute-Grund</Label>
                            <Input value={actionContent} onChange={(e) => setActionContent(e.target.value)} placeholder="Grund..." className="bg-secondary/50 border-border/50 mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Dauer (Minuten)</Label>
                            <Input type="number" value={muteDuration} onChange={(e) => setMuteDuration(e.target.value)} placeholder="60" className="bg-secondary/50 border-border/50 mt-1" />
                          </div>
                        </div>
                      )}
                      {actionType === "ban_user" && (
                        <div className="mt-3 space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Ban-Grund</Label>
                            <Textarea value={actionContent} onChange={(e) => setActionContent(e.target.value)} placeholder="Grund für den Ban..." className="bg-secondary/50 border-border/50 mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Dauer (Tage, leer = permanent)</Label>
                            <Input type="number" value={banDuration} onChange={(e) => setBanDuration(e.target.value)} placeholder="Leer = permanent" className="bg-secondary/50 border-border/50 mt-1" />
                          </div>
                        </div>
                      )}
                      {actionType === "share_to_channel" && (
                        <div className="mt-3">
                          <Label className="text-xs text-muted-foreground">Ziel-Channel</Label>
                          <Select value={targetChannelId} onValueChange={setTargetChannelId}>
                            <SelectTrigger className="bg-secondary/50 border-border/50 text-foreground mt-1"><SelectValue placeholder="Channel wählen..." /></SelectTrigger>
                            <SelectContent>
                              {channels.map(ch => <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {actionType === "auto_tag" && (
                        <div className="mt-3">
                          <Label className="text-xs text-muted-foreground">Tags (kommagetrennt)</Label>
                          <Input value={actionContent} onChange={(e) => setActionContent(e.target.value)} placeholder="z.B. frage, hilfe, neu" className="bg-secondary/50 border-border/50 mt-1" />
                        </div>
                      )}
                      {actionType === "create_poll" && (
                        <div className="mt-3">
                          <Label className="text-xs text-muted-foreground">Umfrage-Frage</Label>
                          <Textarea value={actionContent} onChange={(e) => setActionContent(e.target.value)} placeholder="Die Umfrage-Frage..." className="bg-secondary/50 border-border/50 mt-1" />
                        </div>
                      )}
                    </div>

                    {/* Target Channel */}
                    {channels.length > 0 && (
                      <div className="grid gap-2">
                        <Label className="text-foreground">Ziel-Channel</Label>
                        <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                          <SelectTrigger className="bg-secondary/50 border-border/50 text-foreground"><SelectValue placeholder="Channel wählen (optional)..." /></SelectTrigger>
                          <SelectContent>
                            {channels.map(ch => <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Bot (required) */}
                    {bots.length > 0 && (
                      <div className="grid gap-2">
                        <Label className="text-foreground">Bot auswählen</Label>
                        <Select value={selectedBot} onValueChange={setSelectedBot}>
                          <SelectTrigger className="bg-secondary/50 border-border/50 text-foreground"><SelectValue placeholder="Bot wählen..." /></SelectTrigger>
                          <SelectContent>
                            {bots.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {bots.length === 0 && (
                      <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 text-sm text-muted-foreground">
                        Du brauchst mindestens einen Bot, um eine Automation zu erstellen.
                        {" "}
                        <Link href="/bots" className="text-primary underline underline-offset-2">
                          Bot jetzt erstellen
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="pt-4 border-t border-border/30">
                  <Button
                    onClick={handleCreateAutomation}
                    disabled={
                      isLoading ||
                      !autoName.trim() ||
                      !triggerType ||
                      !actionType
                    }
                    className="w-full text-primary-foreground"
                  >
                    {isLoading ? "Erstellen..." : "Automation erstellen"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {automations.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Zap className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-1">Keine Automationen</h3>
              <p className="text-sm text-muted-foreground">Erstelle deine erste Automation</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {automations.map((auto) => {
                const trigger = triggerTypes.find(t => t.value === auto.trigger_type)
                const action = actionTypes.find(a => a.value === auto.action_type)
                return (
                  <div key={auto.id} className="glass rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                          <Zap className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground">{auto.name}</h3>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${auto.is_active ? "bg-green-500/10 text-green-400" : "bg-secondary text-muted-foreground"}`}>
                              {auto.is_active ? "Aktiv" : "Inaktiv"}
                            </span>
                            {auto.bots && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-400">
                                <Bot className="h-3 w-3" /> {auto.bots.name}
                              </span>
                            )}
                          </div>
                          {auto.description && (
                            <p className="text-xs text-muted-foreground mt-1">{auto.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                            <span className="inline-flex items-center gap-1 rounded-md bg-secondary/50 px-2 py-1">
                              <Settings2 className="h-3 w-3 text-primary" />
                              {trigger?.label || auto.trigger_type}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-secondary/50 px-2 py-1">
                              <Zap className="h-3 w-3 text-primary" />
                              {action?.label || auto.action_type}
                            </span>
                          </div>
                          {/* Show config details */}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {'keyword' in (auto.trigger_config || {}) && (
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Keyword: {String((auto.trigger_config as {keyword?: string})?.keyword)}</span>
                            )}
                            {'hashtag' in (auto.trigger_config || {}) && (
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">#{String((auto.trigger_config as {hashtag?: string})?.hashtag)}</span>
                            )}
                            {'post_count' in (auto.trigger_config || {}) && (
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{String((auto.trigger_config as {post_count?: number})?.post_count)} Posts</span>
                            )}
                            {'streak_days' in (auto.trigger_config || {}) && (
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{String((auto.trigger_config as {streak_days?: number})?.streak_days)} Tage Streak</span>
                            )}
                            {'schedule_type' in (auto.trigger_config || {}) && (
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{String((auto.trigger_config as {schedule_type?: string; time?: string})?.schedule_type)} @ {String((auto.trigger_config as {schedule_type?: string; time?: string})?.time)}</span>
                            )}
                            {'badge_type' in (auto.action_config || {}) && (
                              <span className="text-[10px] bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded">🏅 {String((auto.action_config as {badge_type?: string})?.badge_type)}</span>
                            )}
                            {'duration_minutes' in (auto.action_config || {}) && (
                              <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">{String((auto.action_config as {duration_minutes?: number})?.duration_minutes)} min</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={auto.is_active} onCheckedChange={() => toggleAutomation(auto)} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="glass border-border/50">
          <DialogHeader>
            <DialogTitle>Bot zu Channel einladen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              WÃ¤hle einen deiner Channels aus, um diesen Bot einzuladen.
            </p>
            <Select value={inviteChannelId} onValueChange={setInviteChannelId}>
              <SelectTrigger className="bg-secondary/50 border-border/50 text-foreground">
                <SelectValue placeholder="Channel wÃ¤hlen..." />
              </SelectTrigger>
              <SelectContent>
                {channels.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>
                    {ch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {channels.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Du hast keinen Channel, dessen Owner du bist.
              </p>
            )}
            <Button className="w-full" onClick={handleInviteBot} disabled={isLoading || !inviteChannelId}>
              {isLoading ? "Einladen..." : "Einladen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rules Dialog */}
      <Dialog open={showRulesDialog} onOpenChange={setShowRulesDialog}>
        <DialogContent className="glass border-border/50 max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-primary" />
              Regeln für {selectedBotForRules?.name}
            </DialogTitle>
          </DialogHeader>
          
          <p className="text-sm text-muted-foreground">
            Wähle aus vorgefertigten Regeln, die du aktivieren oder deaktivieren kannst.
          </p>
          
          <div className="flex-1 overflow-auto space-y-4 mt-4">
            {ruleCategories.map((category) => (
              <div key={category} className="rounded-xl bg-secondary/20 p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  {category === "Moderation" && "🛡️"}
                  {category === "Engagement" && "💬"}
                  {category === "Belohnungen" && "🏆"}
                  {category === "Utility" && "⚙️"}
                  {category === "Community" && "👥"}
                  {category === "Sicherheit" && "🔒"}
                  {category}
                </h4>
                <div className="grid gap-2">
                  {presetRules.filter(r => r.category === category).map((preset) => {
                    const isActive = selectedBotRules.some(r => r.rule_name === preset.name)
                    return (
                      <div 
                        key={preset.name} 
                        className={`flex items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isActive ? "border-primary/30 bg-primary/5" : "border-border/30 bg-secondary/30 hover:bg-secondary/50"}`}
                        onClick={() => toggleRule(preset.name, preset.description, preset.category)}
                      >
                        <div className="flex-1 min-w-0">
                          <h5 className="text-sm font-medium text-foreground">{preset.name}</h5>
                          <p className="text-xs text-muted-foreground mt-0.5">{preset.description}</p>
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
    </div>
  )
}

