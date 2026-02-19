export const runtime = "nodejs" // Required for NextAuth and crypto
import { auth } from "@/lib/auth"
import { NextResponse, type NextRequest } from "next/server"
import { isUserCurrentlyBanned } from "@/lib/bans"
import { TWO_FACTOR_COOKIE_NAME, verifyTwoFactorProofValue } from "@/lib/two-factor"

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
  const twoFactorEnabled = req.auth?.user?.twoFactorEnabled === true
  const hasTwoFactorProof =
    !!sessionUserId &&
    verifyTwoFactorProofValue(req.cookies.get(TWO_FACTOR_COOKIE_NAME)?.value, sessionUserId)

  const isProtectedRoute = protectedRoutes.some((route) =>
    nextUrl.pathname.startsWith(route)
  )
  const isAuthRoute = authRoutes.some((route) =>
    nextUrl.pathname.startsWith(route)
  )
  const isTwoFactorRoute = nextUrl.pathname.startsWith("/auth/2fa-challenge")

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

  if (isTwoFactorRoute && !isLoggedIn) {
    const response = NextResponse.redirect(new URL("/auth/login", nextUrl))
    response.cookies.delete(TWO_FACTOR_COOKIE_NAME)
    return response
  }

  if (isTwoFactorRoute && isLoggedIn && !twoFactorEnabled) {
    const response = NextResponse.redirect(new URL("/", nextUrl))
    response.cookies.delete(TWO_FACTOR_COOKIE_NAME)
    return response
  }

  if (isLoggedIn && twoFactorEnabled && !hasTwoFactorProof && !isTwoFactorRoute) {
    const challengeUrl = new URL("/auth/2fa-challenge", nextUrl)
    challengeUrl.searchParams.set("callbackUrl", `${nextUrl.pathname}${nextUrl.search}`)
    return NextResponse.redirect(challengeUrl)
  }

  if (isTwoFactorRoute && hasTwoFactorProof) {
    const callbackUrl = nextUrl.searchParams.get("callbackUrl") || "/"
    return NextResponse.redirect(new URL(callbackUrl, nextUrl))
  }

  const response = NextResponse.next()
  response.cookies.delete("__Secure-authjs.callback-url")
  response.cookies.delete("authjs.callback-url")
  if (!isLoggedIn) {
    response.cookies.delete(TWO_FACTOR_COOKIE_NAME)
  }
  return response
})

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
