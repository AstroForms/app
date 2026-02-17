import Link from "next/link"
import { Mail } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="glass rounded-2xl p-8 text-center max-w-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">E-Mail bestaetigen</h1>
        <p className="text-muted-foreground mb-6">
          Wir haben dir eine Bestaetigungs-E-Mail gesendet. Bitte klicke auf den Link in der E-Mail, um deinen Account zu aktivieren.
        </p>
        <Button asChild variant="outline">
          <Link href="/auth/login">Zurück zum Login</Link>
        </Button>
      </div>
    </div>
  )
}
