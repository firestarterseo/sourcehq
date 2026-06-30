import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createClient } from "@supabase/supabase-js"
import Sidebar from "@/components/Sidebar"
import SettingsTabs from "../SettingsTabs"
import TeamClient from "./TeamClient"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export default async function TeamPage() {
  const supabase = await createServerSupabaseClient()
  const sessionResult = await supabase.auth.getSession()
  console.error("[team-page] sessionResult shape:", JSON.stringify({
    hasData: !!sessionResult.data,
    hasSession: !!sessionResult.data?.session,
    hasUser: !!sessionResult.data?.session?.user,
    userEmail: sessionResult.data?.session?.user?.email,
    userId: sessionResult.data?.session?.user?.id,
    errorMsg: sessionResult.error?.message,
  }))

  const session = sessionResult.data?.session
  const email = session?.user?.email || ""
  const userId = session?.user?.id

  if (!userId) {
    console.error("[team-page] no userId, redirecting to login")
    redirect("/auth/login")
  }

  const admin = adminClient()

  const { data: callerMember, error: callerError } = await admin
    .from("organization_members")
    .select("id, org_id, role, is_primary")
    .eq("user_id", userId)
    .maybeSingle()

  console.error("[team-page] callerMember lookup:", JSON.stringify({
    found: !!callerMember,
    role: callerMember?.role,
    is_primary: callerMember?.is_primary,
    error: callerError?.message,
  }))

  if (!callerMember) {
    console.error("[team-page] no membership row, redirecting to login")
    redirect("/auth/login")
  }
  if (callerMember.role !== "owner" && callerMember.role !== "admin") {
    console.error("[team-page] role insufficient, redirecting to dashboard")
    redirect("/dashboard")
  }

  const orgId = callerMember.org_id

  const { data: members } = await admin
    .from("organization_members")
    .select("id, user_id, role, is_primary, joined_at, invited_at")
    .eq("org_id", orgId)
    .order("joined_at", { ascending: true })

  const { data: invitations } = await admin
    .from("team_invitations")
    .select("id, email, role, invited_by, created_at, expires_at")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })

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
      <Sidebar active="Settings" email={email} />
      <div style={{ marginLeft: "220px", flex: 1, background: "#F8F8F6" }}>
        <div style={{ background: "#fff", borderBottom: "0.5px solid #E5E5E3", padding: "0 24px", height: "52px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "15px", fontWeight: "600", color: "#0D1B3E" }}>Settings</span>
        </div>
        <div style={{ padding: "24px", maxWidth: "960px" }}>
          <SettingsTabs active="team" />
          <TeamClient
            members={enrichedMembers}
            invites={enrichedInvites}
            currentUserId={userId}
            currentRole={callerMember.role as "owner" | "admin" | "member" | "client"}
            currentIsPrimary={callerMember.is_primary}
          />
        </div>
      </div>
    </div>
  )
}
