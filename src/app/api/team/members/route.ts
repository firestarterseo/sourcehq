import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, adminClient } from '@/lib/auth-context'

/**
 * GET /api/team/members
 * Lists all members of the caller's org, joined with auth.users for email.
 * Any authenticated org member can call this.
 */
export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = adminClient()

    const { data: members, error } = await admin
      .from('organization_members')
      .select('id, user_id, role, is_primary, joined_at, invited_at')
      .eq('org_id', ctx.member.org_id)
      .order('joined_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Fetch emails from auth.users via admin
    const userIds = (members || []).map(m => m.user_id)
    const emails: Record<string, string> = {}

    if (userIds.length > 0) {
      const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({
        perPage: 1000,
      })
      if (!usersError && usersData?.users) {
        for (const u of usersData.users) {
          if (userIds.includes(u.id)) {
            emails[u.id] = u.email || ''
          }
        }
      }
    }

    const enriched = (members || []).map(m => ({
      id: m.id,
      user_id: m.user_id,
      email: emails[m.user_id] || '',
      role: m.role,
      is_primary: m.is_primary,
      joined_at: m.joined_at,
      invited_at: m.invited_at,
    }))

    return NextResponse.json({ members: enriched })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
