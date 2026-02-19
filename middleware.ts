export const runtime = "nodejs" // Required for NextAuth and crypto
import { auth } from "@/lib/auth"
import { NextResponse, type NextRequest } from "next/server"
import { isUserCurrentlyBanned } from "@/lib/bans"

// Protected routes that require authentication
const protectedRoutes = [
  "/channels/create",
  "/settings",
  "/bots",
  "/profile",
  "/admin",
]

// Public routes that should redirect to home if authenticated
const authRoutes = [
  "/auth/login",
  "/auth/sign-up",
]

export default auth(async (req) => {
  const { nextUrl } = req
  const sessionUserId =
    req.auth?.user && typeof (req.auth.user as { id?: unknown }).id === "string"
      ? ((req.auth.user as { id: string }).id)
      : null
  const isLoggedIn = !!sessionUserId

  const isProtectedRoute = protectedRoutes.some((route) =>
    nextUrl.pathname.startsWith(route)
  )
  const isAuthRoute = authRoutes.some((route) =>
    nextUrl.pathname.startsWith(route)
  )

  if (sessionUserId && (await isUserCurrentlyBanned(sessionUserId))) {
    const loginUrl = new URL("/auth/login", nextUrl)
    loginUrl.searchParams.set("error", "AccountBanned")
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete("__Secure-authjs.callback-url")
    response.cookies.delete("authjs.callback-url")
    response.cookies.delete("authjs.session-token")
    response.cookies.delete("__Secure-authjs.session-token")
    return response
  }

  // Redirect to login if accessing protected route without auth
  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL("/auth/login", nextUrl)
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname)
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete("__Secure-authjs.callback-url")
    response.cookies.delete("authjs.callback-url")
    return response
  }

  // Redirect to home if accessing auth route while logged in
  if (isAuthRoute && isLoggedIn) {
    const response = NextResponse.redirect(new URL("/", nextUrl))
    response.cookies.delete("__Secure-authjs.callback-url")
    response.cookies.delete("authjs.callback-url")
    return response
  }

  const response = NextResponse.next()
  response.cookies.delete("__Secure-authjs.callback-url")
  response.cookies.delete("authjs.callback-url")
  return response
})

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
