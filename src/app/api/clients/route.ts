import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { name, industry, website } = body

    if (!name) {
      return NextResponse.json({ error: 'Client name is required' }, { status: 400 })
    }

    const { data: member, error: memberError } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', session.user.id)
      .single()

    if (memberError || !member) {
      return NextResponse.json({ error: 'No organization found: ' + memberError?.message }, { status: 400 })
    }

    const { data: client, error: insertError } = await supabase
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