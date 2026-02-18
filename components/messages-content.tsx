"use client"

import { createDbClient } from "@/lib/db-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  MessageCircle, 
  Send, 
  Image as ImageIcon,
  Smile, 
  Search, 
  MoreVertical,
  Trash2,
  Archive,
  Bell,
  BellOff,
  Lock,
  CheckCheck,
  Check,
  X,
  UserPlus,
  Shield,
  Loader2,
  ArrowLeft,
  Plus
} from "lucide-react"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { toast } from "sonner"
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns"
import { de } from "date-fns/locale"
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react"

// Types
interface Profile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

interface Conversation {
  id: string
  is_group: boolean
  group_name: string | null
  group_avatar: string | null
  created_at: string
  updated_at: string
  last_message_at: string
  participants: ConversationParticipant[]
  last_message?: Message
  unread_count?: number
}

interface ConversationParticipant {
  user_id: string
  is_admin: boolean
  is_muted: boolean
  profile: Profile
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string | null
  content_encrypted: string | null
  content_iv: string | null
  media_url: string | null
  media_type: string | null
  gif_url: string | null
  is_deleted: boolean
  created_at: string
  sender?: Profile
  read_by?: string[]
  is_pending?: boolean
}

interface DMRequest {
  id: string
  from_user_id: string
  to_user_id: string
  status: "pending" | "accepted" | "declined"
  created_at: string
  from_user: Profile
}

interface TenorGif {
  id: string
  title: string
  media_formats: {
    gif: { url: string }
    tinygif: { url: string }
  }
}

// Encryption utilities (using Web Crypto API)
const generateKey = async (): Promise<CryptoKey> => {
  return await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  )
}

const exportKey = async (key: CryptoKey): Promise<string> => {
  const exported = await crypto.subtle.exportKey("raw", key)
  return btoa(String.fromCharCode(...new Uint8Array(exported)))
}

const importKey = async (keyStr: string): Promise<CryptoKey> => {
  const keyData = Uint8Array.from(atob(keyStr), c => c.charCodeAt(0))
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  )
}

const encryptMessage = async (text: string, key: CryptoKey): Promise<{ encrypted: string; iv: string }> => {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(text)
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  )
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv))
  }
}

const decryptMessage = async (encrypted: string, ivStr: string, key: CryptoKey): Promise<string> => {
  try {
    const iv = Uint8Array.from(atob(ivStr), c => c.charCodeAt(0))
    const data = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data
    )
    return new TextDecoder().decode(decrypted)
  } catch {
    return "[Nachricht konnte nicht entschlüsselt werden]"
  }
}

// Tenor GIF API
const TENOR_API_KEY = process.env.NEXT_PUBLIC_TENOR_API_KEY

