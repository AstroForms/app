"use client"

import { createDbClient } from "@/lib/db-client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { HashtagInput } from "@/components/hashtag-input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ImageCropper } from "@/components/image-cropper"
import { Hash, BadgeCheck, Users, Flag, UserPlus, UserMinus, Send, Zap, Trash2, Camera, ImagePlus, Settings, Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Repeat2, Link as LinkIcon, X, ExternalLink, Smile, Film, Search, Megaphone } from "lucide-react"
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
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useState, useRef, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

function resolveMediaUrl(value: string | null | undefined): string {
  if (!value) return ""
  const trimmed = value.trim()
  if (!trimmed) return ""

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed
  }

  const normalized = trimmed
    .replace(/^\/+/, "")
    .replace(/^uploads\//, "")
    .replace(/^api\/media\//, "")
  return `/api/media/${normalized}`
}

interface ChannelDetailProps {
  channel: {
    id: string
    name: string
    description: string | null
    is_public?: boolean
    owner_id: string
    is_verified: boolean
    member_count: number
    icon_url: string | null
    banner_url: string | null
    boosted_until?: string | null
    has_pending_promotion_request?: boolean
  }
  posts: Array<{
    id: string
    content: string
    is_automated: boolean
    created_at: string
    user_id: string
    image_url?: string | null
    link_url?: string | null
    link_title?: string | null
    link_description?: string | null
    link_image?: string | null
    parent_post_id?: string | null
    profiles: { id: string; username: string; avatar_url: string | null; display_name: string }
    parent_post?: { id: string; content: string; profiles: { username: string } } | null
  }>
  members: Array<{
    user_id: string
    role: string
    profiles: { id: string; username: string; avatar_url: string | null; display_name: string }
  }>
  membership: { role: string } | null
  userId: string
}

type ChannelPost = ChannelDetailProps["posts"][number]
 
interface PostComment {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_comment_id?: string | null
  profiles: {
    id: string
    username: string
    avatar_url: string | null
    display_name: string
  }
}

const COMMENT_REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"] as const

const channelBoostPackages = [
  { key: "day", label: "1 Tag", cost: 300 },
  { key: "week", label: "7 Tage", cost: 1000 },
  { key: "month", label: "30 Tage", cost: 3500 },
] as const

function PostItem({
  post,
  userId,
  channelId,
  isMod,
  onDelete,
}: {
  post: ChannelPost
  userId: string
  channelId: string
  isMod: boolean
  onDelete: (id: string) => void
}) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [saved, setSaved] = useState(false)
  const [commentCount, setCommentCount] = useState(0)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<PostComment[]>([])
  const [newComment, setNewComment] = useState("")
  const [isPostingComment, setIsPostingComment] = useState(false)
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null)
  const [replyComment, setReplyComment] = useState("")
  const [commentReactions, setCommentReactions] = useState<Record<string, Record<string, number>>>({})
  const [userReactions, setUserReactions] = useState<Record<string, string[]>>({})
  const [isReactingCommentId, setIsReactingCommentId] = useState<string | null>(null)
  const [showRemixDialog, setShowRemixDialog] = useState(false)
  const [remixContent, setRemixContent] = useState("")
  const [isRemixing, setIsRemixing] = useState(false)
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [reportReason, setReportReason] = useState("")
  const [reportDetails, setReportDetails] = useState("")
  const router = useRouter()

  const isOwnPost = userId === post.user_id

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

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/channels/${channelId}#post-${post.id}`)
    toast.success("Link kopiert!")
  }

  const handleReport = async () => {
    if (!userId) return
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

  const refreshCommentCount = async () => {
    const supabase = createDbClient()
    const { count } = await supabase
      .from("post_comments")
      .select("*", { count: "exact", head: true })
      .eq("post_id", post.id)
    setCommentCount(count || 0)
  }

  const loadCommentReactions = async (commentRows: PostComment[]) => {
    if (commentRows.length === 0) {
      setCommentReactions({})
      setUserReactions({})
      return
    }
    const supabase = createDbClient()
    const commentIds = commentRows.map((comment) => comment.id)
    const { data } = await supabase
      .from("comment_reactions")
      .select("comment_id, emoji, user_id")
      .in("comment_id", commentIds)

    const reactionCounts: Record<string, Record<string, number>> = {}
    const mine: Record<string, string[]> = {}

    for (const row of data || []) {
      const entry = row as { comment_id?: string; emoji?: string; user_id?: string }
      if (!entry.comment_id || !entry.emoji) continue
      reactionCounts[entry.comment_id] = reactionCounts[entry.comment_id] || {}
      reactionCounts[entry.comment_id][entry.emoji] = (reactionCounts[entry.comment_id][entry.emoji] || 0) + 1
      if (entry.user_id === userId) {
        mine[entry.comment_id] = mine[entry.comment_id] || []
        if (!mine[entry.comment_id].includes(entry.emoji)) {
          mine[entry.comment_id].push(entry.emoji)
        }
      }
    }

    setCommentReactions(reactionCounts)
    setUserReactions(mine)
  }

  const loadComments = async () => {
    const supabase = createDbClient()
    const { data } = await supabase
      .from("post_comments")
      .select("*, profiles(id, username, avatar_url, display_name)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true })
    const commentRows = (data || []) as PostComment[]
    setComments(commentRows)
    await loadCommentReactions(commentRows)
  }

  const handleOpenComments = async () => {
    setShowComments(true)
    await loadComments()
  }

  const handlePostComment = async (parentCommentId?: string | null) => {
    const content = parentCommentId ? replyComment : newComment
    if (!userId || !content.trim()) return
    setIsPostingComment(true)
    const supabase = createDbClient()
    const { error } = await supabase.from("post_comments").insert({
      post_id: post.id,
      user_id: userId,
      parent_comment_id: parentCommentId || null,
      content: content.trim(),
    })
    if (error) {
      toast.error(error.message)
    } else {
      if (parentCommentId) {
        setReplyComment("")
        setReplyingToCommentId(null)
      } else {
        setNewComment("")
      }
      await refreshCommentCount()
      await loadComments()
      await supabase.rpc("add_xp", { p_user_id: userId, p_amount: 3, p_reason: "Kommentar geschrieben" })
      toast.success("Kommentar gepostet!")
    }
    setIsPostingComment(false)
  }

  const handleDeleteComment = async (commentId: string) => {
    const supabase = createDbClient()
    await supabase.from("post_comments").delete().eq("id", commentId)
    await refreshCommentCount()
    await loadComments()
    toast.success("Kommentar gelöscht")
  }

  const handleToggleCommentReaction = async (commentId: string, emoji: string) => {
    if (!userId) {
      toast.error("Melde dich an, um zu reagieren")
      return
    }
    const hasReacted = (userReactions[commentId] || []).includes(emoji)
    const supabase = createDbClient()
    setIsReactingCommentId(commentId)

    const result = hasReacted
      ? await supabase.from("comment_reactions").delete().eq("comment_id", commentId).eq("emoji", emoji).eq("user_id", userId)
      : await supabase.from("comment_reactions").insert({ comment_id: commentId, emoji, user_id: userId })

    if (result.error) {
      toast.error(result.error)
    } else {
      await loadComments()
    }
    setIsReactingCommentId(null)
  }

  const commentsByParent = useMemo(() => {
    const grouped: Record<string, PostComment[]> = {}
    for (const comment of comments) {
      const key = comment.parent_comment_id || "root"
      grouped[key] = grouped[key] || []
      grouped[key].push(comment)
    }
    return grouped
  }, [comments])

  const renderCommentTree = (parentCommentId: string | null = null, depth = 0) => {
    const key = parentCommentId || "root"
    const groupedComments = commentsByParent[key] || []
    return groupedComments.map((comment) => {
      const reactions = commentReactions[comment.id] || {}
      const myReactions = userReactions[comment.id] || []

      return (
        <div key={comment.id} className={depth > 0 ? "ml-8 border-l border-border/30 pl-4" : ""}>
          <div className="flex gap-3 group/comment rounded-lg p-2 hover:bg-secondary/20 transition-colors">
            <Link href={`/profile/${comment.profiles.id}`}>
              <Avatar className="h-9 w-9">
                <AvatarImage src={comment.profiles.avatar_url || undefined} />
                <AvatarFallback className="bg-secondary text-foreground text-xs">
                  {comment.profiles.username?.charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link href={`/profile/${comment.profiles.id}`} className="text-sm font-medium text-foreground hover:underline">
                  {comment.profiles.display_name || comment.profiles.username}
                </Link>
                <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                  {new Date(comment.created_at).toLocaleDateString("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
                {comment.user_id === userId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover/comment:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteComment(comment.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <p className="text-sm text-foreground/90 mt-1 whitespace-pre-wrap">{comment.content}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {Object.entries(reactions)
                  .filter(([, count]) => count > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([emoji, count]) => (
                    <Button
                      key={`${comment.id}-${emoji}`}
                      variant="ghost"
                      size="sm"
                      className={`h-6 rounded-full px-2 text-xs ${
                        myReactions.includes(emoji) ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                      }`}
                      disabled={isReactingCommentId === comment.id}
                      onClick={() => handleToggleCommentReaction(comment.id, emoji)}
                    >
                      <span>{emoji}</span>
                      <span>{count}</span>
                    </Button>
                  ))}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 rounded-full px-2 text-xs text-muted-foreground hover:text-foreground"
                      disabled={isReactingCommentId === comment.id}
                    >
                      <Smile className="h-3.5 w-3.5 mr-1" /> Reagieren
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-card border-border/30 p-1.5">
                    <div className="flex items-center gap-1">
                      {COMMENT_REACTION_EMOJIS.map((emoji) => (
                        <Button
                          key={`${comment.id}-picker-${emoji}`}
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleToggleCommentReaction(comment.id, emoji)}
                        >
                          {emoji}
                        </Button>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setReplyingToCommentId((current) => current === comment.id ? null : comment.id)}
                >
                  Antworten
                </Button>
              </div>
              {replyingToCommentId === comment.id && userId && (
                <div className="mt-2 flex gap-2">
                  <Textarea
                    value={replyComment}
                    onChange={(event) => setReplyComment(event.target.value)}
                    placeholder={`Antwort an ${comment.profiles.display_name || comment.profiles.username}...`}
                    className="bg-secondary/30 border-border/50 resize-none text-sm min-h-[72px]"
                  />
                  <Button
                    onClick={() => handlePostComment(comment.id)}
                    disabled={isPostingComment || !replyComment.trim()}
                    className="self-end"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 space-y-2">{renderCommentTree(comment.id, depth + 1)}</div>
        </div>
      )
    })
  }

  const handleRemix = async () => {
    if (!userId || !remixContent.trim()) return
    setIsRemixing(true)
    const supabase = createDbClient()
    const { error } = await supabase.from("posts").insert({
      channel_id: channelId,
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
      router.refresh()
    }
    setIsRemixing(false)
  }

  return (
    <>
      <div className="glass rounded-xl p-4 group">
        {/* Remix Reference */}
        {post.parent_post_id && post.parent_post && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/20">
            <Repeat2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              Remix von <span className="text-primary">@{post.parent_post.profiles?.username}</span>
            </span>
          </div>
        )}
        
        <div className="flex items-start gap-3">
          <Link href={`/profile/${post.profiles?.id}`}>
            <Avatar className="h-9 w-9">
              <AvatarImage src={post.profiles?.avatar_url || undefined} />
              <AvatarFallback className="bg-secondary text-foreground text-xs">
                {post.profiles?.username?.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link href={`/profile/${post.profiles?.id}`} className="text-sm font-medium text-foreground hover:underline">
                {post.profiles?.display_name || post.profiles?.username}
              </Link>
              {post.is_automated && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  <Zap className="h-3 w-3" /> AUTO
                </span>
              )}
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
            
            <p className="text-xs text-muted-foreground mt-1.5" suppressHydrationWarning>
              {new Date(post.created_at).toLocaleDateString("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
            
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
          
          {/* Post Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border/30">
              {isOwnPost || isMod ? (
                <DropdownMenuItem onClick={() => onDelete(post.id)} className="text-destructive focus:text-destructive focus:bg-destructive/10 text-xs">
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
      </div>

      {/* Comments Dialog */}
      <Dialog open={showComments} onOpenChange={setShowComments}>
        <DialogContent className="glass border-border/50 max-w-3xl w-[95vw] max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-foreground">Kommentare ({commentCount})</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto py-4 space-y-4">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Noch keine Kommentare</p>
            ) : (
              renderCommentTree(null, 0)
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
              <Button onClick={() => handlePostComment()} disabled={isPostingComment || !newComment.trim()} className="self-end">
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

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="glass border-border/50">
          <DialogHeader>
            <DialogTitle className="text-foreground">Post melden</DialogTitle>
            <DialogDescription>
              Melde diesen Post wegen unangemessenem Inhalt.
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

export function ChannelDetail({ channel, posts, members, membership, userId }: ChannelDetailProps) {
  const MAX_POST_LENGTH = 2000
  const router = useRouter()
  const [newPost, setNewPost] = useState("")
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh()
    }, 10000)
    return () => clearInterval(interval)
  }, [router])
  const [isPosting, setIsPosting] = useState(false)
  const [iconUrl, setIconUrl] = useState(resolveMediaUrl(channel.icon_url))
  const [bannerUrl, setBannerUrl] = useState(resolveMediaUrl(channel.banner_url))
  const [isUploadingIcon, setIsUploadingIcon] = useState(false)
  const [isUploadingBanner, setIsUploadingBanner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [channelName, setChannelName] = useState(channel.name)
  const [channelDescription, setChannelDescription] = useState(channel.description || "")
  const [channelIsPublic, setChannelIsPublic] = useState(channel.is_public ?? true)
  const [settingsName, setSettingsName] = useState(channel.name)
  const [settingsDescription, setSettingsDescription] = useState(channel.description || "")
  const [settingsIsPublic, setSettingsIsPublic] = useState(channel.is_public ?? true)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [boostedUntil, setBoostedUntil] = useState<string | null>(channel.boosted_until || null)
  const [hasPendingPromotionRequest, setHasPendingPromotionRequest] = useState<boolean>(
    !!channel.has_pending_promotion_request,
  )
  const [showPromoteDialog, setShowPromoteDialog] = useState(false)
  const [isPromotingChannel, setIsPromotingChannel] = useState(false)
  const [profileXp, setProfileXp] = useState<number | null>(null)
  const [isCopyingChannelLink, setIsCopyingChannelLink] = useState(false)
  const [showDeleteChannelDialog, setShowDeleteChannelDialog] = useState(false)
  const [deleteChannelConfirmation, setDeleteChannelConfirmation] = useState("")
  const [isDeletingChannel, setIsDeletingChannel] = useState(false)

  // Post media states
  const [postImageUrl, setPostImageUrl] = useState("")
  const [postLinkUrl, setPostLinkUrl] = useState("")
  const [isUploadingPostImage, setIsUploadingPostImage] = useState(false)
  const [showMediaDialog, setShowMediaDialog] = useState(false)
  const [gifSearch, setGifSearch] = useState("")
  const [gifs, setGifs] = useState<Array<{ id: string; url: string; preview: string }>>([])
  const [isLoadingGifs, setIsLoadingGifs] = useState(false)

  // Cropper states
  const [cropperOpen, setCropperOpen] = useState(false)
  const [cropperImageSrc, setCropperImageSrc] = useState("")
  const [cropperType, setCropperType] = useState<"icon" | "banner" | "post">("icon")

  // Channel report states
  const [showChannelReportDialog, setShowChannelReportDialog] = useState(false)
  const [channelReportReason, setChannelReportReason] = useState("")
  const [channelReportDetails, setChannelReportDetails] = useState("")
  const [clientNow, setClientNow] = useState<number | null>(null)

  const iconInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const postImageInputRef = useRef<HTMLInputElement>(null)

  const isOwner = channel.owner_id === userId
  const isMod = membership?.role === "moderator" || membership?.role === "owner" || membership?.role === "admin"
  const remainingPostChars = MAX_POST_LENGTH - newPost.length
  const isBoostActive = boostedUntil && clientNow !== null ? new Date(boostedUntil).getTime() > clientNow : false
  const boostedUntilLabel = boostedUntil
    ? new Date(boostedUntil).toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null
  const displayMembers = members.some((member) => member.user_id === channel.owner_id)
    ? members
    : [
        {
          user_id: channel.owner_id,
          role: "owner",
          profiles: {
            id: channel.owner_id,
            username: "Owner",
            avatar_url: resolveMediaUrl(channel.icon_url) || null,
            display_name: "Owner",
          },
        },
        ...members,
      ]

  useEffect(() => {
    const isPublic = channel.is_public ?? true
    setChannelName(channel.name)
    setChannelDescription(channel.description || "")
    setChannelIsPublic(isPublic)
    setSettingsName(channel.name)
    setSettingsDescription(channel.description || "")
    setSettingsIsPublic(isPublic)
  }, [channel.name, channel.description, channel.is_public])

  useEffect(() => {
    setBoostedUntil(channel.boosted_until || null)
  }, [channel.boosted_until])

  useEffect(() => {
    setHasPendingPromotionRequest(!!channel.has_pending_promotion_request)
  }, [channel.has_pending_promotion_request])

  useEffect(() => {
    setClientNow(Date.now())
  }, [])

  useEffect(() => {
    if (!isOwner) return
    const supabase = createDbClient()
    let isMounted = true

    const loadXp = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("xp")
        .eq("id", userId)
        .single()

      if (error || !isMounted) return
      const row = data as { xp?: number } | null
      if (row && typeof row.xp === "number") {
        setProfileXp(row.xp)
      }
    }

    loadXp()
    return () => {
      isMounted = false
    }
  }, [isOwner, userId])

  const uploadImage = async (blob: Blob, type: "icon" | "banner") => {
    const supabase = createDbClient()
    const fileName = `${channel.id}-${type}-${Date.now()}.jpg`
    const filePath = `channels/${type}s/${fileName}`

    // Convert Blob to File if needed
    let file: File
    if (blob instanceof File) {
      file = blob
    } else {
      file = new File([blob], fileName, { type: "image/jpeg" })
    }

    const { error: uploadError } = await supabase.storage
      .from("channels")
      .upload(filePath, file, { upsert: true, contentType: "image/jpeg" })

    if (uploadError) {
      toast.error(`Fehler beim Hochladen: ${uploadError.message}`)
      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from("channels")
      .getPublicUrl(filePath)

    return publicUrl
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "icon" | "banner") => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Bitte nur Bilder hochladen")
      return
    }

    const maxSize = type === "icon" ? 5 : 10
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`Bild darf maximal ${maxSize}MB groß sein`)
      return
    }

    const imageUrl = URL.createObjectURL(file)
    setCropperImageSrc(imageUrl)
    setCropperType(type)
    setCropperOpen(true)
    e.target.value = ""
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    const supabase = createDbClient()
    
    if (cropperType === "icon") {
      setIsUploadingIcon(true)
      const url = await uploadImage(croppedBlob, "icon")
      if (url) {
        await supabase.from("channels").update({ icon_url: url }).eq("id", channel.id)
        setIconUrl(url)
        toast.success("Channel-Icon aktualisiert!")
        router.refresh()
      }
      setIsUploadingIcon(false)
    } else {
      setIsUploadingBanner(true)
      const url = await uploadImage(croppedBlob, "banner")
      if (url) {
        await supabase.from("channels").update({ banner_url: url }).eq("id", channel.id)
        setBannerUrl(url)
        toast.success("Channel-Banner aktualisiert!")
        router.refresh()
      }
      setIsUploadingBanner(false)
    }
    
    URL.revokeObjectURL(cropperImageSrc)
    setCropperImageSrc("")
  }

  const handleCropperClose = () => {
    setCropperOpen(false)
    URL.revokeObjectURL(cropperImageSrc)
    setCropperImageSrc("")
  }

  const handleSaveChannelSettings = async () => {
    if (!isOwner) return

    const nextName = settingsName.trim()
    const nextDescription = settingsDescription.trim()

    if (!nextName) {
      toast.error("Channel-Name darf nicht leer sein")
      return
    }
    if (nextName.length > 80) {
      toast.error("Channel-Name darf maximal 80 Zeichen haben")
      return
    }
    if (nextDescription.length > 500) {
      toast.error("Beschreibung darf maximal 500 Zeichen haben")
      return
    }

    setIsSavingSettings(true)
    const response = await fetch(`/api/channels/${channel.id}/manage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nextName,
        description: nextDescription || null,
        isPublic: settingsIsPublic,
      }),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const message = typeof data?.error === "string" ? data.error : "Einstellungen konnten nicht gespeichert werden"
      toast.error(message)
      setIsSavingSettings(false)
      return
    }

    setChannelName(nextName)
    setChannelDescription(nextDescription)
    setChannelIsPublic(settingsIsPublic)
    toast.success("Channeleinstellungen gespeichert")
    setIsSavingSettings(false)
    router.refresh()
  }

  const handleCopyChannelLink = async () => {
    try {
      setIsCopyingChannelLink(true)
      await navigator.clipboard.writeText(`${window.location.origin}/channels/${channel.id}`)
      toast.success("Channel-Link kopiert")
    } catch {
      toast.error("Link konnte nicht kopiert werden")
    } finally {
      setIsCopyingChannelLink(false)
    }
  }

  const handleDeleteChannel = async () => {
    if (!isOwner) return
    if (deleteChannelConfirmation.trim() !== channelName.trim()) {
      toast.error("Bitte gib den exakten Channel-Namen ein.")
      return
    }

    setIsDeletingChannel(true)
    try {
      const response = await fetch(`/api/channels/${channel.id}/manage`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteChannelConfirmation.trim() }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Channel konnte nicht gelöscht werden")
      }
      toast.success("Channel wurde gelöscht")
      if (typeof window !== "undefined") {
        window.location.assign("/channels")
        return
      }
      router.push("/channels")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Channel konnte nicht gelöscht werden")
    } finally {
      setIsDeletingChannel(false)
      setShowDeleteChannelDialog(false)
      setDeleteChannelConfirmation("")
    }
  }

  const handleJoin = async () => {
    const supabase = createDbClient()
    const { error } = await supabase.from("channel_members").insert({
      channel_id: channel.id,
      user_id: userId,
    })
    if (error) {
      toast.error(error.message)
      return
    }
    await supabase.rpc("add_xp", { p_user_id: userId, p_amount: 5, p_reason: "Channel beigetreten" })
    toast.success("Beigetreten!")
    router.refresh()
  }

  const handleLeave = async () => {
    const supabase = createDbClient()
    await supabase.from("channel_members").delete().eq("channel_id", channel.id).eq("user_id", userId)
    toast.success("Verlassen!")
    router.refresh()
  }

  const handlePromoteChannel = async (
    packageKey: "day" | "week" | "month",
    packageLabel: string,
  ) => {
    setIsPromotingChannel(true)
    const supabase = createDbClient()
    const { data, error } = await supabase.rpc("promote_channel", {
      p_user_id: userId,
      p_channel_id: channel.id,
      p_package: packageKey,
    })

    if (error) {
      toast.error(error.message || "Werbung fehlgeschlagen")
      setIsPromotingChannel(false)
      return
    }

    const payload = data as {
      xp?: number
      boosted_until?: string | null
      status?: string
      request_id?: string
    } | null
    if (payload && typeof payload.xp === "number") {
      setProfileXp(payload.xp)
    }
    if (payload && (typeof payload.boosted_until === "string" || payload.boosted_until === null)) {
      setBoostedUntil(payload.boosted_until || null)
    }

    if (payload?.status === "PENDING") {
      setHasPendingPromotionRequest(true)
      toast.success(`Werbeanfrage für ${packageLabel} gesendet`)
      setShowPromoteDialog(false)
    } else {
      toast.success(`Channel für ${packageLabel} beworben`)
    }
    router.refresh()
    setIsPromotingChannel(false)
  }

  const handlePost = async () => {
    if (!newPost.trim() && !postImageUrl) return
    if (newPost.length > MAX_POST_LENGTH) {
      toast.error(`Post ist zu lang. Maximal ${MAX_POST_LENGTH} Zeichen.`)
      return
    }
    setIsPosting(true)
    const supabase = createDbClient()
    
    // Fetch link metadata if link provided
    let linkData: { title?: string; description?: string; image?: string } = {}
    if (postLinkUrl) {
      try {
        // Simple URL validation
        new URL(postLinkUrl)
        linkData = { title: postLinkUrl }
      } catch {
        // Invalid URL, ignore
      }
    }
    
    const { error } = await supabase.from("posts").insert({
      channel_id: channel.id,
      user_id: userId,
      content: newPost.trim(),
      image_url: postImageUrl || null,
      link_url: postLinkUrl || null,
      link_title: linkData.title || null,
      link_description: linkData.description || null,
      link_image: linkData.image || null,
    })
    if (error) {
      toast.error(error.message)
    } else {
      await supabase.rpc("add_xp", { p_user_id: userId, p_amount: 5, p_reason: "Post erstellt" })
      setNewPost("")
      setPostImageUrl("")
      setPostLinkUrl("")
      setShowMediaDialog(false)
      toast.success("Gepostet!")
      router.refresh()
    }
    setIsPosting(false)
  }

  const handlePostImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.type.startsWith("image/")) {
      toast.error("Nur Bilder erlaubt")
      return
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Bild darf max. 10MB groß sein")
      return
    }
    
    setIsUploadingPostImage(true)
    const supabase = createDbClient()
    const fileName = `${userId}-post-${Date.now()}.${file.name.split('.').pop()}`
    const filePath = `posts/${fileName}`
    
    const { error: uploadError } = await supabase.storage
      .from("channels")
      .upload(filePath, file, { upsert: true })
    
    if (uploadError) {
      toast.error(`Upload fehlgeschlagen: ${uploadError.message}`)
    } else {
      const { data: { publicUrl } } = supabase.storage.from("channels").getPublicUrl(filePath)
      setPostImageUrl(publicUrl)
      toast.success("Bild hochgeladen!")
    }
    setIsUploadingPostImage(false)
    e.target.value = ""
  }

  const handleDeletePost = async (postId: string) => {
    const supabase = createDbClient()
    await supabase.from("posts").delete().eq("id", postId)
    toast.success("Post gelöscht")
    router.refresh()
  }

  // GIF search using Tenor API (free, no key required for limited use)
  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      setGifs([])
      return
    }
    setIsLoadingGifs(true)
    try {
      // Using Tenor's anonymous API endpoint
      const response = await fetch(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&client_key=astroforms&limit=20`
      )
      const data = await response.json()
      const gifResults = data.results?.map((gif: any) => ({
        id: gif.id,
        url: gif.media_formats?.gif?.url || gif.media_formats?.mediumgif?.url,
        preview: gif.media_formats?.tinygif?.url || gif.media_formats?.nanogif?.url,
      })).filter((g: any) => g.url) || []
      setGifs(gifResults)
    } catch (error) {
      console.error("GIF search error:", error)
      toast.error("GIF-Suche fehlgeschlagen")
    }
    setIsLoadingGifs(false)
  }

  const handleSelectGif = (gifUrl: string) => {
    setPostImageUrl(gifUrl)
    setShowMediaDialog(false)
    setGifSearch("")
    setGifs([])
  }

  const handleInsertEmoji = (emoji: string) => {
    setNewPost(prev => prev + emoji)
  }

  // Common emojis organized by category
  const emojiCategories = {
    "Smileys": ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😌", "😍", "🥰", "😘", "😋", "😛", "😜", "🤪", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥"],
    "Gesten": ["👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "👋", "🤚", "🖐️", "✋", "🖖", "👏", "🙌", "🤝", "🙏", "💪", "🦾", "🫶", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝"],
    "Objekte": ["🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "🥈", "🥉", "⭐", "🌟", "✨", "💫", "🔥", "💯", "✅", "❌", "⚠️", "🚀", "💡", "🎯", "🎮", "🎨", "🎬", "🎵", "🎶", "💻", "📱", "💾", "📷", "🔒", "🔑", "💰", "💎", "⚡", "☀️", "🌙", "⛅", "🌈", "☔", "❄️"],
    "Tiere": ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🐤", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐜", "🦟", "🐢", "🐍", "🦎", "🦂", "🐙", "🦑"],
    "Essen": ["🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🌽", "🌶️", "🍕", "🍔", "🍟", "🌭", "🍿", "🥨", "🥯", "🍞", "🧀", "🥚", "🍳", "🥓", "🥩", "🍗", "🍖", "🦴", "🌮", "🍜"],
  }

  const handleReport = async () => {
    if (!channelReportReason) {
      toast.error("Bitte wähle einen Grund aus")
      return
    }
    const supabase = createDbClient()
    const { error } = await supabase.from("reports").insert({
      reporter_id: userId,
      target_type: "channel",
      target_id: channel.id,
      reason: channelReportReason,
      details: channelReportDetails || null,
    })
    if (!error) {
      toast.success("Channel wurde gemeldet. Wir prüfen den Fall.")
      setShowChannelReportDialog(false)
      setChannelReportReason("")
      setChannelReportDetails("")
    } else {
      toast.error("Fehler beim Melden")
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Image Cropper Dialog */}
      <ImageCropper
        open={cropperOpen}
        onClose={handleCropperClose}
        imageSrc={cropperImageSrc}
        onCropComplete={handleCropComplete}
        aspectRatio={cropperType === "icon" ? 1 : 3}
        title={cropperType === "icon" ? "Channel-Icon zuschneiden" : "Channel-Banner zuschneiden"}
      />

      {/* Channel Header */}
      <div className="glass rounded-2xl overflow-hidden mb-6">
        {/* Banner */}
        <div 
          className={`relative w-full aspect-[3/1] bg-gradient-to-r from-primary/20 to-primary/10 ${isOwner ? "cursor-pointer group" : ""}`}
          onClick={() => isOwner && bannerInputRef.current?.click()}
        >
          {bannerUrl ? (
            <img src={bannerUrl} alt="Channel Banner" className="w-full h-full object-cover" />
          ) : null}
          {isOwner && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex flex-col items-center text-foreground">
                <ImagePlus className="h-6 w-6 mb-1" />
                <span className="text-xs">Banner ändern</span>
              </div>
            </div>
          )}
          {isUploadingBanner && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <span className="text-sm text-foreground">Hochladen...</span>
            </div>
          )}
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelect(e, "banner")}
          />
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {/* Channel Icon */}
              <div 
                className={`relative flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 overflow-hidden ${isOwner ? "cursor-pointer group" : ""}`}
                onClick={() => isOwner && iconInputRef.current?.click()}
              >
                {iconUrl ? (
                  <img src={iconUrl} alt="Channel Icon" className="w-full h-full object-cover" />
                ) : (
                  <Hash className="h-7 w-7 text-primary" />
                )}
                {isOwner && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-5 w-5 text-foreground" />
                  </div>
                )}
                {isUploadingIcon && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <span className="text-[10px] text-foreground">...</span>
                  </div>
                )}
                <input
                  ref={iconInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, "icon")}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">{channelName}</h1>
                  {channel.is_verified && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <BadgeCheck className="h-5 w-5 text-primary" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Verifiziert von einem Teammitglied</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                {channelDescription && (
                  <p className="text-sm text-muted-foreground mt-1 max-w-xl">{channelDescription}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {members.length} Mitglieder</span>
                  <span>{channelIsPublic ? "Öffentlich" : "Privat"}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOwner && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowPromoteDialog(true)}
                        className="bg-transparent text-foreground border-border/50"
                      >
                        <Megaphone className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Channel werben</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {isOwner && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyChannelLink}
                  disabled={isCopyingChannelLink}
                  className="bg-transparent text-foreground border-border/50"
                >
                  <LinkIcon className="h-4 w-4" />
                </Button>
              )}
              {isOwner && (
                <Button variant="outline" size="icon" onClick={() => setShowSettings(!showSettings)} className="bg-transparent text-foreground border-border/50">
                  <Settings className="h-4 w-4" />
                </Button>
              )}
              {!membership && !isOwner && (
                <Button onClick={handleJoin} className="text-primary-foreground">
                  <UserPlus className="h-4 w-4 mr-2" /> Beitreten
                </Button>
              )}
              {membership && !isOwner && (
                <Button variant="outline" onClick={handleLeave} className="bg-transparent text-foreground border-border/50">
                  <UserMinus className="h-4 w-4 mr-2" /> Verlassen
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => setShowChannelReportDialog(true)} className="text-muted-foreground hover:text-destructive">
                <Flag className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Settings Panel for Owner */}
          {isOwner && showSettings && (
            <div className="mt-4 pt-4 border-t border-border/30">
              <p className="text-sm text-muted-foreground mb-4">
                Klicke auf das Icon oder Banner um es zu ändern (max. 5MB für Icon, 10MB für Banner)
              </p>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label className="text-xs text-muted-foreground">Channel-Name</Label>
                  <Input
                    value={settingsName}
                    onChange={(e) => setSettingsName(e.target.value)}
                    maxLength={80}
                    className="bg-secondary/30 border-border/50"
                    placeholder="Channel-Name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs text-muted-foreground">Beschreibung</Label>
                  <Textarea
                    value={settingsDescription}
                    onChange={(e) => setSettingsDescription(e.target.value)}
                    maxLength={500}
                    className="min-h-[90px] bg-secondary/30 border-border/50"
                    placeholder="Beschreibe deinen Channel..."
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/20 px-3 py-2">
                  <div>
                    <p className="text-sm text-foreground">Sichtbarkeit</p>
                    <p className="text-xs text-muted-foreground">
                      {settingsIsPublic ? "Öffentlich in Discover sichtbar" : "Nur per direktem Link sichtbar"}
                    </p>
                  </div>
                  <Switch checked={settingsIsPublic} onCheckedChange={setSettingsIsPublic} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={handleSaveChannelSettings}
                    disabled={isSavingSettings}
                    className="text-primary-foreground"
                  >
                    {isSavingSettings ? "Speichern..." : "Channeleinstellungen speichern"}
                  </Button>
                  <Button
                    variant="outline"
                    className="bg-transparent border-border/50"
                    onClick={handleCopyChannelLink}
                    disabled={isCopyingChannelLink}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Link teilen
                  </Button>
                  <Button
                    variant="outline"
                    className="bg-transparent border-border/50"
                    onClick={() => {
                      setSettingsName(channelName)
                      setSettingsDescription(channelDescription)
                      setSettingsIsPublic(channelIsPublic)
                    }}
                    disabled={isSavingSettings}
                  >
                    Zurücksetzen
                  </Button>
                </div>
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <p className="text-sm font-medium text-destructive">Gefahrenzone</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Beim Löschen werden alle Posts, Mitglieder und Channel-Daten unwiderruflich entfernt.
                  </p>
                  <Button variant="destructive" className="mt-3" onClick={() => setShowDeleteChannelDialog(true)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Channel löschen
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Posts */}
        <div className="lg:col-span-3">
          {(membership || isOwner) && (
            <div className="glass rounded-xl p-4 mb-4">
              <HashtagInput
                placeholder="Schreibe etwas... Tippe # für Hashtags"
                value={newPost}
                onChange={setNewPost}
                className="bg-secondary/30 border-border/50 mb-3"
                minHeight="80px"
                maxLength={MAX_POST_LENGTH}
              />
              <div className="mb-3 flex justify-end">
                <p className={`text-xs ${remainingPostChars <= 100 ? "text-amber-400" : "text-muted-foreground"}`}>
                  {remainingPostChars} Zeichen uebrig
                </p>
              </div>
              
              {/* Media Preview */}
              {postImageUrl && (
                <div className="relative mb-3 rounded-lg overflow-hidden border border-border/30 inline-block">
                  <img src={postImageUrl} alt="Preview" className="max-h-32 object-cover" />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-1 right-1 h-6 w-6 bg-background/80"
                    onClick={() => setPostImageUrl("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              
              {postLinkUrl && (
                <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-secondary/30 text-xs">
                  <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate text-muted-foreground">{postLinkUrl}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto shrink-0" onClick={() => setPostLinkUrl("")}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Dialog open={showMediaDialog} onOpenChange={setShowMediaDialog}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                      >
                        <ImagePlus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Medien hinzufügen</DialogTitle>
                      </DialogHeader>
                      <Tabs defaultValue="image" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="image" className="flex items-center gap-1.5">
                            <ImagePlus className="h-3.5 w-3.5" />
                            Bild
                          </TabsTrigger>
                          <TabsTrigger value="gif" className="flex items-center gap-1.5">
                            <Film className="h-3.5 w-3.5" />
                            GIF
                          </TabsTrigger>
                          <TabsTrigger value="emoji" className="flex items-center gap-1.5">
                            <Smile className="h-3.5 w-3.5" />
                            Emoji
                          </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="image" className="space-y-4 mt-4">
                          <div>
                            <Label className="text-sm text-muted-foreground">Bild hochladen</Label>
                            <div className="flex gap-2 mt-2">
                              <Button 
                                variant="outline" 
                                onClick={() => postImageInputRef.current?.click()}
                                disabled={isUploadingPostImage}
                                className="w-full"
                              >
                                <ImagePlus className="h-4 w-4 mr-2" />
                                {isUploadingPostImage ? "Lädt..." : "Bild auswählen"}
                              </Button>
                            </div>
                            <input
                              ref={postImageInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                handlePostImageSelect(e)
                                setShowMediaDialog(false)
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-sm text-muted-foreground">Link hinzufügen</Label>
                            <div className="flex gap-2 mt-2">
                              <Input 
                                value={postLinkUrl}
                                onChange={(e) => setPostLinkUrl(e.target.value)}
                                placeholder="https://..."
                                className="flex-1"
                              />
                              <Button 
                                variant="outline"
                                onClick={() => setShowMediaDialog(false)}
                                disabled={!postLinkUrl}
                              >
                                OK
                              </Button>
                            </div>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="gif" className="mt-4">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="relative flex-1">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input 
                                value={gifSearch}
                                onChange={(e) => setGifSearch(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && searchGifs(gifSearch)}
                                placeholder="GIFs suchen..."
                                className="pl-9"
                              />
                            </div>
                            <Button onClick={() => searchGifs(gifSearch)} disabled={isLoadingGifs}>
                              {isLoadingGifs ? "..." : "Suchen"}
                            </Button>
                          </div>
                          {gifs.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                              {gifs.map((gif) => (
                                <button
                                  key={gif.id}
                                  onClick={() => handleSelectGif(gif.url)}
                                  className="rounded-md overflow-hidden border border-border hover:border-primary transition-colors"
                                >
                                  <img src={gif.preview} alt="" className="w-full h-20 object-cover" />
                                </button>
                              ))}
                            </div>
                          )}
                          {gifs.length === 0 && gifSearch && !isLoadingGifs && (
                            <p className="text-sm text-muted-foreground text-center py-8">Keine GIFs gefunden. Probiere andere Suchbegriffe.</p>
                          )}
                          {gifs.length === 0 && !gifSearch && (
                            <p className="text-sm text-muted-foreground text-center py-8">Suche nach GIFs...</p>
                          )}
                          <p className="text-[10px] text-muted-foreground/50 mt-3 text-center">Powered by Tenor</p>
                        </TabsContent>
                        
                        <TabsContent value="emoji" className="mt-4">
                          <div className="max-h-64 overflow-y-auto space-y-3">
                            {Object.entries(emojiCategories).map(([category, emojis]) => (
                              <div key={category}>
                                <p className="text-xs font-medium text-muted-foreground mb-2">{category}</p>
                                <div className="flex flex-wrap gap-1">
                                  {emojis.map((emoji, i) => (
                                    <button
                                      key={i}
                                      onClick={() => handleInsertEmoji(emoji)}
                                      className="w-8 h-8 flex items-center justify-center rounded hover:bg-secondary transition-colors text-lg"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </DialogContent>
                  </Dialog>
                </div>
                <Button
                  onClick={handlePost}
                  disabled={isPosting || (!newPost.trim() && !postImageUrl) || remainingPostChars < 0}
                  className="text-primary-foreground"
                >
                  <Send className="h-4 w-4 mr-2" /> Posten
                </Button>
              </div>
            </div>
          )}

          {posts.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="text-muted-foreground">Noch keine Posts in diesem Channel</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {posts.map((post) => (
                <PostItem
                  key={post.id}
                  post={post}
                  userId={userId}
                  channelId={channel.id}
                  isMod={isMod}
                  onDelete={handleDeletePost}
                />
              ))}
            </div>
          )}
        </div>

        {/* Members Sidebar */}
        <div className="lg:col-span-1">
          <div className="glass rounded-xl p-4">
            <h3 className="font-semibold text-foreground mb-3 text-sm">Mitglieder ({displayMembers.length})</h3>
            <div className="flex flex-col gap-2">
              {displayMembers.map((member) => {
                const isBot = member.role === "bot"
                return (
                  <Link
                    key={member.user_id}
                    href={isBot ? `/bots/${member.user_id}` : `/profile/${member.user_id}`}
                    className="flex items-center gap-2 rounded-lg p-2 hover:bg-secondary/30 transition-colors"
                  >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={member.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="bg-secondary text-foreground text-[10px]">
                      {member.profiles?.username?.charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{member.profiles?.display_name || member.profiles?.username}</p>
                    {member.role !== "member" && (
                      <p className="text-[10px] text-primary capitalize">{member.role}</p>
                    )}
                  </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
        <DialogContent className="glass border-border/50">
          <DialogHeader>
            <DialogTitle className="text-foreground">Channel werben</DialogTitle>
            <DialogDescription>
              Waehle ein Paket, um deinen Channel im Discover-Bereich weiter oben zu platzieren.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/20 px-3 py-2">
              <span className="text-xs text-muted-foreground">Dein XP</span>
              <span className="text-sm font-semibold text-foreground">{profileXp ?? "-"}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {channelBoostPackages.map((boostPackage) => {
                const hasEnoughXp = profileXp === null || profileXp >= boostPackage.cost
                return (
                  <Button
                    key={boostPackage.key}
                    variant="outline"
                    className="bg-transparent border-border/50 text-foreground h-auto py-2"
                    disabled={isPromotingChannel || hasPendingPromotionRequest || !hasEnoughXp}
                    onClick={() => handlePromoteChannel(boostPackage.key, boostPackage.label)}
                  >
                    <div className="text-left leading-tight">
                      <p className="text-xs font-semibold">{boostPackage.label}</p>
                      <p className="text-[11px] text-muted-foreground">{boostPackage.cost} XP</p>
                    </div>
                  </Button>
                )
              })}
            </div>
            {boostedUntilLabel && (
              <p className="text-xs text-muted-foreground">
                {isBoostActive ? "Werbung aktiv bis: " : "Letzte Werbung lief bis: "}
                <span className="text-foreground" suppressHydrationWarning>{boostedUntilLabel}</span>
              </p>
            )}
            {hasPendingPromotionRequest && (
              <p className="text-xs text-amber-400">
                Offene Werbeanfrage wartet auf Admin/Owner-Freigabe.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPromoteDialog(false)}
              className="bg-transparent border-border/50"
            >
              Schliessen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteChannelDialog} onOpenChange={setShowDeleteChannelDialog}>
        <DialogContent className="glass border-border/50">
          <DialogHeader>
            <DialogTitle className="text-foreground">Channel löschen</DialogTitle>
            <DialogDescription>
              Gib zur Bestätigung den Channel-Namen ein: <span className="font-semibold text-foreground">{channelName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Label htmlFor="delete-channel-confirm">Channel-Name</Label>
            <Input
              id="delete-channel-confirm"
              value={deleteChannelConfirmation}
              onChange={(e) => setDeleteChannelConfirmation(e.target.value)}
              placeholder={channelName}
              className="bg-secondary/30 border-border/50"
            />
            <p className="text-xs text-muted-foreground">
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteChannelDialog(false)}
              className="bg-transparent border-border/50"
              disabled={isDeletingChannel}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteChannel}
              disabled={isDeletingChannel || deleteChannelConfirmation.trim().length === 0}
            >
              {isDeletingChannel ? "Löschen..." : "Channel endgültig löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Channel Report Dialog */}
      <Dialog open={showChannelReportDialog} onOpenChange={setShowChannelReportDialog}>
        <DialogContent className="glass border-border/50">
          <DialogHeader>
            <DialogTitle className="text-foreground">Channel melden</DialogTitle>
            <DialogDescription>
              Melde diesen Channel wegen unangemessenem Inhalt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Grund der Meldung</Label>
              <select 
                value={channelReportReason} 
                onChange={(e) => setChannelReportReason(e.target.value)}
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
                value={channelReportDetails}
                onChange={(e) => setChannelReportDetails(e.target.value)}
                placeholder="Beschreibe das Problem genauer..."
                className="min-h-[80px] bg-secondary/30 border-border/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChannelReportDialog(false)} className="bg-transparent border-border/50">
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleReport} disabled={!channelReportReason}>
              Melden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
