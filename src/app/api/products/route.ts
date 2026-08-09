import { NextResponse } from 'next/server'
import { z } from 'zod'
import { productsByIds } from '@/server/catalog'

// Hydrates wishlist / recently-viewed, which only hold IDs in localStorage.
// Read-only, capped at 12 IDs by the query layer.
const schema = z.object({ ids: z.array(z.string().min(1).max(40)).max(12) })

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const products = await productsByIds(parsed.data.ids)
  return NextResponse.json({ products })
}
