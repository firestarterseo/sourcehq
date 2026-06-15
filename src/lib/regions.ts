export interface RegionDef {
  key: string
  label: string
  lat: number
  lon: number
  timezone: string
  // FRED metro unemployment series; null = use national (UNRATE)
  fredUnemployment: string | null
}

export const REGIONS: RegionDef[] = [
  { key: 'denver',       label: 'Denver Metro, CO',        lat: 39.7392, lon: -104.9903, timezone: 'America/Denver',   fredUnemployment: 'DENV708URN' },
  { key: 'colorado_springs', label: 'Colorado Springs, CO', lat: 38.8339, lon: -104.8214, timezone: 'America/Denver', fredUnemployment: 'COLO708URN' },
  { key: 'tampa',        label: 'Tampa Bay, FL',           lat: 27.9506, lon: -82.4572,  timezone: 'America/New_York', fredUnemployment: 'TAMP112URN' },
  { key: 'phoenix',      label: 'Phoenix, AZ',             lat: 33.4484, lon: -112.0740, timezone: 'America/Phoenix',  fredUnemployment: 'PHOE004URN' },
  { key: 'dallas',       label: 'Dallas-Fort Worth, TX',   lat: 32.7767, lon: -96.7970,  timezone: 'America/Chicago',  fredUnemployment: 'DALL148URN' },
  { key: 'atlanta',      label: 'Atlanta, GA',             lat: 33.7490, lon: -84.3880,  timezone: 'America/New_York', fredUnemployment: 'ATLA013URN' },
  { key: 'national',     label: 'National (US)',           lat: 39.8283, lon: -98.5795,  timezone: 'America/Chicago',  fredUnemployment: null },
]

export function getRegion(key: string | null | undefined): RegionDef {
  return REGIONS.find(r => r.key === key) || REGIONS.find(r => r.key === 'national')!
}
