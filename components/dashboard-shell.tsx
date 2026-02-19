"use client"

import React, { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  Rocket, LayoutDashboard, Hash, Compass, Bot, User, Shield,
  Settings, LogOut, Menu, X, Home, MessageCircle, ChevronDown, Search, Mic
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Image from "next/image"
import { Input } from "@/components/ui/input"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { href: "/", label: "Startseite", icon: Home },
  { href: "/channels", label: "Meine Channels", icon: Hash },
  { href: "/discover", label: "Entdecken", icon: Compass },
  { href: "/messages", label: "Nachrichten", icon: MessageCircle },
  { href: "/bots", label: "Bots", icon: Bot },
  { href: "/profile", label: "Profil", icon: User },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
  { href: "/settings", label: "Einstellungen", icon: Settings },
]

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userProfile, setUserProfile] = useState<{ username: string; avatar_url: string | null } | null>(null)
  const [searchVal, setSearchVal] = useState("")
  const [searchProfiles, setSearchProfiles] = useState<
    Array<{ id: string; username: string; display_name: string; avatar_url: string | null }>
  >([])
  const [searchOpen, setSearchOpen] = useState(false)
  const searchBoxRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    fetch("/api/profile/me", { cache: "no-store" })
      .then((res) => (res?.ok ? res.json() : null))
      .then((data) => {
        if (!data) return
        setUserRole(data.role || null)
        setUserProfile({ username: data.username, avatar_url: data.avatarUrl || null })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const runAutomations = () => {
      fetch("/api/automations/run", { method: "POST" }).catch(() => {})
    }
    runAutomations()
    const interval = setInterval(runAutomations, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!searchBoxRef.current) return
      if (!searchBoxRef.current.contains(event.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    const query = searchVal.trim()
    if (query.length < 2) {
      setSearchProfiles([])
      return
    }

    const timer = setTimeout(() => {
      fetch(`/api/profiles/search?q=${encodeURIComponent(query)}&limit=6`, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : { profiles: [] }))
        .then((data) => {
          setSearchProfiles(Array.isArray(data?.profiles) ? data.profiles : [])
          setSearchOpen(true)
        })
        .catch(() => setSearchProfiles([]))
    }, 220)

    return () => clearTimeout(timer)
  }, [searchVal])

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const hasAdminAccess = userRole === "admin" || userRole === "owner"
  const visibleNav = navItems.filter((item) => !item.adminOnly || hasAdminAccess)

  const renderNavItem = (item: NavItem, onClick?: () => void) => {
    const { href, label, icon: Icon } = item
    const isActive = href === "/" ? pathname === "/" : (pathname === href || pathname.startsWith(href + "/"))
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
    <div className="flex min-h-screen">
      {/* Desktop Sidebar (Home-style) */}
      <aside className="hidden lg:flex flex-col w-60 border-r border-border/40 bg-card/30 shrink-0">
        <Link href="/" className="flex items-center gap-2.5 px-5 h-12 border-b border-border/40">
          <Image src="/banner.png" alt="Logo" width={150} height={32} className="rounded-sm" />
        </Link>
        <nav className="flex-1 flex flex-col gap-0.5 p-3 pt-4">
          {visibleNav.map((item) => renderNavItem(item))}
        </nav>

        <div className="border-t border-border/40 p-3">
          {userProfile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors w-full text-left">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={userProfile.avatar_url || undefined} />
                    <AvatarFallback className="bg-secondary text-foreground text-[11px]">
                      {userProfile.username?.charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground truncate flex-1">{userProfile.username}</span>
                  {hasAdminAccess && (
                    <span className="text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                      {userRole === "owner" ? "OWNER" : "ADMIN"}
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-card border-border/50">
                {visibleNav.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" /> {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                  <LogOut className="h-4 w-4 mr-2" /> Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-border/40 bg-background/90 backdrop-blur-xl">
          <div className="grid h-12 grid-cols-[auto_1fr_auto] items-center gap-3 px-3 md:px-5">
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground lg:hidden h-8 px-2 gap-1.5"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>

            <div className="max-w-lg w-full justify-self-center">
              <div className="relative" ref={searchBoxRef}>
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Suchen..."
                  value={searchVal}
                  onChange={(e) => {
                    setSearchVal(e.target.value)
                    setSearchOpen(true)
                  }}
                  className="h-8 pl-8 pr-8 bg-secondary/40 border-border/30 text-xs rounded-lg placeholder:text-muted-foreground/60"
                />
                <Mic className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                {searchOpen && searchVal.trim().length >= 2 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-50 rounded-lg border border-border/50 bg-card shadow-lg overflow-hidden">
                    {searchProfiles.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">Keine Profile gefunden</p>
                    ) : (
                      <div className="py-1">
                        {searchProfiles.map((profile) => (
                          <Link
                            key={profile.id}
                            href={`/profile/${profile.id}`}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-secondary/40"
                            onClick={() => setSearchOpen(false)}
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={profile.avatar_url || undefined} />
                              <AvatarFallback className="text-[10px]">
                                {profile.username?.charAt(0).toUpperCase() || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">@{profile.username}</p>
                              {profile.display_name && (
                                <p className="text-[11px] text-muted-foreground truncate">{profile.display_name}</p>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="justify-self-end">
              {userProfile && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={userProfile.avatar_url || undefined} />
                        <AvatarFallback className="bg-secondary text-foreground text-[11px]">
                          {userProfile.username?.charAt(0).toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-foreground hidden sm:inline">{userProfile.username}</span>
                      {hasAdminAccess && (
                        <span className="text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded hidden sm:inline">
                          {userRole === "owner" ? "OWNER" : "ADMIN"}
                        </span>
                      )}
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-card border-border/50">
                    {visibleNav.map((item) => (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link href={item.href} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" /> {item.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                      <LogOut className="h-4 w-4 mr-2" /> Abmelden
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </header>

        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-background/98 backdrop-blur-sm pt-14">
            <nav className="flex flex-col gap-0.5 p-4">
              {visibleNav.map((item) => renderNavItem(item, () => setMobileOpen(false)))}
              <div className="border-t border-border/40 mt-3 pt-3">
                {userProfile && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors w-full text-left">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={userProfile.avatar_url || undefined} />
                          <AvatarFallback className="bg-secondary text-foreground text-[11px]">
                            {userProfile.username?.charAt(0).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-foreground truncate flex-1">{userProfile.username}</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48 bg-card border-border/50">
                      <DropdownMenuItem asChild onClick={() => setMobileOpen(false)}>
                        <Link href="/channels" className="flex items-center gap-2">
                          <Hash className="h-4 w-4" /> Meine Channels
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild onClick={() => setMobileOpen(false)}>
                        <Link href="/discover" className="flex items-center gap-2">
                          <Compass className="h-4 w-4" /> Entdecken
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild onClick={() => setMobileOpen(false)}>
                        <Link href="/messages" className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4" /> Nachrichten
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild onClick={() => setMobileOpen(false)}>
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
              </div>
            </nav>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
