"use client"

import Link from "next/link"
import { Hash, Plus, Users, BadgeCheck, Compass } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Channel {
  id: string
  name: string
  description: string | null
  member_count: number
  is_verified: boolean
  is_public: boolean
  created_at: string
  icon_url?: string | null
}

function ChannelCard({ channel }: { channel: Channel }) {
  return (
    <Link
      href={`/channels/${channel.id}`}
      className="glass rounded-xl p-5 hover:bg-secondary/30 transition-colors group"
    >
      <div className="flex items-start gap-4">
        <Avatar className="h-12 w-12 shrink-0 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
          <AvatarImage src={channel.icon_url || undefined} />
          <AvatarFallback className="rounded-xl">
            <Hash className="h-6 w-6 text-primary" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{channel.name}</h3>
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
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{channel.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {channel.member_count}</span>
            <span>{channel.is_public ? "Öffentlich" : "Privat"}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export function ChannelsList({
  ownedChannels,
  joinedChannels,
}: {
  ownedChannels: Channel[]
  joinedChannels: Channel[]
  userId: string
}) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meine Channels</h1>
          <p className="text-muted-foreground mt-1">Verwalte und durchsuche deine Channels</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="bg-transparent text-foreground border-border/50">
            <Link href="/discover"><Compass className="h-4 w-4 mr-2" /> Entdecken</Link>
          </Button>
          <Button asChild className="text-primary-foreground">
            <Link href="/channels/create"><Plus className="h-4 w-4 mr-2" /> Erstellen</Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="owned" className="w-full">
        <TabsList className="glass mb-6">
          <TabsTrigger value="owned">Erstellt ({ownedChannels.length})</TabsTrigger>
          <TabsTrigger value="joined">Beigetreten ({joinedChannels.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="owned">
          {ownedChannels.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Hash className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-1">Noch keine Channels erstellt</h3>
              <p className="text-sm text-muted-foreground mb-4">Erstelle deinen ersten Channel und baue deine Community auf.</p>
              <Button asChild className="text-primary-foreground">
                <Link href="/channels/create"><Plus className="h-4 w-4 mr-2" /> Channel erstellen</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {ownedChannels.map(ch => <ChannelCard key={ch.id} channel={ch} />)}
            </div>
          )}
        </TabsContent>
        <TabsContent value="joined">
          {joinedChannels.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <Compass className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-1">Noch keinem Channel beigetreten</h3>
              <p className="text-sm text-muted-foreground mb-4">Entdecke spannende Channels und tritt ihnen bei.</p>
              <Button asChild className="text-primary-foreground">
                <Link href="/discover"><Compass className="h-4 w-4 mr-2" /> Channels entdecken</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {joinedChannels.map(ch => <ChannelCard key={ch.id} channel={ch} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
