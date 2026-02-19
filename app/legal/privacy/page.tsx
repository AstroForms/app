import Link from "next/link"
import { Rocket, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: "Datenschutzerklärung von AstroForms.",
  alternates: { canonical: "/legal/privacy" },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/50 bg-card/40 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <Rocket className="h-6 w-6 text-primary" />
            <span className="font-bold text-foreground">AstroForms</span>
          </Link>
          <Button variant="ghost" asChild className="text-muted-foreground">
            <Link href="/"><ArrowLeft className="h-4 w-4 mr-2" /> Zurück</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-bold text-foreground mb-2">Datenschutzerklärung</h1>
        <p className="text-muted-foreground mb-10">Zuletzt aktualisiert: 9. Februar 2026</p>

        <div className="prose prose-invert max-w-none">
          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Verantwortlicher</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Verantwortlich für die Datenverarbeitung auf dieser Plattform ist der Betreiber von AstroForms. 
              Kontaktdaten finden Sie im Impressum.
            </p>
          </section>

          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Erhobene Daten</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Bei der Nutzung von AstroForms werden folgende Daten erhoben:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed flex flex-col gap-2">
              <li>E-Mail-Adresse und Benutzername bei der Registrierung</li>
              <li>Profilinformationen (Anzeigename, Bio, Profilbild)</li>
              <li>Erstellte Inhalte (Posts, Channels, Bots, Automatisierungen)</li>
              <li>Interaktionsdaten (Follows, Channel-Mitgliedschaften, XP-Verlauf)</li>
              <li>Technische Daten (IP-Adresse, Browser-Informationen, Zeitstempel)</li>
              <li>OAuth-Daten bei Anmeldung über Google, Discord oder GitHub</li>
            </ul>
          </section>

          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">3. Zweck der Datenverarbeitung</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Die erhobenen Daten werden für folgende Zwecke verarbeitet:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed flex flex-col gap-2">
              <li>Bereitstellung und Betrieb der Plattform</li>
              <li>Verwaltung von Nutzerkonten und Authentifizierung</li>
              <li>Anzeige von Profilen, Posts und Channel-Inhalten</li>
              <li>Berechnung und Anzeige des XP- und Levelsystems</li>
              <li>Sicherheit und Missbrauchsprävention</li>
              <li>Verwaltung von Reports und Moderationsaufgaben</li>
            </ul>
          </section>

          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Rechtsgrundlage</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Die Verarbeitung der Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragsdurchführung) 
              sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Sicherheit und dem Betrieb der Plattform). 
              Die Anmeldung über OAuth-Anbieter erfolgt auf Grundlage der Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO.
            </p>
          </section>

          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Datenspeicherung</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Die Daten werden auf Servern mit eigener Datenbank-Infrastruktur gespeichert.
              Die Daten werden so lange gespeichert, wie der Nutzeraccount besteht. 
              Nach Löschen des Accounts werden die Daten innerhalb von 30 Tagen vollständig entfernt.
            </p>
          </section>

          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Rechte der Betroffenen</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Gemäß der DSGVO haben Sie folgende Rechte:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed flex flex-col gap-2">
              <li>Recht auf Auskunft über gespeicherte Daten (Art. 15 DSGVO)</li>
              <li>Recht auf Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
              <li>Recht auf Löschen der Daten (Art. 17 DSGVO)</li>
              <li>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
              <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
              <li>Recht auf Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
            </ul>
          </section>

          <section className="glass rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Cookies</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              AstroForms verwendet nur technisch notwendige Cookies für die Authentifizierung und Session-Verwaltung. 
              Es werden keine Tracking-Cookies oder Cookies für Werbezwecke eingesetzt.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/50 px-6 py-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">AstroForms</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/legal/tos" className="hover:text-foreground transition-colors">AGB</Link>
            <Link href="/legal/privacy" className="text-primary">Datenschutz</Link>
            <Link href="/legal/impressum" className="hover:text-foreground transition-colors">Impressum</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
