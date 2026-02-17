import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ user: null }, { status: 200 })
  }

  return NextResponse.json({ user: session.user })
}
