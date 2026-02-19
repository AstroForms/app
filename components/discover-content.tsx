"use client"

import { createDbClient } from "@/lib/db-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Hash, BadgeCheck, Users, Search, UserPlus, Check, Zap } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

interface Channel {
  id: string
  name: string
  description: string | null
  member_count: number
  is_verified: boolean
  owner_id: string
  icon_url?: string | null
  boosted_until?: string | null
  is_boosted?: boolean
}

export function DiscoverContent({
  channels,
  joinedIds,
  userId,
}: {
  channels: Channel[]
  joinedIds: Set<string>
  userId: string
}) {
  const [search, setSearch] = useState("")
  const [joined, setJoined] = useState<Set<string>>(joinedIds)
  const router = useRouter()

  const filtered = channels.filter(ch =>
    ch.name.toLowerCase().includes(search.toLowerCase()) ||
    ch.description?.toLowerCase().includes(search.toLowerCase())
  )

  const handleJoin = async (channelId: string) => {
    const supabase = createDbClient()
    const { error } = await supabase.from("channel_members").insert({
      channel_id: channelId,
      user_id: userId,
    })
    if (error) {
      toast.error(error.message)
      return
    }
    await supabase.rpc("add_xp", { p_user_id: userId, p_amount: 5, p_reason: "Channel beigetreten" })
    setJoined(prev => new Set([...prev, channelId]))
    toast.success("Beigetreten!")
    router.refresh()
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Channels entdecken</h1>
        <p className="text-muted-foreground mt-1">Finde interessante Communities und tritt ihnen bei</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Channels suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 bg-secondary/50 border-border/50"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Hash className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Keine Channels gefunden</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((channel) => {
            const isJoined = joined.has(channel.id)
            const isOwner = channel.owner_id === userId
            return (
              <div key={channel.id} className="glass rounded-xl p-5 hover:bg-secondary/20 transition-colors">
                <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12 shrink-0 rounded-xl bg-primary/10">
                  <AvatarImage src={channel.icon_url || undefined} />
                  <AvatarFallback className="rounded-xl">
                    <Hash className="h-6 w-6 text-primary" />
                  </AvatarFallback>
                </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link href={`/channels/${channel.id}`} className="font-semibold text-foreground hover:underline truncate">
                        {channel.name}
                      </Link>
                      {channel.is_boosted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          <Zap className="h-3 w-3" /> Werbung
                        </span>
                      )}
                      {channel.is_verified && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <BadgeCheck className="h-4 w-4 text-primary shrink-0" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Verifiziert von einem Teammitglied</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    {channel.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{channel.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" /> {channel.member_count}
                      </span>
                      {isOwner ? (
                        <span className="text-xs text-primary font-medium">Dein Channel</span>
                      ) : isJoined ? (
                        <Button size="sm" variant="outline" disabled className="bg-transparent text-primary border-primary/30">
                          <Check className="h-3.5 w-3.5 mr-1" /> Beigetreten
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => handleJoin(channel.id)} className="text-primary-foreground">
                          <UserPlus className="h-3.5 w-3.5 mr-1" /> Beitreten
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

