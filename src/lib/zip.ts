// US ZIP ↔ state.
//
// The relationship only runs one way. A ZIP code determines its state; a state
// does not determine a ZIP — Texas alone has roughly 2,600 of them. So this
// fills the *state* from the ZIP the shopper types, and refuses the pair when
// they disagree. Guessing a ZIP from a state would put a plausible, wrong
// address on every order.
//
// The table is by three-digit prefix, which is how USPS allocates them: a
// prefix belongs to exactly one state. That is ~90 ranges rather than 41,000
// rows, and it needs no API call at checkout.

type Range = readonly [start: number, end: number, state: string]

// Sorted by prefix. Gaps are unassigned prefixes and correctly resolve to null.
const RANGES: readonly Range[] = [
  [5, 5, 'NY'],
  [6, 7, 'PR'], [8, 8, 'VI'], [9, 9, 'PR'],
  [10, 27, 'MA'], [28, 29, 'RI'], [30, 38, 'NH'], [39, 49, 'ME'],
  [50, 59, 'VT'], [60, 69, 'CT'], [70, 89, 'NJ'],
  [90, 98, 'AE'],
  [100, 149, 'NY'], [150, 196, 'PA'], [197, 199, 'DE'],
  [200, 205, 'DC'], [206, 219, 'MD'], [220, 246, 'VA'], [247, 268, 'WV'],
  [270, 289, 'NC'], [290, 299, 'SC'],
  [300, 319, 'GA'], [320, 339, 'FL'], [340, 340, 'AA'], [341, 349, 'FL'],
  [350, 369, 'AL'], [370, 385, 'TN'], [386, 397, 'MS'], [398, 399, 'GA'],
  [400, 427, 'KY'], [430, 459, 'OH'], [460, 479, 'IN'], [480, 499, 'MI'],
  [500, 528, 'IA'], [530, 549, 'WI'], [550, 567, 'MN'], [569, 569, 'DC'],
  [570, 577, 'SD'], [580, 588, 'ND'], [590, 599, 'MT'],
  [600, 629, 'IL'], [630, 658, 'MO'], [660, 679, 'KS'], [680, 693, 'NE'],
  [700, 714, 'LA'], [716, 729, 'AR'], [730, 749, 'OK'],
  [750, 799, 'TX'],
  [800, 816, 'CO'], [820, 831, 'WY'], [832, 838, 'ID'], [840, 847, 'UT'],
  [850, 865, 'AZ'], [870, 884, 'NM'], [885, 885, 'TX'], [889, 898, 'NV'],
  [900, 961, 'CA'], [962, 966, 'AP'], [967, 968, 'HI'], [969, 969, 'GU'],
  [970, 979, 'OR'], [980, 994, 'WA'], [995, 999, 'AK'],
]

/** Every state this store can ship to, in the order the form lists them. */
export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
  'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY',
  'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
  'WI', 'WY', 'DC',
] as const

export const ZIP_PATTERN = /^\d{5}(-\d{4})?$/

export function isValidZip(zip: string): boolean {
  return ZIP_PATTERN.test(zip.trim())
}

/**
 * The state a ZIP belongs to, or null when the ZIP is malformed or its prefix
 * is unassigned. Binary search over the sorted ranges.
 */
export function stateForZip(zip: string): string | null {
  const trimmed = zip.trim()
  if (!ZIP_PATTERN.test(trimmed)) return null

  const prefix = Number(trimmed.slice(0, 3))
  let low = 0
  let high = RANGES.length - 1

  while (low <= high) {
    const mid = (low + high) >> 1
    const [start, end, state] = RANGES[mid]
    if (prefix < start) high = mid - 1
    else if (prefix > end) low = mid + 1
    else return state
  }
  return null
}

/**
 * Do this ZIP and state agree?
 *
 * An unassigned prefix returns true rather than false: the table is a snapshot
 * of USPS allocations and new prefixes do appear. Blocking a real customer over
 * a stale table is a worse failure than accepting a rare mismatch, and the
 * carrier rejects a genuinely undeliverable address anyway.
 */
export function zipMatchesState(zip: string, state: string): boolean {
  const resolved = stateForZip(zip)
  return resolved === null || resolved === state.trim().toUpperCase()
}
