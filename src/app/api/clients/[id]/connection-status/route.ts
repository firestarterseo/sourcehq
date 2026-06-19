import { NextRequest, NextResponse } from 'next/server'
import { adminClient, getAgencyGoogleStatus } from '@/lib/google-auth'

// Cheap, DATABASE-ONLY connection status for a client. Makes NO Google or
// CallRail API calls and never refreshes tokens, so it cannot time out or
// blank the client page. The heavy property-enumeration route
// (google-properties) is only called when the user opens the picker.
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = adminClient()

  // Google: connected if the client has its own connected google row, OR any
  // agency google account is connected.
  let google = false
  try {
    const { data: clientGoogle } = await supabase
      .from('data_connections')
      .select('status')
      .eq('client_id', id)
      .eq('source_type', 'google')
      .single()
    if (clientGoogle?.status === 'connected') {
      google = true
    } else {
      const agency = await getAgencyGoogleStatus()
      google = !!agency.connected
    }
  } catch {
    try {
      const agency = await getAgencyGoogleStatus()
      google = !!agency.connected
    } catch { google = false }
  }

  // CallRail: connected if the client has a connected callrail row.
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

  return NextResponse.json({ google, callrail })
}
