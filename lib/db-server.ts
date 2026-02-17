import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

type QueryFilter = {
  column: string
  op: "eq" | "in"
  value: unknown
}

type QueryState = {
  table: string
  select?: string
  filters: QueryFilter[]
  order?: { column: string; ascending: boolean }
  limit?: number
  count?: "exact"
  head?: boolean
  single?: boolean
  maybeSingle?: boolean
  action?: "select" | "insert" | "update" | "delete"
  data?: unknown
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

function mapFilters(table: string, filters: QueryFilter[]) {
  const where: Record<string, unknown> = {}
  for (const filter of filters) {
    const field = toCamel(filter.column)
    if (filter.op === "eq") {
      where[field] = normalizeEnumInput(table, filter.column, filter.value)
    } else if (filter.op === "in") {
      const values = Array.isArray(filter.value)
        ? filter.value.map((value) => normalizeEnumInput(table, filter.column, value))
        : filter.value
      where[field] = { in: values }
    }
  }
  return where
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
    case "automations":
      return prisma.botAutomation
    case "messages":
      return prisma.message
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
    case "bot_channel_invites":
      return { channel: { select: { id: true, name: true, iconUrl: true, isVerified: true } } }
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
    const snakeKey = toSnake(key)
    if (value instanceof Date) {
      output[snakeKey] = value.toISOString()
    } else {
      output[snakeKey] = normalizeEnumOutput(table, snakeKey, value)
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

class QueryBuilder {
  private state: QueryState

  constructor(table: string) {
    this.state = { table, filters: [] }
  }

  select(select = "*", options?: { count?: "exact"; head?: boolean }) {
    this.state.select = select
    if (options?.count) this.state.count = options.count
    if (options?.head) this.state.head = options.head
    if (!this.state.action) this.state.action = "select"
    return this
  }

  eq(column: string, value: unknown) {
    this.state.filters.push({ column, op: "eq", value })
    return this
  }

  in(column: string, value: unknown[]) {
    this.state.filters.push({ column, op: "in", value })
    return this
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.state.order = { column, ascending: opts?.ascending !== false }
    return this
  }

  limit(value: number) {
    this.state.limit = value
    return this
  }

  async execute(action: "select" | "insert" | "update" | "delete", data?: any) {
    const model = getModel(this.state.table)
    if (!model) return { data: null, error: "Unknown table" }
    const where = mapFilters(this.state.table, this.state.filters)
    const include = getInclude(this.state.table)
    const orderBy = this.state.order
      ? { [toCamel(this.state.order.column)]: this.state.order.ascending ? "asc" : "desc" }
      : undefined

    if (action === "select") {
      if (this.state.count && this.state.head) {
        const count = await (model as any).count({ where })
        return { data: null, error: null, count }
      }

      if (this.state.single || this.state.maybeSingle) {
        const record = await (model as any).findFirst({ where, include, orderBy })
        return { data: record ? mapRecord(this.state.table, record) : null, error: null }
      }
      const records = await (model as any).findMany({
        where,
        include,
        orderBy,
        take: this.state.limit,
      })
      return { data: records.map((record: any) => mapRecord(this.state.table, record)), error: null }
    }

    const mappedData: Record<string, any> = {}
    if (data && typeof data === "object") {
      for (const [key, value] of Object.entries(data)) {
        mappedData[toCamel(key)] = normalizeEnumInput(this.state.table, key, value)
      }
    }

    if (action === "insert") {
      const created = await (model as any).create({ data: mappedData, include })
      return { data: mapRecord(this.state.table, created), error: null }
    }

    if (action === "update") {
      await (model as any).updateMany({ where, data: mappedData })
      const updated = await (model as any).findMany({ where, include })
      return { data: updated.map((record: any) => mapRecord(this.state.table, record)), error: null }
    }

    if (action === "delete") {
      await (model as any).deleteMany({ where })
      return { data: null, error: null }
    }

    return { data: null, error: "Unsupported action" }
  }

  insert(data: any) {
    this.state.action = "insert"
    this.state.data = data
    return this
  }

  update(data: any) {
    this.state.action = "update"
    this.state.data = data
    return this
  }

  delete() {
    this.state.action = "delete"
    return this
  }

  single() {
    this.state.single = true
    const action = this.state.action || "select"
    return this.execute(action, this.state.data)
  }

  maybeSingle() {
    this.state.maybeSingle = true
    const action = this.state.action || "select"
    return this.execute(action, this.state.data)
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const action = this.state.action || "select"
    return this.execute(action, this.state.data).then(onfulfilled, onrejected)
  }
}

export async function createDbServer() {
  const session = await auth()
  return {
    auth: {
      async getUser() {
        return { data: { user: session?.user ?? null }, error: null }
      },
    },
    from(table: string) {
      return new QueryBuilder(table)
    },
  }
}
