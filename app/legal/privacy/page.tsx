import Link from "next/link"
import Image from "next/image"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Datenschutzerklaerung",
  description: "Datenschutzerklaerung von AstroForms.",
  alternates: { canonical: "/legal/privacy" },
}

const PRIVACY_CHANGELOG = [
  {
    version: "Version 1.2",
    date: "23. Februar 2026",
    changes: [
      "Datenkategorien auf reale Features erweitert (Posts, Kommentare, Follows, DMs, Reports, Bot-Logs).",
      "Drittanbieter konkretisiert (OAuth-Provider, GIF-Suche via Tenor, optionaler Discord-Audit-Webhook).",
      "Cookies/Local Storage, Speicherdauer und Loeschroutinen praezisiert.",
    ],
  },
  {
    version: "Version 1.1",
    date: "9. Februar 2026",
    changes: ["Grundfassung Datenschutz."],
  },
]

export default function PrivacyPage() {
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
        <h1 className="mb-2 text-3xl font-bold text-foreground">Datenschutzerklaerung</h1>
        <p className="mb-10 text-muted-foreground">Zuletzt aktualisiert: 23. Februar 2026</p>

        <div className="prose prose-invert max-w-none">
          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">1. Verantwortlicher</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Verantwortlich fuer die Datenverarbeitung ist der Betreiber von AstroForms. Die Kontaktdaten findest du
              im Impressum.
            </p>
          </section>

          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">2. Welche Daten wir verarbeiten</h2>
            <ul className="flex list-disc list-inside flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
              <li>Kontodaten: E-Mail, Name, optional Passwort-Hash, verknuepfte Login-Provider, Passkeys.</li>
              <li>Profildaten: Benutzername, Anzeigename, Bio, Avatar, Banner, Privacy- und Sichtbarkeitseinstellungen.</li>
              <li>Community-Daten: Posts, Kommentare, Likes, Saves, Hashtags, Follows und Follow-Anfragen.</li>
              <li>Messaging-Daten: Konversationen, DM-Anfragen, Nachrichten-Metadaten, Blocklisten und Lesebestaetigungen.</li>
              <li>Channel-/Bot-Daten: Mitgliedschaften, Rollen, Promotion-Anfragen, Bots, Bot-Regeln, Automationen, Ausfuehrungslogs.</li>
              <li>Trust-&-Safety-Daten: Reports, Bearbeitungsstatus, Admin-Notizen, Audit-Logs von Admin-Aktionen.</li>
              <li>Technische Daten: IP-Adresse, Zeitstempel, Session-/Sicherheitsinformationen und angeforderte Ressourcen.</li>
            </ul>
          </section>

          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">3. Zwecke der Verarbeitung</h2>
            <ul className="flex list-disc list-inside flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
              <li>Bereitstellung der Plattform und ihrer Funktionen (Account, Feed, Channels, Bots, DMs).</li>
              <li>Authentifizierung, Kontosicherheit, 2FA/Passkeys und Missbrauchspraevention.</li>
              <li>Moderation, Report-Bearbeitung und Durchsetzung der Nutzungsbedingungen.</li>
              <li>Betrieb, Fehleranalyse, technische Stabilitaet und Weiterentwicklung.</li>
              <li>Kommunikation per E-Mail (z. B. Verifizierung, Passwort-Reset, Sicherheitshinweise).</li>
            </ul>
          </section>

          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">4. Rechtsgrundlagen (DSGVO)</h2>
            <ul className="flex list-disc list-inside flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
              <li>Art. 6 Abs. 1 lit. b DSGVO fuer Vertragsdurchfuehrung (Plattformbetrieb und Nutzerkonto).</li>
              <li>Art. 6 Abs. 1 lit. f DSGVO fuer berechtigte Interessen (Sicherheit, Missbrauchsabwehr, Betrieb).</li>
              <li>Art. 6 Abs. 1 lit. a DSGVO fuer Einwilligungen (z. B. optionale Consent-Kategorien).</li>
              <li>Art. 6 Abs. 1 lit. c DSGVO, soweit gesetzliche Pflichten eine Verarbeitung erfordern.</li>
            </ul>
          </section>

          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">5. Empfaenger und Drittanbieter</h2>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Wir geben Daten nur weiter, wenn dies fuer den Betrieb erforderlich ist, eine Rechtsgrundlage besteht oder
              du eingewilligt hast. Je nach Nutzung koennen folgende Kategorien betroffen sein:
            </p>
            <ul className="flex list-disc list-inside flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
              <li>OAuth-Provider fuer Login/Verknuepfung (Google, Discord, GitHub, Microsoft Entra ID).</li>
              <li>E-Mail-Dienstleister (SMTP) fuer transaktionale Nachrichten.</li>
              <li>Tenor (Google) bei GIF-Suche in der Nachrichtenfunktion.</li>
              <li>Discord bei optional konfiguriertem Admin-Audit-Webhook.</li>
            </ul>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Bei Anbietern ausserhalb der EU/des EWR kann eine Drittlanduebermittlung stattfinden. In diesen Faellen
              achten wir auf geeignete Schutzmassnahmen gemaess DSGVO.
            </p>
          </section>

          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">6. Speicherdauer und Loeschung</h2>
            <ul className="flex list-disc list-inside flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
              <li>Kontodaten speichern wir grundsaetzlich fuer die Dauer des Nutzerkontos.</li>
              <li>Bei Konto-Loeschung werden verknuepfte Daten im Rahmen unserer Loeschlogik entfernt.</li>
              <li>Einzelne Daten koennen laenger gespeichert bleiben, wenn gesetzliche Pflichten dies verlangen.</li>
              <li>Sicherheits- und Moderationsdaten speichern wir nur so lange, wie sie fuer den Zweck erforderlich sind.</li>
            </ul>
          </section>

          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">7. Cookies und Local Storage</h2>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              AstroForms verwendet notwendige Cookies fuer Authentifizierung und Sicherheit sowie ein Consent-Management
              fuer optionale Kategorien.
            </p>
            <ul className="flex list-disc list-inside flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
              <li>Notwendig: Session-/CSRF-/Callback-Cookies fuer Login (Auth.js).</li>
              <li>Sicherheit: Cookie zur 2FA-Bestaetigung (`af_2fa_ok`) und zur Terms-Akzeptanz (`af_terms_ok`).</li>
              <li>Consent: Cookie `af_consent` und Local-Storage-Eintrag `af_consent_preferences`.</li>
              <li>UI-Komfort: `sidebar:state` zur Speicherung des Sidebar-Status.</li>
            </ul>
          </section>

          <section className="glass mb-6 rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">8. Deine Rechte</h2>
            <ul className="flex list-disc list-inside flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
              <li>Auskunft (Art. 15 DSGVO)</li>
              <li>Berichtigung (Art. 16 DSGVO)</li>
              <li>Loeschung (Art. 17 DSGVO)</li>
              <li>Einschraenkung der Verarbeitung (Art. 18 DSGVO)</li>
              <li>Datenuebertragbarkeit (Art. 20 DSGVO)</li>
              <li>Widerspruch (Art. 21 DSGVO)</li>
              <li>Widerruf erteilter Einwilligungen mit Wirkung fuer die Zukunft</li>
              <li>Beschwerde bei einer Datenschutzaufsichtsbehoerde</li>
            </ul>
          </section>

          <section className="glass rounded-2xl p-8">
            <h2 className="mb-4 text-xl font-semibold text-foreground">9. Versionshistorie</h2>
            <div className="space-y-4">
              {PRIVACY_CHANGELOG.map((entry) => (
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
            <Link href="/legal/tos" className="transition-colors hover:text-foreground">
              Nutzungsbedingungen
            </Link>
            <Link href="/legal/privacy" className="text-primary">
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
