"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import Logo from "@/components/Logo"

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={pageStyle} />}>
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
    <main style={pageStyle}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <Logo variant="light" size="md" showTagline={true} />
          </div>
          <div style={cardBodyStyle}>
            <p style={subtitleStyle}>Sign in to your workspace</p>

            <a href="/auth/google" style={googleButtonStyle}>
              <svg width="16" height="16" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
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

const subtitleStyle: React.CSSProperties = {
  fontFamily: "DM Sans, sans-serif",
  fontSize: 13,
  color: "#6B7280",
  textAlign: "center",
  margin: "0 0 20px 0",
}

const googleButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  width: "100%",
  padding: "10px 16px",
  border: "0.5px solid #E5E5E3",
  borderRadius: 8,
  background: "#fff",
  fontFamily: "DM Sans, sans-serif",
  fontSize: 13,
  fontWeight: 500,
  color: "#0D1B3E",
  textDecoration: "none",
  boxSizing: "border-box",
  cursor: "pointer",
}

const dividerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  margin: "18px 0",
}

const dividerLineStyle: React.CSSProperties = {
  flex: 1,
  height: 1,
  background: "#E5E5E3",
}

const dividerTextStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#9CA3AF",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  padding: "0 10px",
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

const footerTextStyle: React.CSSProperties = {
  fontFamily: "DM Sans, sans-serif",
  fontSize: 11,
  color: "#9CA3AF",
  textAlign: "center",
  margin: "16px 0 0 0",
}
