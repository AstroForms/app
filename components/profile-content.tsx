"use client"

import React from "react"

import { createDbClient } from "@/lib/db-client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Star, Zap, UserPlus, UserMinus, Crown, Shield, ShieldCheck,
  BadgeCheck, Bot, Settings, Hash, Heart, MessageCircle, Share2, Bookmark, Repeat2, Send, Trash2, ExternalLink, Clock, Lock, MoreVertical, Ban, Flag
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

const badgeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Crown, Shield, ShieldCheck, BadgeCheck, Bot, Zap,
}

interface PostComment {
  id: string
  content: string
  created_at: string
  user_id: string
  profiles: {
    id: string
    username: string
    avatar_url: string | null
    display_name: string
  }
}

interface ProfilePost {
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
  channels: { id: string; name: string; is_verified: boolean }
  profiles: { id: string; username: string; avatar_url: string | null; display_name: string }
}

interface ProfileContentProps {
  profile: {
    id: string
    username: string
    display_name: string
    bio: string | null
    avatar_url: string | null
    banner_url: string | null
    xp: number
    level: number
    role: string
    show_followers: boolean
    is_verified: boolean
    is_private: boolean
    show_liked_posts: boolean
    dm_privacy?: "everyone" | "followers" | "request" | "nobody"
  }
  posts: ProfilePost[]
  badges: Array<{
    id: string
    badges: { name: string; description: string; icon: string; color: string }
  }>
  followerCount: number
  followingCount: number
  isFollowing: boolean
  isOwnProfile: boolean
  currentUserId: string
  followingProfiles: Array<{
    id: string
    username: string
    display_name: string
    avatar_url: string | null
  }>
  hasPendingRequest?: boolean
  followRequests?: Array<{
    id: string
    follower_id: string
    profiles: { id: string; username: string; display_name: string; avatar_url: string | null }
    created_at: string
  }>
}

