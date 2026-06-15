import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const FIRESTARTER_ORG_ID = 'd3acaf18-a924-4d25-8f5a-99b6893ae843'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, industry, website, region } = body

    if (!name) {
      return NextResponse.json({ error: 'Client name is required' }, { status: 400 })
    }

    const { data: client, error } = await adminClient()
      .from('clients')
      .insert({ org_id: FIRESTARTER_ORG_ID, name, industry, website, region, active: true })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ client })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
