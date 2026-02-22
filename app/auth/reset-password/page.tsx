"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [token, setToken] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const value = new URLSearchParams(window.location.search).get("token") || ""
    setToken(value)
  }, [])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    setMessage(null)

    if (!token) {
      setError("Der Zurücksetzungslink ist ungültig.")
      setIsLoading(false)
      return
    }

    if (newPassword !== repeatPassword) {
      setError("Die Passwörter stimmen nicht überein.")
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Passwort konnte nicht zurückgesetzt werden.")
      }

      setMessage("Passwort erfolgreich geändert. Du wirst jetzt zum Login weitergeleitet.")
      setTimeout(() => router.push("/auth/login"), 1200)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Passwort konnte nicht zurückgesetzt werden.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl glass p-8">
        <div className="mb-6 text-center">
          <Lock className="mx-auto mb-3 h-9 w-9 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Neues Passwort setzen</h1>
          <p className="mt-2 text-sm text-muted-foreground">Wähle ein sicheres Passwort mit mindestens 10 Zeichen.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="password">Neues Passwort</Label>
            <Input
              id="password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password-repeat">Neues Passwort wiederholen</Label>
            <Input
              id="password-repeat"
              type="password"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              required
            />
          </div>

          {error ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
          {message ? <p className="rounded-lg bg-secondary/60 p-3 text-sm text-foreground">{message}</p> : null}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Speichere..." : "Passwort ändern"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Zurück zum <Link href="/auth/login" className="text-primary hover:underline">Login</Link>
        </p>
      </div>
    </div>
  )
}
