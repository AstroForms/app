"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { HomeNavbar } from "@/components/home-navbar"
import { PostFeed } from "@/components/post-feed"
import {
  Rocket, LayoutDashboard, Hash, Compass, Bot, User, Shield,
  Settings, LogOut, Home, Flame, ChevronDown, MessageCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import Image from "next/image"

interface HomeUser {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

interface TrendingChannel {
  id: string
  name: string
  post_count: number
}

interface JoinedChannel {
  id: string
  name: string
  is_verified: boolean
}

interface FeedPost {
  id: string
  content: string
  is_automated: boolean
  created_at: string
  user_id: string
  channel_id: string
  image_url?: string | null
  link_url?: string | null
  link_title?: string | null
  link_description?: string | null
  link_image?: string | null
  parent_post_id?: string | null
  profiles: {
    id: string
    username: string
    avatar_url: string | null
    display_name: string
  }
  channels: {
    id: string
    name: string
    is_verified: boolean
  }
  parent_post?: {
    id: string
    content: string
    profiles: { username: string }
  } | null
}

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
  authRequired?: boolean
}

const navItems: NavItem[] = [
  { href: "/", label: "Startseite", icon: Home },
  { href: "/channels", label: "Meine Channels", icon: Hash, authRequired: true },
  { href: "/discover", label: "Entdecken", icon: Compass },
  { href: "/messages", label: "Nachrichten", icon: MessageCircle, authRequired: true },
  { href: "/bots", label: "Bots", icon: Bot, authRequired: true },
  { href: "/profile", label: "Profil", icon: User, authRequired: true },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
  { href: "/settings", label: "Einstellungen", icon: Settings, authRequired: true },
]

export function HomePage({
  user,
  trendingChannels,
  joinedChannels,
  posts,
}: {
  user: HomeUser | null
  trendingChannels: TrendingChannel[]
  joinedChannels: JoinedChannel[]
  posts: FeedPost[]
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      fetch("/api/profile/me")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.role) setUserRole(data.role)
        })
        .catch(() => {})
    }
  }, [user])

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const hasAdminAccess = userRole === "admin" || userRole === "owner"

  const visibleNav = navItems.filter((item) => {
    if (item.adminOnly && !hasAdminAccess) return false
    if (item.authRequired && !user) return false
    return true
  })

  const renderNavItem = (item: NavItem, onClick?: () => void) => {
    const { href, label, icon: Icon } = item
    const isActive = href === "/" ? true : false
    return (
      <Link
        key={href}
        href={href}
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
          isActive
            ? "bg-primary/10 text-primary shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
            : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
        {label}
      </Link>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <HomeNavbar
        user={user}
        onSearch={setSearchQuery}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
      />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-sm pt-14 lg:hidden overflow-auto">
          <div className="p-4">
            <nav className="flex flex-col gap-0.5 mb-4">
              {visibleNav.map((item) => renderNavItem(item, () => setSidebarOpen(false)))}
            </nav>
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors w-full text-left">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-secondary text-foreground text-[11px]">
                        {user.username?.charAt(0).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground truncate flex-1">{user.username}</span>
                    {hasAdminAccess && (
                      <span className="text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                        {userRole === "owner" ? "OWNER" : "ADMIN"}
                      </span>
                    )}
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-card border-border/50">
                  <DropdownMenuItem asChild onClick={() => setSidebarOpen(false)}>
                    <Link href="/channels" className="flex items-center gap-2">
                      <Hash className="h-4 w-4" /> Meine Channels
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild onClick={() => setSidebarOpen(false)}>
                    <Link href="/discover" className="flex items-center gap-2">
                      <Compass className="h-4 w-4" /> Entdecken
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild onClick={() => setSidebarOpen(false)}>
                    <Link href="/profile" className="flex items-center gap-2">
                      <User className="h-4 w-4" /> Profil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                    <LogOut className="h-4 w-4 mr-2" /> Abmelden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <div className="rounded-xl border border-border/50 bg-card/40 p-4 mt-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Trending Channels
              </h2>
              {trendingChannels.map((ch) => (
                <a
                  key={ch.id}
                  href={`/channels/${ch.id}`}
                  className="flex items-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <span className="text-muted-foreground">#</span>
                  <span className="font-medium">{ch.name}</span>
                  <span className="text-[11px] ml-auto">{ch.post_count} Posts</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-60 border-r border-border/40 bg-card/30 shrink-0">
          <nav className="flex-1 flex flex-col gap-0.5 p-3 pt-4">
            {visibleNav.map((item) => renderNavItem(item))}
          </nav>

          <div className="border-t border-border/40 p-3">
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors w-full text-left">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-secondary text-foreground text-[11px]">
                        {user.username?.charAt(0).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground truncate flex-1">{user.username}</span>
                    {hasAdminAccess && (
                      <span className="text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                        {userRole === "owner" ? "OWNER" : "ADMIN"}
                      </span>
                    )}
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-card border-border/50">
                  <DropdownMenuItem asChild>
                    <Link href="/" className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" /> Home
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/channels" className="flex items-center gap-2">
                      <Hash className="h-4 w-4" /> Meine Channels
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/discover" className="flex items-center gap-2">
                      <Compass className="h-4 w-4" /> Entdecken
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center gap-2">
                      <User className="h-4 w-4" /> Profil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                    <LogOut className="h-4 w-4 mr-2" /> Abmelden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {!user && (
              <Button asChild className="w-full text-primary-foreground">
                <Link href="/auth/login">Anmelden</Link>
              </Button>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex gap-5 max-w-[900px] mx-auto w-full px-3 md:px-5 py-4">
            <PostFeed posts={posts} userId={user?.id || null} searchQuery={searchQuery} />
            
            {/* Trending Sidebar */}
            <aside className="w-56 shrink-0 hidden xl:block">
              <div className="sticky top-[calc(3rem+1.25rem)]">
                <div className="rounded-xl border border-border/30 bg-card/30 overflow-hidden">
                  <div className="px-3.5 py-2.5 border-b border-border/30">
                    <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                      Trending Channels
                    </h2>
                  </div>
                  <nav className="flex flex-col">
                    {trendingChannels.length === 0 && (
                      <p className="px-3.5 py-5 text-[11px] text-muted-foreground text-center">Keine Channels</p>
                    )}
                    {trendingChannels.map((channel, i) => (
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
          </div>

          {/* Footer */}
          <footer className="border-t border-border/40 bg-card/30 py-6 px-4 mt-auto">
            <div className="max-w-[900px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Image src="/banner.png" alt="Logo" width={150} height={32} className="rounded-sm" />
                <span>© 2026</span>
              </div>
              <div className="flex items-center gap-4">
                <Link href="/legal/tos" className="hover:text-foreground transition-colors">AGB</Link>
                <Link href="/legal/privacy" className="hover:text-foreground transition-colors">Datenschutz</Link>
                <Link href="/legal/impressum" className="hover:text-foreground transition-colors">Impressum</Link>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
