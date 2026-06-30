"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Logo from "@/components/Logo"

type InviteDetails = {
  email: string
  role: string
  orgName: string
}

const MIN_PASSWORD_LENGTH = 12

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const token = params?.token

  const [loading, setLoading] = useState(true)
  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/team/invitations/accept?token=${encodeURIComponent(token as string)}`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setLoadError(data.error || "Invitation could not be loaded")
        } else {
          setInvite({ email: data.email, role: data.role, orgName: data.orgName })
        }
      } catch (e: any) {
        if (!cancelled) setLoadError(e.message || "Failed to load invitation")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (password.length < MIN_PASSWORD_LENGTH) {
      setSubmitError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      return
    }
    if (password !== confirm) {
      setSubmitError("Passwords do not match")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/team/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error || "Failed to accept invitation")
        setSubmitting(false)
        return
      }
      setDone(true)
      setTimeout(() => router.push("/auth/login"), 2000)
    } catch (e: any) {
      setSubmitError(e.message || "Failed to accept invitation")
      setSubmitting(false)
    }
  }

  return (
    <main style={pageStyle}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <Logo variant="light" size="md" showTagline={true} />
          </div>
          <div style={cardBodyStyle}>
            {loading && <p style={subtitleStyle}>Loading invitation...</p>}

            {!loading && loadError && (
              <>
                <h2 style={titleStyle}>Invitation problem</h2>
                <p style={bodyTextStyle}>{loadError}</p>
                <p style={mutedTextStyle}>
                  If you think this is a mistake, contact the person who invited you.
                </p>
              </>
            )}

            {!loading && !loadError && done && (
              <>
                <h2 style={titleStyle}>Account created</h2>
                <p style={bodyTextStyle}>Redirecting to sign in...</p>
              </>
            )}

            {!loading && !loadError && !done && invite && (
              <>
                <h2 style={titleStyle}>Join {invite.orgName}</h2>
                <p style={bodyTextStyle}>
                  You have been invited to join {invite.orgName} as a {invite.role}.
                </p>
                <p style={mutedTextStyle}>Set a password to create your account.</p>

                <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Email</label>
                    <input type="email" value={invite.email} disabled style={inputDisabledStyle} />
                  </div>
                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      minLength={MIN_PASSWORD_LENGTH}
                      required
                      style={inputStyle}
                      placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                    />
                  </div>
                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Confirm password</label>
                    <input
                      type="password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      minLength={MIN_PASSWORD_LENGTH}
                      required
                      style={inputStyle}
                    />
                  </div>
                  {submitError && <p style={errorStyle}>{submitError}</p>}
                  <button type="submit" disabled={submitting} style={submitButtonStyle}>
                    {submitting ? "Creating account..." : "Accept invitation"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px 20px",
  background: "linear-gradient(135deg, #EDE9FE 0%, #E0E7FF 100%)",
  fontFamily: "DM Sans, sans-serif",
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  overflow: "hidden",
  border: "0.5px solid #E5E5E3",
}

const cardHeaderStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #EDE9FE 0%, #E0E7FF 100%)",
  padding: "36px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
}

const cardBodyStyle: React.CSSProperties = {
  padding: "28px",
}

const titleStyle: React.CSSProperties = {
  fontFamily: "Outfit, sans-serif",
  fontSize: 20,
  fontWeight: 700,
  color: "#0D1B3E",
  margin: "0 0 8px 0",
  textAlign: "center",
}

const subtitleStyle: React.CSSProperties = {
  fontFamily: "DM Sans, sans-serif",
  fontSize: 13,
  color: "#6B7280",
  textAlign: "center",
  margin: 0,
}

const bodyTextStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: "20px",
  color: "#44403c",
  margin: "0 0 6px 0",
  textAlign: "center",
}

const mutedTextStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: "18px",
  color: "#9CA3AF",
  margin: "0",
  textAlign: "center",
}

const fieldGroupStyle: React.CSSProperties = {
  marginBottom: 12,
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 500,
  color: "#6B7280",
  marginBottom: 5,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  fontFamily: "DM Sans, sans-serif",
  fontSize: 13,
  border: "0.5px solid #E5E5E3",
  borderRadius: 8,
  outline: "none",
  background: "#fff",
  color: "#0D1B3E",
  boxSizing: "border-box",
}

const inputDisabledStyle: React.CSSProperties = {
  ...inputStyle,
  background: "#FAFAF8",
  color: "#9CA3AF",
}

const errorStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#B91C1C",
  margin: "6px 0 10px 0",
}

const submitButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 4,
  padding: "10px 16px",
  fontFamily: "DM Sans, sans-serif",
  fontSize: 13,
  fontWeight: 500,
  color: "#fff",
  background: "#7C3AED",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
}
