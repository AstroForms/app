"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    setMessage(null)

    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      setMessage("Wenn ein Konto mit dieser E-Mail existiert, haben wir dir einen Link gesendet.")
    } catch {
      setMessage("Wenn ein Konto mit dieser E-Mail existiert, haben wir dir einen Link gesendet.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl glass p-8">
        <div className="mb-6 text-center">
          <Mail className="mx-auto mb-3 h-9 w-9 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Passwort vergessen</h1>
          <p className="mt-2 text-sm text-muted-foreground">Wir senden dir einen sicheren Link zum Zurücksetzen.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@beispiel.de"
              required
            />
          </div>
          {message ? <p className="rounded-lg bg-secondary/60 p-3 text-sm text-foreground">{message}</p> : null}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Sende Link..." : "Link senden"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Zurück zum <Link href="/auth/login" className="text-primary hover:underline">Login</Link>
        </p>
      </div>
    </div>
  )
}
