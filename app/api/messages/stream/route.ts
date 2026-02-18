import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const runtime = "nodejs"

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const conversationId = url.searchParams.get("conversationId")?.trim() || ""
  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 })
  }

  const isParticipant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId },
    select: { id: true },
  })
  if (!isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const sinceRaw = url.searchParams.get("since")
  let cursor = sinceRaw ? Date.parse(sinceRaw) : 0
  if (!Number.isFinite(cursor)) cursor = 0

  const encoder = new TextEncoder()
  let interval: NodeJS.Timeout | null = null
  let heartbeat: NodeJS.Timeout | null = null
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: string, data: unknown) => {
        if (closed) return
        controller.enqueue(encoder.encode(sse(event, data)))
      }

      const close = () => {
        if (closed) return
        closed = true
        if (interval) clearInterval(interval)
        if (heartbeat) clearInterval(heartbeat)
        try {
          controller.close()
        } catch {
          // stream already closed
        }
      }

      const checkUpdates = async () => {
        try {
          const latest = await prisma.message.findFirst({
            where: { conversationId },
            select: { id: true, createdAt: true },
            orderBy: { createdAt: "desc" },
          })
          if (!latest) return
          const ts = latest.createdAt.getTime()
          if (ts > cursor) {
            cursor = ts
            emit("update", { id: latest.id, created_at: latest.createdAt.toISOString() })
          }
        } catch {
          emit("error", { message: "stream_check_failed" })
        }
      }

      emit("ready", { ok: true })
      void checkUpdates()
      interval = setInterval(() => {
        void checkUpdates()
      }, 1000)
      heartbeat = setInterval(() => {
        emit("ping", { t: Date.now() })
      }, 25000)

      req.signal.addEventListener("abort", close)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

