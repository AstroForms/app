import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
import { BOT_RELATED_TABLES, ensureBotInfrastructure } from "@/lib/bot-infrastructure"
import { onChannelMemberCreated, onChannelMemberDeleted } from "@/lib/channel-members"

type QueryFilter = {
  column: string
  op: "eq" | "neq" | "in" | "ilike" | "or"
  value: unknown
}

function toCamel(input: string) {
  return input.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function toSnake(input: string) {
  return input.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

const enumInputOverrides: Record<string, Record<string, Record<string, string>>> = {
  dm_requests: {
    status: {
      declined: "REJECTED",
    },
  },
}

const enumOutputOverrides: Record<string, Record<string, Record<string, string>>> = {
  dm_requests: {
    status: {
      REJECTED: "declined",
    },
  },
}

const enumInputUppercaseColumns: Record<string, Set<string>> = {
  follow_requests: new Set(["status"]),
  dm_requests: new Set(["status"]),
  bot_channel_invites: new Set(["status"]),
  bot_verification_requests: new Set(["status"]),
  reports: new Set(["status", "target_type", "reason"]),
  channel_members: new Set(["role"]),
  conversation_participants: new Set(["role"]),
  profiles: new Set(["dm_privacy"]),
  messages: new Set(["message_type"]),
  scheduled_tasks: new Set(["schedule_type"]),
}

const enumOutputLowercaseColumns: Record<string, Set<string>> = {
  follow_requests: new Set(["status"]),
  dm_requests: new Set(["status"]),
  bot_channel_invites: new Set(["status"]),
  bot_verification_requests: new Set(["status"]),
  reports: new Set(["status", "target_type", "reason"]),
  channel_members: new Set(["role"]),
  conversation_participants: new Set(["role"]),
  profiles: new Set(["dm_privacy", "role"]),
  messages: new Set(["message_type"]),
  scheduled_tasks: new Set(["schedule_type"]),
}

function normalizeEnumInput(table: string, column: string, value: unknown) {
  if (typeof value !== "string") return value
  const lowerValue = value.toLowerCase()
  const override = enumInputOverrides[table]?.[column]?.[lowerValue]
  if (override) return override
  if (enumInputUppercaseColumns[table]?.has(column)) {
    return lowerValue.toUpperCase()
  }
  return value
}

function normalizeEnumOutput(table: string, column: string, value: unknown) {
  if (typeof value !== "string") return value
  const override = enumOutputOverrides[table]?.[column]?.[value]
  if (override) return override
  if (enumOutputLowercaseColumns[table]?.has(column)) {
    return value.toLowerCase()
  }
  return value
}

function parseOrExpression(table: string, expression: string) {
  const conditions = expression
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [rawColumn, op, ...rawValueParts] = part.split(".")
      const rawValue = rawValueParts.join(".")
      if (!rawColumn || !op) return null
      const field = mapFilterColumn(table, rawColumn)
      if (op === "ilike") {
        const normalized = normalizeEnumInput(table, rawColumn, rawValue.replace(/^%|%$/g, ""))
        return { [field]: { contains: normalized } }
      }
      if (op === "eq") {
        return { [field]: normalizeEnumInput(table, rawColumn, rawValue) }
      }
      return null
    })
    .filter((value): value is Record<string, unknown> => value !== null)

  return conditions.length > 0 ? conditions : null
}

function mapFilters(table: string, filters: QueryFilter[]) {
  const where: Record<string, unknown> = {}
  const orConditions: Array<Record<string, unknown>> = []

  for (const filter of filters || []) {
    if (filter.op === "eq") {
      const field = mapFilterColumn(table, filter.column)
      where[field] = normalizeEnumInput(table, filter.column, filter.value)
    } else if (filter.op === "neq") {
      const field = mapFilterColumn(table, filter.column)
      where[field] = { not: normalizeEnumInput(table, filter.column, filter.value) }
    } else if (filter.op === "in") {
      const field = mapFilterColumn(table, filter.column)
      const values = Array.isArray(filter.value)
        ? filter.value.map((value) => normalizeEnumInput(table, filter.column, value))
        : filter.value
      where[field] = { in: values }
    } else if (filter.op === "ilike") {
      const field = mapFilterColumn(table, filter.column)
      const rawValue = typeof filter.value === "string" ? filter.value : String(filter.value ?? "")
      const normalized = normalizeEnumInput(table, filter.column, rawValue.replace(/^%|%$/g, ""))
      where[field] = { contains: normalized }
    } else if (filter.op === "or" && typeof filter.value === "string") {
      const parsed = parseOrExpression(table, filter.value)
      if (parsed) orConditions.push(...parsed)
    }
  }

  if (orConditions.length > 0) {
    where.OR = orConditions
  }

  return where
}

