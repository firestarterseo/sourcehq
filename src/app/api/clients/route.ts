import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const FIRESTARTER_ORG_ID = 'd3acaf18-a924-4d25-8f5a-99b6893ae843'

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!serviceKey) {
      return NextResponse.json({ error: 'Service key missing' }, { status: 500 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      url,
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

    const adminSupabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: client, error: insertError } = await adminSupabase
      .from('clients')
      .insert({ 
        org_id: FIRESTARTER_ORG_ID, 
        name, 
        industry, 
        website, 
        active: true 
      })
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