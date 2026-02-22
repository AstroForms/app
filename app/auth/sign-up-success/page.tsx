"use client"

import Link from "next/link"
import { CheckCircle2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export default function SignUpSuccessPage() {
  const [email, setEmail] = useState("")
  const [resendState, setResendState] = useState<"idle" | "loading" | "done">("idle")

  useEffect(() => {
    if (typeof window === "undefined") return
    const value = new URLSearchParams(window.location.search).get("email") || ""
    setEmail(value)
  }, [])

  const resendVerificationMail = async () => {
    if (!email || resendState === "loading") return

    setResendState("loading")
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    setResendState("done")
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="glass rounded-2xl p-8 text-center max-w-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Fast geschafft</h1>
        <p className="text-muted-foreground mb-3">
          Dein Account wurde erstellt. Bitte bestaetige jetzt deine E-Mail-Adresse.
        </p>
        {email ? <p className="text-sm font-medium text-foreground mb-5">Mail gesendet an: {email}</p> : null}

        <div className="rounded-lg border border-border/60 bg-secondary/30 p-4 text-left mb-6">
          <p className="text-sm font-semibold mb-2 inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Sicherheitsinfos</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>Wir fragen dich niemals nach deinem Passwort per E-Mail.</li>
            <li>Der Bestaetigungslink ist 24 Stunden gueltig.</li>
            <li>Wenn du keine Mail siehst, pruefe Spam/Junk und sende neu.</li>
          </ul>
        </div>

        <div className="grid gap-3">
          <Button onClick={resendVerificationMail} disabled={!email || resendState === "loading"}>
            {resendState === "loading" ? "Sende erneut..." : "Bestaetigungs-Mail erneut senden"}
          </Button>
          {resendState === "done" ? (
            <p className="text-xs text-green-700 bg-green-100 rounded-md p-2">Wenn der Account noch unbestaetigt ist, wurde eine neue Mail verschickt.</p>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/auth/login">Zum Login</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
