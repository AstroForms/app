"use client"

import { createDbClient } from "@/lib/db-client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, BadgeCheck, Zap,
  Home, Trash2, Flag, Repeat2, ExternalLink, X, Send, Image as ImageIcon
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useState, useEffect } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

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

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return "gerade eben"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `vor ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `vor ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `vor ${days}d`
  return date.toLocaleDateString("de-DE", { day: "numeric", month: "short" })
}

function PostCard({
  post,
  userId,
  searchQuery,
  onRefresh,
}: {
  post: FeedPost
  userId: string | null
  searchQuery: string
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
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [reportReason, setReportReason] = useState("")
  const [reportDetails, setReportDetails] = useState("")
  const router = useRouter()

  const isOwnPost = userId === post.user_id

  // Load initial like/save state and counts
  useEffect(() => {
    const loadPostData = async () => {
      const supabase = createDbClient()
      
      // Get like count
      const { count: likes } = await supabase
        .from("post_likes")
        .select("*", { count: "exact", head: true })
        .eq("post_id", post.id)
      setLikeCount(likes || 0)

      // Get comment count
      const { count: commentsCount } = await supabase
        .from("post_comments")
        .select("*", { count: "exact", head: true })
        .eq("post_id", post.id)
      setCommentCount(commentsCount || 0)

      // Check if user liked/saved
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

  if (
    searchQuery &&
    !post.content.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !post.channels.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !post.profiles.username.toLowerCase().includes(searchQuery.toLowerCase())
  ) {
    return null
  }

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
      await supabase.rpc("add_xp", { p_user_id: userId, p_amount: 2, p_reason: "Post geliked" })
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

  const handleDelete = async () => {
    if (!isOwnPost) return
    const supabase = createDbClient()
    await supabase.from("posts").delete().eq("id", post.id)
    toast.success("Post gelöscht")
    onRefresh()
  }

  const handleReport = async () => {
    if (!userId) {
      toast.error("Melde dich an um zu melden")
      return
    }
    if (!reportReason) {
      toast.error("Bitte wähle einen Grund aus")
      return
    }
    const supabase = createDbClient()
    const { error } = await supabase.from("reports").insert({
      reporter_id: userId,
      target_type: "post",
      target_id: post.id,
      reason: reportReason,
      details: reportDetails || null,
    })
    if (!error) {
      toast.success("Post wurde gemeldet. Wir prüfen den Fall.")
      setShowReportDialog(false)
      setReportReason("")
      setReportDetails("")
    } else {
      toast.error("Fehler beim Melden")
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
      await supabase.rpc("add_xp", { p_user_id: userId, p_amount: 3, p_reason: "Kommentar geschrieben" })
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
      await supabase.rpc("add_xp", { p_user_id: userId, p_amount: 5, p_reason: "Post gemixt" })
      toast.success("Remix gepostet!")
      onRefresh()
    }
    setIsRemixing(false)
  }

  return (
    <>
      <article className="rounded-xl border border-border/30 bg-card/30 p-4 transition-all hover:bg-card/50 group">
        {/* Parent post reference for remixes */}
        {post.parent_post && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/20">
            <Repeat2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              Remix von <Link href={`/profile/${post.parent_post.profiles?.username}`} className="text-primary hover:underline">@{post.parent_post.profiles?.username}</Link>
            </span>
          </div>
        )}

        {/* Post Header */}
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link href={`/profile/${post.profiles.id}`}>
              <Avatar className="h-8 w-8 shrink-0 ring-1 ring-border/30 hover:ring-primary/30 transition-all">
                <AvatarImage src={post.profiles.avatar_url || undefined} />
                <AvatarFallback className="bg-secondary text-foreground text-[10px]">
                  {post.profiles.username?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link
                  href={`/channels/${post.channels.id}`}
                  className="text-xs font-semibold text-foreground hover:underline"
                >
                  {"c/"}{post.channels.name}
                </Link>
                {post.channels.is_verified && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <BadgeCheck className="h-3 w-3 text-primary shrink-0" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Verifizierter Channel</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <span className="text-muted-foreground/40 text-[10px]">{"·"}</span>
                <Link
                  href={`/profile/${post.profiles.id}`}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {post.profiles.username}
                </Link>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-muted-foreground/60">{timeAgo(post.created_at)}</span>
                {post.is_automated && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1 py-px text-[9px] font-bold text-primary uppercase tracking-wider">
                    <Zap className="h-2 w-2" /> Auto
                  </span>
                )}
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/40 hover:text-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border/30">
              {isOwnPost ? (
                <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive focus:bg-destructive/10 text-xs">
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Löschen
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setShowReportDialog(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10 text-xs">
                  <Flag className="h-3.5 w-3.5 mr-2" /> Melden
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleShare} className="text-foreground focus:text-foreground focus:bg-secondary/50 text-xs">
                <Share2 className="h-3.5 w-3.5 mr-2" /> Link kopieren
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Post Content */}
        <div className="mb-3">
          <p className="text-[13px] text-foreground/85 leading-relaxed whitespace-pre-wrap">{post.content}</p>
          
          {/* Image */}
          {post.image_url && (
            <div className="mt-3 rounded-lg overflow-hidden border border-border/30">
              <img src={post.image_url} alt="Post image" className="w-full max-h-96 object-cover" />
            </div>
          )}

          {/* Link Embed */}
          {post.link_url && (
            <a 
              href={post.link_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-3 flex rounded-lg border border-border/30 overflow-hidden hover:bg-secondary/20 transition-colors"
            >
              {post.link_image && (
                <div className="w-24 h-24 shrink-0 bg-secondary/30">
                  <img src={post.link_image} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 p-3 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{post.link_title || post.link_url}</p>
                {post.link_description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{post.link_description}</p>
                )}
                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground/60">
                  <ExternalLink className="h-3 w-3" />
                  <span className="truncate">{new URL(post.link_url).hostname}</span>
                </div>
              </div>
            </a>
          )}
        </div>

        {/* Post Actions */}
        <div className="flex items-center gap-0.5 -ml-2 pt-1 border-t border-border/20">
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
      </article>

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
                      <span className="text-[10px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
                      {comment.user_id === userId && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-5 w-5 opacity-0 group-hover/comment:opacity-100 ml-auto text-muted-foreground hover:text-destructive"
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
            <div className="flex gap-2 pt-3 border-t border-border/30">
              <Textarea
                placeholder="Kommentar schreiben..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="bg-secondary/30 border-border/50 min-h-[60px] text-sm"
              />
              <Button 
                size="icon" 
                onClick={handlePostComment} 
                disabled={isPostingComment || !newComment.trim()}
                className="shrink-0 text-primary-foreground"
              >
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
          
          {/* Original post preview */}
          <div className="rounded-lg bg-secondary/20 p-3 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={post.profiles.avatar_url || undefined} />
                <AvatarFallback className="text-[8px]">{post.profiles.username?.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="text-[11px] text-muted-foreground">@{post.profiles.username}</span>
            </div>
            <p className="text-xs text-foreground/70 line-clamp-3">{post.content}</p>
          </div>

          <Textarea
            placeholder="Dein Remix..."
            value={remixContent}
            onChange={(e) => setRemixContent(e.target.value)}
            className="bg-secondary/30 border-border/50 min-h-[100px]"
          />
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowRemixDialog(false)} className="bg-transparent border-border/50">
              Abbrechen
            </Button>
            <Button onClick={handleRemix} disabled={isRemixing || !remixContent.trim()} className="text-primary-foreground">
              {isRemixing ? "Posten..." : "Remix posten"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="glass border-border/50">
          <DialogHeader>
            <DialogTitle className="text-foreground">Post melden</DialogTitle>
            <DialogDescription>
              Melde diesen Post wegen unangemessenem Inhalt. Wir prüfen alle Meldungen.
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
                <option value="misinformation">Falschinformationen</option>
                <option value="copyright">Urheberrechtsverletzung</option>
                <option value="other">Sonstiges</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Details (optional)</Label>
              <Textarea 
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Beschreibe das Problem genauer..."
                className="min-h-[80px] bg-secondary/30 border-border/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportDialog(false)} className="bg-transparent border-border/50">
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleReport} disabled={!reportReason}>
              Melden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function PostFeed({
  posts,
  userId,
  searchQuery,
}: {
  posts: FeedPost[]
  userId: string | null
  searchQuery: string
}) {
  const router = useRouter()
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh()
    }, 10000)
    return () => clearInterval(interval)
  }, [router])
  
  const filtered = searchQuery
    ? posts.filter(
        (p) =>
          p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.channels.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.profiles.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : posts

  const handleRefresh = () => {
    router.refresh()
  }

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-4">
        <Home className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-bold text-foreground">Startseite</h1>
        <span className="text-[11px] text-muted-foreground/50 ml-1">Die neuesten Posts</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border/30 bg-card/30 p-10 text-center">
          <p className="text-muted-foreground text-xs">
            {searchQuery ? "Keine Posts zu deiner Suche gefunden" : "Noch keine Posts vorhanden"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((post) => (
            <PostCard key={post.id} post={post} userId={userId} searchQuery="" onRefresh={handleRefresh} />
          ))}
        </div>
      )}
    </div>
  )
}

