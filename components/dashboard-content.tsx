"use client"

import Link from "next/link"
import { Hash, Plus, Star, Zap, Users, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  xp: number
  level: number
  role: string
}

interface Channel {
  id: string
  name: string
  description: string | null
  member_count: number
  is_verified: boolean
  icon_url?: string | null
}

interface Post {
  id: string
  content: string
  is_automated: boolean
  created_at: string
  profiles: { username: string; avatar_url: string | null; display_name: string }
  channels: { name: string }
}

export function DashboardContent({
  profile,
  channels,
  recentPosts,
}: {
  profile: Profile | null
  channels: Channel[]
  recentPosts: Post[]
}) {
  const xpForNextLevel = profile ? (profile.level * profile.level * 50) : 0
  const xpProgress = profile ? Math.min((profile.xp / Math.max(xpForNextLevel, 1)) * 100, 100) : 0

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-1">
          Willkommen zurück{profile?.display_name ? `, ${profile.display_name}` : ""}
        </h1>
        <p className="text-muted-foreground">Dein AstroForms Home</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Level</span>
            <Star className="h-4 w-4 text-primary" />
          </div>
          <p className="text-3xl font-bold text-foreground">{profile?.level || 1}</p>
          <div className="mt-2">
            <Progress value={xpProgress} className="h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">{profile?.xp || 0} / {xpForNextLevel} XP</p>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Channels</span>
            <Hash className="h-4 w-4 text-primary" />
          </div>
          <p className="text-3xl font-bold text-foreground">{channels.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Beigetreten</p>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">XP Gesamt</span>
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <p className="text-3xl font-bold text-foreground">{profile?.xp || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Gesammelt</p>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Rolle</span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <p className="text-xl font-bold text-foreground capitalize">{profile?.role || "user"}</p>
          <p className="text-xs text-muted-foreground mt-1">Aktueller Status</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Channels */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Deine Channels</h2>
            <Button size="sm" asChild className="text-primary-foreground">
              <Link href="/channels/create">
                <Plus className="h-4 w-4 mr-1" /> Neu
              </Link>
            </Button>
          </div>
          {channels.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center">
              <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Noch keine Channels</p>
              <Button size="sm" variant="outline" asChild className="mt-3 bg-transparent text-foreground">
                <Link href="/discover">Entdecken</Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {channels.map((channel) => (
                <Link
                  key={channel.id}
                  href={`/channels/${channel.id}`}
                  className="glass rounded-xl p-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={channel.icon_url || undefined} />
                      <AvatarFallback className="bg-primary/10">
                        <Hash className="h-5 w-5 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground text-sm">{channel.name}</p>
                      <p className="text-xs text-muted-foreground">{channel.member_count} Mitglieder</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Posts */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground mb-4">Neueste Posts</h2>
          {recentPosts.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center">
              <p className="text-sm text-muted-foreground">Noch keine Posts vorhanden</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {recentPosts.map((post) => (
                <div key={post.id} className="glass rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={post.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="bg-secondary text-foreground text-xs">
                        {post.profiles?.username?.charAt(0).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">{post.profiles?.display_name || post.profiles?.username}</span>
                        {post.is_automated && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            <Zap className="h-3 w-3" /> AUTOMIERT
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">in {post.channels?.name}</span>
                      </div>
                      <p className="text-sm text-foreground/80 line-clamp-2">{post.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(post.created_at).toLocaleDateString("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
