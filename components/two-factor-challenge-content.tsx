"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { ShieldCheck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type TwoFactorChallengeContentProps = {
  callbackUrl: string
}

export function TwoFactorChallengeContent({ callbackUrl }: TwoFactorChallengeContentProps) {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: code }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "2FA-Code ungueltig.")
      }
      router.push(callbackUrl)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "2FA-Code ungueltig.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md glass rounded-2xl p-8">
        <div className="mb-6 text-center">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">2FA-Bestaetigung</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gib den 6-stelligen Code aus deiner Authenticator-App oder einen Backup-Code ein.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9-]/g, "").slice(0, 12).toUpperCase())}
            placeholder="123456 oder ABCDE-12345"
            className="h-11 bg-secondary/50 border-border/50 text-center text-lg"
            autoComplete="one-time-code"
          />
          {error && (
            <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="h-11 w-full text-primary-foreground font-semibold" disabled={isLoading}>
            {isLoading ? "Pruefen..." : "Code bestaetigen"}
          </Button>
        </form>

        <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
          <Link href="/settings" className="hover:underline">2FA verwalten</Link>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/auth/login" })}
            className="hover:underline"
          >
            Abmelden
          </button>
        </div>
      </div>
    </div>
  )
}
