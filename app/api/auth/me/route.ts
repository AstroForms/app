import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { user: null },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    )
  }

  return NextResponse.json(
    {
      user: {
        id: session.user.id,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  )
}
