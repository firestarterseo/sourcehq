import { redirect } from "next/navigation"
import Sidebar from "@/components/Sidebar"
import { getAuthContext, adminClient, hasRole } from "@/lib/auth-context"
import TeamClient from "./TeamClient"
import SettingsTabs from "../SettingsTabs"

export const dynamic = "force-dynamic"

export default async function TeamPage() {
  const ctx = await getAuthContext()
  if (!ctx) redirect("/login")
  if (!hasRole(ctx.member.role, "admin")) redirect("/dashboard")

  const admin = adminClient()

  // Members
  const { data: members } = await admin
    .from("organization_members")
    .select("id, user_id, role, is_primary, joined_at, invited_at")
    .eq("org_id", ctx.member.org_id)
    .order("joined_at", { ascending: true })

  // Pending invitations
  const { data: invitations } = await admin
    .from("team_invitations")
    .select("id, email, role, invited_by, created_at, expires_at")
    .eq("org_id", ctx.member.org_id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })

  // Emails for member user_ids and invited_by ids
  const userIds = new Set<string>()
  for (const m of members || []) userIds.add(m.user_id)
  for (const i of invitations || []) userIds.add(i.invited_by)

  const emails: Record<string, string> = {}
  if (userIds.size > 0) {
    const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (usersData?.users) {
      for (const u of usersData.users) {
        if (userIds.has(u.id)) emails[u.id] = u.email || ""
      }
    }
  }

  const enrichedMembers = (members || []).map(m => ({
    id: m.id,
    user_id: m.user_id,
    email: emails[m.user_id] || "",
    role: m.role as "owner" | "admin" | "member" | "client",
    is_primary: m.is_primary,
    joined_at: m.joined_at,
  }))

  const enrichedInvites = (invitations || []).map(i => ({
    id: i.id,
    email: i.email,
    role: i.role as "owner" | "admin" | "member" | "client",
    invitedByEmail: emails[i.invited_by] || "",
    created_at: i.created_at,
    expires_at: i.expires_at,
  }))

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "var(--font-dm-sans), DM Sans, sans-serif" }}>
      <Sidebar active="Settings" email={ctx.user.email} />
      <div style={{ marginLeft: "220px", flex: 1, background: "#F8F8F6" }}>
        <div style={{ background: "#fff", borderBottom: "0.5px solid #E5E5E3", padding: "0 24px", height: "52px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "15px", fontWeight: "600", color: "#0D1B3E" }}>Settings</span>
        </div>
        <div style={{ padding: "24px", maxWidth: "960px" }}>
          <SettingsTabs active="team" />
          <TeamClient
            members={enrichedMembers}
            invites={enrichedInvites}
            currentUserId={ctx.user.id}
            currentRole={ctx.member.role}
            currentIsPrimary={ctx.member.is_primary}
          />
        </div>
      </div>
    </div>
  )
}

