"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Role = "owner" | "admin" | "member" | "client"

type Member = {
  id: string
  user_id: string
  email: string
  role: Role
  is_primary: boolean
  joined_at: string
}

type Invite = {
  id: string
  email: string
  role: Role
  invitedByEmail: string
  created_at: string
  expires_at: string
}

type Props = {
  members: Member[]
  invites: Invite[]
  currentUserId: string
  currentRole: Role
  currentIsPrimary: boolean
}

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  client: "Client",
}

function roleRank(r: Role): number {
  return { owner: 3, admin: 2, member: 1, client: 0 }[r]
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function TeamClient({
  members,
  invites,
  currentUserId,
  currentRole,
  currentIsPrimary,
}: Props) {
  const router = useRouter()

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<Role>("member")
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  // Role-edit state per member
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [pendingRole, setPendingRole] = useState<Role>("member")
  const [actionError, setActionError] = useState<string | null>(null)

  function canChangeMemberRole(m: Member): boolean {
    if (m.user_id === currentUserId) return false
    if (m.is_primary) return false
    if (m.role === "owner" && !currentIsPrimary) return false
    return roleRank(currentRole) >= 2 // admin or owner
  }

  function canRemoveMember(m: Member): boolean {
    return canChangeMemberRole(m)
  }

  function availableRolesForAssignment(): Role[] {
    // Admins can assign member or admin. Owners can assign anything except client (reserved).
    if (currentRole === "owner") return ["owner", "admin", "member"]
    if (currentRole === "admin") return ["admin", "member"]
    return []
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(null)
    setInviteSuccess(null)
    setInviting(true)
    try {
      const res = await fetch("/api/team/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        setInviteError(data.error || "Failed to send invitation")
      } else {
        setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}`)
        setInviteEmail("")
        setInviteRole("member")
        router.refresh()
      }
    } catch (err: any) {
      setInviteError(err.message || "Failed to send invitation")
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleSave(memberId: string) {
    setActionError(null)
    try {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: pendingRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data.error || "Failed to change role")
        return
      }
      setEditingMemberId(null)
      router.refresh()
    } catch (err: any) {
      setActionError(err.message || "Failed to change role")
    }
  }

  async function handleRemoveMember(m: Member) {
    if (!confirm(`Remove ${m.email} from the organization?`)) return
    setActionError(null)
    try {
      const res = await fetch(`/api/team/members/${m.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data.error || "Failed to remove member")
        return
      }
      router.refresh()
    } catch (err: any) {
      setActionError(err.message || "Failed to remove member")
    }
  }

  async function handleRevokeInvite(i: Invite) {
    if (!confirm(`Revoke the invitation for ${i.email}?`)) return
    setActionError(null)
    try {
      const res = await fetch(`/api/team/invitations/${i.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data.error || "Failed to revoke invitation")
        return
      }
      router.refresh()
    } catch (err: any) {
      setActionError(err.message || "Failed to revoke invitation")
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: "20px", fontWeight: "600", color: "#0D1B3E", margin: "0 0 4px 0" }}>Team</h1>
      <p style={{ fontSize: "13px", color: "#6B7280", margin: "0 0 24px 0" }}>
        Manage who has access to your organization.
      </p>

      {actionError && (
        <div style={errorBannerStyle}>{actionError}</div>
      )}

      {/* Invite form */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Invite a new member</h2>
        <form onSubmit={handleInvite} style={{ display: "flex", gap: "8px", alignItems: "flex-start", flexWrap: "wrap" }}>
          <input
            type="email"
            required
            placeholder="email@example.com"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            style={{ ...inputStyle, flex: "1 1 280px" }}
          />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value as Role)}
            style={{ ...inputStyle, width: "140px" }}
          >
            {availableRolesForAssignment().map(r => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
          <button type="submit" disabled={inviting} style={primaryButtonStyle}>
            {inviting ? "Sending..." : "Send invitation"}
          </button>
        </form>
        {inviteError && <p style={fieldErrorStyle}>{inviteError}</p>}
        {inviteSuccess && <p style={fieldSuccessStyle}>{inviteSuccess}</p>}
      </section>

      {/* Pending invitations */}
      {invites.length > 0 && (
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Pending invitations</h2>
          <div style={tableStyle}>
            <div style={{ ...tableHeaderRowStyle, gridTemplateColumns: "2fr 1fr 1fr 100px" }}>
              <div style={tableHeaderCellStyle}>Email</div>
              <div style={tableHeaderCellStyle}>Role</div>
              <div style={tableHeaderCellStyle}>Expires</div>
              <div style={tableHeaderCellStyle}></div>
            </div>
            {invites.map(i => (
              <div key={i.id} style={{ ...tableRowStyle, gridTemplateColumns: "2fr 1fr 1fr 100px" }}>
                <div>
                  <div style={{ fontSize: "14px", color: "#0D1B3E" }}>{i.email}</div>
                  <div style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "2px" }}>
                    Invited by {i.invitedByEmail || "unknown"}
                  </div>
                </div>
                <div style={cellTextStyle}>{ROLE_LABEL[i.role]}</div>
                <div style={cellTextStyle}>{formatDate(i.expires_at)}</div>
                <div style={{ textAlign: "right" }}>
                  <button onClick={() => handleRevokeInvite(i)} style={dangerLinkStyle}>Revoke</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Members */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Members</h2>
        <div style={tableStyle}>
          <div style={{ ...tableHeaderRowStyle, gridTemplateColumns: "2fr 1.5fr 1fr 140px" }}>
            <div style={tableHeaderCellStyle}>Email</div>
            <div style={tableHeaderCellStyle}>Role</div>
            <div style={tableHeaderCellStyle}>Joined</div>
            <div style={tableHeaderCellStyle}></div>
          </div>
          {members.map(m => {
            const isSelf = m.user_id === currentUserId
            const editable = canChangeMemberRole(m)
            const removable = canRemoveMember(m)
            const isEditing = editingMemberId === m.id
            return (
              <div key={m.id} style={{ ...tableRowStyle, gridTemplateColumns: "2fr 1.5fr 1fr 140px" }}>
                <div>
                  <div style={{ fontSize: "14px", color: "#0D1B3E" }}>
                    {m.email || m.user_id}
                    {isSelf && <span style={youBadgeStyle}>you</span>}
                    {m.is_primary && <span style={primaryBadgeStyle}>primary</span>}
                  </div>
                </div>
                <div>
                  {isEditing ? (
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <select
                        value={pendingRole}
                        onChange={e => setPendingRole(e.target.value as Role)}
                        style={{ ...inputStyle, padding: "4px 8px", fontSize: "12px" }}
                      >
                        {availableRolesForAssignment().map(r => (
                          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                        ))}
                      </select>
                      <button onClick={() => handleRoleSave(m.id)} style={smallPrimaryButtonStyle}>Save</button>
                      <button onClick={() => setEditingMemberId(null)} style={smallSecondaryButtonStyle}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={cellTextStyle}>{ROLE_LABEL[m.role]}</span>
                      {editable && (
                        <button
                          onClick={() => {
                            setEditingMemberId(m.id)
                            setPendingRole(m.role)
                          }}
                          style={editLinkStyle}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div style={cellTextStyle}>{formatDate(m.joined_at)}</div>
                <div style={{ textAlign: "right" }}>
                  {removable && (
                    <button onClick={() => handleRemoveMember(m)} style={dangerLinkStyle}>Remove</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

const sectionStyle: React.CSSProperties = {
  background: "#fff",
  border: "0.5px solid #E5E5E3",
  borderRadius: "12px",
  padding: "20px",
  marginBottom: "20px",
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#0D1B3E",
  margin: "0 0 16px 0",
}

const tableStyle: React.CSSProperties = {
  border: "0.5px solid #E5E5E3",
  borderRadius: "8px",
  overflow: "hidden",
}

const tableHeaderRowStyle: React.CSSProperties = {
  display: "grid",
  padding: "10px 16px",
  borderBottom: "0.5px solid #E5E5E3",
  background: "#FAFAF8",
}

const tableHeaderCellStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  color: "#9CA3AF",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
}

const tableRowStyle: React.CSSProperties = {
  display: "grid",
  padding: "12px 16px",
  borderBottom: "0.5px solid #F3F4F6",
  alignItems: "center",
}

const cellTextStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#6B7280",
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: "13px",
  border: "0.5px solid #E5E5E3",
  borderRadius: "6px",
  outline: "none",
  background: "#fff",
  color: "#0D1B3E",
}

const primaryButtonStyle: React.CSSProperties = {
  background: "#6D28D9",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  padding: "8px 16px",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
}

const smallPrimaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  padding: "4px 10px",
  fontSize: "12px",
}

const smallSecondaryButtonStyle: React.CSSProperties = {
  background: "#fff",
  color: "#6B7280",
  border: "0.5px solid #E5E5E3",
  borderRadius: "6px",
  padding: "4px 10px",
  fontSize: "12px",
  cursor: "pointer",
}

const editLinkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#6D28D9",
  fontSize: "12px",
  cursor: "pointer",
  padding: 0,
  textDecoration: "underline",
}

const dangerLinkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#B91C1C",
  fontSize: "12px",
  cursor: "pointer",
  padding: 0,
  textDecoration: "underline",
}

const errorBannerStyle: React.CSSProperties = {
  background: "#FEF2F2",
  border: "0.5px solid #FECACA",
  color: "#991B1B",
  fontSize: "13px",
  padding: "10px 14px",
  borderRadius: "8px",
  marginBottom: "16px",
}

const fieldErrorStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#B91C1C",
  margin: "8px 0 0 0",
}

const fieldSuccessStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#15803D",
  margin: "8px 0 0 0",
}

const youBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  marginLeft: "8px",
  padding: "2px 8px",
  borderRadius: "20px",
  background: "#F3F4F6",
  color: "#6B7280",
  fontSize: "11px",
  fontWeight: 500,
}

const primaryBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  marginLeft: "6px",
  padding: "2px 8px",
  borderRadius: "20px",
  background: "#EDE9FE",
  color: "#5B21B6",
  fontSize: "11px",
  fontWeight: 500,
}
