import { NextResponse } from 'next/server'
import { getAllAgencyGoogleTokens } from '@/lib/google-auth'
import { requireRole, AuthError, adminClient } from '@/lib/auth-context'

// Read-only discovery pass, owner-gated. Enumerates every GSC site, GA4
// property, and GBP location reachable across the connected agency Google
// accounts, plus every CallRail company under the agency CallRail key, then
// cross-references against the `clients` table already in Supabase. Nothing
// is written anywhere, this only reads and reports.
//
// This has to live inside the app (not a standalone script) because the
// underlying API keys are stored as Vercel "Sensitive" env vars, which are
// write-only outside the running server process, `vercel env pull` always
// returns them as empty strings.
//
// Hit it once deployed, logged in as owner:
//   GET https://sourcehq.vercel.app/api/admin/discover-agency-accounts

const GSC_API = 'https://searchconsole.googleapis.com/webmasters/v3'
const GA4_ADMIN_API = 'https://analyticsadmin.googleapis.com/v1beta'
const GBP_ACCT_API = 'https://mybusinessaccountmanagement.googleapis.com/v1'
const GBP_INFO_API = 'https://mybusinessbusinessinformation.googleapis.com/v1'
const CALLRAIL_API = 'https://api.callrail.com/v3'

function normalizeDomain(url: string | null | undefined): string | null {
  if (!url) return null
  return url
    .replace(/^sc-domain:/, '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .toLowerCase()
}

async function gscSitesForToken(token: string, email: string) {
  const out: { url: string; account: string }[] = []
  try {
    const res = await fetch(`${GSC_API}/sites`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return out
    const json = await res.json()
    for (const s of json.siteEntry || []) {
      if (s.permissionLevel === 'siteUnverifiedUser') continue
      out.push({ url: s.siteUrl, account: email })
    }
  } catch { /* skip this account */ }
  return out
}

async function ga4PropertiesForToken(token: string, email: string) {
  const out: { id: string; name: string; account: string }[] = []
  let pageToken: string | undefined
  let guard = 0
  try {
    do {
      const u = new URL(`${GA4_ADMIN_API}/accountSummaries`)
      u.searchParams.set('pageSize', '200')
      if (pageToken) u.searchParams.set('pageToken', pageToken)
      const res = await fetch(u.toString(), { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) break
      const json = await res.json()
      for (const acct of json.accountSummaries || []) {
        for (const prop of acct.propertySummaries || []) {
          out.push({ id: prop.property, name: prop.displayName, account: email })
        }
      }
      pageToken = json.nextPageToken || undefined
      guard++
    } while (pageToken && guard < 20)
  } catch { /* skip this account */ }
  return out
}

async function gbpLocationsForToken(token: string, email: string) {
  const out: { id: string; name: string; cityState: string; account: string }[] = []
  try {
    const acctRes = await fetch(`${GBP_ACCT_API}/accounts`, { headers: { Authorization: `Bearer ${token}` } })
    if (!acctRes.ok) return out
    const acctJson = await acctRes.json()
    for (const acct of acctJson.accounts || []) {
      const locRes = await fetch(
        `${GBP_INFO_API}/${acct.name}/locations?readMask=name,title,storefrontAddress&pageSize=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!locRes.ok) continue
      const locJson = await locRes.json()
      for (const loc of locJson.locations || []) {
        const addr = loc.storefrontAddress
        const cityState = addr ? `${addr.locality || ''}${addr.administrativeArea ? ', ' + addr.administrativeArea : ''}` : ''
        out.push({ id: loc.name, name: loc.title || loc.name, cityState, account: email })
      }
    }
  } catch { /* skip this account */ }
  return out
}

async function callrailCompanies(agencyKey: string) {
  const headers = { Authorization: `Token token="${agencyKey}"` }
  const out: { id: string; name: string; account_id: string }[] = []
  try {
    const accRes = await fetch(`${CALLRAIL_API}/a.json`, { headers })
    if (!accRes.ok) return out
    const accJson = await accRes.json()
    for (const acct of accJson.accounts || []) {
      const compRes = await fetch(`${CALLRAIL_API}/a/${acct.id}/companies.json`, { headers })
      if (!compRes.ok) continue
      const compJson = await compRes.json()
      for (const c of compJson.companies || []) {
        out.push({ id: c.id, name: c.name, account_id: acct.id })
      }
    }
  } catch { /* ignore */ }
  return out
}

function dedupBy<T>(arr: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>()
  return arr.filter(x => {
    const k = key(x)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export async function GET() {
  try {
    await requireRole('owner')
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }

  const tokens = await getAllAgencyGoogleTokens()

  const gscSites: { url: string; account: string }[] = []
  const ga4Properties: { id: string; name: string; account: string }[] = []
  const gbpLocations: { id: string; name: string; cityState: string; account: string }[] = []

  for (const { email, token } of tokens) {
    gscSites.push(...await gscSitesForToken(token, email))
    ga4Properties.push(...await ga4PropertiesForToken(token, email))
    gbpLocations.push(...await gbpLocationsForToken(token, email))
  }

  const dedupGsc = dedupBy(gscSites, s => s.url)
  const dedupGa4 = dedupBy(ga4Properties, p => p.id)
  const dedupGbp = dedupBy(gbpLocations, l => l.id)

  let callrailList: { id: string; name: string; account_id: string }[] = []
  if (process.env.CALLRAIL_AGENCY_KEY) {
    callrailList = await callrailCompanies(process.env.CALLRAIL_AGENCY_KEY)
  }

  const { data: existingClients } = await adminClient()
    .from('clients')
    .select('id, name, website, industry, active')

  const clientByDomain = new Map<string, any>()
  for (const c of existingClients || []) {
    const d = normalizeDomain(c.website)
    if (d) clientByDomain.set(d, c)
  }

  const matched: any[] = []
  const newDomains: any[] = []
  for (const site of dedupGsc) {
    const domain = normalizeDomain(site.url)
    const client = domain ? clientByDomain.get(domain) : null
    if (client) {
      matched.push({ domain, gsc_account: site.account, client_id: client.id, client_name: client.name, client_industry: client.industry, client_active: client.active })
    } else {
      newDomains.push({ domain, gsc_url: site.url, account: site.account })
    }
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    totals: {
      connectedGoogleAccounts: tokens.map(t => t.email),
      gscSites: dedupGsc.length,
      ga4Properties: dedupGa4.length,
      gbpLocations: dedupGbp.length,
      callrailCompanies: callrailList.length,
      existingSourcehqClients: (existingClients || []).length,
      gscDomainsMatchedToExistingClient: matched.length,
      gscDomainsWithNoExistingClient: newDomains.length,
    },
    matchedToExistingClients: matched,
    newDomainsFoundViaGSC: newDomains,
    allGa4Properties: dedupGa4,
    allGbpLocations: dedupGbp,
    allCallrailCompanies: callrailList,
  })
}
