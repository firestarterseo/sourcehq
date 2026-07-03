import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/google-auth'

// Cheap, DATABASE-ONLY connection status for a client. Makes NO Google or
// CallRail API calls and never refreshes tokens, so it cannot time out or
// blank the client page. The heavy property-enumeration route
// (google-properties) is only called when the user opens the picker.
//
// A tile counts as connected only when this specific client actually has the
// relevant property/location selected. Merely having an agency Google account
// connected at the org level is NOT enough - that's what caused every client's
// Google tiles to render green before any setup work had happened.
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = adminClient()

  let gsc = false
  let ga4 = false
  let gbp = false
  try {
    const { data: row } = await supabase
      .from('data_connections')
      .select('status, credentials')
      .eq('client_id', id)
      .eq('source_type', 'google')
      .single()
    if (row?.status === 'connected') {
      const creds: any = row.credentials || {}
      gsc = !!creds.gsc_property
      ga4 = !!creds.ga4_property
      gbp = !!creds.gbp_location
    }
  } catch { /* fall through - all three stay false */ }

  // "google" is retained for callers that still consume the umbrella flag
  // (e.g. code paths that gate on "any Google connected at all"). It is true
  // if any of the three specific pickers are set for this client.
  const google = gsc || ga4 || gbp

  let callrail = false
  try {
    const { data: cr } = await supabase
      .from('data_connections')
      .select('status')
      .eq('client_id', id)
      .eq('source_type', 'callrail')
      .single()
    callrail = cr?.status === 'connected'
  } catch { callrail = false }

  return NextResponse.json({ google, gsc, ga4, gbp, callrail })
}