function mapFilterColumn(table: string, column: string) {
  if (table === "dm_requests") {
    if (column === "to_user_id") return "recipientId"
    if (column === "from_user_id") return "senderId"
  }
  return toCamel(column)
}

function mapOrder(table: string, order?: { column: string; ascending: boolean }) {
  if (!order) return undefined
  if (table === "conversation_participants" && order.column === "conversations(last_message_at)") {
    return { conversation: { lastMessageAt: order.ascending ? "asc" : "desc" } }
  }
  return { [toCamel(order.column)]: order.ascending ? "asc" : "desc" }
}

function extractChannelIdsFromWhere(where: Record<string, unknown>) {
  const channelIds = new Set<string>()
  const channelFilter = where.channelId

  if (typeof channelFilter === "string") {
    channelIds.add(channelFilter)
    return Array.from(channelIds)
  }

  if (channelFilter && typeof channelFilter === "object" && "in" in channelFilter) {
    const values = (channelFilter as { in?: unknown }).in
    if (Array.isArray(values)) {
      for (const value of values) {
        if (typeof value === "string" && value.trim()) {
          channelIds.add(value)
        }
      }
    }
  }

  return Array.from(channelIds)
}

function normalizeWriteData(table: string, payload: Record<string, any>) {
  if (table === "messages" && typeof payload.gifUrl === "string" && payload.gifUrl.trim()) {
    payload.mediaUrl = payload.gifUrl.trim()
    payload.mediaType = "gif"
    delete payload.gifUrl
  }
  if (table === "posts") {
    const optionalKeys = ["imageUrl", "linkUrl", "linkTitle", "linkDescription", "linkImage", "parentPostId", "botId"]
    for (const key of optionalKeys) {
      if (payload[key] === null || payload[key] === undefined || payload[key] === "") {
        delete payload[key]
      }
    }
  }
  return payload
}

function getModel(table: string) {
  switch (table) {
    case "profiles":
      return prisma.profile
    case "channels":
      return prisma.channel
    case "channel_members":
      return prisma.channelMember
    case "posts":
      return prisma.post
    case "post_likes":
      return prisma.postLike
    case "post_saves":
      return prisma.postSave
    case "post_comments":
      return prisma.postComment
    case "reports":
      return prisma.report
    case "bots":
      return prisma.bot
    case "bot_active_rules":
      return prisma.botActiveRule
    case "bot_channel_invites":
      return prisma.botChannelInvite
    case "bot_verification_requests":
      return prisma.botVerificationRequest
    case "bot_channel_rules":
      return prisma.botChannelRule
    case "bot_execution_logs":
      return prisma.botExecutionLog
    case "bot_action_logs":
      return prisma.botActionLog
    case "scheduled_tasks":
      return prisma.scheduledTask
    case "automations":
      return prisma.botAutomation
    case "messages":
      return prisma.message
    case "conversations":
      return prisma.conversation
    case "conversation_participants":
      return prisma.conversationParticipant
    case "dm_requests":
      return prisma.dmRequest
    case "message_read_receipts":
      return prisma.messageReadReceipt
    case "blocked_users":
      return prisma.blockedUser
    case "follows":
      return prisma.follow
    case "follow_requests":
      return prisma.followRequest
    default:
      return null
  }
}

function getInclude(table: string) {
  switch (table) {
    case "posts":
      return {
        user: { select: { id: true, username: true, avatarUrl: true, displayName: true } },
        channel: { select: { id: true, name: true, isVerified: true } },
        parentPost: { include: { user: { select: { username: true } } } },
      }
    case "post_comments":
      return { user: { select: { id: true, username: true, avatarUrl: true, displayName: true } } }
    case "channel_members":
      return {
        channel: true,
        user: { select: { id: true, username: true, avatarUrl: true, displayName: true } },
      }
    case "messages":
      return { sender: { select: { id: true, username: true, avatarUrl: true, displayName: true } } }
    case "conversation_participants":
      return {
        user: { select: { id: true, username: true, avatarUrl: true, displayName: true } },
        conversation: true,
      }
    case "dm_requests":
      return {
        sender: { select: { id: true, username: true, avatarUrl: true, displayName: true } },
        recipient: { select: { id: true, username: true, avatarUrl: true, displayName: true } },
      }
    case "bot_channel_invites":
      return { channel: { select: { id: true, name: true, iconUrl: true, isVerified: true } } }
    case "bot_verification_requests":
      return {
        bot: { select: { id: true, name: true, avatarUrl: true } },
        owner: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      }
    case "automations":
      return { bot: { select: { name: true } } }
    case "bots":
      return { owner: { select: { id: true, username: true, displayName: true, avatarUrl: true } } }
    case "channels":
      return { owner: { select: { username: true } } }
    case "reports":
      return { reporter: { select: { username: true } } }
    default:
      return undefined
  }
}

