'use client'

import { useState } from 'react'

// Rule builder for automatic collections. Serialises to one hidden JSON field,
// same contract as the variants editor — the server action parses it with a
// zod schema, so a hand-crafted payload cannot invent a field.

type Condition = { field: string; operator: string; value: string }

const FIELDS = [
  { value: 'tag', label: 'Tag' },
  { value: 'category', label: 'Category slug' },
  { value: 'price', label: 'Price (cents)' },
  { value: 'featured', label: 'Featured' },
]

const OPERATORS = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'gt', label: 'greater than' },
  { value: 'lt', label: 'less than' },
]

export function CollectionRules({
  automatic: initialAutomatic,
  rules,
}: {
  automatic: boolean
  rules: { match: 'all' | 'any'; conditions: Condition[] } | null
}) {
  const [automatic, setAutomatic] = useState(initialAutomatic)
  const [match, setMatch] = useState<'all' | 'any'>(rules?.match ?? 'all')
  const [conditions, setConditions] = useState<Condition[]>(rules?.conditions ?? [])

  return (
    <div className="rounded-lg border border-[var(--admin-line)] p-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="automatic"
          checked={automatic}
          onChange={(event) => setAutomatic(event.target.checked)}
          className="size-4 accent-[var(--color-rose-500)]"
        />
        Automatic collection
      </label>
      <p className="mt-1 text-xs text-[var(--admin-muted)]">
        Members are resolved from these rules. Switching this off keeps the manual list below instead.
      </p>

      {automatic && (
        <div className="mt-3 space-y-2">
          <input type="hidden" name="rules" value={JSON.stringify({ match, conditions })} />

          <label className="flex items-center gap-2 text-xs">
            <span className="text-[var(--admin-muted)]">Match</span>
            <select value={match} onChange={(event) => setMatch(event.target.value as 'all' | 'any')} className="admin-field w-28 py-1 text-xs">
              <option value="all">all rules</option>
              <option value="any">any rule</option>
            </select>
          </label>

          {conditions.map((condition, index) => (
            <div key={index} className="flex flex-wrap items-center gap-1.5">
              <select
                aria-label="Field"
                value={condition.field}
                onChange={(event) => setConditions(conditions.map((c, i) => (i === index ? { ...c, field: event.target.value } : c)))}
                className="admin-field w-32 py-1 text-xs"
              >
                {FIELDS.map((field) => (
                  <option key={field.value} value={field.value}>
                    {field.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Operator"
                value={condition.operator}
                onChange={(event) => setConditions(conditions.map((c, i) => (i === index ? { ...c, operator: event.target.value } : c)))}
                className="admin-field w-28 py-1 text-xs"
              >
                {OPERATORS.map((operator) => (
                  <option key={operator.value} value={operator.value}>
                    {operator.label}
                  </option>
                ))}
              </select>
              <input
                aria-label="Value"
                value={condition.value}
                onChange={(event) => setConditions(conditions.map((c, i) => (i === index ? { ...c, value: event.target.value } : c)))}
                className="admin-field w-28 py-1 text-xs"
              />
              <button type="button" onClick={() => setConditions(conditions.filter((_, i) => i !== index))} className="admin-btn admin-btn-danger px-2 py-1 text-xs">
                ×<span className="sr-only">Remove rule {index + 1}</span>
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setConditions([...conditions, { field: 'tag', operator: 'is', value: '' }])}
            className="admin-btn admin-btn-ghost text-xs"
          >
            Add rule
          </button>
        </div>
      )}
    </div>
  )
}
