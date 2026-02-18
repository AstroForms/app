import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="glass rounded-2xl p-8 text-center max-w-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Registrierung erfolgreich</h1>
        <p className="text-muted-foreground mb-6">
          Dein Account wurde erstellt. Du kannst dich jetzt direkt anmelden.
        </p>
        <Button asChild variant="outline">
          <Link href="/auth/login">Zurück zum Login</Link>
        </Button>
      </div>
    </div>
  )
}