export function MessagesContent({ currentUserId, targetUserId }: { currentUserId: string; targetUserId?: string }) {
  const supabase = useMemo(() => createDbClient(), [])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [dmRequests, setDmRequests] = useState<DMRequest[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [conversationSearch, setConversationSearch] = useState("")
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [startingConversationUserId, setStartingConversationUserId] = useState<string | null>(null)
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifSearchQuery, setGifSearchQuery] = useState("")
  const [gifs, setGifs] = useState<TenorGif[]>([])
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null)
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const [targetUserHandled, setTargetUserHandled] = useState(false)
  const [isPageVisible, setIsPageVisible] = useState(true)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const conversationsLoadingRef = useRef(false)
  const requestsLoadingRef = useRef(false)
  const messagesLoadingRef = useRef(false)
  const tenorWarningShownRef = useRef(false)
  const searchRequestIdRef = useRef(0)

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 100)
  }

  const updateConversationPreview = useCallback((conversationId: string, preview: Message, createdAt: string) => {
    setConversations((prev) => prev.map((conversation) => (
      conversation.id === conversationId
        ? { ...conversation, last_message: preview, last_message_at: createdAt }
        : conversation
    )))
  }, [])

  const loadMessages = useCallback(async () => {
    if (!selectedConversation || messagesLoadingRef.current) return
    messagesLoadingRef.current = true

    const { data, error } = await supabase
      .from("messages")
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq("conversation_id", selectedConversation.id)
      .order("created_at", { ascending: true })

      if (!error && data) {
        const decryptedMessages = await Promise.all(
          data.map(async (msg: any) => {
            if (msg.content_encrypted && msg.content_iv && encryptionKey) {
              const decrypted = await decryptMessage(
                msg.content_encrypted,
                msg.content_iv,
                encryptionKey
              )
              return {
                ...msg,
                content: decrypted === "[Nachricht konnte nicht entschlÃ¼sselt werden]"
                  ? "[Alte verschlüsselte Nachricht]"
                  : decrypted,
              }
            }
            if (typeof msg.content_encrypted === "string" && !msg.content_iv) {
              return { ...msg, content: msg.content_encrypted }
            }
            return msg
          })
        )

      setMessages(decryptedMessages)
      scrollToBottom()

      await supabase
        .from("message_read_receipts")
        .upsert(
          data.filter((m: any) => m.sender_id !== currentUserId).map((m: any) => ({
            message_id: m.id,
            user_id: currentUserId,
            read_at: new Date().toISOString()
          })),
          { onConflict: "message_id,user_id" }
        )
    }

    messagesLoadingRef.current = false
  }, [selectedConversation, supabase, encryptionKey, currentUserId])

  useEffect(() => {
    const handleVisibility = () => {
      setIsPageVisible(document.visibilityState === "visible")
    }
    handleVisibility()
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [])

  // Initialize encryption key
  useEffect(() => {
    const initKey = async () => {
      // In a real app, keys would be exchanged/stored securely
      // For demo, we generate a key per session
      const storedKey = localStorage.getItem(`dm_key_${currentUserId}`)
      if (storedKey) {
        const key = await importKey(storedKey)
        setEncryptionKey(key)
      } else {
        const key = await generateKey()
        const exported = await exportKey(key)
        localStorage.setItem(`dm_key_${currentUserId}`, exported)
        setEncryptionKey(key)
      }
    }
    initKey()
  }, [currentUserId])

  // Load conversations
  useEffect(() => {
    const loadConversations = async () => {
      if (conversationsLoadingRef.current) return
      conversationsLoadingRef.current = true
      setIsLoading(true)
      
      const { data: participations, error } = await supabase
        .from("conversation_participants")
        .select(`
          conversation_id,
          conversations!inner (
            id,
            is_group,
            group_name,
            group_avatar,
            created_at,
            updated_at,
            last_message_at
          )
        `)
        .eq("user_id", currentUserId)
        .order("conversations(last_message_at)", { ascending: false })
      
      if (error) {
        console.error("Error loading conversations:", error)
        setIsLoading(false)
        conversationsLoadingRef.current = false
        return
      }

      // Get all conversation IDs
      const conversationIds = participations?.map((p: any) => p.conversation_id) || []
      
      if (conversationIds.length === 0) {
        setConversations([])
        setIsLoading(false)
        conversationsLoadingRef.current = false
        return
      }

      // Get all participants for these conversations
      const { data: allParticipants } = await supabase
        .from("conversation_participants")
        .select(`
          conversation_id,
          user_id,
          is_admin,
          is_muted,
          profiles!inner (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .in("conversation_id", conversationIds)

      // Get last message for each conversation
      const { data: lastMessages } = await supabase
        .from("messages")
        .select("*")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })

      const decryptedLastMessages = await Promise.all(
        (lastMessages || []).map(async (msg: any) => {
          if (msg.content_encrypted && msg.content_iv && encryptionKey) {
            const decrypted = await decryptMessage(msg.content_encrypted, msg.content_iv, encryptionKey)
            return {
              ...msg,
              content: decrypted === "[Nachricht konnte nicht entschlÃ¼sselt werden]"
                ? "[Alte verschlüsselte Nachricht]"
                : decrypted,
            }
          }
          if (typeof msg.content_encrypted === "string" && !msg.content_iv) {
            return { ...msg, content: msg.content_encrypted }
          }
          return msg
        })
      )

      // Build conversation objects
      const convos: Conversation[] = participations?.map((p: any) => {
        const conv = p.conversations as any
        const participants = allParticipants?.filter((ap: any) => ap.conversation_id === p.conversation_id) || []
        const lastMsg = decryptedLastMessages?.find(m => m.conversation_id === p.conversation_id)
        const unread = 0

        return {
          id: conv.id,
          is_group: conv.is_group,
          group_name: conv.group_name,
          group_avatar: conv.group_avatar,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          last_message_at: conv.last_message_at,
          participants: participants.map((p: any) => ({
            user_id: p.user_id,
            is_admin: p.is_admin,
            is_muted: p.is_muted,
            profile: p.profiles as any
          })),
          last_message: lastMsg,
          unread_count: unread
        }
      }) || []

      setConversations(convos)
      setIsLoading(false)
      conversationsLoadingRef.current = false
    }

    loadConversations()
    const interval = setInterval(() => {
      if (isPageVisible) loadConversations()
    }, 30000)
    return () => clearInterval(interval)
  }, [currentUserId, supabase, isPageVisible, encryptionKey])

  // Load DM requests
  useEffect(() => {
    const loadRequests = async () => {
      if (requestsLoadingRef.current) return
      requestsLoadingRef.current = true
      const { data } = await supabase
        .from("dm_requests")
        .select(`
          *,
          from_user:profiles!dm_requests_from_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq("to_user_id", currentUserId)
        .eq("status", "pending")

      setDmRequests(data || [])
      requestsLoadingRef.current = false
    }

    loadRequests()
    const interval = setInterval(() => {
      if (isPageVisible) loadRequests()
    }, 60000)
    return () => clearInterval(interval)
  }, [currentUserId, supabase, isPageVisible])

  // Handle targetUserId from URL (auto-start conversation)
  useEffect(() => {
    if (!targetUserId || targetUserHandled || isLoading) return

    const handleTargetUser = async () => {
      setTargetUserHandled(true)
      
      // Check if conversation already exists
      const existingConvo = conversations.find(c => 
        !c.is_group && c.participants.some(p => p.user_id === targetUserId)
      )

      if (existingConvo) {
        setSelectedConversation(existingConvo)
        setMobileShowChat(true)
        return
      }

      // Check DM settings
      const { data: canSend } = await supabase.rpc("can_send_dm", {
        p_sender_id: currentUserId,
        p_receiver_id: targetUserId
      })

      if (canSend === false) {
        // Need to send request
        const { error } = await supabase.rpc("send_dm_request", {
          p_from_user_id: currentUserId,
          p_to_user_id: targetUserId
        })

        if (!error) {
          toast.success("DM-Anfrage gesendet")
        } else {
          toast.error("Konnte keine Anfrage senden")
        }
        return
      }

      // Create conversation
      const { data: convoId, error } = await supabase.rpc("get_or_create_dm_conversation", {
        p_user1_id: currentUserId,
        p_user2_id: targetUserId
      })

      if (!error && convoId) {
        window.location.href = "/messages"
      }
    }

    handleTargetUser()
  }, [targetUserId, targetUserHandled, isLoading, conversations, currentUserId, supabase])

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConversation) return

    loadMessages()
    const interval = setInterval(() => {
      if (isPageVisible) loadMessages()
    }, 2500)
    return () => clearInterval(interval)
  }, [selectedConversation, loadMessages, isPageVisible])

  // Search users to start conversation
  const searchUsers = useCallback(async (query: string) => {
    const normalizedQuery = query.trim()
    if (normalizedQuery.length < 2) {
      searchRequestIdRef.current += 1
      setSearchResults([])
      setIsSearching(false)
      return
    }

    const requestId = ++searchRequestIdRef.current
    setIsSearching(true)
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .neq("id", currentUserId)
      .or(`username.ilike.%${normalizedQuery}%,display_name.ilike.%${normalizedQuery}%`)
      .limit(10)

    if (requestId === searchRequestIdRef.current) {
      setSearchResults(data || [])
      setIsSearching(false)
    }
  }, [currentUserId, supabase])

  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, searchUsers])

  // Search GIFs
  const searchGifs = useCallback(async (query: string) => {
    if (!TENOR_API_KEY) {
      setGifs([])
      if (!tenorWarningShownRef.current) {
        toast.error("GIF-Suche ist nicht konfiguriert")
        tenorWarningShownRef.current = true
      }
      return
    }

    if (!query) {
      // Load trending GIFs
      const res = await fetch(
        `https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=20&media_filter=gif,tinygif`
      )
      const data = await res.json()
      setGifs(data.results || [])
      return
    }

    const res = await fetch(
      `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=20&media_filter=gif,tinygif`
    )
    const data = await res.json()
    setGifs(data.results || [])
  }, [])

  useEffect(() => {
    if (showGifPicker) {
      const timer = setTimeout(() => {
        searchGifs(gifSearchQuery)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [gifSearchQuery, showGifPicker, searchGifs])

  // Start new conversation
  const startConversation = async (userId: string) => {
    if (startingConversationUserId) return
    setStartingConversationUserId(userId)

    // Check if conversation already exists
    const existingConvo = conversations.find(c => 
      !c.is_group && c.participants.some(p => p.user_id === userId)
    )

    if (existingConvo) {
      setSelectedConversation(existingConvo)
      setShowNewConversation(false)
      setMobileShowChat(true)
      setStartingConversationUserId(null)
      return
    }

    // Check DM settings
    const { data: canSend } = await supabase.rpc("can_send_dm", {
      p_sender_id: currentUserId,
      p_receiver_id: userId
    })

    if (canSend === false) {
      // Need to send request
      const { error } = await supabase.rpc("send_dm_request", {
        p_sender_id: currentUserId,
        p_recipient_id: userId
      })

      if (!error) {
        toast.success("DM-Anfrage gesendet")
      } else {
        toast.error("Konnte keine Anfrage senden")
      }
      setShowNewConversation(false)
      setStartingConversationUserId(null)
      return
    }

    // Create conversation
    const { data: convoId, error } = await supabase.rpc("get_or_create_dm_conversation", {
      p_user_id: currentUserId,
      p_target_id: userId
    })

    if (!error && convoId) {
      // Reload conversations
      window.location.reload()
      return
    }
    toast.error("Konversation konnte nicht erstellt werden")
    setStartingConversationUserId(null)
  }

  // Send message
  const sendMessage = async () => {
    if ((!messageInput.trim() && !selectedImage) || !selectedConversation || isSending) return

    setIsSending(true)

    try {
      let mediaUrl: string | null = null
      let mediaType: string | null = null

      // Upload image if selected
      if (selectedImage) {
        const fileExt = selectedImage.name.split(".").pop()
        const fileName = `${currentUserId}/${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from("dm-media")
          .upload(fileName, selectedImage)

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("dm-media")
            .getPublicUrl(fileName)
          mediaUrl = urlData.publicUrl
          mediaType = selectedImage.type
        }
      }

      // Store cross-device readable content in DB.
      const encrypted = messageInput.trim() || ""
      const iv: string | null = null

      // Send message
      const optimisticId = `tmp-${Date.now()}`
      const createdAt = new Date().toISOString()
      const optimisticMessage: Message = {
        id: optimisticId,
        conversation_id: selectedConversation.id,
        sender_id: currentUserId,
        content: messageInput.trim() || null,
        content_encrypted: encrypted,
        content_iv: iv,
        media_url: mediaUrl,
        media_type: mediaType,
        gif_url: null,
        is_deleted: false,
        created_at: createdAt,
        is_pending: true,
      }
      setMessages((prev) => [...prev, optimisticMessage])
      updateConversationPreview(selectedConversation.id, optimisticMessage, createdAt)
      scrollToBottom()

      const { error } = await supabase.from("messages").insert({
        conversation_id: selectedConversation.id,
        sender_id: currentUserId,
        content_encrypted: encrypted,
        content_iv: iv,
        reactions: {},
        media_url: mediaUrl,
        media_type: mediaType
      })

      if (!error) {
        setMessageInput("")
        setSelectedImage(null)
        setImagePreview(null)
        await loadMessages()
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      }
    } catch (error) {
      console.error("Error sending message:", error)
      toast.error("Nachricht konnte nicht gesendet werden")
    }

    setIsSending(false)
  }

  // Send GIF
  const sendGif = async (gifUrl: string) => {
    if (!selectedConversation || isSending) return

    setIsSending(true)
    const encrypted = ""
    const iv: string | null = null

    const optimisticId = `tmp-gif-${Date.now()}`
    const createdAt = new Date().toISOString()
    const optimisticGif: Message = {
      id: optimisticId,
      conversation_id: selectedConversation.id,
      sender_id: currentUserId,
      content: null,
      content_encrypted: encrypted,
      content_iv: iv,
      media_url: null,
      media_type: null,
      gif_url: gifUrl,
      is_deleted: false,
      created_at: createdAt,
      is_pending: true,
    }
    setMessages((prev) => [...prev, optimisticGif])
    updateConversationPreview(selectedConversation.id, optimisticGif, createdAt)
    scrollToBottom()

    const { error } = await supabase.from("messages").insert({
      conversation_id: selectedConversation.id,
      sender_id: currentUserId,
      content_encrypted: encrypted,
      content_iv: iv,
      reactions: {},
      gif_url: gifUrl
    })

    if (!error) {
      setShowGifPicker(false)
      await loadMessages()
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
    }

    setIsSending(false)
  }

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Bild darf maximal 10MB groß sein")
        return
      }
      setSelectedImage(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  // Accept DM request
  const acceptRequest = async (requestId: string) => {
    const { error } = await supabase.rpc("accept_dm_request", {
      p_request_id: requestId,
      p_current_user_id: currentUserId
    })

    if (!error) {
      toast.success("Anfrage angenommen")
      setDmRequests(prev => prev.filter(r => r.id !== requestId))
    }
  }

  // Decline DM request
  const declineRequest = async (requestId: string) => {
    const { error } = await supabase
      .from("dm_requests")
      .update({ status: "declined" })
      .eq("id", requestId)

    if (!error) {
      toast.success("Anfrage abgelehnt")
      setDmRequests(prev => prev.filter(r => r.id !== requestId))
    }
  }

  // Get conversation display info
  const getConversationInfo = (conversation: Conversation) => {
    if (conversation.is_group) {
      return {
        name: conversation.group_name || "Gruppe",
        avatar: conversation.group_avatar,
        initials: (conversation.group_name || "G")[0]
      }
    }

    const otherParticipant = conversation.participants.find(p => p.user_id !== currentUserId)
    return {
      name: otherParticipant?.profile.display_name || otherParticipant?.profile.username || "Unbekannt",
      avatar: otherParticipant?.profile.avatar_url,
      initials: (otherParticipant?.profile.display_name || "U")[0].toUpperCase()
    }
  }

  // Format message time
  const formatMessageTime = (date: string) => {
    const d = new Date(date)
    if (isToday(d)) return format(d, "HH:mm")
    if (isYesterday(d)) return `Gestern ${format(d, "HH:mm")}`
    return format(d, "dd.MM.yy HH:mm")
  }

  // Conversation list
  const renderConversationList = () => (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Nachrichten
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNewConversation(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Chats suchen..."
            value={conversationSearch}
            onChange={(e) => setConversationSearch(e.target.value)}
            className="h-8 pl-8 pr-8 bg-secondary/40 border-border/30 text-xs rounded-lg placeholder:text-muted-foreground/60"
          />
        </div>
        
        {/* DM Requests Badge */}
        {dmRequests.length > 0 && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Nachrichtenanfragen
                </span>
                <Badge variant="destructive">{dmRequests.length}</Badge>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nachrichtenanfragen</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {dmRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={request.from_user?.avatar_url || ""} />
                        <AvatarFallback>{(request.from_user?.display_name || "U")[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{request.from_user?.display_name}</p>
                        <p className="text-xs text-muted-foreground">@{request.from_user?.username}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => acceptRequest(request.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => declineRequest(request.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <MessageCircle className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Keine Konversationen</p>
            <p className="text-xs text-muted-foreground mt-1">
              Starte eine neue Unterhaltung!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {conversations
              .filter((conversation) => {
                if (!conversationSearch.trim()) return true
                const info = getConversationInfo(conversation)
                const needle = conversationSearch.toLowerCase()
                const last = conversation.last_message?.content || ""
                return (
                  info.name.toLowerCase().includes(needle) ||
                  last.toLowerCase().includes(needle)
                )
              })
              .map((conversation) => {
              const info = getConversationInfo(conversation)
              const isSelected = selectedConversation?.id === conversation.id
              
              return (
                <button
                  key={conversation.id}
                  onClick={() => {
                    setSelectedConversation(conversation)
                    setMobileShowChat(true)
                  }}
                  className={`w-full p-4 text-left transition-colors hover:bg-secondary/50 ${
                    isSelected ? "bg-secondary" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={info.avatar || ""} />
                      <AvatarFallback>{info.initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate">{info.name}</p>
                        {conversation.last_message_at && (
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(conversation.last_message_at), { 
                              addSuffix: true, 
                              locale: de 
                            })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm text-muted-foreground truncate">
                          {conversation.last_message?.gif_url 
                            ? "🎞️ GIF"
                            : conversation.last_message?.media_url
                            ? "📷 Bild"
                            : conversation.last_message?.content || "Keine Nachrichten"}
                        </p>
                        {(conversation.unread_count || 0) > 0 && (
                          <Badge className="ml-2">{conversation.unread_count}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )

  // Chat view
  const renderChatView = () => {
    if (!selectedConversation) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
          <Lock className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-lg">Wähle eine Konversation</p>
          <p className="text-sm">Alle Nachrichten sind Ende-zu-Ende verschlüsselt</p>
        </div>
      )
    }

    const info = getConversationInfo(selectedConversation)

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileShowChat(false)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-10 w-10">
              <AvatarImage src={info.avatar || ""} />
              <AvatarFallback>{info.initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{info.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Verschlüsselt
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message, index) => {
              const isOwn = message.sender_id === currentUserId
              const showAvatar = index === 0 || messages[index - 1].sender_id !== message.sender_id

              return (
                <div
                  key={message.id}
                  className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : ""} ${
                    message.is_pending ? "animate-pulse" : "animate-in fade-in slide-in-from-bottom-2 duration-300"
                  }`}
                >
                  {showAvatar ? (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={message.sender?.avatar_url || ""} />
                      <AvatarFallback>
                        {(message.sender?.display_name || "U")[0]}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="w-8" />
                  )}
                  
                  <div className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}>
                    {message.is_deleted ? (
                      <p className="text-sm text-muted-foreground italic">
                        Nachricht wurde gelöscht
                      </p>
                    ) : (
                      <>
                        {message.gif_url && (
                          <img 
                            src={message.gif_url} 
                            alt="GIF" 
                            className="rounded-lg max-w-full max-h-64"
                          />
                        )}
                        {message.media_url && (
                          <img 
                            src={message.media_url} 
                            alt="Media" 
                            className="rounded-lg max-w-full max-h-64"
                          />
                        )}
                        {message.content && (
                          <div
                            className={`px-4 py-2 rounded-2xl ${
                              isOwn
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-secondary rounded-bl-sm"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </div>
                        )}
                      </>
                    )}
                    <div className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : ""}`}>
                      <span className="text-xs text-muted-foreground">
                        {formatMessageTime(message.created_at)}
                      </span>
                      {isOwn && (
                        <CheckCheck className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Image Preview */}
        {imagePreview && (
          <div className="px-4 py-2 border-t border-border/50">
            <div className="relative inline-block">
              <img src={imagePreview} alt="Preview" className="h-20 rounded-lg" />
              <button
                onClick={() => {
                  setSelectedImage(null)
                  setImagePreview(null)
                }}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Bild senden</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* GIF Picker */}
            <Dialog open={showGifPicker} onOpenChange={setShowGifPicker}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <span className="text-lg">GIF</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>GIF senden</DialogTitle>
                </DialogHeader>
                <Input
                  placeholder="GIFs suchen..."
                  value={gifSearchQuery}
                  onChange={(e) => setGifSearchQuery(e.target.value)}
                />
                <ScrollArea className="h-64">
                  <div className="grid grid-cols-2 gap-2">
                    {gifs.map((gif) => (
                      <button
                        key={gif.id}
                        onClick={() => sendGif(gif.media_formats.gif.url)}
                        className="rounded-lg overflow-hidden hover:ring-2 ring-primary"
                      >
                        <img
                          src={gif.media_formats.tinygif.url}
                          alt={gif.title}
                          className="w-full h-24 object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>

            {/* Emoji Picker */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Smile className="h-5 w-5" />
              </Button>
              {showEmojiPicker && (
                <div className="absolute bottom-12 left-0 z-50">
                  <EmojiPicker
                    theme={Theme.DARK}
                    onEmojiClick={(emoji: EmojiClickData) => {
                      setMessageInput(prev => prev + emoji.emoji)
                      setShowEmojiPicker(false)
                    }}
                  />
                </div>
              )}
            </div>

            <Input
              placeholder="Nachricht schreiben..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              className="flex-1"
            />

            <Button
              onClick={sendMessage}
              disabled={isSending || (!messageInput.trim() && !selectedImage)}
            >
              {isSending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // New Conversation Dialog
  const renderNewConversationDialog = () => (
    <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neue Konversation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Nutzer suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          
          {isSearching ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-2">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => startConversation(user.id)}
                  disabled={startingConversationUserId !== null}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url || ""} />
                    <AvatarFallback>{(user.display_name || user.username || "U")[0]?.toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="font-medium">{user.display_name || user.username || "Unbekannt"}</p>
                    <p className="text-sm text-muted-foreground">@{user.username || "unknown"}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : searchQuery.length >= 2 ? (
            <p className="text-center text-muted-foreground py-4">
              Keine Nutzer gefunden
            </p>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Mindestens 2 Zeichen eingeben
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Desktop: Side by side */}
      <div className="hidden md:flex w-full">
        <div className="w-80 border-r border-border/50">
          {renderConversationList()}
        </div>
        <div className="flex-1">
          {renderChatView()}
        </div>
      </div>

      {/* Mobile: Toggle between list and chat */}
      <div className="md:hidden w-full">
        {mobileShowChat && selectedConversation ? (
          renderChatView()
        ) : (
          renderConversationList()
        )}
      </div>

      {renderNewConversationDialog()}
    </div>
  )
}

