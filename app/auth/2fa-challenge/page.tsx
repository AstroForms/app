import { TwoFactorChallengeContent } from "@/components/two-factor-challenge-content"

type TwoFactorChallengePageProps = {
  searchParams?: Promise<{
    callbackUrl?: string
  }>
}

export default async function TwoFactorChallengePage({ searchParams }: TwoFactorChallengePageProps) {
  const params = searchParams ? await searchParams : undefined
  const callbackUrl = typeof params?.callbackUrl === "string" ? params.callbackUrl : "/"

  return <TwoFactorChallengeContent callbackUrl={callbackUrl} />
}
