// All money is integer USD cents. Intl.NumberFormat is native — no date/money lib.
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function formatUSD(cents: number): string {
  return usd.format(cents / 100)
}

export function percentOff(priceCents: number, compareCents?: number | null): number | null {
  if (!compareCents || compareCents <= priceCents) return null
  return Math.round(((compareCents - priceCents) / compareCents) * 100)
}

export const FREE_SHIPPING_THRESHOLD_CENTS = 5900
export const FLAT_SHIPPING_CENTS = 599
// Single blended rate. Real per-state nexus rates belong in a tax provider,
// not in application code.
export const TAX_RATE = 0.0725

export function quoteTotals(subtotalCents: number) {
  const shippingCents = subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS || subtotalCents === 0 ? 0 : FLAT_SHIPPING_CENTS
  const taxCents = Math.round(subtotalCents * TAX_RATE)
  return { subtotalCents, shippingCents, taxCents, totalCents: subtotalCents + shippingCents + taxCents }
}
