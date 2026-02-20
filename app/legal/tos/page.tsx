import Link from "next/link"
import Image from "next/image"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Metadata } from "next"
import { CURRENT_TERMS_VERSION } from "@/lib/legal-constants"

export const metadata: Metadata = {
  title: "Nutzungsbedingungen",
  description: "Nutzungsbedingungen von AstroForms.",
  alternates: { canonical: "/legal/tos" },
}

const TERMS_CHANGELOG = [
  {
    version: CURRENT_TERMS_VERSION,
    date: "19. Februar 2026",
    changes: [
      "Umbenennung von AGB auf Nutzungsbedingungen.",
      "Ergänzung eines Cookie-/Consent-Hinweises.",
      "Sicherheitsabschnitt um 2FA-Hinweis ergänzt.",
    ],
  },
  {
    version: "v1.1",
    date: "9. Februar 2026",
    changes: [
      "Klarstellungen zu Bots, Automatisierungen und Moderation.",
      "Präzisierung zum XP- und Levelsystem.",
    ],
  },
  {
    version: "v1.0",
    date: "1. Februar 2026",
    changes: [
      "Erstveröffentlichung der Nutzungsbedingungen.",
    ],
  },
]

export default function TosPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/50 bg-card/40 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/banner.png" alt="AstroForms Logo" width={150} height={32} className="rounded-sm" />
          </Link>
          <Button variant="ghost" asChild className="text-muted-foreground">
            <Link href="/"><ArrowLeft className="h-4 w-4 mr-2" /> Zurück</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-bold text-foreground mb-2">Nutzungsbedingungen</h1>
        <p className="text-muted-foreground mb-10">Zuletzt aktualisiert: 19. Februar 2026</p>

        <div className="prose prose-invert max-w-none">
          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Geltungsbereich</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der Plattform AstroForms und aller damit verbundenen Dienste. 
              Mit der Registrierung und Nutzung der Plattform erklaert sich der Nutzer mit diesen Bedingungen einverstanden.
            </p>
          </section>

          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Registrierung und Account</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Für die Nutzung der Plattform ist eine Registrierung erforderlich. Der Nutzer ist verpflichtet, wahrheitsgetreue und vollständige Angaben zu machen. Jeder Nutzer darf nur einen Account besitzen.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Der Nutzer ist für die Sicherheit seiner Zugangsdaten selbst verantwortlich. Bei Verdacht auf Missbrauch des Accounts ist der Nutzer verpflichtet, uns unverzüglich zu informieren.
            </p>
          </section>

          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">3. Nutzungsregeln</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Der Nutzer verpflichtet sich, die Plattform nicht für rechtswidrige Zwecke zu nutzen. Insbesondere ist es untersagt:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed flex flex-col gap-2">
              <li>Inhalte zu verbreiten, die gegen geltendes Recht verstoßen</li>
              <li>Andere Nutzer zu belaestigen, zu bedrohen oder zu diskriminieren</li>
              <li>Spam oder unerwuenschte Werbung zu verbreiten</li>
              <li>Die Plattform technisch zu manipulieren oder zu überlasten</li>
              <li>Bots oder Automatisierungen für missbräuchliche Zwecke einzusetzen</li>
            </ul>
          </section>

          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Channels und Inhalte</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nutzer können eigene Channels erstellen und Inhalte veröffentlichen. Für die Inhalte ist der jeweilige Nutzer selbst verantwortlich. 
              AstroForms behält sich das Recht vor, Inhalte und Channels zu entfernen, die gegen diese Nutzungsbedingungen verstoßen.
              Channel-Owner und Moderatoren sind für die Einhaltung der Regeln in ihren Channels mitverantwortlich.
            </p>
          </section>

          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Bots und Automatisierungen</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Die Erstellung von Bots und Automatisierungen ist erlaubt, sofern diese nicht gegen die Nutzungsregeln verstoßen. 
              Automatisierte Posts werden mit einem AUTOMIERT-Badge gekennzeichnet. AstroForms behält sich das Recht vor, nicht verifizierte Bots einzuschraenken oder zu entfernen.
            </p>
          </section>

          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">6. XP und Levelsystem</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Das XP- und Levelsystem dient der Gamification der Plattform. Es besteht kein Anspruch auf bestimmte XP-Werte oder Level. 
              AstroForms behält sich das Recht vor, das System jederzeit anzupassen. Missbrauch des XP-Systems kann zur Zurücksetzung der XP und zum Ausschluss von der Plattform fuehren.
            </p>
          </section>

          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Haftung</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              AstroForms haftet nicht für Schäden, die durch die Nutzung der Plattform entstehen, es sei denn, es liegt Vorsatz oder grobe Fahrlässigkeit vor. 
              Für die Verfügbarkeit der Plattform wird keine Garantie übernommen.
            </p>
          </section>

          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Änderungen der Nutzungsbedingungen</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              AstroForms behält sich das Recht vor, diese Nutzungsbedingungen jederzeit zu ändern. Änderungen werden den Nutzern rechtzeitig mitgeteilt. 
              Die weitere Nutzung der Plattform nach Änderung der Nutzungsbedingungen gilt als Zustimmung zu den geänderten Bedingungen.
            </p>
          </section>

          <section className="glass rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Versionshistorie</h2>
            <div className="space-y-4">
              {TERMS_CHANGELOG.map((entry) => (
                <div key={entry.version} className="rounded-xl border border-border/50 bg-secondary/20 p-4">
                  <p className="text-sm font-medium text-foreground">
                    {entry.version} <span className="text-muted-foreground font-normal">({entry.date})</span>
                  </p>
                  <ul className="mt-2 list-disc list-inside text-sm text-muted-foreground flex flex-col gap-1">
                    {entry.changes.map((change) => (
                      <li key={change}>{change}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/50 px-6 py-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/">
            <Image src="/banner.png" alt="AstroForms Logo" width={140} height={30} className="rounded-sm" />
          </Link>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/legal/tos" className="text-primary">Nutzungsbedingungen</Link>
            <Link href="/legal/privacy" className="hover:text-foreground transition-colors">Datenschutz</Link>
            <Link href="/legal/impressum" className="hover:text-foreground transition-colors">Impressum</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
