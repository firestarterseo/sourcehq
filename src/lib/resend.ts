import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY not set. Email sending will fail.')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

export const EMAIL_FROM = 'SOURCE HQ <invites@sourcehq.app>'
export const APP_NAME = 'SOURCE HQ'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sourcehq.app'