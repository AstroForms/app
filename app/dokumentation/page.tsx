import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, BookOpen, Compass, LifeBuoy, ShieldCheck, Workflow } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dokumentation",
  description: "Uebersicht und Hilfe zu AstroForms.",
  alternates: { canonical: "/dokumentation" },
}

const QUICK_START_STEPS = [
  "Account erstellen oder einloggen.",
  "Profil anpassen (Avatar, Banner, Bio, Privacy-Einstellungen).",
  "Channels entdecken oder selbst einen Channel erstellen.",
  "Posts, Kommentare und Reactions nutzen, um dich zu vernetzen.",
  "Bei Bedarf Bots und Automationen fuer deinen Channel einrichten.",
]

const CORE_FEATURES = [
  "Community mit Profilen, Follows, Posts, Kommentaren und Reactions.",
  "Channel-System mit Rollen, Moderation und Promotion-Anfragen.",
  "Direktnachrichten mit DM-Anfragen und Privacy-Kontrollen.",
  "Bot-System mit Regeln, Triggern und Automationen.",
  "Admin- und Trust/Safety-Tools fuer Reports und Sicherheitsfaelle.",
]

export default function DocumentationPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/50 bg-card/40 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/banner.png" alt="AstroForms Logo" width={150} height={32} className="rounded-sm" />
          </Link>
          <Button variant="ghost" asChild className="text-muted-foreground">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Zurueck
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="mb-2 text-3xl font-bold text-foreground">Dokumentation</h1>
        <p className="mb-10 text-muted-foreground">Leitfaden zur Nutzung von AstroForms</p>

        <div className="space-y-6">
          <section className="glass rounded-2xl p-8">
            <div className="mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Was ist AstroForms?</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              AstroForms ist eine Social-Community-Plattform mit Fokus auf Austausch, Channel-Strukturen und
              Automatisierung. Du kannst Inhalte veroeffentlichen, mit anderen interagieren und Community-Bereiche
              gezielt organisieren.
            </p>
          </section>

          <section className="glass rounded-2xl p-8">
            <div className="mb-4 flex items-center gap-2">
              <Workflow className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Kernfunktionen</h2>
            </div>
            <ul className="flex list-disc list-inside flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
              {CORE_FEATURES.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </section>

          <section className="glass rounded-2xl p-8">
            <div className="mb-4 flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Erste Schritte</h2>
            </div>
            <ol className="flex list-decimal list-inside flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
              {QUICK_START_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          <section className="glass rounded-2xl p-8">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Sicherheit und Regeln</h2>
            </div>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Fuer einen sicheren Betrieb gelten verbindliche Regeln fuer Inhalte, Verhalten und Kontoschutz.
              Insbesondere empfehlen wir die Nutzung von 2FA, ein starkes Passwort und sorgfaeltigen Umgang mit
              verknuepften Konten.
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/legal/tos" className="rounded-lg border border-border/60 px-3 py-2 hover:bg-secondary/40">
                Nutzungsbedingungen
              </Link>
              <Link
                href="/legal/privacy"
                className="rounded-lg border border-border/60 px-3 py-2 hover:bg-secondary/40"
              >
                Datenschutz
              </Link>
              <Link
                href="/legal/impressum"
                className="rounded-lg border border-border/60 px-3 py-2 hover:bg-secondary/40"
              >
                Impressum
              </Link>
            </div>
          </section>

          <section className="glass rounded-2xl p-8">
            <div className="mb-4 flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Hilfe und Feedback</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Wenn etwas nicht funktioniert, pruefe zuerst deine Account- und Privacy-Einstellungen. Fuer
              rechtliche Hinweise und verbindliche Regeln nutze die verlinkten Seiten. Bei Fehlern oder
              Verbesserungswuenschen kann die Dokumentation erweitert werden.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/50 px-6 py-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/">
            <Image src="/banner.png" alt="AstroForms Logo" width={140} height={30} className="rounded-sm" />
          </Link>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/dokumentation" className="text-primary">
              Dokumentation
            </Link>
            <Link href="/legal/tos" className="transition-colors hover:text-foreground">
              Nutzungsbedingungen
            </Link>
            <Link href="/legal/privacy" className="transition-colors hover:text-foreground">
              Datenschutz
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
