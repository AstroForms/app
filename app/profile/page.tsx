import { createDbServer } from "@/lib/db-server"
import { redirect } from "next/navigation"

export default async function ProfileRedirect() {
  const supabase = await createDbServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")
  redirect(`/profile/${user.id}`)
}
