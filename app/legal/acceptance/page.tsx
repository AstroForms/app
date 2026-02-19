import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { CURRENT_TERMS_VERSION } from "@/lib/legal-constants"
import { LegalAcceptanceContent } from "@/components/legal-acceptance-content"

type LegalAcceptancePageProps = {
  searchParams?: Promise<{
    callbackUrl?: string
  }>
}

export default async function LegalAcceptancePage({ searchParams }: LegalAcceptancePageProps) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/auth/login")
  }

  const params = searchParams ? await searchParams : undefined
  const callbackUrl = typeof params?.callbackUrl === "string" ? params.callbackUrl : "/"

  return <LegalAcceptanceContent callbackUrl={callbackUrl} version={CURRENT_TERMS_VERSION} />
}
