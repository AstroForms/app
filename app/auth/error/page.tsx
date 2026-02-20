import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

function mapErrorMessage(error?: string) {
  switch (error) {
    case "AccessDenied":
      return "Zugriff verweigert. Dein Account ist möglicherweise gesperrt oder hat keine Berechtigung."
    case "Configuration":
      return "Die Login-Konfiguration ist aktuell fehlerhaft. Bitte später erneut versuchen."
    case "OAuthAccountNotLinked":
      return "Dieser Login-Provider ist nicht mit deinem Account verknüpft."
    case "Verification":
      return "Die Verifizierung ist fehlgeschlagen oder abgelaufen."
    default:
      return "Es gab ein Problem bei der Authentifizierung. Bitte versuche es erneut."
  }
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const errorCode = params?.error
  const message = mapErrorMessage(errorCode)

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="glass rounded-2xl p-8 text-center max-w-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Authentifizierungsfehler</h1>
        <p className="text-muted-foreground mb-6">{message}</p>
        {errorCode ? <p className="text-xs text-muted-foreground mb-4">Code: {errorCode}</p> : null}
        <Button asChild>
          <Link href="/auth/login">Zurück zum Login</Link>
        </Button>
      </div>
    </div>
  )
}
