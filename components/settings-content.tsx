"use client"

import { createDbClient } from "@/lib/db-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ImageCropper } from "@/components/image-cropper"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { signIn as oauthSignIn, signOut as authSignOut } from "next-auth/react"
import { toast } from "sonner"
import { Settings, Camera, ImagePlus, User, Lock, Eye, EyeOff, Heart, Users, MessageCircle, Shield, UserX } from "lucide-react"
import { KontenVerknuepfen } from "./konten-verknuepfen"

function resolveMediaUrl(value: string | null | undefined): string {
  if (!value) return ""
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed
  }
  const normalized = trimmed
    .replace(/^\/+/, "")
    .replace(/^uploads\//, "")
    .replace(/^api\/media\//, "")
  return `/api/media/${normalized}`
}

interface Profile {
  id: string
  username: string
  display_name: string
  bio: string | null
  avatar_url: string | null
  banner_url: string | null
  show_followers: boolean
  is_private: boolean
  show_liked_posts: boolean
  dm_privacy: "everyone" | "followers" | "request" | "nobody"
}

type LinkedProvider = {
  provider: string
  providerAccountId: string
}

type AccountOverview = {
  email: string | null
  hasPassword: boolean
  providers: LinkedProvider[]
}

type AccountSettings = {
  emailNotifications: boolean
  marketingEmails: boolean
  loginAlerts: boolean
  profileVisibilityTips: boolean
}

type TwoFactorState = {
  enabled: boolean
  setupPending: boolean
}

export function SettingsContent({ profile }: { profile: Profile | null }) {
  const [username, setUsername] = useState(profile?.username || "")
  const [displayName, setDisplayName] = useState(profile?.display_name || "")
  const [bio, setBio] = useState(profile?.bio || "")
  const [showFollowers, setShowFollowers] = useState(profile?.show_followers ?? true)
  const [isPrivate, setIsPrivate] = useState(profile?.is_private ?? false)
  const [showLikedPosts, setShowLikedPosts] = useState(profile?.show_liked_posts ?? true)
  const [dmPrivacy, setDmPrivacy] = useState<"everyone" | "followers" | "request" | "nobody">(profile?.dm_privacy ?? "everyone")
  const [avatarUrl, setAvatarUrl] = useState(resolveMediaUrl(profile?.avatar_url))
  const [bannerUrl, setBannerUrl] = useState(resolveMediaUrl(profile?.banner_url))
  const [isLoading, setIsLoading] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isUploadingBanner, setIsUploadingBanner] = useState(false)
  const [isLinking, setIsLinking] = useState(false)
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [accountOverview, setAccountOverview] = useState<AccountOverview | null>(null)
  const [accountSettings, setAccountSettings] = useState<AccountSettings>({
    emailNotifications: true,
    marketingEmails: false,
    loginAlerts: true,
    profileVisibilityTips: true,
  })
  const [isSavingAccountSettings, setIsSavingAccountSettings] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [twoFactor, setTwoFactor] = useState<TwoFactorState>({ enabled: false, setupPending: false })
  const [twoFactorSetupSecret, setTwoFactorSetupSecret] = useState("")
  const [twoFactorSetupQr, setTwoFactorSetupQr] = useState("")
  const [twoFactorSetupCode, setTwoFactorSetupCode] = useState("")
  const [twoFactorDisableCode, setTwoFactorDisableCode] = useState("")
  const [isTwoFactorLoading, setIsTwoFactorLoading] = useState(false)
  const [isTwoFactorVerifying, setIsTwoFactorVerifying] = useState(false)
  const [isTwoFactorDisabling, setIsTwoFactorDisabling] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [deletePassword, setDeletePassword] = useState("")
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  
  // Cropper states
  const [cropperOpen, setCropperOpen] = useState(false)
  const [cropperImageSrc, setCropperImageSrc] = useState("")
  const [cropperType, setCropperType] = useState<"avatar" | "banner">("avatar")
  
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const loadLinkedAccounts = useCallback(async () => {
    setIsLoadingAccounts(true)
    try {
      const response = await fetch("/api/account/linked")
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Konten konnten nicht geladen werden")
      }
      setAccountOverview(data as AccountOverview)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Konten konnten nicht geladen werden")
    } finally {
      setIsLoadingAccounts(false)
    }
  }, [])

  useEffect(() => {
    void loadLinkedAccounts()
  }, [loadLinkedAccounts])

  const loadAccountSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/account/settings", { cache: "no-store" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Konto-Einstellungen konnten nicht geladen werden")
      }
      if (data?.settings) {
        setAccountSettings({
          emailNotifications: Boolean(data.settings.emailNotifications),
          marketingEmails: Boolean(data.settings.marketingEmails),
          loginAlerts: Boolean(data.settings.loginAlerts),
          profileVisibilityTips: Boolean(data.settings.profileVisibilityTips),
        })
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Konto-Einstellungen konnten nicht geladen werden")
    }
  }, [])

  useEffect(() => {
    void loadAccountSettings()
  }, [loadAccountSettings])

  const loadTwoFactorState = useCallback(async () => {
    setIsTwoFactorLoading(true)
    try {
      const response = await fetch("/api/account/2fa", { cache: "no-store" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "2FA-Status konnte nicht geladen werden")
      }
      setTwoFactor({
        enabled: Boolean(data.enabled),
        setupPending: Boolean(data.setupPending),
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "2FA-Status konnte nicht geladen werden")
    } finally {
      setIsTwoFactorLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTwoFactorState()
  }, [loadTwoFactorState])

  const uploadImage = async (blob: Blob, type: "avatar" | "banner") => {
    if (!profile) return null
    const supabase = createDbClient()
    const fileName = `${profile.id}-${type}-${Date.now()}.jpg`
    const filePath = `${type}s/${fileName}`

    // Cast Blob to File for upload
    const fileToUpload = blob instanceof File ? blob : new File([blob], fileName, { type: "image/jpeg" })
    const { error: uploadError } = await supabase.storage
      .from("profiles")
      .upload(filePath, fileToUpload, { upsert: true, contentType: "image/jpeg" })

    if (uploadError) {
      toast.error(`Fehler beim Hochladen: ${uploadError.message}`)
      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from("profiles")
      .getPublicUrl(filePath)

    return resolveMediaUrl(publicUrl)
  }

  const persistImageUrl = async (type: "avatar" | "banner", url: string) => {
    if (!profile) return false
    const supabase = createDbClient()
    const payload = type === "avatar" ? { avatar_url: url } : { banner_url: url }
    const { error } = await supabase.from("profiles").update(payload).eq("id", profile.id)
    if (error) {
      toast.error(`Fehler beim Speichern: ${error.message}`)
      return false
    }
    return true
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "avatar" | "banner") => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Bitte nur Bilder hochladen")
      return
    }

    const maxSize = type === "avatar" ? 5 : 10
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`Bild darf maximal ${maxSize}MB groß sein`)
      return
    }

    // Create object URL for cropper
    const imageUrl = URL.createObjectURL(file)
    setCropperImageSrc(imageUrl)
    setCropperType(type)
    setCropperOpen(true)
    
    // Reset input
    e.target.value = ""
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (cropperType === "avatar") {
      setIsUploadingAvatar(true)
      const url = await uploadImage(croppedBlob, "avatar")
      if (url) {
        const saved = await persistImageUrl("avatar", url)
        if (saved) {
          setAvatarUrl(url)
          toast.success("Profilbild gespeichert!")
          router.refresh()
        }
      }
      setIsUploadingAvatar(false)
    } else {
      setIsUploadingBanner(true)
      const url = await uploadImage(croppedBlob, "banner")
      if (url) {
        const saved = await persistImageUrl("banner", url)
        if (saved) {
          setBannerUrl(url)
          toast.success("Banner gespeichert!")
          router.refresh()
        }
      }
      setIsUploadingBanner(false)
    }
    
    // Cleanup
    URL.revokeObjectURL(cropperImageSrc)
    setCropperImageSrc("")
  }

  const handleCropperClose = () => {
    setCropperOpen(false)
    URL.revokeObjectURL(cropperImageSrc)
    setCropperImageSrc("")
  }

  const handleSave = async () => {
    if (!profile) return
    setIsLoading(true)
    const supabase = createDbClient()

    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      toast.error("Benutzername muss 3-20 Zeichen lang sein")
      setIsLoading(false)
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      toast.error("Benutzername darf nur Buchstaben, Zahlen und _ enthalten")
      setIsLoading(false)
      return
    }
    if (trimmedUsername !== profile.username) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", trimmedUsername)
        .maybeSingle()
      const existingProfile = existing as { id?: string } | null
      if (existingProfile && existingProfile.id && existingProfile.id !== profile.id) {
        toast.error("Benutzername ist bereits vergeben")
        setIsLoading(false)
        return
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        username: trimmedUsername,
        display_name: displayName,
        bio,
        show_followers: showFollowers,
        is_private: isPrivate,
        show_liked_posts: showLikedPosts,
        dm_privacy: dmPrivacy,
        avatar_url: avatarUrl || null,
        banner_url: bannerUrl || null,
      })
      .eq("id", profile.id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Einstellungen gespeichert!")
      router.refresh()
    }
    setIsLoading(false)
  }

  const handleLinkAccount = async (provider: "google" | "discord" | "github" | "microsoft-entra-id") => {
    setIsLinking(true)
    try {
      await oauthSignIn(provider, { callbackUrl: "/settings" })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Account-Verknüpfung fehlgeschlagen")
    } finally {
      setIsLinking(false)
    }
  }

  const handleDisconnectProvider = async (provider: string) => {
    setIsDisconnecting(true)
    try {
      const response = await fetch("/api/account/linked", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "provider", provider }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Provider konnte nicht getrennt werden")
      }
      toast.success("Provider getrennt")
      await loadLinkedAccounts()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Provider konnte nicht getrennt werden")
    } finally {
      setIsDisconnecting(false)
    }
  }

  const saveAccountSettings = async () => {
    setIsSavingAccountSettings(true)
    try {
      const response = await fetch("/api/account/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: accountSettings }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Konto-Einstellungen konnten nicht gespeichert werden")
      }
      toast.success("Konto-Einstellungen gespeichert")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Konto-Einstellungen konnten nicht gespeichert werden")
    } finally {
      setIsSavingAccountSettings(false)
    }
  }

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error("Neues Passwort muss mindestens 8 Zeichen haben.")
      return
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Neue Passwoerter stimmen nicht ueberein.")
      return
    }

    setIsChangingPassword(true)
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Passwort konnte nicht geaendert werden")
      }
      toast.success("Passwort erfolgreich geaendert")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmNewPassword("")
      await loadLinkedAccounts()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Passwort konnte nicht geaendert werden")
    } finally {
      setIsChangingPassword(false)
    }
  }

  const startTwoFactorSetup = async () => {
    setIsTwoFactorLoading(true)
    try {
      const response = await fetch("/api/account/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "setup" }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "2FA-Setup konnte nicht gestartet werden")
      }
      setTwoFactorSetupSecret(typeof data.secret === "string" ? data.secret : "")
      setTwoFactorSetupQr(typeof data.qrDataUrl === "string" ? data.qrDataUrl : "")
      setTwoFactorSetupCode("")
      setTwoFactor((prev) => ({ ...prev, setupPending: true }))
      toast.success("2FA-Setup gestartet. Bitte mit einem Code bestaetigen.")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "2FA-Setup konnte nicht gestartet werden")
    } finally {
      setIsTwoFactorLoading(false)
    }
  }

  const confirmTwoFactorSetup = async () => {
    if (!twoFactorSetupCode) {
      toast.error("Bitte den 6-stelligen Code eingeben.")
      return
    }
    setIsTwoFactorVerifying(true)
    try {
      const response = await fetch("/api/account/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "enable", token: twoFactorSetupCode }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "2FA konnte nicht aktiviert werden")
      }
      setTwoFactor({ enabled: true, setupPending: false })
      setTwoFactorSetupSecret("")
      setTwoFactorSetupQr("")
      setTwoFactorSetupCode("")
      toast.success("2FA wurde aktiviert.")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "2FA konnte nicht aktiviert werden")
    } finally {
      setIsTwoFactorVerifying(false)
    }
  }

  const disableTwoFactor = async () => {
    if (!twoFactorDisableCode) {
      toast.error("Bitte den 6-stelligen Code eingeben.")
      return
    }
    setIsTwoFactorDisabling(true)
    try {
      const response = await fetch("/api/account/2fa", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: twoFactorDisableCode }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "2FA konnte nicht deaktiviert werden")
      }
      setTwoFactor({ enabled: false, setupPending: false })
      setTwoFactorDisableCode("")
      setTwoFactorSetupSecret("")
      setTwoFactorSetupQr("")
      setTwoFactorSetupCode("")
      toast.success("2FA wurde deaktiviert.")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "2FA konnte nicht deaktiviert werden")
    } finally {
      setIsTwoFactorDisabling(false)
    }
  }

  const deleteOwnAccount = async () => {
    if (deleteConfirmation.trim().toUpperCase() !== "KONTO LOESCHEN") {
      toast.error("Bitte gib genau 'KONTO LOESCHEN' ein.")
      return
    }

    setIsDeletingAccount(true)
    try {
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: deleteConfirmation,
          currentPassword: deletePassword,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Konto konnte nicht geloescht werden")
      }

      toast.success("Konto geloescht")
      await authSignOut({ callbackUrl: "/" })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Konto konnte nicht geloescht werden")
    } finally {
      setIsDeletingAccount(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Image Cropper Dialog */}
      <ImageCropper
        open={cropperOpen}
        onClose={handleCropperClose}
        imageSrc={cropperImageSrc}
        onCropComplete={handleCropComplete}
        aspectRatio={cropperType === "avatar" ? 1 : 3}
        title={cropperType === "avatar" ? "Profilbild zuschneiden" : "Banner zuschneiden"}
      />

      <div className="flex items-center gap-3 mb-6">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Einstellungen</h1>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="glass w-full grid grid-cols-4 mb-6">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Privatsphäre
          </TabsTrigger>
          <TabsTrigger value="accounts" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Konten
          </TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Konto
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <div className="glass rounded-2xl p-6 md:p-8">
            <div className="flex flex-col gap-5">
              {/* Banner Upload */}
              <div className="grid gap-2">
                <Label className="text-foreground">Banner</Label>
                <div 
                  className="relative h-32 rounded-xl bg-secondary/30 border-2 border-dashed border-border/50 overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => bannerInputRef.current?.click()}
                >
                  {bannerUrl ? (
                    <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <ImagePlus className="h-8 w-8 mb-2" />
                      <span className="text-sm">Banner hochladen</span>
                    </div>
                  )}
                  {isUploadingBanner && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                      <span className="text-sm text-foreground">Hochladen...</span>
                    </div>
                  )}
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e, "banner")}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Empfohlene Größe: 1500x500px (max. 10MB)</p>
              </div>

              {/* Avatar Upload */}
              <div className="grid gap-2">
                <Label className="text-foreground">Profilbild</Label>
                <div className="flex items-center gap-4">
                  <div 
                    className="relative cursor-pointer group"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <Avatar className="h-20 w-20 border-2 border-border/50 group-hover:border-primary/50 transition-colors">
                      <AvatarImage src={avatarUrl || undefined} />
                      <AvatarFallback className="bg-secondary text-foreground text-xl">
                        {profile?.username?.charAt(0).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="h-6 w-6 text-foreground" />
                    </div>
                    {isUploadingAvatar && (
                      <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center">
                        <span className="text-xs text-foreground">...</span>
                      </div>
                    )}
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e, "avatar")}
                    />
                  </div>
                  <div>
                    <p className="text-sm text-foreground">Klicke zum Ändern</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG oder GIF (max. 5MB)</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label className="text-foreground">Benutzername</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-11 bg-secondary/50 border-border/50"
                />
                <p className="text-xs text-muted-foreground">3-20 Zeichen, nur Buchstaben, Zahlen und _</p>
              </div>

              <div className="grid gap-2">
                <Label className="text-foreground">Anzeigename</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-11 bg-secondary/50 border-border/50"
                />
              </div>

              <div className="grid gap-2">
                <Label className="text-foreground">Bio</Label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Erzähle etwas über dich..."
                  className="bg-secondary/50 border-border/50 min-h-[100px]"
                />
              </div>

              <Button onClick={handleSave} disabled={isLoading} className="h-11 text-primary-foreground font-semibold">
                {isLoading ? "Speichern..." : "Profil speichern"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy">
          <div className="glass rounded-2xl p-6 md:p-8">
            <div className="flex flex-col gap-4">
              <div className="mb-2">
                <h2 className="text-lg font-semibold text-foreground">Privatsphäre-Einstellungen</h2>
                <p className="text-sm text-muted-foreground">Kontrolliere, wer deine Inhalte sehen kann</p>
              </div>

              {/* Private Profile */}
              <div className="flex items-start justify-between gap-4 rounded-xl bg-secondary/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                    {isPrivate ? <EyeOff className="h-5 w-5 text-primary" /> : <Eye className="h-5 w-5 text-primary" />}
                  </div>
                  <div>
                    <Label className="text-foreground font-medium">Privates Profil</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Wenn aktiviert, müssen andere Nutzer eine Follower-Anfrage senden, bevor sie dir folgen können. 
                      Deine Posts sind nur für bestätigte Follower sichtbar.
                    </p>
                  </div>
                </div>
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
              </div>

              {/* Show Followers */}
              <div className="flex items-start justify-between gap-4 rounded-xl bg-secondary/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <Label className="text-foreground font-medium">Follower-Liste anzeigen</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Andere können sehen, wem du folgst und wer dir folgt
                    </p>
                  </div>
                </div>
                <Switch checked={showFollowers} onCheckedChange={setShowFollowers} />
              </div>

              {/* Show Liked Posts */}
              <div className="flex items-start justify-between gap-4 rounded-xl bg-secondary/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                    <Heart className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <Label className="text-foreground font-medium">Gelikte Posts anzeigen</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Andere können sehen, welche Posts du geliked hast
                    </p>
                  </div>
                </div>
                <Switch checked={showLikedPosts} onCheckedChange={setShowLikedPosts} />
              </div>

              {/* DM Privacy */}
              <div className="rounded-xl bg-secondary/30 p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                    <MessageCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <Label className="text-foreground font-medium">Direktnachrichten (DMs)</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Wer kann dir Direktnachrichten senden?
                    </p>
                  </div>
                </div>
                <Select value={dmPrivacy} onValueChange={(v) => setDmPrivacy(v as typeof dmPrivacy)}>
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-green-500" />
                        <div>
                          <span className="font-medium">Jeder</span>
                          <span className="text-xs text-muted-foreground ml-2">Alle können dir DMs senden</span>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="followers">
                      <div className="flex items-center gap-2">
                        <UserX className="h-4 w-4 text-blue-500" />
                        <div>
                          <span className="font-medium">Nur Follower</span>
                          <span className="text-xs text-muted-foreground ml-2">Nur wer dir folgt</span>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="request">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-yellow-500" />
                        <div>
                          <span className="font-medium">Mit Anfrage</span>
                          <span className="text-xs text-muted-foreground ml-2">Müssen erst anfragen</span>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="nobody">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-red-500" />
                        <div>
                          <span className="font-medium">Niemand</span>
                          <span className="text-xs text-muted-foreground ml-2">DMs komplett deaktiviert</span>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              
              </div>

              {/* Info Box for Private Profile */}
              {isPrivate && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 mt-2">
                  <div className="flex items-start gap-3">
                    <Lock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Privates Profil aktiv</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Neue Follower müssen erst von dir bestätigt werden. Du findest ausstehende Anfragen in deinem Profil.
                        Bestehende Follower bleiben erhalten.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={handleSave} disabled={isLoading} className="h-11 text-primary-foreground font-semibold mt-2">
                {isLoading ? "Speichern..." : "Privatsphäre speichern"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="accounts">
          <KontenVerknuepfen
            isLinking={isLinking}
            isLoadingAccounts={isLoadingAccounts}
            isDisconnecting={isDisconnecting}
            accountOverview={accountOverview}
            onLinkAccount={handleLinkAccount}
            onDisconnectProvider={handleDisconnectProvider}
          />
        </TabsContent>
        <TabsContent value="account">
          <div className="glass rounded-2xl p-6 md:p-8">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Zwei-Faktor-Authentifizierung (2FA)</h2>
                <p className="text-sm text-muted-foreground">
                  Zusaetzlicher Schutz mit einem 6-stelligen Code aus deiner Authenticator-App.
                </p>
              </div>
              <div className="space-y-3 rounded-xl bg-secondary/30 p-4">
                <p className="text-sm text-foreground">
                  Status:{" "}
                  <span className={twoFactor.enabled ? "font-medium text-green-500" : "text-muted-foreground"}>
                    {isTwoFactorLoading ? "Laden..." : twoFactor.enabled ? "Aktiviert" : "Deaktiviert"}
                  </span>
                </p>
                {!twoFactor.enabled && !twoFactor.setupPending && (
                  <Button onClick={startTwoFactorSetup} disabled={isTwoFactorLoading} className="h-10 text-primary-foreground font-semibold">
                    2FA aktivieren
                  </Button>
                )}
                {twoFactor.setupPending && (
                  <div className="space-y-3 rounded-lg border border-border/50 bg-background/30 p-3">
                    <p className="text-xs text-muted-foreground">1. QR-Code scannen oder manuellen Key in der App eintragen.</p>
                    {!twoFactorSetupQr && !twoFactorSetupSecret && (
                      <div className="rounded-md border border-border/40 bg-secondary/30 p-3 text-xs text-muted-foreground">
                        Setup war bereits gestartet. Starte es neu, um einen aktuellen QR-Code zu erhalten.
                      </div>
                    )}
                    {twoFactorSetupQr && (
                      <img src={twoFactorSetupQr} alt="2FA QR Code" className="h-40 w-40 rounded-md border border-border/50 bg-white p-1" />
                    )}
                    {twoFactorSetupSecret && (
                      <p className="break-all text-xs text-muted-foreground">
                        Manueller Key: <span className="font-mono text-foreground">{twoFactorSetupSecret}</span>
                      </p>
                    )}
                    <div className="grid gap-2">
                      <Label className="text-foreground">2FA-Code bestaetigen</Label>
                      <Input
                        value={twoFactorSetupCode}
                        onChange={(e) => setTwoFactorSetupCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                        inputMode="numeric"
                        placeholder="123456"
                        className="h-11 bg-secondary/50 border-border/50"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={confirmTwoFactorSetup} disabled={isTwoFactorVerifying} className="h-10 text-primary-foreground font-semibold">
                        {isTwoFactorVerifying ? "Pruefen..." : "Aktivierung bestaetigen"}
                      </Button>
                      <Button onClick={startTwoFactorSetup} variant="secondary" className="h-10" disabled={isTwoFactorLoading}>
                        QR neu laden
                      </Button>
                      <Button
                        variant="outline"
                        className="h-10 bg-transparent"
                        onClick={async () => {
                          await fetch("/api/account/2fa", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ mode: "cancel" }),
                          })
                          setTwoFactorSetupSecret("")
                          setTwoFactorSetupQr("")
                          setTwoFactorSetupCode("")
                          await loadTwoFactorState()
                        }}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                )}
                {twoFactor.enabled && (
                  <div className="space-y-2 rounded-lg border border-border/50 bg-background/30 p-3">
                    <Label className="text-foreground">Zum Deaktivieren aktuellen 2FA-Code eingeben</Label>
                    <Input
                      value={twoFactorDisableCode}
                      onChange={(e) => setTwoFactorDisableCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                      inputMode="numeric"
                      placeholder="123456"
                      className="h-11 bg-secondary/50 border-border/50"
                    />
                    <Button variant="destructive" onClick={disableTwoFactor} disabled={isTwoFactorDisabling} className="h-10 font-semibold">
                      {isTwoFactorDisabling ? "Deaktiviere..." : "2FA deaktivieren"}
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-lg font-semibold text-foreground">Passwort ändern</h2>
                <p className="text-sm text-muted-foreground">Setze ein neues Passwort für deinen Account.</p>
              </div>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label className="text-foreground">Aktuelles Passwort</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="h-11 bg-secondary/50 border-border/50"
                    placeholder="Aktuelles Passwort"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-foreground">Neues Passwort</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-11 bg-secondary/50 border-border/50"
                    placeholder="Mindestens 8 Zeichen"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-foreground">Neues Passwort bestätigen</Label>
                  <Input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="h-11 bg-secondary/50 border-border/50"
                    placeholder="Neues Passwort wiederholen"
                  />
                </div>
                <Button onClick={changePassword} disabled={isChangingPassword} className="h-11 text-primary-foreground font-semibold">
                  {isChangingPassword ? "Wird geändert..." : "Passwort ändern"}
                </Button>
              </div>

              <div className="border-t border-border/40 pt-6">
                <h3 className="text-base font-semibold text-foreground mb-3">Konto-Optionen</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl bg-secondary/30 p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">E-Mail-Benachrichtigungen</p>
                      <p className="text-xs text-muted-foreground">Wichtige Updates per E-Mail erhalten.</p>
                    </div>
                    <Switch
                      checked={accountSettings.emailNotifications}
                      onCheckedChange={(checked) => setAccountSettings((prev) => ({ ...prev, emailNotifications: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-secondary/30 p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">Marketing-E-Mails</p>
                      <p className="text-xs text-muted-foreground">Produktneuigkeiten und Tipps per E-Mail.</p>
                    </div>
                    <Switch
                      checked={accountSettings.marketingEmails}
                      onCheckedChange={(checked) => setAccountSettings((prev) => ({ ...prev, marketingEmails: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-secondary/30 p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">Login-Alerts</p>
                      <p className="text-xs text-muted-foreground">Hinweis bei neuen Anmeldungen.</p>
                    </div>
                    <Switch
                      checked={accountSettings.loginAlerts}
                      onCheckedChange={(checked) => setAccountSettings((prev) => ({ ...prev, loginAlerts: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-secondary/30 p-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">Profil-Tipps anzeigen</p>
                      <p className="text-xs text-muted-foreground">Hilfetexte für Profil-/Sichtbarkeitseinstellungen.</p>
                    </div>
                    <Switch
                      checked={accountSettings.profileVisibilityTips}
                      onCheckedChange={(checked) => setAccountSettings((prev) => ({ ...prev, profileVisibilityTips: checked }))}
                    />
                  </div>
                  <Button onClick={saveAccountSettings} disabled={isSavingAccountSettings} className="h-11 text-primary-foreground font-semibold">
                    {isSavingAccountSettings ? "Speichern..." : "Konto-Optionen speichern"}
                  </Button>
                </div>
              </div>

              <div className="border-t border-border/40 pt-6">
                <h3 className="text-base font-semibold text-destructive mb-2">Konto loeschen</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Diese Aktion ist endgueltig. Alle Daten zu deinem Konto werden entfernt.
                </p>
                <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                  <div className="grid gap-2">
                    <Label className="text-foreground">Bestaetigung</Label>
                    <Input
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      className="h-11 bg-secondary/50 border-border/50"
                      placeholder="KONTO LOESCHEN"
                    />
                    <p className="text-xs text-muted-foreground">
                      Tippe exakt <span className="font-medium text-foreground">KONTO LOESCHEN</span> ein.
                    </p>
                  </div>
                  {accountOverview?.hasPassword && (
                    <div className="grid gap-2">
                      <Label className="text-foreground">Aktuelles Passwort</Label>
                      <Input
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        className="h-11 bg-secondary/50 border-border/50"
                        placeholder="Aktuelles Passwort"
                      />
                    </div>
                  )}
                  <Button
                    variant="destructive"
                    onClick={deleteOwnAccount}
                    disabled={isDeletingAccount || deleteConfirmation.trim().length === 0}
                    className="h-11 font-semibold"
                  >
                    {isDeletingAccount ? "Konto wird geloescht..." : "Konto endgueltig loeschen"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}


