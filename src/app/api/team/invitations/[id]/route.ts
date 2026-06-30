import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, adminClient, hasRole } from '@/lib/auth-context'

/**
 * DELETE /api/team/invitations/[id]
 * Revokes a pending invitation. Sets revoked_at = now().
 * Requires Owner or Admin role, and the invitation must belong to the caller's org.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!hasRole(ctx.member.role, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Invitation id is required' }, { status: 400 })
    }

    const admin = adminClient()

    // Verify the invitation belongs to the caller's org and isn't already finalized
    const { data: invite, error: lookupError } = await admin
      .from('team_invitations')
      .select('id, org_id, accepted_at, revoked_at')
      .eq('id', id)
      .maybeSingle()

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 400 })
    }
    if (!invite) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }
    if (invite.org_id !== ctx.member.org_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (invite.accepted_at) {
      return NextResponse.json(
        { error: 'Invitation has already been accepted and cannot be revoked' },
        { status: 409 }
      )
    }
    if (invite.revoked_at) {
      return NextResponse.json({ error: 'Invitation is already revoked' }, { status: 409 })
    }

    const { error: updateError } = await admin
      .from('team_invitations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}