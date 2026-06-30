import { createServerSupabaseClient } from './supabase-server'
import { createClient } from '@supabase/supabase-js'

export type Role = 'owner' | 'admin' | 'member' | 'client'

export type AuthMember = {
  id: string
  org_id: string
  user_id: string
  role: Role
  is_primary: boolean
}

export type AuthContext = {
  user: { id: string; email: string }
  member: AuthMember
}

/**
 * Admin client for bypassing RLS. Use only when you need to read/write
 * across users, or perform actions the caller's RLS would block.
 */
export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Returns the authenticated user and their organization_members row.
 * Returns null if unauthenticated or not a member of any org.
 *
 * Usage in a route handler:
 *   const ctx = await getAuthContext()
 *   if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 *   // ctx.user.id, ctx.member.org_id, ctx.member.role available
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return null

  // Use admin client to read the membership row, bypassing RLS recursion concerns
  const { data: member, error: memberError } = await adminClient()
    .from('organization_members')
    .select('id, org_id, user_id, role, is_primary')
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError || !member) return null

  return {
    user: { id: user.id, email: user.email ?? '' },
    member: member as AuthMember,
  }
}

/**
 * Role hierarchy check. Returns true if the caller's role is at least the
 * required level. Order: owner > admin > member > client.
 */
export function hasRole(callerRole: Role, requiredRole: Role): boolean {
  const order: Record<Role, number> = { owner: 3, admin: 2, member: 1, client: 0 }
  return order[callerRole] >= order[requiredRole]
}

/**
 * Convenience: throws an HTTP-style error if the caller doesn't meet the
 * required role. Route handlers should catch and return appropriate status.
 */
export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function requireRole(requiredRole: Role): Promise<AuthContext> {
  const ctx = await getAuthContext()
  if (!ctx) throw new AuthError('Unauthorized', 401)
  if (!hasRole(ctx.member.role, requiredRole)) {
    throw new AuthError('Forbidden', 403)
  }
  return ctx
}