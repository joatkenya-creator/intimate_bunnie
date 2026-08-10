// Return eligibility. Pure — no database, no server-only — so the policy is
// unit tested rather than trusted. The customer-facing wording it enforces is
// on /pages/returns; the two must agree.

export const RETURN_WINDOW_DAYS = 30

// The policy runs 30 days from *delivery*, but no delivery timestamp is
// recorded anywhere, so the clock starts at the order date plus typical transit.
// Erring long is the cheap mistake: a few days of extra grace costs far less
// than refusing a return that the policy actually allows.
const TRANSIT_ALLOWANCE_DAYS = 5

const DAY_MS = 24 * 60 * 60 * 1000

/** Only a paid or shipped order can come back. */
const RETURNABLE_STATUSES = new Set(['PAID', 'FULFILLED'])

export function returnDeadline(orderedAt: Date): Date {
  return new Date(orderedAt.getTime() + (RETURN_WINDOW_DAYS + TRANSIT_ALLOWANCE_DAYS) * DAY_MS)
}

export function isReturnable(order: { status: string; createdAt: Date }, now: Date = new Date()): boolean {
  return RETURNABLE_STATUSES.has(order.status) && now <= returnDeadline(order.createdAt)
}

export function daysLeftToReturn(order: { createdAt: Date }, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((returnDeadline(order.createdAt).getTime() - now.getTime()) / DAY_MS))
}

// ponytail: one flat address for every approval. When a carrier account exists,
// this becomes a generated prepaid label instead of a paragraph.
export const RETURN_INSTRUCTIONS =
  'Pack the items in their original, unopened packaging and post them to the return address printed on your delivery slip. Write your RMA number on the outside of the parcel. We refund within two business days of the parcel reaching us.'
