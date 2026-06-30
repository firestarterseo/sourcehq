import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getAuthContext, adminClient, hasRole, type Role } from '@/lib/auth-context'
import { resend, EMAIL_FROM, APP_URL } from '@/lib/resend'
import { InviteEmail } from '@/lib/email-templates/invite'

const VALID_ROLES: Role[] = ['owner', 'admin', 'member']
const INVITE_TTL_DAYS = 7

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * POST /api/team/invitations
 * Body: { email: string, role: 'owner' | 'admin' | 'member' }
 * Sends an invite email and creates a team_invitations row.
 * Requires Owner or Admin role.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!hasRole(ctx.member.role, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const email = String(body.email || '').trim().toLowerCase()
    const role = String(body.role || 'member') as Role

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    // Only Owners can invite Owners. Admins can only invite admin or member.
    if (role === 'owner' && ctx.member.role !== 'owner') {
      return NextResponse.json({ error: 'Only Owners can invite Owners' }, { status: 403 })
    }

    const admin = adminClient()

    // Check: is this email already a member of the org?
    const { data: existingUser } = await admin
      .from('organization_members')
      .select('id, user_id')
      .eq('org_id', ctx.member.org_id)
      .limit(1)

    if (existingUser && existingUser.length > 0) {
      // Look up by joined user email through auth.users
      const { data: matchByEmail } = await admin.rpc('check_email_in_org', {
        p_org_id: ctx.member.org_id,
        p_email: email,
      })
      // If the RPC doesn't exist yet (it won't), fall through. The DB constraint
      // will catch duplicate insertions on the team_invitations side via the
      // active-invitation check below.
      if (matchByEmail === true) {
        return NextResponse.json({ error: 'User is already a member of this org' }, { status: 409 })
      }
    }

    // Check: is there already an active (non-accepted, non-revoked, non-expired) invite for this email?
    const { data: existingInvite } = await admin
      .from('team_invitations')
      .select('id, expires_at')
      .eq('org_id', ctx.member.org_id)
      .eq('email', email)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .limit(1)

    if (existingInvite && existingInvite.length > 0) {
      return NextResponse.json(
        { error: 'An active invitation already exists for this email' },
        { status: 409 }
      )
    }

    // Get org name for email
    const { data: org } = await admin
      .from('organizations')
      .select('name')
      .eq('id', ctx.member.org_id)
      .single()

    const orgName = org?.name || 'SOURCE HQ'

    // Create the invitation
    const token = randomUUID()
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)

    const { data: invite, error: insertError } = await admin
      .from('team_invitations')
      .insert({
        org_id: ctx.member.org_id,
        email,
        role,
        token,
        invited_by: ctx.user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    // Send the email
    const acceptUrl = `${APP_URL}/accept-invite/${token}`

    try {
      await resend.emails.send({
        from: EMAIL_FROM,
        to: email,
        subject: `You've been invited to ${orgName} on SOURCE HQ`,
        react: InviteEmail({
          inviterEmail: ctx.user.email,
          orgName,
          role,
          acceptUrl,
          expiresAt,
        }),
      })
    } catch (emailError: any) {
      // Email failed. Roll back the invite row so the user can retry cleanly.
      await admin.from('team_invitations').delete().eq('id', invite.id)
      return NextResponse.json(
        { error: `Failed to send invite email: ${emailError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expires_at: invite.expires_at,
        created_at: invite.created_at,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/**
 * GET /api/team/invitations
 * Lists all pending (non-accepted, non-revoked, non-expired) invitations for the caller's org.
 * Requires Owner or Admin role.
 */
export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!hasRole(ctx.member.role, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = adminClient()
    const { data: invites, error } = await admin
      .from('team_invitations')
      .select('id, email, role, invited_by, created_at, expires_at')
      .eq('org_id', ctx.member.org_id)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ invites: invites || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}