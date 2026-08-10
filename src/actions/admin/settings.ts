'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { auditData } from '@/lib/rbac'
import { run } from '@/server/guard'
import { SETTINGS_DEFAULTS, type SettingsGroup } from '@/config/settings'
import type { ActionState } from '@/lib/form'

/**
 * One action saves every settings group. The defaults object is the schema: a
 * field's default type decides how its form value is coerced, so adding a
 * setting means adding one line to `SETTINGS_DEFAULTS` and one input — never a
 * new action, a new parser, and a new migration.
 */
export async function saveSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('settings.write', async (admin) => {
    const group = String(form.get('group') ?? '') as SettingsGroup
    const defaults = SETTINGS_DEFAULTS[group]
    if (!defaults) return { error: 'Unknown settings group' }

    // Feature flags are a free-form map, so their keys come from the form, not
    // from the defaults.
    if (group === 'features') {
      const flags: Record<string, boolean> = {}
      for (const key of Object.keys(SETTINGS_DEFAULTS.features)) flags[key] = form.get(`flag:${key}`) === 'on'
      for (const [key, value] of form.entries()) {
        if (key.startsWith('flag:')) flags[key.slice(5)] = value === 'on'
      }
      await persist(group, flags, admin)
      return { ok: 'Feature flags saved' }
    }

    const value: Record<string, unknown> = {}
    for (const [key, fallback] of Object.entries(defaults as Record<string, unknown>)) {
      const raw = form.get(key)

      if (typeof fallback === 'boolean') {
        value[key] = raw === 'on' || raw === 'true'
      } else if (typeof fallback === 'number') {
        const parsed = Number(String(raw ?? ''))
        value[key] = Number.isFinite(parsed) ? Math.round(parsed) : fallback
      } else if (typeof fallback === 'object' && fallback !== null) {
        // Structured settings ship as JSON in a textarea. A bespoke editor per
        // shape would be five editors for five screens nobody opens weekly.
        try {
          value[key] = raw ? JSON.parse(String(raw)) : fallback
        } catch {
          return { error: `${key} is not valid JSON.`, fieldErrors: { [key]: 'Invalid JSON' } }
        }
      } else {
        value[key] = String(raw ?? '')
      }
    }

    await persist(group, value, admin)
    return { ok: 'Settings saved' }
  })
}

async function persist(group: string, value: object, admin: { id: string; email: string }) {
  await db.setting.upsert({
    where: { key: group },
    create: { key: group, value: value as object, updatedBy: admin.email },
    update: { value: value as object, updatedBy: admin.email },
  })
  await db.auditLog.create({ data: auditData(admin, 'settings.update', group) })
  revalidatePath('/admin/settings')
  // Branding and feature flags reach the storefront chrome.
  revalidatePath('/', 'layout')
}
