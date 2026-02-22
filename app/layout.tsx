import React from "react"
import type { Metadata, Viewport } from "next"
import { Space_Grotesk, Fira_Code } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/components/auth-provider"
import { ConsentBanner } from "@/components/consent-banner"
import { getPublicSiteUrl } from "@/lib/site-url"

import "./globals.css"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
})

const firaCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-fira-code",
  display: "swap",
})

const siteUrl = getPublicSiteUrl()
const siteName = "AstroForms"
const defaultTitle = "AstroForms - Community, Channels und Bots"
const defaultDescription =
  "AstroForms ist eine moderne Community-Plattform mit Channels, Profilen, Bots und Automatisierungen."

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: defaultTitle,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  keywords: [
    "Community Plattform",
    "Channels",
    "Social Platform",
    "Bots",
    "Automatisierung",
    "AstroForms",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: siteUrl,
    siteName,
    title: defaultTitle,
    description: defaultDescription,
    images: [
      {
        url: "/banner.png",
        width: 1200,
        height: 630,
        alt: "AstroForms",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/banner.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
}

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="de"
      className={`dark ${spaceGrotesk.variable} ${firaCode.variable}`}
    >
      <body className="font-sans antialiased min-h-screen">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: siteName,
              url: siteUrl,
              description: defaultDescription,
              inLanguage: "de-DE",
              publisher: {
                "@type": "Organization",
                name: siteName,
                url: siteUrl,
                logo: `${siteUrl}/banner.png`,
              },
            }),
          }}
        />
        <AuthProvider>{children}</AuthProvider>
        <ConsentBanner />
        <Toaster />
      </body>
    </html>
  )
}
