import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { name, industry, website } = body

    if (!name) {
      return NextResponse.json({ error: 'Client name is required' }, { status: 400 })
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: member, error: memberError } = await adminSupabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', session.user.id)
      .single()

    if (memberError || !member) {
      return NextResponse.json({ error: 'No organization found: ' + memberError?.message }, { status: 400 })
    }

    const { data: client, error: insertError } = await adminSupabase
      .from('clients')
      .insert({ org_id: member.org_id, name, industry, website, active: true })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json({ client })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}