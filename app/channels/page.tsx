import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/dashboard-shell"
import { ChannelsList } from "@/components/channels-list"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export default async function ChannelsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login")
  const userId = session.user.id

  const ownedChannels = await prisma.channel.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
  })

  const memberChannels = await prisma.channelMember.findMany({
    where: { userId },
    include: { channel: true },
  })

  const joined = memberChannels.map((m) => m.channel)

  const allChannels = [...ownedChannels, ...joined]
  const channelIds = [...new Set(allChannels.map((c) => c.id))]
  const memberCounts = await Promise.all(
    channelIds.map(async (channelId) => ({
      channelId,
      count: await prisma.channelMember.count({ where: { channelId } }),
    })),
  )
  const memberCountMap = Object.fromEntries(
    memberCounts.map((entry) => [entry.channelId, entry.count]),
  )

  const ownedWithCounts = ownedChannels.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    member_count: memberCountMap[c.id] || 0,
    is_verified: c.isVerified,
    is_public: c.isPublic,
    created_at: c.createdAt.toISOString(),
    icon_url: c.iconUrl || null,
  }))

  const joinedWithCounts = joined.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    member_count: memberCountMap[c.id] || 0,
    is_verified: c.isVerified,
    is_public: c.isPublic,
    created_at: c.createdAt.toISOString(),
    icon_url: c.iconUrl || null,
  }))

  return (
    <DashboardShell>
      <ChannelsList ownedChannels={ownedWithCounts} joinedChannels={joinedWithCounts} userId={userId} />
    </DashboardShell>
  )
}
