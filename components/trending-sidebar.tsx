"use client"

import Link from "next/link"
import { Hash, Flame } from "lucide-react"
import { cn } from "@/lib/utils"

interface TrendingChannel {
  id: string
  name: string
  post_count: number
}

export function TrendingSidebar({ channels }: { channels: TrendingChannel[] }) {
  return (
    <aside className="w-48 shrink-0 hidden lg:block">
      <div className="sticky top-[calc(3rem+1.25rem)]">
        <div className="rounded-xl border border-border/30 bg-card/30 overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-border/30">
            <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              Trending Channels
            </h2>
          </div>
          <nav className="flex flex-col">
            {channels.length === 0 && (
              <p className="px-3.5 py-5 text-[11px] text-muted-foreground text-center">Keine Channels</p>
            )}
            {channels.map((channel, i) => (
              <Link
                key={channel.id}
                href={`/channels/${channel.id}`}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 text-xs transition-colors hover:bg-secondary/30 border-l-2",
                  i < 3 ? "border-l-primary/40" : "border-l-transparent"
                )}
              >
                <Hash className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-semibold truncate",
                    i < 3 ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {channel.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">{channel.post_count} Posts</p>
                </div>
                {i < 3 && <Flame className="h-3.5 w-3.5 text-orange-400 shrink-0" />}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  )
}
