import { NextRequest, NextResponse } from 'next/server'
import { requireRole, AuthError, adminClient } from '@/lib/auth-context'
import { saveGoogleSelection } from '@/lib/google-auth'

const FIRESTARTER_ORG_ID = 'd3acaf18-a924-4d25-8f5a-99b6893ae843'

// Owner-gated, bulk-onboards approved candidates from the
// discover-agency-accounts review spreadsheet. Takes a POST body of
// { candidates: [...], dryRun: boolean }. Defaults to dryRun: true so
// hitting this without a body, or with dryRun omitted, never writes
// anything - dryRun must be explicitly set to false to actually create
// rows. Idempotent: re-running (even with dryRun: false) skips any
// candidate whose normalized website domain already matches an existing
// client, so this is safe to re-run after fixing individual errors.
//
// Each candidate creates, at most: one `clients` row, one `data_connections`
// row (source_type 'google', covering GSC/GA4/GBP selections together, same
// shape saveGoogleSelection uses for the per-client picker), and one
// `data_connections` row (source_type 'callrail', agency mode) if a CallRail
// match was found. A client with no GA4/GBP/CallRail match still gets
// created with just the GSC property, since GSC verification is what put it
// in the candidate list in the first place.
//
// Hit it once deployed, logged in as owner:
//   POST https://sourcehq.vercel.app/api/admin/bulk-create-clients
//   body: { candidates: [...], dryRun: true }   <- sanity check first
//   body: { candidates: [...], dryRun: false }  <- actually creates rows

interface BulkCandidate {
  domain: string
  name: string
  industry?: string | null
  website: string
  region_guess?: string | null
  gsc_property?: string | null
  google_account?: string | null
  ga4_property?: string | null
  ga4_property_name?: string | null
  gbp_location?: string | null
  gbp_location_name?: string | null
  gbp_google_account?: string | null
  callrail_company_id?: string | null
  callrail_company_name?: string | null
  callrail_account_id?: string | null
}

function normalizeDomain(url: string | null | undefined): string | null {
  if (!url) return null
  return url
    .replace(/^sc-domain:/, '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .toLowerCase()
}

export async function POST(request: NextRequest) {
  try {
    await requireRole('owner')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body with a candidates array' }, { status: 400 })
  }

  const candidates: BulkCandidate[] = Array.isArray(body.candidates) ? body.candidates : []
  const dryRun = body.dryRun !== false // anything other than an explicit `false` stays a dry run

  if (candidates.length === 0) {
    return NextResponse.json({ error: 'No candidates provided' }, { status: 400 })
  }

  const supabase = adminClient()

  // Load existing clients once, so a re-run (or a duplicate domain within
  // this same batch) never creates the same client twice.
  const { data: existingClients } = await supabase.from('clients').select('id, website')
  const existingByDomain = new Set(
    (existingClients || [])
      .map((c: any) => normalizeDomain(c.website))
      .filter((d: any): d is string => Boolean(d))
  )

  const results: any[] = []

  for (const c of candidates) {
    const domain = normalizeDomain(c.website) || normalizeDomain(c.domain)

    if (domain && existingByDomain.has(domain)) {
      results.push({ domain, status: 'skipped_existing' })
      continue
    }

    if (dryRun) {
      results.push({
        domain,
        status: 'would_create',
        name: c.name,
        industry: c.industry || null,
        has_ga4: Boolean(c.ga4_property),
        has_gbp: Boolean(c.gbp_location),
        has_callrail: Boolean(c.callrail_company_id),
      })
      continue
    }

    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .insert({
        org_id: FIRESTARTER_ORG_ID,
        name: c.name,
        industry: c.industry || null,
        website: c.website,
        region: c.region_guess || null,
        active: true,
      })
      .select()
      .single()

    if (clientErr || !client) {
      results.push({ domain, status: 'error', stage: 'client_insert', error: clientErr?.message || 'insert returned no row' })
      continue
    }

    // Mark this domain used immediately, so a duplicate later in the same
    // batch (shouldn't happen, the spreadsheet is deduped, but don't rely on
    // that alone) skips instead of double-inserting.
    if (domain) existingByDomain.add(domain)

    try {
      await saveGoogleSelection(client.id, {
        gsc_property: c.gsc_property || null,
        ga4_property: c.ga4_property || null,
        ga4_property_name: c.ga4_property_name || null,
        gbp_location: c.gbp_location || null,
        gbp_location_name: c.gbp_location_name || null,
        google_account: c.google_account || null,
        gbp_google_account: c.gbp_google_account || c.google_account || null,
      })
    } catch (err: any) {
      results.push({ domain, status: 'partial_error', stage: 'google_connection', client_id: client.id, error: err.message })
      continue
    }

    if (c.callrail_company_id) {
      const { error: crErr } = await supabase.from('data_connections').insert({
        client_id: client.id,
        source_type: 'callrail',
        status: 'connected',
        credentials: {
          mode: 'agency',
          company_id: c.callrail_company_id,
          company_name: c.callrail_company_name || null,
          account_id: c.callrail_account_id || null,
        },
      })
      if (crErr) {
        results.push({ domain, status: 'partial_error', stage: 'callrail_connection', client_id: client.id, error: crErr.message })
        continue
      }
    }

    results.push({ domain, status: 'created', client_id: client.id, name: c.name })
  }

  return NextResponse.json({
    dryRun,
    totalCandidates: candidates.length,
    created: results.filter(r => r.status === 'created').length,
    wouldCreate: results.filter(r => r.status === 'would_create').length,
    skippedExisting: results.filter(r => r.status === 'skipped_existing').length,
    errors: results.filter(r => r.status === 'error' || r.status === 'partial_error').length,
    results,
  })
}
