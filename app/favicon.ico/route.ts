import { NextRequest, NextResponse } from "next/server"

export function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/icon.png", req.url), 307)
}

