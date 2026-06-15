import type { ReactNode } from 'react'

export type SourceCategory =
  | 'Search & Analytics'
  | 'Call & Lead Tracking'
  | 'CRM'
  | 'Email Marketing'
  | 'SEO Tools'

export interface DataSourceDef {
  key: string                 // unique id, also the /data/[source] route segment
  name: string                // display name
  category: SourceCategory
  sublabel: string            // short descriptor under the name
  icon: string                // lucide icon name (resolved in the component)
  status: 'live' | 'soon'     // whether the integration is actually built
  // which Google OAuth-backed sources share the one Google connection
  googleBacked?: boolean
  // route segment for the data detail page, if it has one
  dataRoute?: string
}

// The catalog. Order within a category is display order.
// Adding a new integration = one entry here.
export const DATA_SOURCES: DataSourceDef[] = [
  // Search & Analytics (all share the single Google OAuth connection)
  { key: 'gsc',  name: 'Search Console',   category: 'Search & Analytics', sublabel: 'Organic search demand', icon: 'Search',    status: 'live', googleBacked: true, dataRoute: 'gsc' },
  { key: 'ga4',  name: 'Analytics (GA4)',  category: 'Search & Analytics', sublabel: 'Website engagement',     icon: 'BarChart3', status: 'live', googleBacked: true, dataRoute: 'ga4' },
  { key: 'gbp',  name: 'Business Profile',  category: 'Search & Analytics', sublabel: 'Local / maps presence',  icon: 'MapPin',    status: 'live', googleBacked: true, dataRoute: 'gbp' },
  { key: 'ads',  name: 'Google Ads',        category: 'Search & Analytics', sublabel: 'Paid search demand',     icon: 'Megaphone', status: 'soon', googleBacked: true },

  // Call & Lead Tracking
  { key: 'callrail', name: 'CallRail', category: 'Call & Lead Tracking', sublabel: 'Inbound call tracking', icon: 'Phone', status: 'live', dataRoute: 'callrail' },

  // SEO Tools
  { key: 'ahrefs',  name: 'Ahrefs',  category: 'SEO Tools', sublabel: 'Backlinks & keywords', icon: 'Link2',     status: 'soon' },
  { key: 'semrush', name: 'SEMrush', category: 'SEO Tools', sublabel: 'Competitive SEO',       icon: 'TrendingUp', status: 'soon' },

  // CRM
  { key: 'hubspot',   name: 'HubSpot',   category: 'CRM', sublabel: 'Pipeline & contacts', icon: 'Users',  status: 'soon' },
  { key: 'salesforce',name: 'Salesforce',category: 'CRM', sublabel: 'Pipeline & contacts', icon: 'Cloud',  status: 'soon' },
  { key: 'pipedrive', name: 'Pipedrive', category: 'CRM', sublabel: 'Sales pipeline',       icon: 'Filter', status: 'soon' },

  // Email Marketing
  { key: 'mailchimp',      name: 'Mailchimp',      category: 'Email Marketing', sublabel: 'Email campaigns', icon: 'Mail', status: 'soon' },
  { key: 'activecampaign', name: 'ActiveCampaign', category: 'Email Marketing', sublabel: 'Email & automation', icon: 'Send', status: 'soon' },
]

export const CATEGORY_ORDER: SourceCategory[] = [
  'Search & Analytics',
  'Call & Lead Tracking',
  'CRM',
  'Email Marketing',
  'SEO Tools',
]

