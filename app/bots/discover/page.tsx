import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { BotsDiscoverContent } from "@/components/bots-discover-content"
import { FeatureDisabledNotice } from "@/components/feature-disabled-notice"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isFeatureEnabled } from "@/lib/features"

export default async function BotsDiscoverPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login")
  const userId = session.user.id
  const botsEnabled = await isFeatureEnabled("bots")

  if (!botsEnabled) {
    return (
      <DashboardShell>
        <FeatureDisabledNotice
          title="Bots sind deaktiviert"
          description="Diese Funktion wurde von der Administration deaktiviert und kann aktuell nicht verwendet werden."
        />
      </DashboardShell>
    )
  }

  const bots = await prisma.bot.findMany({
    where: { isPublic: true },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return (
    <DashboardShell>
      <BotsDiscoverContent
        bots={bots.map((bot) => ({
          id: bot.id,
          name: bot.name,
          description: bot.description,
          avatar_url: bot.avatarUrl,
          is_verified: bot.isVerified,
          is_public: bot.isPublic,
          owner_id: bot.ownerId,
          profiles: {
            id: bot.owner.id,
            username: bot.owner.username || "",
            display_name: bot.owner.displayName || "",
            avatar_url: bot.owner.avatarUrl,
          },
        }))}
        userId={userId}
      />
    </DashboardShell>
  )
}
