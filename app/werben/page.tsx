import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function WerbenPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=%2Fwerben")
  }

  redirect("/channels")
}
