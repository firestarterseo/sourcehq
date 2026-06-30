import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"
import { cookies } from "next/headers"
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
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  console.error("[team-page] all cookies:", JSON.stringify(allCookies.map(c => c.name)))

  const authCookies = allCookies.filter(c => c.name.startsWith("sb-") && c.name.includes("auth-token"))
  console.error("[team-page] auth cookie names found:", JSON.stringify(authCookies.map(c => c.name)))

  if (authCookies.length === 0) {
    console.error("[team-page] no auth cookies found at all")
    redirect("/auth/login")
  }

  authCookies.sort((a, b) => a.name.localeCompare(b.name))
  const rawToken = authCookies.map(c => c.value).join("")

  let parsedToken: any
  try {
    const decoded = Buffer.from(rawToken.replace(/^base64-/, ""), "base64").toString("utf-8")
    parsedToken = JSON.parse(decoded)
  } catch (e: any) {
    console.error("[team-page] failed to decode auth token:", e.message)
    redirect("/auth/login")
  }

  const accessToken = parsedToken?.access_token
  if (!accessToken) {
    console.error("[team-page] no access_token in decoded payload")
    redirect("/auth/login")
  }

  const admin = adminClient()
  const { data: userData, error: userError } = await admin.auth.getUser(accessToken)
  if (userError || !userData?.user) {
    console.error("[team-page] getUser with explicit token failed:", userError?.message)
    redirect("/auth/login")
  }

  const userId = userData.user.id
  const email = userData.user.email || ""

  const { data: callerMember, error: callerError } = await admin
    .from("organization_members")
    .select("id, org_id, role, is_primary")
    .eq("user_id", userId)
    .maybeSingle()

  if (callerError || !callerMember) {
    console.error("[team-page] no membership row:", callerError?.message)
    redirect("/auth/login")
  }
  if (callerMember.role !== "owner" && callerMember.role !== "admin") {
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

