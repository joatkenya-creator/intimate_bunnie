'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { query, transaction } from '@/lib/sql'
import { currentUser } from '@/lib/auth'
import { rateLimit, clientIp } from '@/lib/security'
import { checkBotId } from 'botid/server'
import { quoteTotals, formatUSD } from '@/lib/money'
import { notify } from '@/server/notifications'
import { getPaymentProvider } from '@/services/payment'
import { sendOrderPlaced } from '@/services/email'
import { absoluteUrl } from '@/config/site'
import { reference, newId } from '@/lib/ids'
import { ZIP_PATTERN, zipMatchesState } from '@/lib/zip'

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
  zip: z.string().regex(ZIP_PATTERN, 'Enter a valid U.S. ZIP code'),
  lines: z.array(lineSchema).min(1).max(50),
})
  // The browser fills the state from the ZIP, but a form post is not obliged to
  // agree with it. Checking the pair here is what stops a mismatched address
  // reaching a shipping label.
  .refine((value) => zipMatchesState(value.zip, value.state), {
    path: ['zip'],
    message: 'That ZIP code is not in the state you selected. Check both.',
  })

export type CheckoutInput = z.input<typeof checkoutSchema>
export type CheckoutResult = { ok: true; orderNumber: string } | { ok: false; error: string }

export async function placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check your details' }

  // Card testing is a scripted loop of small orders against stolen numbers. The
  // dev provider makes it harmless today and a chargeback problem the day a
  // real one replaces it. A genuine shopper who mistypes a card a few times
  // stays well inside this.
  if (!rateLimit(`checkout:${clientIp(await headers())}`, 10, 10 * 60_000)) {
    return { ok: false, error: 'Too many attempts. Wait a few minutes and try again.' }
  }

  // The counter caps the volume; BotID catches the headless browser doing it at
  // a human pace. Checked after the counter because it is the billable one.
  if ((await checkBotId()).isBot) {
    return { ok: false, error: 'We could not verify this request. Refresh the page and try again.' }
  }

  const { lines, email, fullName, line1, line2, city, state, zip } = parsed.data

  // Re-price from the database. The browser's cart is a suggestion, never a
  // source of prices.
  const products = await query<{
    id: string
    name: string
    priceCents: number
    inventory: number
    variants: { id: string; optionValue: string; priceDelta: number; inventory: number }[]
  }>(
    `SELECT p."id", p."name", p."priceCents", p."inventory",
       COALESCE((
         SELECT json_agg(json_build_object('id', v."id", 'optionValue', v."optionValue",
                                           'priceDelta', v."priceDelta", 'inventory', v."inventory"))
         FROM "Variant" v WHERE v."productId" = p."id"
       ), '[]'::json) AS variants
     FROM "Product" p
     WHERE p."id" = ANY($1) AND p."active" = true`,
    [lines.map((line) => line.productId)],
  )

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

  // Order creation and stock decrements share one transaction so an oversell
  // cannot slip between the check above and the write.
  //
  // Neon's HTTP transactions are non-interactive: every statement goes in one
  // batch and nothing can branch on an earlier result. That is fine here — the
  // pricing read already happened, and the writes below are fully determined by
  // it. The order id is generated here because Prisma's `cuid()` was a
  // client-side default; Postgres has none.
  const orderId = newId()

  await transaction([
    {
      text: `INSERT INTO "Order" (
          "id", "number", "email", "userId", "status", "subtotalCents", "shippingCents", "taxCents", "totalCents",
          "shipName", "shipLine1", "shipLine2", "shipCity", "shipState", "shipZip",
          "paymentProvider", "paymentReference"
        ) VALUES ($1,$2,$3,$4,'PAID',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      values: [
        orderId,
        number,
        email,
        user?.id ?? null,
        totals.subtotalCents,
        totals.shippingCents,
        totals.taxCents,
        totals.totalCents,
        fullName,
        line1,
        line2 || null,
        city,
        state.toUpperCase(),
        zip,
        getPaymentProvider().id,
        payment.reference,
      ],
    },
    ...items.map((item) => ({
      text: `INSERT INTO "OrderItem" ("id", "orderId", "productId", "name", "variantName", "unitCents", "quantity")
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      values: [newId(), orderId, item.productId, item.name, item.variantName ?? null, item.unitCents, item.quantity],
    })),
    // Decrement the level the shopper was actually sold from.
    ...lines.map((line) =>
      line.variantId
        ? {
            text: `UPDATE "Variant" SET "inventory" = "inventory" - $1 WHERE "id" = $2`,
            values: [line.quantity, line.variantId],
          }
        : {
            text: `UPDATE "Product" SET "inventory" = "inventory" - $1 WHERE "id" = $2`,
            values: [line.quantity, line.productId],
          },
    ),
    // On-hand comes down now; `reservedStock` counts the units sold but still
    // on the shelf, which is what a picker needs to see. Fulfilment or
    // cancellation releases it — see actions/admin/orders.ts.
    ...lines.map((line) => ({
      text: `UPDATE "Product" SET "reservedStock" = "reservedStock" + $1 WHERE "id" = $2`,
      values: [line.quantity, line.productId],
    })),
    // Every stock movement gets a history row, including the automatic ones.
    ...items.map((item) => ({
      text: `INSERT INTO "InventoryAdjustment" ("id", "productId", "delta", "resulting", "reason", "note", "actor")
             VALUES ($1,$2,$3,$4,'SOLD',$5,'checkout')`,
      values: [
        newId(),
        item.productId,
        -item.quantity,
        (products.find((p) => p.id === item.productId)?.inventory ?? item.quantity) - item.quantity,
        `Order ${number}`,
      ],
    })),
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
