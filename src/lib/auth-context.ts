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

export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session?.user) return null
  const user = session.user

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

export function hasRole(callerRole: Role, requiredRole: Role): boolean {
  const order: Record<Role, number> = { owner: 3, admin: 2, member: 1, client: 0 }
  return order[callerRole] >= order[requiredRole]
}

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
