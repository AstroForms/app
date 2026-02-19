"use client"

import Link from "next/link"
import { Hash, Plus, Compass, BadgeCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface SidebarChannel {
  id: string
  name: string
  is_verified: boolean
}

export function ChannelsSidebar({
  channels,
  isLoggedIn,
}: {
  channels: SidebarChannel[]
  isLoggedIn: boolean
}) {
  return (
    <aside className="w-56 shrink-0 hidden xl:block">
      <div className="sticky top-[calc(3rem+1.25rem)]">
        <div className="rounded-xl border border-border/30 bg-card/30 overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/30">
            <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              Kanaele
            </h2>
            {isLoggedIn && (
              <Link href="/channels/create" className="text-muted-foreground hover:text-primary transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {channels.length === 0 ? (
            <div className="px-3.5 py-5 text-center">
              <p className="text-[11px] text-muted-foreground mb-3">
                {isLoggedIn
                  ? "Du bist noch keinem Kanal beigetreten"
                  : "Melde dich an um Kanaelen beizutreten"}
              </p>
              <Button size="sm" asChild className="w-full text-primary-foreground font-semibold text-xs h-8 rounded-lg">
                <Link href={isLoggedIn ? "/discover" : "/auth/login"}>
                  <Compass className="h-3.5 w-3.5 mr-1.5" />
                  {isLoggedIn ? "Kanaele entdecken" : "Anmelden"}
                </Link>
              </Button>
            </div>
          ) : (
            <nav className="flex flex-col">
              {channels.map((ch) => (
                <Link
                  key={ch.id}
                  href={`/channels/${ch.id}`}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/30 transition-colors"
                >
                  <Hash className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                  <span className="truncate font-medium">{ch.name}</span>
                  {ch.is_verified && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex ml-auto">
                            <BadgeCheck className="h-3 w-3 text-primary shrink-0" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Verifiziert</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </Link>
              ))}
              <div className="px-3 pt-1.5 pb-2.5">
                <Button size="sm" variant="outline" asChild className="w-full bg-transparent text-foreground border-border/30 hover:bg-secondary/30 text-xs h-7 rounded-lg">
                  <Link href="/discover">
                    <Compass className="h-3 w-3 mr-1.5" />
                    Alle entdecken
                  </Link>
                </Button>
              </div>
            </nav>
          )}
        </div>

        {/* Footer Links */}
        <div className="mt-4 px-1">
          <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[10px] text-muted-foreground/50">
            <Link href="/legal/tos" className="hover:text-muted-foreground transition-colors">Richtlinien</Link>
            <Link href="/legal/impressum" className="hover:text-muted-foreground transition-colors">Impressum</Link>
            <Link href="/legal/privacy" className="hover:text-muted-foreground transition-colors">Datenschutz</Link>
            <Link href="/legal/tos" className="hover:text-muted-foreground transition-colors">Nutzungsbedingungen</Link>
          </div>
          <p className="text-[10px] text-muted-foreground/30 mt-1.5">&copy; 2026 AstroForms</p>
        </div>
      </div>
    </aside>
  )
}
