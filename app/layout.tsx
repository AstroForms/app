import React from "react"
import type { Metadata, Viewport } from "next"
import { Space_Grotesk, Fira_Code } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/components/auth-provider"

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

export const metadata: Metadata = {
  title: "AstroForms - Community Platform",
  description:
    "Modern community platform with channels, bots, automation, and XP leveling.",
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
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </body>
    </html>
  )
}
