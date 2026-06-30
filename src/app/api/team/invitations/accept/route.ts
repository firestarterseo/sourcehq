import { NextRequest, NextResponse } from 'next/server'
import { adminClient, type Role } from '@/lib/auth-context'

const MIN_PASSWORD_LENGTH = 12

/**
 * GET /api/team/invitations/accept?token=...
 * Validates an invite token. Returns { valid: true, email, role, orgName } or an error.
 * Unauthenticated endpoint, since the user does not yet exist.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const admin = adminClient()

    const { data: invite, error } = await admin
      .from('team_invitations')
      .select('id, org_id, email, role, expires_at, accepted_at, revoked_at')
      .eq('token', token)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (!invite) {
      return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 })
    }
    if (invite.accepted_at) {
      return NextResponse.json({ error: 'This invitation has already been accepted' }, { status: 410 })
    }
    if (invite.revoked_at) {
      return NextResponse.json({ error: 'This invitation has been revoked' }, { status: 410 })
    }
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 })
    }

    const { data: org } = await admin
      .from('organizations')
      .select('name')
      .eq('id', invite.org_id)
      .single()

    return NextResponse.json({
      valid: true,
      email: invite.email,
      role: invite.role,
      orgName: org?.name || 'SOURCE HQ',
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/**
 * POST /api/team/invitations/accept
 * Body: { token: string, password: string }
 * Creates the user account, adds the org membership, marks the invite accepted.
 * MVP: new-user path only. Errors if the email already exists in auth.users.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const token = String(body.token || '').trim()
    const password = String(body.password || '')

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      )
    }

    const admin = adminClient()

    // Validate the invitation
    const { data: invite, error: lookupError } = await admin
      .from('team_invitations')
      .select('id, org_id, email, role, expires_at, accepted_at, revoked_at, invited_by')
      .eq('token', token)
      .maybeSingle()

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 400 })
    }
    if (!invite) {
      return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 })
    }
    if (invite.accepted_at) {
      return NextResponse.json({ error: 'This invitation has already been accepted' }, { status: 410 })
    }
    if (invite.revoked_at) {
      return NextResponse.json({ error: 'This invitation has been revoked' }, { status: 410 })
    }
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 })
    }

    // Check whether a user with this email already exists in auth.users
    const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers({
      perPage: 1000,
    })
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 })
    }
    const emailLower = invite.email.toLowerCase()
    const existing = existingUsers?.users.find(u => (u.email || '').toLowerCase() === emailLower)

    if (existing) {
      return NextResponse.json(
        {
          error:
            'An account with this email already exists. The existing-user accept flow is not yet supported. Contact an administrator.',
        },
        { status: 409 }
      )
    }

    // Create the auth user
    const { data: createData, error: createError } = await admin.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
    })

    if (createError || !createData?.user) {
      return NextResponse.json(
        { error: createError?.message || 'Failed to create user' },
        { status: 500 }
      )
    }

    const newUserId = createData.user.id

    // Create the organization_members row
    const { error: memberError } = await admin
      .from('organization_members')
      .insert({
        org_id: invite.org_id,
        user_id: newUserId,
        role: invite.role as Role,
        is_primary: false,
        invited_by: invite.invited_by,
        invited_at: new Date().toISOString(),
      })

    if (memberError) {
      // Roll back the user creation if membership insert failed
      await admin.auth.admin.deleteUser(newUserId)
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    // Mark invite as accepted
    const { error: acceptError } = await admin
      .from('team_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id)

    if (acceptError) {
      // Membership exists but invite update failed. Log but do not roll back.
      console.error('Failed to mark invite accepted:', acceptError.message)
    }

    return NextResponse.json({
      ok: true,
      email: invite.email,
      role: invite.role,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