function ProfilePostItem({
  post,
  userId,
  onRefresh,
}: {
  post: ProfilePost
  userId: string
  onRefresh: () => void
}) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [saved, setSaved] = useState(false)
  const [commentCount, setCommentCount] = useState(0)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<PostComment[]>([])
  const [newComment, setNewComment] = useState("")
  const [isPostingComment, setIsPostingComment] = useState(false)
  const [showRemixDialog, setShowRemixDialog] = useState(false)
  const [remixContent, setRemixContent] = useState("")
  const [isRemixing, setIsRemixing] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const loadPostData = async () => {
      const supabase = createDbClient()
      
      const { count: likes } = await supabase
        .from("post_likes")
        .select("*", { count: "exact", head: true })
        .eq("post_id", post.id)
      setLikeCount(likes || 0)

      const { count: commentsCount } = await supabase
        .from("post_comments")
        .select("*", { count: "exact", head: true })
        .eq("post_id", post.id)
      setCommentCount(commentsCount || 0)

      if (userId) {
        const { data: likeData } = await supabase
          .from("post_likes")
          .select("id")
          .eq("post_id", post.id)
          .eq("user_id", userId)
          .maybeSingle()
        setLiked(!!likeData)

        const { data: saveData } = await supabase
          .from("post_saves")
          .select("id")
          .eq("post_id", post.id)
          .eq("user_id", userId)
          .maybeSingle()
        setSaved(!!saveData)
      }
    }
    loadPostData()
  }, [post.id, userId])

  const handleLike = async () => {
    if (!userId) {
      toast.error("Melde dich an um zu liken")
      return
    }
    const supabase = createDbClient()
    
    if (liked) {
      await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", userId)
      setLiked(false)
      setLikeCount(c => c - 1)
    } else {
      await supabase.from("post_likes").insert({ post_id: post.id, user_id: userId })
      setLiked(true)
      setLikeCount(c => c + 1)
    }
  }

  const handleSave = async () => {
    if (!userId) {
      toast.error("Melde dich an um zu speichern")
      return
    }
    const supabase = createDbClient()
    
    if (saved) {
      await supabase.from("post_saves").delete().eq("post_id", post.id).eq("user_id", userId)
      setSaved(false)
      toast.success("Aus Lesezeichen entfernt")
    } else {
      await supabase.from("post_saves").insert({ post_id: post.id, user_id: userId })
      setSaved(true)
      toast.success("Gespeichert!")
    }
  }

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/channels/${post.channel_id}#post-${post.id}`)
    toast.success("Link kopiert!")
  }

  const loadComments = async () => {
    const supabase = createDbClient()
    const { data } = await supabase
      .from("post_comments")
      .select("*, profiles(id, username, avatar_url, display_name)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true })
    setComments(data || [])
  }

  const handleOpenComments = async () => {
    setShowComments(true)
    await loadComments()
  }

  const handlePostComment = async () => {
    if (!userId || !newComment.trim()) return
    setIsPostingComment(true)
    const supabase = createDbClient()
    const { error } = await supabase.from("post_comments").insert({
      post_id: post.id,
      user_id: userId,
      content: newComment.trim(),
    })
    if (error) {
      toast.error(error.message)
    } else {
      setNewComment("")
      setCommentCount(c => c + 1)
      await loadComments()
      toast.success("Kommentar gepostet!")
    }
    setIsPostingComment(false)
  }

  const handleDeleteComment = async (commentId: string) => {
    const supabase = createDbClient()
    await supabase.from("post_comments").delete().eq("id", commentId)
    setCommentCount(c => c - 1)
    await loadComments()
    toast.success("Kommentar gelöscht")
  }

  const handleRemix = async () => {
    if (!userId || !remixContent.trim()) return
    setIsRemixing(true)
    const supabase = createDbClient()
    const { error } = await supabase.from("posts").insert({
      channel_id: post.channel_id,
      user_id: userId,
      content: remixContent.trim(),
      parent_post_id: post.id,
    })
    if (error) {
      toast.error(error.message)
    } else {
      setRemixContent("")
      setShowRemixDialog(false)
      toast.success("Remix gepostet!")
      onRefresh()
    }
    setIsRemixing(false)
  }

  return (
    <>
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Link href={`/channels/${post.channel_id}`} className="flex items-center gap-1 hover:text-primary transition-colors">
            <Hash className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground hover:text-primary">{post.channels?.name}</span>
          </Link>
          {post.channels?.is_verified && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <BadgeCheck className="h-3 w-3 text-primary" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Verifizierter Channel</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {post.is_automated && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              <Zap className="h-3 w-3" /> AUTO
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {new Date(post.created_at).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
          </span>
        </div>
        <p className="text-sm text-foreground/80">{post.content}</p>
        
        {/* Post Image */}
        {post.image_url && (
          <div className="mt-2 rounded-lg overflow-hidden border border-border/30">
            <img src={post.image_url} alt="Post" className="w-full max-h-80 object-cover" />
          </div>
        )}
        
        {/* Link Embed */}
        {post.link_url && (
          <a 
            href={post.link_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-2 flex rounded-lg border border-border/30 overflow-hidden hover:bg-secondary/20 transition-colors"
          >
            {post.link_image && (
              <div className="w-20 h-20 shrink-0 bg-secondary/30">
                <img src={post.link_image} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 p-2.5 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{post.link_title || post.link_url}</p>
              {post.link_description && (
                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{post.link_description}</p>
              )}
              <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground/60">
                <ExternalLink className="h-2.5 w-2.5" />
                <span className="truncate">{new URL(post.link_url).hostname}</span>
              </div>
            </div>
          </a>
        )}
        
        {/* Post Actions */}
        <div className="flex items-center gap-0.5 -ml-2 pt-2 mt-2 border-t border-border/20">
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 gap-1 text-[11px] px-2 ${liked ? "text-rose-400 hover:text-rose-400" : "text-muted-foreground hover:text-foreground"}`}
            onClick={handleLike}
          >
            <Heart className={`h-3.5 w-3.5 ${liked ? "fill-rose-400" : ""}`} />
            {likeCount > 0 && likeCount}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-[11px] px-2 text-muted-foreground hover:text-foreground"
            onClick={handleOpenComments}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {commentCount > 0 && commentCount}
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowRemixDialog(true)}
                >
                  <Repeat2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Remix erstellen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
            onClick={handleShare}
          >
            <Share2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2 ${saved ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            onClick={handleSave}
          >
            <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-primary" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Comments Dialog */}
      <Dialog open={showComments} onOpenChange={setShowComments}>
        <DialogContent className="glass border-border/50 max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-foreground">Kommentare ({commentCount})</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto py-4 space-y-3">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Noch keine Kommentare</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-2.5 group/comment">
                  <Link href={`/profile/${comment.profiles.id}`}>
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={comment.profiles.avatar_url || undefined} />
                      <AvatarFallback className="bg-secondary text-foreground text-[10px]">
                        {comment.profiles.username?.charAt(0).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/profile/${comment.profiles.id}`} className="text-xs font-medium text-foreground hover:underline">
                        {comment.profiles.display_name || comment.profiles.username}
                      </Link>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(comment.created_at).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
                      </span>
                      {comment.user_id === userId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover/comment:opacity-100 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteComment(comment.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-foreground/80 mt-0.5">{comment.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {userId && (
            <div className="flex gap-2 pt-4 border-t border-border/30">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Kommentar schreiben..."
                className="bg-secondary/30 border-border/50 resize-none text-sm min-h-[60px]"
              />
              <Button onClick={handlePostComment} disabled={isPostingComment || !newComment.trim()} className="self-end">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Remix Dialog */}
      <Dialog open={showRemixDialog} onOpenChange={setShowRemixDialog}>
        <DialogContent className="glass border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Remix erstellen</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="rounded-lg bg-secondary/20 p-3 border border-border/30">
              <div className="flex items-center gap-2 mb-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={post.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="bg-secondary text-foreground text-[8px]">
                    {post.profiles?.username?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">@{post.profiles?.username}</span>
              </div>
              <p className="text-xs text-foreground/70 line-clamp-3">{post.content}</p>
            </div>
            
            <Textarea
              value={remixContent}
              onChange={(e) => setRemixContent(e.target.value)}
              placeholder="Dein Remix-Kommentar..."
              className="bg-secondary/30 border-border/50 resize-none text-sm min-h-[100px]"
            />
            
            <Button onClick={handleRemix} disabled={isRemixing || !remixContent.trim()} className="w-full">
              <Repeat2 className="h-4 w-4 mr-2" /> {isRemixing ? "Wird gepostet..." : "Remix posten"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function ProfileContent({
  profile,
  posts,
  badges,
  followerCount,
  followingCount,
  isFollowing: initialIsFollowing,
  isOwnProfile,
  currentUserId,
  followingProfiles,
  hasPendingRequest: initialHasPendingRequest,
  followRequests: initialFollowRequests,
}: ProfileContentProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [followers, setFollowers] = useState(followerCount)
  const [hasPendingRequest, setHasPendingRequest] = useState(initialHasPendingRequest ?? false)
  const [followRequests, setFollowRequests] = useState(initialFollowRequests || [])
  const [isBlocked, setIsBlocked] = useState(false)
  const [showBlockDialog, setShowBlockDialog] = useState(false)
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [reportReason, setReportReason] = useState("")
  const [reportDetails, setReportDetails] = useState("")
  const router = useRouter()

  // Check if user is blocked
  useEffect(() => {
    const checkBlocked = async () => {
      const supabase = createDbClient()
      const { data } = await supabase
        .from("blocked_users")
        .select("id")
        .eq("blocker_id", currentUserId)
        .eq("blocked_id", profile.id)
        .maybeSingle()
      setIsBlocked(!!data)
    }
    if (!isOwnProfile) checkBlocked()
  }, [currentUserId, profile.id, isOwnProfile])

  const xpForNextLevel = profile.level * profile.level * 50
  const xpProgress = Math.min((profile.xp / Math.max(xpForNextLevel, 1)) * 100, 100)

  const handleFollow = async () => {
    const supabase = createDbClient()
    
    if (isFollowing) {
      // Unfollow
      await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", profile.id)
      setIsFollowing(false)
      setFollowers(f => f - 1)
      toast.success("Entfolgt")
    } else if (hasPendingRequest) {
      // Cancel pending request
      await supabase.from("follow_requests").delete().eq("follower_id", currentUserId).eq("following_id", profile.id)
      setHasPendingRequest(false)
      toast.success("Anfrage zurückgezogen")
    } else if (profile.is_private) {
      // Send follow request for private profile
      const { error } = await supabase.from("follow_requests").insert({ 
        follower_id: currentUserId, 
        following_id: profile.id,
        status: "pending"
      })
      if (error) {
        toast.error("Fehler beim Senden der Anfrage")
      } else {
        setHasPendingRequest(true)
        toast.success("Follower-Anfrage gesendet!")
      }
    } else {
      // Direct follow for public profile
      await supabase.from("follows").insert({ follower_id: currentUserId, following_id: profile.id })
      await supabase.rpc("add_xp", { p_user_id: currentUserId, p_amount: 5, p_reason: "Nutzer gefolgt" })
      setIsFollowing(true)
      setFollowers(f => f + 1)
      toast.success("Gefolgt!")
    }
    router.refresh()
  }

  const handleAcceptRequest = async (requestId: string, followerId: string) => {
    const supabase = createDbClient()
    
    // Update the request status
    await supabase.from("follow_requests").update({ status: "accepted" }).eq("id", requestId)
    
    // Create the follow relationship
    await supabase.from("follows").insert({ follower_id: followerId, following_id: profile.id })
    
    // Remove from local state
    setFollowRequests(prev => prev.filter(r => r.id !== requestId))
    setFollowers(f => f + 1)
    toast.success("Follower-Anfrage akzeptiert!")
    router.refresh()
  }

  const handleRejectRequest = async (requestId: string) => {
    const supabase = createDbClient()
    await supabase.from("follow_requests").update({ status: "rejected" }).eq("id", requestId)
    setFollowRequests(prev => prev.filter(r => r.id !== requestId))
    toast.success("Follower-Anfrage abgelehnt")
    router.refresh()
  }

  const handleBlock = async () => {
    const supabase = createDbClient()
    
    if (isBlocked) {
      // Unblock
      const { error } = await supabase.rpc("unblock_user", {
        p_blocker_id: currentUserId,
        p_blocked_id: profile.id
      })
      if (!error) {
        setIsBlocked(false)
        toast.success(`@${profile.username} wurde entblockt`)
      }
    } else {
      // Block
      const { error } = await supabase.rpc("block_user", {
        p_blocker_id: currentUserId,
        p_blocked_id: profile.id
      })
      if (!error) {
        setIsBlocked(true)
        // Also unfollow if following
        if (isFollowing) {
          await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", profile.id)
          setIsFollowing(false)
          setFollowers(f => f - 1)
        }
        toast.success(`@${profile.username} wurde blockiert`)
      }
    }
    setShowBlockDialog(false)
    router.refresh()
  }

  const handleReport = async () => {
    if (!reportReason) {
      toast.error("Bitte wähle einen Grund aus")
      return
    }
    
    const supabase = createDbClient()
    const { error } = await supabase.from("reports").insert({
      reporter_id: currentUserId,
      target_type: "user",
      target_id: profile.id,
      reason: reportReason,
      details: reportDetails || null
    })
    
    if (!error) {
      toast.success("Nutzer wurde gemeldet. Wir prüfen den Fall.")
      setShowReportDialog(false)
      setReportReason("")
      setReportDetails("")
    } else {
      toast.error("Fehler beim Melden")
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Profile Header */}
      <div className="glass rounded-2xl overflow-hidden mb-6">
        {/* Banner */}
        {profile.banner_url && (
          <div className="h-32 w-full">
            <img src={profile.banner_url} alt="Profile Banner" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-8">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <Avatar className="h-24 w-24 -mt-12 border-4 border-background" style={{ marginTop: profile.banner_url ? "-3rem" : "0" }}>
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-secondary text-foreground text-2xl">
                {profile.username?.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-foreground">{profile.display_name || profile.username}</h1>
              <TooltipProvider>
                {profile.is_private && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center justify-center rounded-full bg-secondary p-1">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Privates Profil</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {profile.is_verified && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center justify-center rounded-full bg-primary/10 p-1">
                        <BadgeCheck className="h-4 w-4 text-primary" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Verifiziert von einem Teammitglied</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {profile.role === "admin" && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center justify-center rounded-full bg-destructive/10 p-1">
                        <Shield className="h-4 w-4 text-destructive" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Administrator</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {profile.role === "moderator" && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center justify-center rounded-full bg-blue-500/10 p-1">
                        <ShieldCheck className="h-4 w-4 text-blue-500" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Moderator</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </TooltipProvider>
            </div>
            <p className="text-sm text-muted-foreground mb-3">@{profile.username}</p>
            {profile.bio && <p className="text-sm text-foreground/80 mb-4">{profile.bio}</p>}

            {/* Badges */}
            {badges.length > 0 && (
              <TooltipProvider>
                <div className="flex flex-wrap gap-2 mb-4">
                  {badges.map((ub) => {
                    const Icon = badgeIcons[ub.badges.icon] || Star
                    return (
                      <Tooltip key={ub.id}>
                        <TooltipTrigger asChild>
                          <span
                            className="inline-flex items-center justify-center rounded-full p-1.5 border border-border/50 cursor-default"
                            style={{ color: ub.badges.color, backgroundColor: `${ub.badges.color}15` }}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{ub.badges.name}</p>
                          {ub.badges.description && <p className="text-xs text-muted-foreground">{ub.badges.description}</p>}
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </TooltipProvider>
            )}

            <div className="flex items-center gap-6 text-sm">
              <span className="text-foreground"><strong>{followers}</strong> <span className="text-muted-foreground">Follower</span></span>
              <span className="text-foreground"><strong>{followingCount}</strong> <span className="text-muted-foreground">Folgt</span></span>
            </div>
          </div>

          <div className="flex gap-2">
            {!isOwnProfile && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        onClick={handleFollow} 
                        size="icon"
                        variant={isFollowing || hasPendingRequest ? "outline" : "default"} 
                        className={isFollowing || hasPendingRequest ? "bg-transparent text-foreground border-border/50" : "text-primary-foreground"}
                      >
                        {isFollowing ? (
                          <UserMinus className="h-4 w-4" />
                        ) : hasPendingRequest ? (
                          <Clock className="h-4 w-4" />
                        ) : profile.is_private ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isFollowing ? "Entfolgen" : hasPendingRequest ? "Anfrage ausstehend" : profile.is_private ? "Anfrage senden" : "Folgen"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {/* Message Button - shown based on dm_privacy */}
                {profile.dm_privacy !== "nobody" && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          size="icon"
                          variant="outline" 
                          className="bg-transparent text-foreground border-border/50"
                          asChild
                        >
                          <Link href={`/messages?user=${profile.id}`}>
                            <MessageCircle className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {profile.dm_privacy === "everyone" 
                          ? "Nachricht senden" 
                          : profile.dm_privacy === "followers" && isFollowing
                            ? "Nachricht senden"
                            : profile.dm_privacy === "followers" && !isFollowing
                              ? "Erst folgen"
                              : "DM-Anfrage senden"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {/* More Options Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      size="icon"
                      variant="outline" 
                      className="bg-transparent text-foreground border-border/50"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={() => setShowBlockDialog(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      {isBlocked ? "Entblocken" : "Blockieren"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setShowReportDialog(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Flag className="h-4 w-4 mr-2" />
                      Melden
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            {isOwnProfile && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="outline" asChild className="bg-transparent text-foreground border-border/50">
                      <Link href="/settings"><Settings className="h-4 w-4" /></Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Profil bearbeiten</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* XP Bar */}
        <div className="mt-6 rounded-xl bg-secondary/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">Level {profile.level}</span>
            </div>
            <span className="text-sm text-muted-foreground">{profile.xp} / {xpForNextLevel} XP</span>
          </div>
          <Progress value={xpProgress} className="h-2" />
        </div>
        </div>
      </div>

      {/* Follow Requests (only shown on own profile with private mode) */}
      {isOwnProfile && profile.is_private && followRequests.length > 0 && (
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Follower-Anfragen ({followRequests.length})</h3>
          </div>
          <div className="flex flex-col gap-3">
            {followRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
                <Link href={`/profile/${request.profiles.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={request.profiles.avatar_url || undefined} />
                    <AvatarFallback className="bg-secondary text-foreground">
                      {request.profiles.username?.charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground text-sm">{request.profiles.display_name || request.profiles.username}</p>
                    <p className="text-xs text-muted-foreground">@{request.profiles.username}</p>
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => handleAcceptRequest(request.id, request.follower_id)}
                    className="text-primary-foreground"
                  >
                    Akzeptieren
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleRejectRequest(request.id)}
                    className="bg-transparent text-foreground border-border/50"
                  >
                    Ablehnen
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Tabs */}
      <Tabs defaultValue="posts">
        <TabsList className="glass mb-6">
          <TabsTrigger value="posts">Posts ({posts.length})</TabsTrigger>
          {profile.show_followers && <TabsTrigger value="following">Folgt ({followingProfiles.length})</TabsTrigger>}
        </TabsList>

        <TabsContent value="posts">
          {posts.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="text-muted-foreground">Noch keine Posts</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {posts.map((post) => (
                <ProfilePostItem
                  key={post.id}
                  post={post}
                  userId={currentUserId}
                  onRefresh={() => router.refresh()}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="following">
          {followingProfiles.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="text-muted-foreground">Folgt niemandem</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {followingProfiles.map((fp) => (
                <Link key={fp.id} href={`/profile/${fp.id}`} className="glass rounded-xl p-4 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={fp.avatar_url || undefined} />
                      <AvatarFallback className="bg-secondary text-foreground text-sm">
                        {fp.username?.charAt(0).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground text-sm">{fp.display_name || fp.username}</p>
                      <p className="text-xs text-muted-foreground">@{fp.username}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Block Dialog */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isBlocked ? "Nutzer entblocken" : "Nutzer blockieren"}</DialogTitle>
            <DialogDescription>
              {isBlocked 
                ? `Möchtest du @${profile.username} wirklich entblocken? Die Person kann dir dann wieder folgen und Nachrichten senden.`
                : `Wenn du @${profile.username} blockierst, kann diese Person dein Profil nicht mehr sehen, dir nicht mehr folgen und keine Nachrichten senden.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockDialog(false)}>
              Abbrechen
            </Button>
            <Button 
              variant={isBlocked ? "default" : "destructive"} 
              onClick={handleBlock}
            >
              {isBlocked ? "Entblocken" : "Blockieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nutzer melden</DialogTitle>
            <DialogDescription>
              Melde @{profile.username} wegen unangemessenem Verhalten. Wir prüfen alle Meldungen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Grund der Meldung</Label>
              <select 
                value={reportReason} 
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-secondary/50 px-3 py-2 text-sm"
              >
                <option value="">Grund auswählen...</option>
                <option value="spam">Spam</option>
                <option value="harassment">Belästigung</option>
                <option value="hate_speech">Hassrede</option>
                <option value="violence">Gewaltverherrlichung</option>
                <option value="inappropriate">Unangemessene Inhalte</option>
                <option value="impersonation">Identitätsdiebstahl</option>
                <option value="other">Sonstiges</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Details (optional)</Label>
              <Textarea 
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Beschreibe das Problem genauer..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportDialog(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleReport}>
              Melden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

