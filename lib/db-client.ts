import { signOut } from "next-auth/react"

type QueryFilter = {
  column: string
  op: "eq" | "neq" | "in" | "ilike" | "or"
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
  action?: "select" | "insert" | "update" | "delete" | "upsert"
  data?: unknown
}

async function requestDb<T>(payload: Record<string, unknown>) {
  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { data: null, error: json.error || "Request failed" } as const
  }
  return json as T
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

  neq(column: string, value: unknown) {
    this.state.filters.push({ column, op: "neq", value })
    return this
  }

  in(column: string, value: unknown[]) {
    this.state.filters.push({ column, op: "in", value })
    return this
  }

  ilike(column: string, value: string) {
    this.state.filters.push({ column, op: "ilike", value })
    return this
  }

  or(expression: string) {
    this.state.filters.push({ column: "__or__", op: "or", value: expression })
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

  async execute(action: "select" | "insert" | "update" | "delete" | "upsert", data?: unknown) {
    return requestDb<{ data: unknown; error: string | null; count?: number }>({
      action,
      ...this.state,
      data,
    })
  }

  insert(data: unknown) {
    this.state.action = "insert"
    this.state.data = data
    return this
  }

  update(data: unknown) {
    this.state.action = "update"
    this.state.data = data
    return this
  }

  delete() {
    this.state.action = "delete"
    return this
  }

  upsert(data: unknown, options?: Record<string, unknown>) {
    this.state.action = "upsert"
    this.state.data = { values: data, options }
    return this
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    const action = this.state.action || "select"
    return this.execute(action, this.state.data).then(onfulfilled, onrejected)
  }
}

export function createDbClient() {
  return {
    auth: {
      async getUser() {
        const res = await fetch("/api/auth/me")
        const json = await res.json().catch(() => ({}))
        if (!res.ok) return { data: { user: null }, error: json.error || "Unauthorized" }
        return { data: { user: json.user }, error: null }
      },
      async signOut() {
        await signOut({ callbackUrl: "/" })
        return { error: null }
      },
    },
    from(table: string) {
      return new QueryBuilder(table)
    },
    async rpc(name: string, params?: Record<string, unknown>) {
      const res = await fetch(`/api/rpc/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params || {}),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { data: null, error: json.error || "RPC failed" }
      }
      return { data: json.data ?? json, error: null }
    },
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, file: File, _opts?: Record<string, unknown>) {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("path", path)
            formData.append("bucket", bucket)
            const res = await fetch("/api/upload", { method: "POST", body: formData })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) return { data: null, error: { message: json.error || "Upload failed" } }
            return { data: { path: json.path || path }, error: null }
          },
          getPublicUrl(path: string) {
            return { data: { publicUrl: `/uploads/${path}` } }
          },
        }
      },
    },
    removeChannel() {
      return null
    },
  }
}