function mapRecord(table: string, record: any) {
  if (!record) return record
  const output: Record<string, any> = {}
  for (const [key, value] of Object.entries(record)) {
    if (value instanceof Date) {
      output[toSnake(key)] = value.toISOString()
    } else {
      output[toSnake(key)] = normalizeEnumOutput(table, toSnake(key), value)
    }
  }

  if (table === "posts") {
    output.profiles = record.user
      ? {
          id: record.user.id,
          username: record.user.username,
          avatar_url: record.user.avatarUrl,
          display_name: record.user.displayName,
        }
      : null
    output.channels = record.channel
      ? {
          id: record.channel.id,
          name: record.channel.name,
          is_verified: record.channel.isVerified,
        }
      : null
    if (record.parentPost) {
      output.parent_post = {
        id: record.parentPost.id,
        content: record.parentPost.content,
        profiles: record.parentPost.user ? { username: record.parentPost.user.username } : null,
      }
    }
  }

  if (table === "post_comments") {
    output.profiles = record.user
      ? {
          id: record.user.id,
          username: record.user.username,
          avatar_url: record.user.avatarUrl,
          display_name: record.user.displayName,
        }
      : null
  }

  if (table === "channel_members") {
    output.channels = record.channel
      ? {
          id: record.channel.id,
          name: record.channel.name,
          description: record.channel.description,
          avatar_url: record.channel.iconUrl || null,
          banner_url: record.channel.bannerUrl || null,
          is_verified: record.channel.isVerified,
          is_public: record.channel.isPublic,
        }
      : null
    output.profiles = record.user
      ? {
          id: record.user.id,
          username: record.user.username,
          avatar_url: record.user.avatarUrl,
          display_name: record.user.displayName,
        }
      : null
  }

  if (table === "messages") {
    output.gif_url = record.mediaType === "gif" ? record.mediaUrl : null
    output.sender = record.sender
      ? {
          id: record.sender.id,
          username: record.sender.username,
          avatar_url: record.sender.avatarUrl,
          display_name: record.sender.displayName,
        }
      : null
  }

  if (table === "conversation_participants") {
    output.profiles = record.user
      ? {
          id: record.user.id,
          username: record.user.username,
          avatar_url: record.user.avatarUrl,
          display_name: record.user.displayName,
        }
      : null
    output.conversations = record.conversation
      ? {
          id: record.conversation.id,
          is_group: record.conversation.isGroup,
          group_name: record.conversation.name,
          group_avatar: record.conversation.groupAvatar,
          created_at: record.conversation.createdAt,
          updated_at: record.conversation.updatedAt,
          last_message_at: record.conversation.lastMessageAt,
        }
      : null
  }

  if (table === "dm_requests") {
    output.from_user = record.sender
      ? {
          id: record.sender.id,
          username: record.sender.username,
          avatar_url: record.sender.avatarUrl,
          display_name: record.sender.displayName,
        }
      : null
    output.to_user = record.recipient
      ? {
          id: record.recipient.id,
          username: record.recipient.username,
          avatar_url: record.recipient.avatarUrl,
          display_name: record.recipient.displayName,
        }
      : null
  }

  if (table === "bot_channel_invites") {
    output.channels = record.channel
      ? {
          id: record.channel.id,
          name: record.channel.name,
          avatar_url: record.channel.iconUrl || null,
          is_verified: record.channel.isVerified,
        }
      : null
  }

  if (table === "automations") {
    output.bots = record.bot ?? null
  }

  if (table === "bots") {
    output.profiles = record.owner
      ? {
          id: record.owner.id,
          username: record.owner.username,
          display_name: record.owner.displayName,
          avatar_url: record.owner.avatarUrl,
        }
      : null
  }

  if (table === "channels") {
    output.profiles = record.owner ? { username: record.owner.username } : null
  }

  if (table === "reports") {
    output.profiles = record.reporter ? { username: record.reporter.username } : null
  }

  return output
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const body = await req.json()
    const { table, action, filters, order, limit, count, head, single, maybeSingle, data } = body

    if (typeof table !== "string") {
      return NextResponse.json({ error: "Invalid table" }, { status: 400 })
    }

    if (BOT_RELATED_TABLES.has(table)) {
      await ensureBotInfrastructure()
    }

    const model = getModel(table)
    if (!model) {
      return NextResponse.json({ error: "Unknown table" }, { status: 400 })
    }

    if (!session?.user?.id && action !== "select") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const where = mapFilters(table, filters || [])
    const include = getInclude(table)
    const orderBy = mapOrder(table, order)

    if (action === "select") {
      if (count && head) {
        const total = await (model as any).count({ where })
        return NextResponse.json({ data: null, error: null, count: total })
      }

      if (single || maybeSingle) {
        const record = await (model as any).findFirst({ where, include, orderBy })
        return NextResponse.json({ data: record ? mapRecord(table, record) : null, error: null })
      }

      const records = await (model as any).findMany({
        where,
        include,
        orderBy,
        take: limit,
      })
      return NextResponse.json({
        data: records.map((record: any) => mapRecord(table, record)),
        error: null,
      })
    }

    const mappedData: Record<string, any> = {}
    if (data && typeof data === "object") {
      for (const [key, value] of Object.entries(data)) {
        mappedData[toCamel(key)] = normalizeEnumInput(table, key, value)
      }
    }
    normalizeWriteData(table, mappedData)

    if (action === "insert") {
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      if (table === "messages") {
        const senderId = mappedData.senderId
        const conversationId = mappedData.conversationId
        if (typeof senderId !== "string" || typeof conversationId !== "string") {
          return NextResponse.json({ error: "Invalid message payload" }, { status: 400 })
        }
        if (senderId !== session.user.id) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const participants = await prisma.conversationParticipant.findMany({
          where: { conversationId },
          select: { userId: true },
        })
        const participantIds = participants.map((participant) => participant.userId)
        if (!participantIds.includes(senderId)) {
          return NextResponse.json({ error: "Sender is not part of this conversation" }, { status: 403 })
        }

        const relationFilters = participantIds
          .filter((participantId) => participantId !== senderId)
          .flatMap((participantId) => ([
            { blockerId: senderId, blockedId: participantId },
            { blockerId: participantId, blockedId: senderId },
          ]))

        if (relationFilters.length > 0) {
          const blockedRelation = await prisma.blockedUser.findFirst({
            where: { OR: relationFilters },
            select: { id: true },
          })
          if (blockedRelation) {
            return NextResponse.json({ error: "Blocked conversation" }, { status: 403 })
          }
        }
      }

      const created = await (model as any).create({ data: mappedData, include })

      if (table === "channel_members") {
        const createdMember = created as { channelId?: string; userId?: string; role?: string | null }
        if (createdMember.channelId && createdMember.userId) {
          await onChannelMemberCreated({
            channelId: createdMember.channelId,
            userId: createdMember.userId,
            role: createdMember.role,
          })
        }
      }

      return NextResponse.json({ data: mapRecord(table, created), error: null })
    }

    if (action === "upsert") {
      const payload = data && typeof data === "object" && "values" in data ? (data as any).values : data
      if (Array.isArray(payload)) {
        const rows = payload
          .filter((row) => row && typeof row === "object")
          .map((row) =>
            normalizeWriteData(
              table,
              Object.fromEntries(
                Object.entries(row as Record<string, unknown>).map(([key, value]) => [
                  toCamel(key),
                  normalizeEnumInput(table, key, value),
                ]),
              ),
            ),
          )

        if (rows.length === 0) {
          return NextResponse.json({ data: null, error: null })
        }

        await (model as any).createMany({ data: rows, skipDuplicates: true })
        return NextResponse.json({ data: null, error: null })
      }

      if (!payload || typeof payload !== "object") {
        return NextResponse.json({ error: "Invalid upsert payload" }, { status: 400 })
      }

      const row = normalizeWriteData(
        table,
        Object.fromEntries(
          Object.entries(payload as Record<string, unknown>).map(([key, value]) => [
            toCamel(key),
            normalizeEnumInput(table, key, value),
          ]),
        ),
      )
      const created = await (model as any).create({ data: row, include })
      return NextResponse.json({ data: mapRecord(table, created), error: null })
    }

    if (action === "update") {
      await (model as any).updateMany({ where, data: mappedData })
      const updated = await (model as any).findMany({ where, include })
      return NextResponse.json({
        data: updated.map((record: any) => mapRecord(table, record)),
        error: null,
      })
    }

    if (action === "delete") {
      const channelIds = table === "channel_members" ? extractChannelIdsFromWhere(where) : []
      await (model as any).deleteMany({ where })

      if (table === "channel_members") {
        for (const channelId of channelIds) {
          await onChannelMemberDeleted(channelId)
        }
      }

      return NextResponse.json({ data: null, error: null })
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database request failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
