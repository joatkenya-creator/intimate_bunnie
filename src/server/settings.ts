import 'server-only'
import { query } from '@/lib/sql'
import { SETTINGS_DEFAULTS, type SettingsGroup, type SettingsGroups } from '@/config/settings'

// Settings reads live here rather than in server/admin.ts because the storefront
// header needs branding on every request. Importing the admin query layer would
// drag Prisma into the public path, and the WASM engine cannot be instantiated
// inside the free plan's CPU budget.

/** Stored values merged over the defaults, so a new field never reads undefined. */
export async function getSettings<G extends SettingsGroup>(group: G): Promise<SettingsGroups[G]> {
  const rows = await query<{ value: unknown }>('SELECT "value" FROM "Setting" WHERE "key" = $1', [group]).catch(() => [])
  return { ...SETTINGS_DEFAULTS[group], ...((rows[0]?.value as object | null) ?? {}) }
}

export async function getAllSettings(): Promise<SettingsGroups> {
  const rows = await query<{ key: string; value: unknown }>('SELECT "key", "value" FROM "Setting"').catch(() => [])
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value])) as Partial<SettingsGroups>

  return Object.fromEntries(
    Object.entries(SETTINGS_DEFAULTS).map(([key, defaults]) => [
      key,
      { ...defaults, ...((stored[key as SettingsGroup] as object | undefined) ?? {}) },
    ]),
  ) as SettingsGroups
}
