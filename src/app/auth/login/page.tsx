"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={pageStyle}><div style={cardStyle} /></div>}>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || "/dashboard"
  const inviteError = searchParams.get("error")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(inviteError === "invalid" ? "Sign in failed. Try again." : null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) {
        setError(signInError.message)
        setSubmitting(false)
        return
      }
      router.push(next)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Sign in failed")
      setSubmitting(false)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={brandStyle}>SOURCE HQ</div>
        <h1 style={titleStyle}>Sign in</h1>
        <p style={subtitleStyle}>Welcome back. Choose how you want to sign in.</p>

        <a href="/auth/google" style={googleButtonStyle}>
          <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: 10 }}>
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
          </svg>
          Sign in with Google
        </a>

        <div style={dividerStyle}>
          <div style={dividerLineStyle}></div>
          <span style={dividerTextStyle}>or</span>
          <div style={dividerLineStyle}></div>
        </div>

        <form onSubmit={handleEmailLogin}>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
              autoComplete="email"
            />
          </div>
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
              autoComplete="current-password"
            />
          </div>
          {error && <p style={errorStyle}>{error}</p>}
          <button type="submit" disabled={submitting} style={submitButtonStyle}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p style={footerTextStyle}>
          Forgot your password? Contact your administrator.
        </p>
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#F8F8F6",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px 20px",
  fontFamily: "var(--font-dm-sans), DM Sans, sans-serif",
}

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  backgroundColor: "#ffffff",
  borderRadius: 12,
  padding: "40px",
  border: "0.5px solid #E5E5E3",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
}

const brandStyle: React.CSSProperties = {
  fontFamily: '"Fjalla One", Impact, sans-serif',
  fontWeight: 400,
  fontSize: 20,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  color: "#0D1B3E",
  marginBottom: 28,
}

const titleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
  color: "#0D1B3E",
  margin: "0 0 6px 0",
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#6B7280",
  margin: "0 0 24px 0",
}

const googleButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 500,
  color: "#0D1B3E",
  background: "#ffffff",
  border: "0.5px solid #E5E5E3",
  borderRadius: 8,
  textDecoration: "none",
  cursor: "pointer",
}

const dividerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  margin: "20px 0",
}

const dividerLineStyle: React.CSSProperties = {
  flex: 1,
  height: 1,
  background: "#E5E5E3",
}

const dividerTextStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#9CA3AF",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  padding: "0 12px",
}

const fieldGroupStyle: React.CSSProperties = {
  marginBottom: 14,
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 500,
  color: "#6B7280",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  fontSize: 14,
  border: "0.5px solid #E5E5E3",
  borderRadius: 6,
  outline: "none",
  background: "#ffffff",
  color: "#0D1B3E",
  boxSizing: "border-box",
}

const errorStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#B91C1C",
  margin: "8px 0 12px 0",
}

const submitButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 500,
  color: "#ffffff",
  background: "#6D28D9",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
}

const footerTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#9CA3AF",
  textAlign: "center",
  margin: "24px 0 0 0",
}
