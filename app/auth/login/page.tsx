"use client"

import React from "react"

import { getProviders, signIn } from "next-auth/react"
import { signIn as passkeySignIn } from "next-auth/webauthn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Image from "next/image"
import { Github, KeyRound } from "lucide-react"

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M2 3h9v9H2V3zm11 0h9v9h-9V3zM2 14h9v9H2v-9zm11 0h9v9h-9v-9z" />
    </svg>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [availableProviders, setAvailableProviders] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const mapAuthError = (value: string | null | undefined) => {
    if (!value) return null
    switch (value) {
      case "AccountBanned":
        return "Dein Account ist aktuell gesperrt. Bitte kontaktiere den Support."
      case "EmailNotVerified":
        return "Bitte bestaetige zuerst deine E-Mail-Adresse. Pruefe dein Postfach."
      case "CredentialsSignin":
        return "Login fehlgeschlagen. PrÃ¼fe Benutzername/E-Mail und Passwort."
      case "AccessDenied":
        return "Zugriff verweigert. Dein Account ist eventuell eingeschrÃ¤nkt."
      case "Configuration":
        return "Login ist gerade nicht verfÃ¼gbar (Configuration). Bitte spÃ¤ter erneut versuchen."
      case "OAuthAccountNotLinked":
        return "Dieser OAuth-Login ist nicht mit deinem Account verknÃ¼pft."
      case "VerificationExpired":
        return "Der Bestaetigungslink ist abgelaufen. Lass dir bitte einen neuen Link senden."
      case "Verification":
        return "Der Bestaetigungslink ist ungueltig oder wurde bereits verwendet."
      default:
        return "Anmeldung fehlgeschlagen. Bitte erneut versuchen."
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    const search = new URLSearchParams(window.location.search)
    const incomingError = search.get("error")
    if (incomingError) {
      setError(mapAuthError(incomingError))
    }
    if (search.get("verified") === "1") {
      setNotice("E-Mail erfolgreich bestaetigt. Du kannst dich jetzt anmelden.")
    }
  }, [])

  useEffect(() => {
    let active = true
    getProviders()
      .then((providers) => {
        if (!active) return
        setAvailableProviders(new Set(Object.keys(providers || {})))
      })
      .catch(() => {
        if (!active) return
        setAvailableProviders(new Set())
      })

    return () => {
      active = false
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/",
      })
      if (!result) {
        throw new Error("Login fehlgeschlagen")
      }
      if (result.url && result.url.includes("error=AccountBanned")) {
        throw new Error(mapAuthError("AccountBanned") || "Dein Account ist aktuell gesperrt.")
      }
      if (result.error || !result.ok) {
        throw new Error(mapAuthError(result.error) || "Ungültige Anmeldedaten")
      }
      router.push(result.url || "/")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten")
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuth = async (provider: "google" | "discord" | "github" | "microsoft-entra-id") => {
    if (!availableProviders.has(provider)) {
      setError("Dieser Login-Provider ist derzeit nicht verfuegbar.")
      return
    }
    await signIn(provider, { callbackUrl: "/" })
  }

  const handlePasskeyLogin = async () => {
    setError(null)
    try {
      await passkeySignIn("passkey", { redirectTo: "/" })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Passkey-Anmeldung fehlgeschlagen")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center mb-4">
            <Image src="/banner.png" alt="AstroForms Logo" width={180} height={38} className="rounded-sm" />
          </Link>
          <p className="text-muted-foreground">Melde dich bei deinem Account an</p>
        </div>

        <div className="glass rounded-2xl p-8">
          <div className="flex flex-col gap-3 mb-6">
            <Button
              variant="outline"
              className="w-full gap-2 h-11 bg-secondary/50 border-border/50 hover:bg-secondary text-foreground"
              onClick={handlePasskeyLogin}
            >
              <KeyRound className="h-5 w-5" />
              Mit Passkey anmelden
            </Button>
            {availableProviders.has("google") ? (
              <Button
                variant="outline"
                className="w-full gap-2 h-11 bg-secondary/50 border-border/50 hover:bg-secondary text-foreground"
                onClick={() => handleOAuth("google")}
              >
                <GoogleIcon className="h-5 w-5" />
                Mit Google anmelden
              </Button>
            ) : null}
            {availableProviders.has("discord") ? (
              <Button
                variant="outline"
                className="w-full gap-2 h-11 bg-secondary/50 border-border/50 hover:bg-secondary text-foreground"
                onClick={() => handleOAuth("discord")}
              >
                <DiscordIcon className="h-5 w-5" />
                Mit Discord anmelden
              </Button>
            ) : null}
            {availableProviders.has("microsoft-entra-id") ? (
              <Button
                variant="outline"
                className="w-full gap-2 h-11 bg-secondary/50 border-border/50 hover:bg-secondary text-foreground"
                onClick={() => handleOAuth("microsoft-entra-id")}
              >
                <MicrosoftIcon className="h-5 w-5" />
                Mit Microsoft anmelden
              </Button>
            ) : null}
            {availableProviders.has("github") ? (
              <Button
                variant="outline"
                className="w-full gap-2 h-11 bg-secondary/50 border-border/50 hover:bg-secondary text-foreground"
                onClick={() => handleOAuth("github")}
              >
                <Github className="h-5 w-5" />
                Mit GitHub anmelden
              </Button>
            ) : null}
          </div>

          <div className="flex items-center gap-4 mb-6">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground uppercase">oder</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-foreground">E-Mail oder Benutzername</Label>
              <Input
                id="email"
                type="text"
                placeholder="name@beispiel.de oder dein_name"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-secondary/50 border-border/50"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password" className="text-foreground">Passwort</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-secondary/50 border-border/50"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{error}</p>
            )}
            {notice && (
              <p className="text-sm text-green-700 bg-green-100 rounded-lg p-3">{notice}</p>
            )}
            <Button type="submit" className="w-full h-11 font-semibold text-primary-foreground" disabled={isLoading}>
              {isLoading ? "Anmelden..." : "Anmelden"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Noch kein Account?{" "}
            <Link href="/auth/sign-up" className="text-primary hover:underline font-medium">
              Registrieren
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Mit der Anmeldung stimmst du unseren{" "}
          <Link href="/legal/tos" className="text-primary hover:underline">Nutzungsbedingungen</Link>,{" "}
          <Link href="/legal/privacy" className="text-primary hover:underline">Datenschutz</Link> und{" "}
          <Link href="/legal/impressum" className="text-primary hover:underline">Impressum</Link> zu.
        </p>
      </div>
    </div>
  )
}

