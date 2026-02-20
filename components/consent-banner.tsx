"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"

type ConsentPrefs = {
  version: string
  necessary: true
  analytics: boolean
  marketing: boolean
  updatedAt: string
}

const CONSENT_VERSION = "2026-02-19"
const STORAGE_KEY = "af_consent_preferences"
const COOKIE_NAME = "af_consent"

function writeConsent(value: ConsentPrefs) {
  const serialized = JSON.stringify(value)
  localStorage.setItem(STORAGE_KEY, serialized)
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(serialized)}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`
}

export function ConsentBanner() {
  const [show, setShow] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        setShow(true)
        return
      }
      const parsed = JSON.parse(raw) as Partial<ConsentPrefs>
      if (!parsed || parsed.version !== CONSENT_VERSION) {
        setShow(true)
      }
    } catch {
      setShow(true)
    }
  }, [])

  const payload = useMemo<ConsentPrefs>(
    () => ({
      version: CONSENT_VERSION,
      necessary: true,
      analytics,
      marketing,
      updatedAt: new Date().toISOString(),
    }),
    [analytics, marketing],
  )

  const acceptAll = () => {
    const value: ConsentPrefs = {
      version: CONSENT_VERSION,
      necessary: true,
      analytics: true,
      marketing: true,
      updatedAt: new Date().toISOString(),
    }
    writeConsent(value)
    setAnalytics(true)
    setMarketing(true)
    setShow(false)
  }

  const acceptNecessaryOnly = () => {
    const value: ConsentPrefs = {
      version: CONSENT_VERSION,
      necessary: true,
      analytics: false,
      marketing: false,
      updatedAt: new Date().toISOString(),
    }
    writeConsent(value)
    setAnalytics(false)
    setMarketing(false)
    setShow(false)
  }

  const saveCustom = () => {
    writeConsent(payload)
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-2xl rounded-2xl border border-border/60 bg-card/95 p-4 shadow-2xl backdrop-blur">
      <p className="text-sm text-foreground">
        Wir verwenden Cookies für Login, Sicherheit und optionale Analyse/Marketing-Funktionen.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Mehr Infos in{" "}
        <Link href="/legal/privacy" className="underline underline-offset-2 hover:text-foreground">Datenschutz</Link>
        {" "}und{" "}
        <Link href="/legal/tos" className="underline underline-offset-2 hover:text-foreground">Nutzungsbedingungen</Link>.
      </p>

      <div className="mt-3 space-y-2 rounded-lg bg-secondary/40 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">Notwendige Cookies</span>
          <span className="text-xs text-muted-foreground">Immer aktiv</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">Analyse</span>
          <Switch checked={analytics} onCheckedChange={setAnalytics} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">Marketing</span>
          <Switch checked={marketing} onCheckedChange={setMarketing} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={acceptAll} className="text-primary-foreground">Alle akzeptieren</Button>
        <Button onClick={acceptNecessaryOnly} variant="outline" className="bg-transparent">Nur notwendige</Button>
        <Button onClick={saveCustom} variant="secondary">Auswahl speichern</Button>
      </div>
    </div>
  )
}
