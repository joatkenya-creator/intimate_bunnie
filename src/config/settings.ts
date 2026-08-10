// Settings are JSON rows keyed by group. The shape and the defaults live here so
// a missing row reads as "the default", never as a crash, and adding a field is
// one line rather than a migration.

export type SettingsGroups = {
  general: {
    storeName: string
    tagline: string
    supportEmail: string
    phone: string
    timezone: string
    weightUnit: 'g' | 'oz'
    orderPrefix: string
  }
  branding: {
    primaryColor: string
    accentColor: string
    logoUrl: string
    faviconUrl: string
    announcement: string
    announcementActive: boolean
  }
  currency: {
    code: string
    symbol: string
    position: 'before' | 'after'
    // Basis points against the base currency, so no float ever holds a rate.
    rates: Record<string, number>
  }
  tax: {
    inclusive: boolean
    defaultRateBps: number
    // Overrides keyed by two-letter state code, also in basis points.
    stateRatesBps: Record<string, number>
    taxShipping: boolean
  }
  shipping: {
    freeThresholdCents: number
    flatRateCents: number
    expeditedCents: number
    originZip: string
    carriers: string[]
  }
  email: {
    fromName: string
    fromAddress: string
    replyTo: string
    bccOrders: string
    provider: 'resend' | 'none'
  }
  payments: {
    gateways: { id: string; label: string; enabled: boolean; mode: 'test' | 'live' }[]
    captureOnOrder: boolean
  }
  legal: {
    businessName: string
    address: string
    vatId: string
    policyPages: { label: string; slug: string }[]
  }
  features: Record<string, boolean>
}

export type SettingsGroup = keyof SettingsGroups

export const SETTINGS_DEFAULTS: SettingsGroups = {
  general: {
    storeName: 'Intimate Bunnie',
    tagline: 'Pleasure, beautifully considered.',
    supportEmail: 'care@intimatebunnie.com',
    phone: '',
    timezone: 'America/New_York',
    weightUnit: 'g',
    orderPrefix: 'IB',
  },
  branding: {
    primaryColor: '#e91e63',
    accentColor: '#ffd4c0',
    logoUrl: '',
    faviconUrl: '',
    announcement: 'Discreet plain packaging · Free U.S. shipping over $59',
    announcementActive: true,
  },
  currency: {
    code: 'USD',
    symbol: '$',
    position: 'before',
    rates: { USD: 10_000 },
  },
  tax: {
    inclusive: false,
    defaultRateBps: 725,
    stateRatesBps: {},
    taxShipping: false,
  },
  shipping: {
    freeThresholdCents: 5900,
    flatRateCents: 599,
    expeditedCents: 1499,
    originZip: '',
    carriers: ['USPS', 'UPS'],
  },
  email: {
    fromName: 'Intimate Bunnie',
    fromAddress: 'care@intimatebunnie.com',
    replyTo: 'care@intimatebunnie.com',
    bccOrders: '',
    provider: 'resend',
  },
  payments: {
    gateways: [
      { id: 'dev', label: 'Development (records intents)', enabled: true, mode: 'test' },
      { id: 'klarna', label: 'Klarna', enabled: false, mode: 'test' },
    ],
    captureOnOrder: true,
  },
  legal: {
    businessName: 'Intimate Bunnie LLC',
    address: '',
    vatId: '',
    policyPages: [
      { label: 'Privacy Policy', slug: 'privacy' },
      { label: 'Terms of Service', slug: 'terms' },
      { label: 'Returns', slug: 'returns' },
    ],
  },
  features: {
    ageGate: true,
    reviews: true,
    wishlist: true,
    blog: true,
    storeCredit: false,
    giftCards: false,
    multiWarehouse: false,
  },
}

export const SETTINGS_GROUPS: { key: SettingsGroup; label: string; description: string }[] = [
  { key: 'general', label: 'General', description: 'Store identity, contact, and units.' },
  { key: 'branding', label: 'Branding', description: 'Colours, logo, and the announcement bar.' },
  { key: 'currency', label: 'Currencies', description: 'Display currency and conversion rates.' },
  { key: 'tax', label: 'Taxes', description: 'Default and per-state rates.' },
  { key: 'shipping', label: 'Shipping', description: 'Thresholds, flat rates, and carriers.' },
  { key: 'email', label: 'Email', description: 'Sender identity and transactional routing.' },
  { key: 'payments', label: 'Payment gateways', description: 'Which providers are live.' },
  { key: 'legal', label: 'Legal', description: 'Business details and policy pages.' },
  { key: 'features', label: 'Feature flags', description: 'Switch storefront capabilities on and off.' },
]
