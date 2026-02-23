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
    date: "23. Februar 2026",
    changes: [
      "Inhalte an reale Plattformfunktionen angepasst (Posts, Kommentare, Follows, DMs, DM-Anfragen).",
      "Regeln für Channels, Bots, Automationen, Promotion-Anfragen und Reports konkretisiert.",
      "Abschnitte zu Kontosicherheit (Passwort, 2FA, Passkeys), Sanktionen und Konto-Löschung präzisiert.",
    ],
  },
  {
    version: "Version 1.2",
    date: "19. Februar 2026",
    changes: [
      "Umbenennung von AGB auf Nutzungsbedingungen.",
      "Ergänzung eines Cookie-/Consent-Hinweises.",
      "Sicherheitsabschnitt um 2FA-Hinweis ergänzt.",
    ],
  },
  {
    version: "Version 1.1",
    date: "9. Februar 2026",
    changes: [
      "Klarstellungen zu Bots, Automatisierungen und Moderation.",
      "Präzisierung zum XP- und Levelsystem.",
    ],
  },
  {
    version: "Version 1.0",
    date: "1. Februar 2026",
    changes: ["Erstveröffentlichung der Nutzungsbedingungen."],
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
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Zurück
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="mb-2 text-3xl font-bold text-foreground">Nutzungsbedingungen</h1>
        <p className="mb-10 text-muted-foreground">Zuletzt aktualisiert: 23. Februar 2026</p>

        <div className="prose prose-invert max-w-none">
          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">1. Geltungsbereich und Vertragspartner</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Diese Nutzungsbedingungen regeln die Nutzung von AstroForms und aller verbundenen Funktionen,
              insbesondere Profile, Posts, Kommentare, Follows, Channels, Bots, direkte Nachrichten (DM) und
              Moderation. Mit Registrierung oder Nutzung akzeptierst du diese Bedingungen.
            </p>
          </section>

          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">2. Konto, Sicherheit und Zugang</h2>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Für zentrale Funktionen ist ein Nutzerkonto erforderlich. Du bist für korrekte Angaben und den Schutz
              deiner Zugangsdaten verantwortlich.
            </p>
            <ul className="flex list-disc list-inside flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
              <li>Du darfst dein Konto nicht an Dritte überlassen.</li>
              <li>Bei Verdacht auf Missbrauch musst du uns unverzüglich informieren.</li>
              <li>Verfügbare Sicherheitsfunktionen wie 2FA und Passkeys sollst du aktiv nutzen.</li>
            </ul>
          </section>

          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">3. Inhalte und Verhaltensregeln</h2>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Du bist für alle von dir eingestellten Inhalte und Handlungen verantwortlich.
            </p>
            <ul className="flex list-disc list-inside flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
              <li>Verboten sind rechtswidrige, beleidigende, diskriminierende oder gewaltverherrlichende Inhalte.</li>
              <li>Spam, Belästigung, Identitätsmissbrauch, Täuschung und technische Angriffe sind untersagt.</li>
              <li>Du musst die Rechte Dritter beachten (z. B. Urheber-, Marken- und Persönlichkeitsrechte).</li>
            </ul>
          </section>

          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">4. Nutzungsrechte an Inhalten</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Du behältst grundsätzlich deine Rechte an eigenen Inhalten. Du räumst AstroForms ein einfaches,
              nicht-exklusives Recht ein, Inhalte für den Plattformbetrieb zu speichern, zu verarbeiten, anzuzeigen
              und technisch zu verteilen (z. B. in Feeds, Profilen, Channels oder DMs), soweit dies für die
              Bereitstellung erforderlich ist.
            </p>
          </section>

          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">5. Nachrichten, DM-Anfragen und Blockieren</h2>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              AstroForms bietet direkte Nachrichten (DM), DM-Anfragen und Privacy-Einstellungen. Je nach Einstellung
              sind Nachrichten direkt, nur per Anfrage oder gar nicht möglich.
            </p>
            <ul className="flex list-disc list-inside flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
              <li>Beim Blockieren eines Nutzers werden direkte Interaktionen, insbesondere DMs, eingeschränkt.</li>
              <li>Missbrauch von Nachrichtenfunktionen kann zu Moderationsmaßnahmen führen.</li>
              <li>Es besteht kein Anspruch auf Zustellung jeder Nachricht oder dauerhafte Chat-Verfügbarkeit.</li>
            </ul>
          </section>

          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">6. Channels, Bots und Automatisierungen</h2>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Nutzer können Channels erstellen und verwalten. Bots und Automatisierungen sind nur für zulässige
              Zwecke erlaubt.
            </p>
            <ul className="flex list-disc list-inside flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
              <li>Channel-Owner und Moderatoren tragen Verantwortung für Inhalte in ihrem Bereich.</li>
              <li>Bots dürfen nicht für Spam, Belästigung, Umgehung von Sperren oder sonstigen Missbrauch genutzt werden.</li>
              <li>Bei Risiko, Missbrauch oder Verstößen können wir Bots, Automationen oder Integrationen deaktivieren.</li>
            </ul>
          </section>

          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">7. XP, Level, Verifikation und Promotion</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              XP-, Level-, Verifikations- und Promotionsfunktionen sind optionale Plattformfeatures ohne Garantie auf
              wirtschaftliche Vorteile. Regeln, Werte, Verfügbarkeit oder Bedingungen können aus sachlichen Gründen
              angepasst werden, z. B. zur Sicherheit, Missbrauchsprävention oder technischen Weiterentwicklung.
            </p>
          </section>

          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">8. Moderation, Reports und Sanktionen</h2>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              AstroForms kann Inhalte und Accounts prüfen und bei Verstößen angemessen reagieren. Reports können
              sich insbesondere auf Nutzer, Posts, Channels, Kommentare oder Nachrichten beziehen.
            </p>
            <ul className="flex list-disc list-inside flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
              <li>Mögliche Maßnahmen: Hinweis, Inhaltseinschränkung, Löschung, temporäre oder permanente Sperre.</li>
              <li>Gemeldete Inhalte dürfen zur Sicherheits- und Missbrauchsprüfung verarbeitet werden.</li>
              <li>Bei schwerwiegenden Verstößen behalten wir uns rechtliche Schritte vor.</li>
            </ul>
          </section>

          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">9. Verfügbarkeit und Änderungen am Dienst</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Wir bemühen uns um hohe Verfügbarkeit, können aber keine unterbrechungsfreie Erreichbarkeit
              garantieren. Funktionen können geändert, erweitert oder eingestellt werden, soweit dies für Betrieb,
              Sicherheit, Compliance oder Weiterentwicklung erforderlich ist.
            </p>
          </section>

          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">10. Haftung und Freistellung</h2>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie im gesetzlich zwingenden Umfang.
              Bei einfacher Fahrlässigkeit haften wir nur bei Verletzung wesentlicher Vertragspflichten und
              beschränkt auf den typischen, vorhersehbaren Schaden.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Du stellst AstroForms von Ansprüchen Dritter frei, die aus deinen rechtswidrigen Inhalten oder deiner
              rechtswidrigen Nutzung der Plattform entstehen, soweit du den Verstoß zu vertreten hast.
            </p>
          </section>

          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">11. Laufzeit, Löschung und Beendigung</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Du kannst dein Konto gemäß den verfügbaren Kontofunktionen löschen. Wir können Konten bei
              schwerwiegenden oder wiederholten Verstößen sperren oder kündigen. Gesetzliche Aufbewahrungs- und
              Nachweispflichten bleiben unberührt.
            </p>
          </section>

          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">12. Änderungen dieser Nutzungsbedingungen</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Wir können diese Nutzungsbedingungen anpassen, wenn sachliche Gründe vorliegen (z. B. neue Funktionen,
              geänderte Rechtslage, Sicherheitsanforderungen). Die jeweils gültige Version wird auf dieser Seite
              veröffentlicht. Wesentliche Änderungen können eine erneute Zustimmung erforderlich machen.
            </p>
          </section>

          <section className="glass rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">13. Versionshistorie</h2>
            <div className="space-y-4">
              {TERMS_CHANGELOG.map((entry) => (
                <div key={entry.version} className="rounded-xl border border-border/50 bg-secondary/20 p-4">
                  <p className="text-sm font-medium text-foreground">
                    {entry.version} <span className="font-normal text-muted-foreground">({entry.date})</span>
                  </p>
                  <ul className="mt-2 flex list-disc list-inside flex-col gap-1 text-sm text-muted-foreground">
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
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/">
            <Image src="/banner.png" alt="AstroForms Logo" width={140} height={30} className="rounded-sm" />
          </Link>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/legal/tos" className="text-primary">
              Nutzungsbedingungen
            </Link>
            <Link href="/legal/privacy" className="transition-colors hover:text-foreground">
              Datenschutz
            </Link>
            <Link href="/legal/impressum" className="transition-colors hover:text-foreground">
              Impressum
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
