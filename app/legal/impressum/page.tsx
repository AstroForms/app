import Link from "next/link"
import Image from "next/image"
import { ArrowLeft } from "lucide-react"
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
            <Image src="/banner.png" alt="AstroForms Logo" width={150} height={32} className="rounded-sm" />
          </Link>
          <Button variant="ghost" asChild className="text-muted-foreground">
            <Link href="/"><ArrowLeft className="h-4 w-4 mr-2" /> Zurück</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-bold text-foreground mb-2">Impressum</h1>
        <p className="text-muted-foreground mb-10">Angaben gemäß § 5 DDG</p>

        <div className="prose prose-invert max-w-none">
          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Dienstanbieter</h2>
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
              E-Mail: kontakt@astroforms.de
            </p>
          </section>

          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Vertretungsberechtigt</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Conner Berthun
            </p>
          </section>

          <section className="glass rounded-2xl p-8 mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">Haftung für Inhalte</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Als Diensteanbieter sind wir gemäss den allgemeinen Gesetzen für eigene Inhalte auf diesen Seiten
              verantwortlich. Wir sind jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
              Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit
              hinweisen.
            </p>
          </section>

          <section className="glass rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">Haftung für Links</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen Einfluss
              haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte
              der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
            </p>
          </section> 

          <section className="glass rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">Urheberrecht</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
            </p>
          </section> 
        </div>
      </main>

      <footer className="border-t border-border/50 px-6 py-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/">
            <Image src="/banner.png" alt="AstroForms Logo" width={140} height={30} className="rounded-sm" />
          </Link>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/legal/tos" className="hover:text-foreground transition-colors">Nutzungsbedingungen</Link>
            <Link href="/legal/privacy" className="hover:text-foreground transition-colors">Datenschutz</Link>
            <Link href="/legal/impressum" className="text-primary">Impressum</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
