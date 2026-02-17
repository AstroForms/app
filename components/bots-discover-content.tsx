"use client"

import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Bot, BadgeCheck, Search } from "lucide-react"
import { useState } from "react"
import Link from "next/link"

interface BotItem {
  id: string
  name: string
  description: string | null
  avatar_url: string | null
  is_verified: boolean
  is_public: boolean
  owner_id: string
  profiles: { id: string; username: string; display_name: string; avatar_url: string | null }
}

export function BotsDiscoverContent({
  bots,
  userId,
}: {
  bots: BotItem[]
  userId: string
}) {
  const [search, setSearch] = useState("")

  const filtered = bots.filter(
    (bot) =>
      bot.name.toLowerCase().includes(search.toLowerCase()) ||
      bot.description?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Bots entdecken</h1>
        <p className="text-muted-foreground mt-1">Finde Ã¶ffentliche Bots und lade sie in deine Channels ein</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Bots suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 bg-secondary/50 border-border/50"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Bot className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Keine Bots gefunden</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((bot) => (
            <div key={bot.id} className="glass rounded-xl p-5 hover:bg-secondary/20 transition-colors">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={bot.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10">
                    <Bot className="h-5 w-5 text-primary" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link href={`/bots/${bot.id}`} className="font-semibold text-foreground hover:underline truncate">
                      {bot.name}
                    </Link>
                    {bot.is_verified && (
                      <Badge variant="secondary" className="gap-1">
                        <BadgeCheck className="h-3 w-3" /> Verifiziert
                      </Badge>
                    )}
                  </div>
                  {bot.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{bot.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <Link href={`/profile/${bot.profiles.id}`} className="text-xs text-muted-foreground hover:text-foreground">
                      von {bot.profiles.display_name || bot.profiles.username}
                    </Link>
                    {bot.owner_id === userId ? (
                      <span className="text-xs text-primary font-medium">Dein Bot</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Öffentlicher Bot</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
