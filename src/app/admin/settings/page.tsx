import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { getAllSettings } from '@/server/admin'
import { SETTINGS_DEFAULTS, SETTINGS_GROUPS, type SettingsGroup } from '@/config/settings'
import { saveSettings } from '@/actions/admin/settings'
import { PageHeader, Panel, Tabs } from '@/components/admin/ui'
import { AdminForm, TextField, TextArea, Toggle, SelectField } from '@/components/admin/forms'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Settings' }

// One form for nine groups. Field types come from the shape of the defaults, so
// a new setting is a line in config/settings.ts and nothing else.

const LABELS: Record<string, string> = {
  storeName: 'Store name',
  supportEmail: 'Support email',
  weightUnit: 'Weight unit',
  orderPrefix: 'Order number prefix',
  primaryColor: 'Primary colour',
  accentColor: 'Accent colour',
  logoUrl: 'Logo URL',
  faviconUrl: 'Favicon URL',
  announcementActive: 'Show the announcement bar',
  defaultRateBps: 'Default rate (basis points)',
  stateRatesBps: 'Per-state rates (JSON, basis points)',
  taxShipping: 'Charge tax on shipping',
  freeThresholdCents: 'Free shipping threshold (cents)',
  flatRateCents: 'Flat rate (cents)',
  expeditedCents: 'Expedited rate (cents)',
  originZip: 'Ship-from ZIP',
  fromName: 'Sender name',
  fromAddress: 'Sender address',
  replyTo: 'Reply-to',
  bccOrders: 'BCC order receipts to',
  captureOnOrder: 'Capture payment when the order is placed',
  businessName: 'Legal business name',
  vatId: 'VAT / tax ID',
  policyPages: 'Policy pages (JSON)',
  rates: 'Conversion rates (JSON, basis points)',
  gateways: 'Gateways (JSON)',
  carriers: 'Carriers (JSON array)',
  inclusive: 'Prices include tax',
}

function labelFor(key: string): string {
  return LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (character) => character.toUpperCase())
}

const CHOICES: Record<string, { value: string; label: string }[]> = {
  weightUnit: [
    { value: 'g', label: 'Grams' },
    { value: 'oz', label: 'Ounces' },
  ],
  position: [
    { value: 'before', label: 'Before the amount' },
    { value: 'after', label: 'After the amount' },
  ],
  provider: [
    { value: 'resend', label: 'Resend' },
    { value: 'none', label: 'None — log only' },
  ],
}

export default async function AdminSettings({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  await requirePagePermission('settings.read')
  const { group: groupParam } = await searchParams
  const mayWrite = await hasPermission('settings.write')

  const group = (SETTINGS_GROUPS.find((entry) => entry.key === groupParam)?.key ?? 'general') as SettingsGroup
  const meta = SETTINGS_GROUPS.find((entry) => entry.key === group)!
  const settings = await getAllSettings()
  const values = settings[group] as Record<string, unknown>

  return (
    <>
      <PageHeader title="Settings" description="Stored as JSON rows keyed by group — a missing value reads as its default." />

      <Tabs
        current={`/admin/settings?group=${group}`}
        tabs={SETTINGS_GROUPS.map((entry) => ({ href: `/admin/settings?group=${entry.key}`, label: entry.label }))}
      />

      <Panel title={meta.label} description={meta.description} className="mt-3">
        {!mayWrite ? (
          <pre className="admin-scroll rounded bg-[var(--admin-raised)] p-3 text-xs">{JSON.stringify(values, null, 2)}</pre>
        ) : (
          <AdminForm action={saveSettings} key={group}>
            <input type="hidden" name="group" value={group} />

            {group === 'features' ? (
              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="admin-label">Storefront capabilities</legend>
                {Object.entries(values as Record<string, boolean>).map(([key, enabled]) => (
                  <Toggle key={key} label={labelFor(key)} name={`flag:${key}`} defaultChecked={enabled} />
                ))}
              </fieldset>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {Object.entries(SETTINGS_DEFAULTS[group] as Record<string, unknown>).map(([key, fallback]) => {
                  const value = values[key]

                  if (typeof fallback === 'boolean') {
                    return <Toggle key={key} label={labelFor(key)} name={key} defaultChecked={Boolean(value)} />
                  }
                  if (typeof fallback === 'object' && fallback !== null) {
                    return (
                      <div key={key} className="lg:col-span-2">
                        <TextArea
                          label={labelFor(key)}
                          name={key}
                          rows={5}
                          defaultValue={JSON.stringify(value ?? fallback, null, 2)}
                          hint="Edited as JSON — a bespoke editor for a screen opened twice a year is not worth writing."
                        />
                      </div>
                    )
                  }
                  if (CHOICES[key]) {
                    return <SelectField key={key} label={labelFor(key)} name={key} defaultValue={String(value ?? '')} options={CHOICES[key]} />
                  }
                  return (
                    <TextField
                      key={key}
                      label={labelFor(key)}
                      name={key}
                      type={typeof fallback === 'number' ? 'number' : 'text'}
                      defaultValue={String(value ?? '')}
                    />
                  )
                })}
              </div>
            )}
          </AdminForm>
        )}
      </Panel>

      <Panel title="What these actually drive" className="mt-4">
        <ul className="space-y-1.5 text-sm text-[var(--admin-muted)]">
          <li><strong>General &amp; legal</strong> — invoice and packing-slip headers.</li>
          <li><strong>Branding</strong> — announcement bar copy and admin accent colour.</li>
          <li><strong>Email</strong> — sender identity; delivery still needs <code>RESEND_API_KEY</code>.</li>
          <li>
            <strong>Tax, shipping, currency, gateways</strong> — read by the admin today. Checkout still prices from
            <code> lib/money.ts</code> and <code>services/payment.ts</code>; point those at these rows when you replace the
            blended rate with real ones.
          </li>
          <li><strong>Feature flags</strong> — read wherever a capability is optional.</li>
        </ul>
      </Panel>
    </>
  )
}
