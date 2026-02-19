"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Rocket, Search, Menu, X, Mic, ChevronDown, LayoutDashboard, Hash, Compass, MessageCircle, Bot, User, Shield, Settings, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Image from "next/image"
import { signOut } from "next-auth/react"

interface HomeNavbarProps {
  user: { id: string; username: string; display_name: string; avatar_url: string | null } | null
  onSearch: (query: string) => void
  onToggleSidebar: () => void
  sidebarOpen: boolean
}

export function HomeNavbar({ user, onSearch, onToggleSidebar, sidebarOpen }: HomeNavbarProps) {
  const [searchVal, setSearchVal] = useState("")
  const [userRole, setUserRole] = useState<string | null>(null)
  const [searchProfiles, setSearchProfiles] = useState<
    Array<{ id: string; username: string; display_name: string; avatar_url: string | null }>
  >([])
  const [searchOpen, setSearchOpen] = useState(false)
  const searchBoxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!user?.id) return
    fetch("/api/profile/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.role) setUserRole(data.role)
      })
      .catch(() => {})
  }, [user?.id])

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
        .catch(() => {
          setSearchProfiles([])
        })
    }, 220)

    return () => clearTimeout(timer)
  }, [searchVal])

  const hasAdminAccess = userRole === "admin" || userRole === "owner"
  const visibleNav = [
    { href: "/", label: "Startseite", icon: Rocket },
    { href: "/channels", label: "Meine Channels", icon: Hash },
    { href: "/discover", label: "Entdecken", icon: Compass },
    { href: "/profile", label: "Profil", icon: User },
    ...(hasAdminAccess ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-xl">
      <div className="grid h-12 grid-cols-[auto_1fr_auto] items-center gap-3 px-3 md:px-5">
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground lg:hidden h-8 px-2 gap-1.5"
            onClick={onToggleSidebar}
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            <span className="text-xs hidden sm:inline">{"Menu"}</span>
          </Button>

          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image src="/banner.png" alt="Logo" width={150} height={32} className="rounded-sm" />
          </Link>
        </div>

        <div className="max-w-lg w-full justify-self-center min-w-0 hidden sm:block">
          <div className="relative" ref={searchBoxRef}>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Suchen..."
              value={searchVal}
              onChange={(e) => {
                setSearchVal(e.target.value)
                onSearch(e.target.value)
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

        <div className="flex items-center gap-2 shrink-0 justify-self-end">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="bg-secondary text-foreground text-[11px]">
                      {user.username?.charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground hidden sm:inline">{user.username}</span>
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
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                  <LogOut className="h-4 w-4 mr-2" /> Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground text-xs h-8">
                <Link href="/auth/login">Anmelden</Link>
              </Button>
              <Button size="sm" asChild className="text-primary-foreground font-semibold text-xs h-8 rounded-lg">
                <Link href="/auth/sign-up">Registrieren</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
