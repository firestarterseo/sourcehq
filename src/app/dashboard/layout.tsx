import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { adminClient } from '@/lib/auth-context'

// Defense-in-depth: middleware.ts already redirects unauthenticated requests
// to /dashboard/* before they reach any page component. This layout repeats
// the check server-side so an individual dashboard page is never accidentally
// exposed if the middleware matcher is ever narrowed or bypassed.
//
// It also checks org membership, not just "is there a session": /auth/google
// calls signInWithOAuth with no domain restriction, so any Google account can
// currently complete sign-in and get a valid Supabase session. Requiring an
// organization_members row here means a stranger who signs in that way still
// can't see any client data - the invite flow (accept-invite) is what actually
// grants access. See auth-context.ts's getAuthContext, which this mirrors.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/login')
  }

  const { data: member, error: memberError } = await adminClient()
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError || !member) {
    redirect('/auth/login?error=unauthorized')
  }

  return children
}
