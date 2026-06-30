"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"

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
      // Redirect to login after a short delay
      setTimeout(() => router.push("/login"), 2000)
    } catch (e: any) {
      setSubmitError(e.message || "Failed to accept invitation")
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <p style={bodyTextStyle}>Loading invitation...</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={headerStyle}>SOURCE HQ</h1>
          <h2 style={titleStyle}>Invitation problem</h2>
          <p style={bodyTextStyle}>{loadError}</p>
          <p style={mutedTextStyle}>If you think this is a mistake, contact the person who invited you.</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={headerStyle}>SOURCE HQ</h1>
          <h2 style={titleStyle}>Account created</h2>
          <p style={bodyTextStyle}>Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={headerStyle}>SOURCE HQ</h1>
        <h2 style={titleStyle}>Join {invite?.orgName}</h2>
        <p style={bodyTextStyle}>
          You have been invited to join {invite?.orgName} as a {invite?.role}.
        </p>
        <p style={mutedTextStyle}>Set a password to create your account.</p>

        <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Email</label>
            <input type="email" value={invite?.email || ""} disabled style={inputDisabledStyle} />
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
          <button type="submit" disabled={submitting} style={buttonStyle}>
            {submitting ? "Creating account..." : "Accept invitation"}
          </button>
        </form>
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#f5f5f4",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px 20px",
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
}

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 440,
  backgroundColor: "#ffffff",
  borderRadius: 8,
  padding: "40px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
}

const headerStyle: React.CSSProperties = {
  fontFamily: '"Fjalla One", Impact, sans-serif',
  fontWeight: 400,
  fontSize: 18,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  color: "#231a2c",
  margin: "0 0 24px 0",
}

const titleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
  color: "#231a2c",
  margin: "0 0 8px 0",
}

const bodyTextStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: "22px",
  color: "#44403c",
  margin: "0 0 6px 0",
}

const mutedTextStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: "20px",
  color: "#78716c",
  margin: "0",
}

const fieldGroupStyle: React.CSSProperties = {
  marginBottom: 16,
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  color: "#44403c",
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 15,
  border: "1px solid #d6d3d1",
  borderRadius: 6,
  outline: "none",
  boxSizing: "border-box",
}

const inputDisabledStyle: React.CSSProperties = {
  ...inputStyle,
  backgroundColor: "#fafaf9",
  color: "#78716c",
}

const buttonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 8,
  padding: "12px 16px",
  fontSize: 15,
  fontWeight: 600,
  color: "#ffffff",
  backgroundColor: "#231a2c",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
}

const errorStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#b91c1c",
  margin: "0 0 12px 0",
}
