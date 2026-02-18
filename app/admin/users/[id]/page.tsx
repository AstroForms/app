import { notFound, redirect } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { AdminUserDetailContent } from "@/components/admin-user-detail-content"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
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

  const target = await prisma.profile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  })

  if (!target) {
    notFound()
  }

  return (
    <DashboardShell>
      <AdminUserDetailContent
        targetUser={{
          id: target.id,
          username: target.username ?? "",
          displayName: target.displayName ?? "",
          email: target.user?.email ?? "",
          name: target.user?.name ?? "",
          role: target.role,
          createdAt: target.createdAt.toISOString(),
          avatarUrl: target.avatarUrl ?? null,
        }}
      />
    </DashboardShell>
  )
}
