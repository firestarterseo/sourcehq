import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, adminClient, hasRole, type Role } from '@/lib/auth-context'

const VALID_ROLES: Role[] = ['owner', 'admin', 'member']

/**
 * PATCH /api/team/members/[id]
 * Body: { role: 'owner' | 'admin' | 'member' }
 * Changes a member role. Owner-protection rules apply.
 */
export async function PATCH(
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
    const body = await request.json()
    const newRole = String(body.role || '') as Role

    if (!VALID_ROLES.includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const admin = adminClient()

    const { data: target, error: lookupError } = await admin
      .from('organization_members')
      .select('id, org_id, user_id, role, is_primary')
      .eq('id', id)
      .maybeSingle()

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 400 })
    }
    if (!target) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    if (target.org_id !== ctx.member.org_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (target.user_id === ctx.user.id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 403 })
    }

    if (target.is_primary) {
      return NextResponse.json(
        { error: 'Cannot change the Primary Owner role. Use transfer ownership instead.' },
        { status: 403 }
      )
    }

    if (target.role === 'owner' && !ctx.member.is_primary) {
      return NextResponse.json(
        { error: 'Only the Primary Owner can change another Owner role' },
        { status: 403 }
      )
    }

    if (newRole === 'owner' && ctx.member.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only Owners can promote a member to Owner' },
        { status: 403 }
      )
    }

    const { error: updateError } = await admin
      .from('organization_members')
      .update({ role: newRole })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/**
 * DELETE /api/team/members/[id]
 * Removes a member from the org. Owner-protection rules apply.
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
    const admin = adminClient()

    const { data: target, error: lookupError } = await admin
      .from('organization_members')
      .select('id, org_id, user_id, role, is_primary')
      .eq('id', id)
      .maybeSingle()

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 400 })
    }
    if (!target) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }
    if (target.org_id !== ctx.member.org_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (target.user_id === ctx.user.id) {
      return NextResponse.json({ error: 'Cannot remove yourself from the org' }, { status: 403 })
    }

    if (target.is_primary) {
      return NextResponse.json(
        { error: 'Cannot remove the Primary Owner. Use transfer ownership first.' },
        { status: 403 }
      )
    }

    if (target.role === 'owner' && !ctx.member.is_primary) {
      return NextResponse.json(
        { error: 'Only the Primary Owner can remove another Owner' },
        { status: 403 }
      )
    }

    const { error: deleteError } = await admin
      .from('organization_members')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
