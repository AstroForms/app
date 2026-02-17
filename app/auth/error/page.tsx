import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="glass rounded-2xl p-8 text-center max-w-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Authentifizierungsfehler</h1>
        <p className="text-muted-foreground mb-6">
          Es gab ein Problem bei der Authentifizierung. Bitte versuche es erneut.
        </p>
        <Button asChild>
          <Link href="/auth/login">Zurück zum Login</Link>
        </Button>
      </div>
    </div>
  )
}
