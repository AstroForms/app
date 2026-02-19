import Link from "next/link"
import { Rocket, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Impressum",
  description: "Impressum und Anbieterkennzeichnung von AstroForms.",
  alternates: { canonical: "/legal/impressum" },
}

export default function ImpressumPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/50 bg-card/40 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <Rocket className="h-6 w-6 text-primary" />
            <span className="font-bold text-foreground">AstroForms</span>
          </Link>
          <Button variant="ghost" asChild className="text-muted-foreground">
            <Link href="/"><ArrowLeft className="h-4 w-4 mr-2" /> Zurueck</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-bold text-foreground mb-2">Impressum</h1>
        <p className="text-muted-foreground mb-10">Angaben gemäß § 5 DDG</p>

        <div className="prose prose-invert max-w-none">
          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Diensteanbieter</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              AstroForms
              <br />
              Conner Berthun
              <br />
              Botenfeldstraße 2
              <br />
              84088 Neufahrn i. NB.
              <br />
              Deutschland
            </p>
          </section>

          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Kontakt</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              E-Mail: In Arbeit
            </p>
          </section>

          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Vertretungsberechtigt</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Conner Berthun
            </p>
          </section>

          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Haftung fuer Inhalte</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Als Diensteanbieter sind wir gemaess den allgemeinen Gesetzen fuer eigene Inhalte auf diesen Seiten
              verantwortlich. Wir sind jedoch nicht verpflichtet, uebermittelte oder gespeicherte fremde
              Informationen zu ueberwachen oder nach Umstaenden zu forschen, die auf eine rechtswidrige Taetigkeit
              hinweisen.
            </p>
          </section>

          <section className="glass rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">Haftung fuer Links</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Unser Angebot enthaelt Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen Einfluss
              haben. Deshalb koennen wir fuer diese fremden Inhalte auch keine Gewaehr uebernehmen. Fuer die Inhalte
              der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
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
            <Link href="/legal/privacy" className="hover:text-foreground transition-colors">Datenschutz</Link>
            <Link href="/legal/impressum" className="text-primary">Impressum</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
