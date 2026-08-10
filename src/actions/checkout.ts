'use server'

import { z } from 'zod'
import { db } from '@/lib/db'
import { currentUser } from '@/lib/auth'
import { quoteTotals, formatUSD } from '@/lib/money'
import { notify } from '@/server/admin'
import { getPaymentProvider } from '@/services/payment'
import { sendOrderPlaced } from '@/services/email'
import { absoluteUrl } from '@/config/site'
import { reference } from '@/lib/ids'

const lineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  quantity: z.number().int().min(1).max(99),
})

const checkoutSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(80),
  line1: z.string().min(3).max(120),
  line2: z.string().max(120).optional().or(z.literal('')),
  city: z.string().min(2).max(80),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Enter a valid U.S. ZIP code'),
  lines: z.array(lineSchema).min(1).max(50),
})

export type CheckoutInput = z.input<typeof checkoutSchema>
export type CheckoutResult = { ok: true; orderNumber: string } | { ok: false; error: string }

export async function placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check your details' }

  const { lines, email, fullName, line1, line2, city, state, zip } = parsed.data

  // Re-price from the database. The browser's cart is a suggestion, never a
  // source of prices.
  const products = await db.product.findMany({
    where: { id: { in: lines.map((l) => l.productId) }, active: true },
    select: {
      id: true,
      name: true,
      priceCents: true,
      inventory: true,
      variants: { select: { id: true, optionValue: true, priceDelta: true, inventory: true } },
    },
  })

  const items: { productId: string; name: string; variantName?: string; unitCents: number; quantity: number }[] = []

  for (const line of lines) {
    const product = products.find((p) => p.id === line.productId)
    if (!product) return { ok: false, error: 'An item in your bag is no longer available' }

    const variant = line.variantId ? product.variants.find((v) => v.id === line.variantId) : undefined
    if (line.variantId && !variant) return { ok: false, error: `That option for ${product.name} is unavailable` }

    const stock = variant ? variant.inventory : product.inventory
    if (stock < line.quantity) return { ok: false, error: `Only ${stock} left of ${product.name}` }

    items.push({
      productId: product.id,
      name: product.name,
      variantName: variant?.optionValue,
      unitCents: product.priceCents + (variant?.priceDelta ?? 0),
      quantity: line.quantity,
    })
  }

  const totals = quoteTotals(items.reduce((sum, i) => sum + i.unitCents * i.quantity, 0))
  const number = reference('IB')
  const user = await currentUser()

  const payment = await getPaymentProvider().createPayment({
    amountCents: totals.totalCents,
    orderNumber: number,
    email,
  })
  if (payment.status === 'failed') return { ok: false, error: 'Payment was declined' }

  // Order creation and stock decrements share a transaction so an oversell
  // cannot slip between the check above and the write.
  await db.$transaction([
    db.order.create({
      data: {
        number,
        email,
        userId: user?.id,
        status: 'PAID',
        subtotalCents: totals.subtotalCents,
        shippingCents: totals.shippingCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        shipName: fullName,
        shipLine1: line1,
        shipLine2: line2 || null,
        shipCity: city,
        shipState: state.toUpperCase(),
        shipZip: zip,
        paymentProvider: getPaymentProvider().id,
        paymentReference: payment.reference,
        items: { create: items },
      },
    }),
    ...lines.map((line) =>
      line.variantId
        ? db.variant.update({ where: { id: line.variantId }, data: { inventory: { decrement: line.quantity } } })
        : db.product.update({ where: { id: line.productId }, data: { inventory: { decrement: line.quantity } } }),
    ),
    // On-hand comes down now; `reservedStock` counts the units sold but still
    // on the shelf, which is what a picker needs to see. Fulfilment or
    // cancellation releases it — see actions/admin/orders.ts.
    ...lines.map((line) =>
      db.product.update({ where: { id: line.productId }, data: { reservedStock: { increment: line.quantity } } }),
    ),
    // Every stock movement gets a history row, including the automatic ones.
    ...items.map((item) =>
      db.inventoryAdjustment.create({
        data: {
          productId: item.productId,
          delta: -item.quantity,
          resulting: (products.find((p) => p.id === item.productId)?.inventory ?? item.quantity) - item.quantity,
          reason: 'SOLD',
          note: `Order ${number}`,
          actor: 'checkout',
        },
      }),
    ),
  ])

  // After the transaction, never inside it: the order is real whether or not
  // the receipt gets out, and sendOrderPlaced swallows its own failures.
  await sendOrderPlaced(email, {
    number,
    items,
    ...totals,
    shipName: fullName,
    shipLine1: line1,
    shipLine2: line2 || null,
    shipCity: city,
    shipState: state.toUpperCase(),
    shipZip: zip,
    orderUrl: absoluteUrl(`/checkout/confirmation?order=${number}`),
  })

  await notify({
    type: 'ORDER',
    title: `New order ${number} — ${formatUSD(totals.totalCents)}`,
    body: `${items.length} item${items.length === 1 ? '' : 's'} for ${email}`,
    link: `/admin/orders/${number}`,
  })

  return { ok: true, orderNumber: number }
}
