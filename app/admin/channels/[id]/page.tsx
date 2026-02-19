import { notFound, redirect } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { AdminChannelDetailContent } from "@/components/admin-channel-detail-content"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export default async function AdminChannelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    redirect("/auth/login")
  }

  const me = await prisma.profile.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  const hasAdminAccess = me?.role === "admin" || me?.role === "owner"
  if (!hasAdminAccess) {
    redirect("/admin")
  }

  const target = await prisma.channel.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  })

  if (!target) {
    notFound()
  }

  return (
    <DashboardShell>
      <AdminChannelDetailContent
        targetChannel={{
          id: target.id,
          name: target.name,
          description: target.description,
          isPublic: target.isPublic,
          isVerified: target.isVerified,
          memberCount: target.memberCount,
          createdAt: target.createdAt.toISOString(),
          ownerId: target.owner.id,
          ownerUsername: target.owner.username ?? "",
        }}
      />
    </DashboardShell>
  )
}
