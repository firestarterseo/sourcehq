export interface RegionDef {
  key: string
  label: string
  lat: number
  lon: number
  timezone: string
  // FRED metro unemployment series; null = use national (UNRATE)
  fredUnemployment: string | null
  // two-letter USPS state code; null = national (no state)
  state: string | null
  // canonical "City,State,United States" string for cloro geo-targeting; null = national
  cloroLocation: string | null
}

export const REGIONS: RegionDef[] = [
  { key: 'denver',       label: 'Denver Metro, CO',        lat: 39.7392, lon: -104.9903, timezone: 'America/Denver',   fredUnemployment: 'DENV708URN', state: 'CO', cloroLocation: 'Denver,Colorado,United States' },
  { key: 'colorado_springs', label: 'Colorado Springs, CO', lat: 38.8339, lon: -104.8214, timezone: 'America/Denver', fredUnemployment: 'COLO708URN', state: 'CO', cloroLocation: 'Colorado Springs,Colorado,United States' },
  { key: 'tampa',        label: 'Tampa Bay, FL',           lat: 27.9506, lon: -82.4572,  timezone: 'America/New_York', fredUnemployment: 'TAMP112URN', state: 'FL', cloroLocation: 'Tampa,Florida,United States' },
  { key: 'phoenix',      label: 'Phoenix, AZ',             lat: 33.4484, lon: -112.0740, timezone: 'America/Phoenix',  fredUnemployment: 'PHOE004URN', state: 'AZ', cloroLocation: 'Phoenix,Arizona,United States' },
  { key: 'dallas',       label: 'Dallas-Fort Worth, TX',   lat: 32.7767, lon: -96.7970,  timezone: 'America/Chicago',  fredUnemployment: 'DALL148URN', state: 'TX', cloroLocation: 'Dallas,Texas,United States' },
  { key: 'atlanta',      label: 'Atlanta, GA',             lat: 33.7490, lon: -84.3880,  timezone: 'America/New_York', fredUnemployment: 'ATLA013URN', state: 'GA', cloroLocation: 'Atlanta,Georgia,United States' },
  { key: 'chicago',      label: 'Chicago Metro, IL',       lat: 41.8781, lon: -87.6298,  timezone: 'America/Chicago',  fredUnemployment: 'CHIC917URN', state: 'IL', cloroLocation: 'Chicago,Illinois,United States' },
  { key: 'national',     label: 'National (US)',           lat: 39.8283, lon: -98.5795,  timezone: 'America/Chicago',  fredUnemployment: null, state: null, cloroLocation: null },
]

export function getRegion(key: string | null | undefined): RegionDef {
  return REGIONS.find(r => r.key === key) || REGIONS.find(r => r.key === 'national')!
}
