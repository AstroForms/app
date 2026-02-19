"use client"

import { createDbClient } from "@/lib/db-client"
import { useState, useRef, useEffect, useCallback, forwardRef } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Hash, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface Hashtag {
  id: string
  name: string
  usage_count: number
}

interface HashtagInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
  maxLength?: number
}

export const HashtagInput = forwardRef<HTMLTextAreaElement, HashtagInputProps>(
  ({ value, onChange, placeholder = "Schreibe etwas...", className, minHeight = "80px", maxLength }, ref) => {
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [suggestions, setSuggestions] = useState<Hashtag[]>([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [hashtagStart, setHashtagStart] = useState<number | null>(null)
    const [currentHashtag, setCurrentHashtag] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)

    // Search for hashtags
    const searchHashtags = useCallback(async (query: string) => {
      if (!query || query.length < 1) {
        setSuggestions([])
        return
      }

      setIsLoading(true)
      const supabase = createDbClient()

      const { data, error } = await supabase.rpc("search_hashtags", {
        p_query: query,
        p_limit: 8,
      })

      if (!error && data) {
        setSuggestions(data)
      } else {
        // Fallback to direct query if RPC doesn't exist yet
        const { data: fallbackData } = await supabase
          .from("hashtags")
          .select("id, name, usage_count")
          .ilike("name", `${query}%`)
          .order("usage_count", { ascending: false })
          .limit(8)

        setSuggestions(fallbackData || [])
      }
      setIsLoading(false)
    }, [])

    // Load top hashtags when # is typed without search query
    const loadTopHashtags = useCallback(async () => {
      setIsLoading(true)
      const supabase = createDbClient()

      const { data } = await supabase
        .from("hashtags")
        .select("id, name, usage_count")
        .order("usage_count", { ascending: false })
        .limit(10)

      setSuggestions(data || [])
      setIsLoading(false)
    }, [])

    // Handle text input changes
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      const cursorPos = e.target.selectionStart || 0
      onChange(newValue)

      // Find if we're currently typing a hashtag
      const textBeforeCursor = newValue.slice(0, cursorPos)
      const hashMatch = textBeforeCursor.match(/#([a-zA-Z0-9_äöüß]*)$/)

      if (hashMatch) {
        const startPos = cursorPos - hashMatch[0].length
        setHashtagStart(startPos)
        setCurrentHashtag(hashMatch[1])
        setShowSuggestions(true)
        setSelectedIndex(0)

        if (hashMatch[1].length > 0) {
          searchHashtags(hashMatch[1])
        } else {
          loadTopHashtags()
        }
      } else {
        setShowSuggestions(false)
        setHashtagStart(null)
        setCurrentHashtag("")
      }
    }

    // Handle suggestion selection
    const selectSuggestion = (hashtag: Hashtag) => {
      if (hashtagStart === null) return

      const beforeHashtag = value.slice(0, hashtagStart)
      const afterCursor = value.slice(hashtagStart + currentHashtag.length + 1)
      const newValue = `${beforeHashtag}#${hashtag.name} ${afterCursor}`

      onChange(newValue)
      setShowSuggestions(false)
      setHashtagStart(null)
      setCurrentHashtag("")

      // Focus back on textarea
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = hashtagStart + hashtag.name.length + 2
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
        }
      }, 0)
    }

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showSuggestions || suggestions.length === 0) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex((i) => (i + 1) % suggestions.length)
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex((i) => (i - 1 + suggestions.length) % suggestions.length)
          break
        case "Enter":
          if (showSuggestions && suggestions[selectedIndex]) {
            e.preventDefault()
            selectSuggestion(suggestions[selectedIndex])
          }
          break
        case "Tab":
          if (showSuggestions && suggestions[selectedIndex]) {
            e.preventDefault()
            selectSuggestion(suggestions[selectedIndex])
          }
          break
        case "Escape":
          setShowSuggestions(false)
          break
      }
    }

    // Close suggestions when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setShowSuggestions(false)
        }
      }

      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // Combine refs
    const setRefs = useCallback(
      (element: HTMLTextAreaElement | null) => {
        textareaRef.current = element
        if (typeof ref === "function") {
          ref(element)
        } else if (ref) {
          ref.current = element
        }
      },
      [ref]
    )

    return (
      <div ref={containerRef} className="relative">
        <Textarea
          ref={setRefs}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          className={cn("resize-none", className)}
          style={{ minHeight }}
        />

        {/* Hashtag Suggestions Dropdown */}
        {showSuggestions && (
          <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-lg border border-border/50 bg-popover/95 backdrop-blur-xl shadow-lg">
            {isLoading ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Lade...
              </div>
            ) : suggestions.length > 0 ? (
              <>
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border/30 flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3" />
                  {currentHashtag ? "Vorschläge" : "Beliebte Hashtags"}
                </div>
                {suggestions.map((hashtag, index) => (
                  <button
                    key={hashtag.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-sm transition-colors",
                      index === selectedIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50"
                    )}
                    onClick={() => selectSuggestion(hashtag)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="flex items-center gap-2">
                      <Hash className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium">{hashtag.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {hashtag.usage_count > 0 && `${hashtag.usage_count} Posts`}
                    </span>
                  </button>
                ))}
              </>
            ) : currentHashtag.length > 0 ? (
              <div className="px-3 py-2.5">
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    selectedIndex === 0 ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  )}
                  onClick={() =>
                    selectSuggestion({ id: "new", name: currentHashtag, usage_count: 0 })
                  }
                >
                  <Hash className="h-3.5 w-3.5 text-primary" />
                  <span>
                    Neues Hashtag <span className="font-semibold">#{currentHashtag}</span> erstellen
                  </span>
                </button>
              </div>
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Tippe um zu suchen...
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
)

HashtagInput.displayName = "HashtagInput"
