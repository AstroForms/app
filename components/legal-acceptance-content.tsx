"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"

type LegalAcceptanceContentProps = {
  callbackUrl: string
  version: string
}

export function LegalAcceptanceContent({ callbackUrl, version }: LegalAcceptanceContentProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accept = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/legal/acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Akzeptanz fehlgeschlagen.")
      }
      router.push(callbackUrl)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Akzeptanz fehlgeschlagen.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-border/60 bg-card/70 p-8 backdrop-blur">
        <h1 className="text-2xl font-bold text-foreground">Nutzungsbedingungen aktualisiert</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bitte akzeptiere die aktuelle Version <span className="font-medium text-foreground">{version}</span>, um AstroForms weiter zu nutzen.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Die Details findest du unter{" "}
          <Link href="/legal/tos" className="underline underline-offset-2 hover:text-foreground">
            Nutzungsbedingungen
          </Link>
          .
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={accept} disabled={isLoading} className="text-primary-foreground">
            {isLoading ? "Wird gespeichert..." : "Version akzeptieren"}
          </Button>
          <Button variant="outline" asChild className="bg-transparent">
            <Link href="/legal/tos">Nutzungsbedingungen lesen</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
