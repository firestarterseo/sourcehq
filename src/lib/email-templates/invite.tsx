import * as React from 'react'

type InviteEmailProps = {
  inviterEmail: string
  inviterName?: string
  orgName: string
  role: string
  acceptUrl: string
  expiresAt: Date
}

export function InviteEmail({
  inviterEmail,
  inviterName,
  orgName,
  role,
  acceptUrl,
  expiresAt,
}: InviteEmailProps) {
  const inviter = inviterName || inviterEmail
  const expiresFormatted = expiresAt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>Invitation to {orgName} on SOURCE HQ</title>
      </head>
      <body style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', backgroundColor: '#f5f5f4', margin: 0, padding: '40px 20px', color: '#231a2c' }}>
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: '560px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden' }}>
          <tbody>
            <tr>
              <td style={{ padding: '32px 40px 24px 40px', borderBottom: '1px solid #e7e5e4' }}>
                <div style={{ fontFamily: '"Fjalla One", Impact, sans-serif', fontSize: '24px', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#231a2c' }}>
                  SOURCE HQ
                </div>
              </td>
            </tr>
            <tr>
              <td style={{ padding: '32px 40px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 16px 0', color: '#231a2c' }}>
                  You have been invited to {orgName}
                </h1>
                <p style={{ fontSize: '15px', lineHeight: '24px', margin: '0 0 12px 0', color: '#44403c' }}>
                  {inviter} invited you to join {orgName} on SOURCE HQ as a {role}.
                </p>
                <p style={{ fontSize: '15px', lineHeight: '24px', margin: '0 0 32px 0', color: '#44403c' }}>
                  SOURCE HQ tracks AI visibility across ChatGPT, Perplexity, Google AI Overviews, Gemini, and other engines.
                </p>
                <table cellPadding={0} cellSpacing={0}>
                  <tbody>
                    <tr>
                      <td style={{ backgroundColor: '#231a2c', borderRadius: '6px', padding: '14px 28px' }}>
                        <a href={acceptUrl} style={{ color: '#ffffff', textDecoration: 'none', fontSize: '15px', fontWeight: 600, display: 'inline-block' }}>
                          Accept invitation
                        </a>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p style={{ fontSize: '13px', lineHeight: '20px', margin: '32px 0 0 0', color: '#78716c' }}>
                  This invitation expires on {expiresFormatted}. If you were not expecting this, you can ignore this email.
                </p>
                <p style={{ fontSize: '13px', lineHeight: '20px', margin: '12px 0 0 0', color: '#78716c', wordBreak: 'break-all' }}>
                  Or paste this link into your browser: {acceptUrl}
                </p>
              </td>
            </tr>
            <tr>
              <td style={{ padding: '24px 40px', borderTop: '1px solid #e7e5e4', backgroundColor: '#fafaf9' }}>
                <p style={{ fontSize: '12px', lineHeight: '18px', margin: 0, color: '#a8a29e' }}>
                  SOURCE HQ, by Firestarter SEO. Denver, CO.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  )
}
