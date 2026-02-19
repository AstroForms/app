"use client"

import { Button } from "@/components/ui/button"
import { Github, Link2Off, ShieldCheck } from "lucide-react"

type OAuthProvider = "google" | "discord" | "github" | "microsoft-entra-id"

type LinkedProvider = {
  provider: string
  providerAccountId: string
}

type AccountOverview = {
  email: string | null
  hasPassword: boolean
  providers: LinkedProvider[]
}

interface KontenVerknuepfenProps {
  isLinking: boolean
  isLoadingAccounts: boolean
  isDisconnecting: boolean
  accountOverview: AccountOverview | null
  onLinkAccount: (provider: OAuthProvider) => void
  onDisconnectProvider: (provider: string) => void
}

const providerMeta: Record<OAuthProvider, { label: string; icon: string }> = {
  google: { label: "Google", icon: "G" },
  discord: { label: "Discord", icon: "D" },
  "microsoft-entra-id": { label: "Microsoft", icon: "M" },
  github: { label: "GitHub", icon: "" },
}

export function KontenVerknuepfen({
  isLinking,
  isLoadingAccounts,
  isDisconnecting,
  accountOverview,
  onLinkAccount,
  onDisconnectProvider,
}: KontenVerknuepfenProps) {
  const linkedProviders = new Set((accountOverview?.providers || []).map((entry) => entry.provider))

  return (
    <div className="rounded-2xl border border-border/50 bg-secondary/20 p-5 space-y-5">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 text-primary">
            <Github />
          </span>
          <h3 className="text-sm font-semibold text-foreground">Konten verknuepfen</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Verknuepfe weitere Login-Methoden und verwalte vorhandene Verbindungen.
        </p>
      </div>

      <div className="rounded-xl border border-border/40 bg-secondary/30 p-3 space-y-2">
        <div className="flex items-center gap-2 text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Aktive Login-Methoden</p>
        </div>
        {isLoadingAccounts ? (
          <p className="text-xs text-muted-foreground">Wird geladen...</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">E-Mail: {accountOverview?.email || "nicht gesetzt"}</p>
            <p className="text-xs text-muted-foreground">
              Passwort: {accountOverview?.hasPassword ? "gesetzt" : "nicht gesetzt"}
            </p>
            <p className="text-xs text-muted-foreground">
              Provider: {accountOverview?.providers.length || 0}
            </p>
          </>
        )}
      </div>

      {!isLoadingAccounts && accountOverview && (
        <div className="space-y-2">
          {accountOverview.providers.length > 0 ? (
            accountOverview.providers.map((provider) => (
              <div
                key={`${provider.provider}:${provider.providerAccountId}`}
                className="flex items-center justify-between rounded-lg bg-secondary/35 p-2"
              >
                <p className="text-xs text-foreground">
                  {providerMeta[provider.provider as OAuthProvider]?.label || provider.provider}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 bg-transparent border-border/50"
                  disabled={isDisconnecting || isLinking}
                  onClick={() => onDisconnectProvider(provider.provider)}
                >
                  <Link2Off className="h-3.5 w-3.5 mr-1" />
                  Trennen
                </Button>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">Keine OAuth-Provider verknuepft.</p>
          )}

        </div>
      )}

      <div className="grid gap-2">
        {(Object.keys(providerMeta) as OAuthProvider[]).map((provider) => {
          const meta = providerMeta[provider]
          const isLinked = linkedProviders.has(provider)

          return (
            <Button
              key={provider}
              type="button"
              variant="outline"
              className="justify-start gap-2 bg-secondary/50 border-border/50 hover:bg-secondary text-foreground"
              onClick={() => onLinkAccount(provider)}
              disabled={isLinking || isLinked}
            >
              {provider === "github" ? (
                <Github className="h-4 w-4" />
              ) : (
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-white text-black text-[10px] font-bold">
                  {meta.icon}
                </span>
              )}
              {meta.label} {isLinked ? "verbunden" : "verbinden"}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
