export const runtime = "nodejs" // Required for NextAuth and crypto
import { auth } from "@/lib/auth"
import { NextResponse, type NextRequest } from "next/server"
import { isUserCurrentlyBanned } from "@/lib/bans"
import { TWO_FACTOR_COOKIE_NAME } from "@/lib/two-factor-constants"
import { verifyTwoFactorProofValueEdge } from "@/lib/two-factor-edge"
import { CURRENT_TERMS_VERSION, LEGAL_ACCEPTANCE_COOKIE_NAME } from "@/lib/legal-constants"
import { verifyLegalAcceptanceProofValueEdge } from "@/lib/legal-edge"

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

async function isUserCurrentlyBannedSafe(userId: string) {
  try {
    return await isUserCurrentlyBanned(userId)
  } catch {
    return false
  }
}

export default auth(async (req) => {
  try {
    const { nextUrl } = req
    const sessionUserId =
      req.auth?.user && typeof (req.auth.user as { id?: unknown }).id === "string"
        ? ((req.auth.user as { id: string }).id)
        : null
    const isLoggedIn = !!sessionUserId
    const twoFactorEnabled = req.auth?.user?.twoFactorEnabled === true
    const acceptedTermsVersion =
      typeof req.auth?.user?.acceptedTermsVersion === "string" ? req.auth.user.acceptedTermsVersion : null
    const hasTwoFactorProof =
      !!sessionUserId &&
      (await verifyTwoFactorProofValueEdge(req.cookies.get(TWO_FACTOR_COOKIE_NAME)?.value, sessionUserId))
    const hasLegalAcceptanceProof =
      !!sessionUserId &&
      (await verifyLegalAcceptanceProofValueEdge(req.cookies.get(LEGAL_ACCEPTANCE_COOKIE_NAME)?.value, sessionUserId))
    const hasAcceptedCurrentTerms =
      acceptedTermsVersion === CURRENT_TERMS_VERSION || hasLegalAcceptanceProof

    const isProtectedRoute = protectedRoutes.some((route) =>
      nextUrl.pathname.startsWith(route)
    )
    const isAuthRoute = authRoutes.some((route) =>
      nextUrl.pathname.startsWith(route)
    )
    const isTwoFactorRoute = nextUrl.pathname.startsWith("/auth/2fa-challenge")
    const isLegalAcceptanceRoute = nextUrl.pathname.startsWith("/legal/acceptance")
    const isLegalContentRoute =
      nextUrl.pathname.startsWith("/legal/tos") ||
      nextUrl.pathname.startsWith("/legal/privacy") ||
      nextUrl.pathname.startsWith("/legal/impressum")

    if (sessionUserId && (await isUserCurrentlyBannedSafe(sessionUserId))) {
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

    if (
      isLoggedIn &&
      !hasAcceptedCurrentTerms &&
      !isLegalAcceptanceRoute &&
      !isLegalContentRoute &&
      !isTwoFactorRoute
    ) {
      const acceptanceUrl = new URL("/legal/acceptance", nextUrl)
      acceptanceUrl.searchParams.set("callbackUrl", `${nextUrl.pathname}${nextUrl.search}`)
      return NextResponse.redirect(acceptanceUrl)
    }

    if (isLegalAcceptanceRoute && hasAcceptedCurrentTerms) {
      const callbackUrl = nextUrl.searchParams.get("callbackUrl") || "/"
      return NextResponse.redirect(new URL(callbackUrl, nextUrl))
    }

    const response = NextResponse.next()
    response.cookies.delete("__Secure-authjs.callback-url")
    response.cookies.delete("authjs.callback-url")
    if (!isLoggedIn) {
      response.cookies.delete(TWO_FACTOR_COOKIE_NAME)
      response.cookies.delete(LEGAL_ACCEPTANCE_COOKIE_NAME)
    }
    return response
  } catch (error) {
    console.error("[middleware] guarded fallback due to error:", error)
    return NextResponse.next()
  }
})

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
