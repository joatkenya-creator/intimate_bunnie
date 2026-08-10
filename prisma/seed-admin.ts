import { PrismaClient } from '../src/generated/prisma-node/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'
import { SYSTEM_ROLES } from '../src/lib/permissions.ts'
import { hashPassword } from '../src/lib/password.ts'
import { SETTINGS_DEFAULTS } from '../src/config/settings.ts'

// Admin seed. Additive on purpose: it never deletes catalog data, so it can be
// re-run against a store that already has products. Run `db:seed` first for the
// catalog, then this for staff, orders, customers, content, and settings.
//
// Every person, order, and address below is invented.

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'owner@intimatebunnie.test'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'ChangeMe!2026'

/** Deterministic pseudo-random so re-runs produce the same demo store. */
let seedState = 20260810
function random(): number {
  seedState = (seedState * 1103515245 + 12345) % 2147483648
  return seedState / 2147483648
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]
}
function daysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(9 + Math.floor(random() * 9), Math.floor(random() * 60), 0, 0)
  return date
}
function reference(prefix: string): string {
  const alphabet = '23456789BCDFGHJKLMNPQRSTVWXZ'
  return `${prefix}-${Array.from({ length: 6 }, () => alphabet[Math.floor(random() * alphabet.length)]).join('')}`
}

const CUSTOMERS = [
  { email: 'dani.reyes@example.com', name: 'Dani Reyes', segment: 'vip', tags: ['vip', 'repeat'] },
  { email: 'mia.k@example.com', name: 'Mia Kovac', segment: 'newsletter', tags: ['newsletter'] },
  { email: 'tasha.b@example.com', name: 'Tasha Bell', segment: 'vip', tags: ['vip'] },
  { email: 'jordan.lane@example.com', name: 'Jordan Lane', segment: null, tags: [] },
  { email: 'priya.n@example.com', name: 'Priya Nair', segment: 'wholesale', tags: ['wholesale'] },
  { email: 'sam.oduya@example.com', name: 'Sam Oduya', segment: null, tags: ['gift-buyer'] },
  { email: 'lena.fischer@example.com', name: 'Lena Fischer', segment: 'newsletter', tags: [] },
  { email: 'nkechi.a@example.com', name: 'Nkechi Adeyemi', segment: 'vip', tags: ['vip', 'reviewer'] },
  { email: 'rosa.mendez@example.com', name: 'Rosa Mendez', segment: null, tags: [] },
  { email: 'kai.tanaka@example.com', name: 'Kai Tanaka', segment: null, tags: ['returns-risk'] },
  { email: 'ivy.chen@example.com', name: 'Ivy Chen', segment: 'newsletter', tags: [] },
  { email: 'omar.haddad@example.com', name: 'Omar Haddad', segment: null, tags: [] },
]

const STAFF = [
  { email: 'ops@intimatebunnie.test', name: 'Robin Ellery', role: 'ADMIN' as const, roleSlug: 'administrator' },
  { email: 'merch@intimatebunnie.test', name: 'Ash Delacroix', role: 'STAFF' as const, roleSlug: 'merchandiser' },
  { email: 'support@intimatebunnie.test', name: 'Noor Haddad', role: 'STAFF' as const, roleSlug: 'support' },
]

const CITIES = [
  ['Portland', 'OR', '97209'],
  ['Austin', 'TX', '78702'],
  ['Brooklyn', 'NY', '11211'],
  ['Chicago', 'IL', '60622'],
  ['Denver', 'CO', '80205'],
  ['Savannah', 'GA', '31401'],
  ['Oakland', 'CA', '94607'],
  ['Providence', 'RI', '02903'],
] as const

const ORDER_STATUSES = ['PENDING', 'PAID', 'PAID', 'FULFILLED', 'FULFILLED', 'FULFILLED', 'CANCELLED', 'REFUNDED'] as const

async function seedRoles() {
  console.log('Roles…')
  // Two passes: every role must exist before inheritance can point at one.
  for (const role of SYSTEM_ROLES) {
    await db.adminRole.upsert({
      where: { slug: role.slug },
      create: { slug: role.slug, name: role.name, description: role.description, permissions: role.permissions, system: true },
      update: { name: role.name, description: role.description, permissions: role.permissions, system: true },
    })
  }
  for (const role of SYSTEM_ROLES.filter((entry) => entry.inherits)) {
    const parent = await db.adminRole.findUnique({ where: { slug: role.inherits! }, select: { id: true } })
    if (parent) await db.adminRole.update({ where: { slug: role.slug }, data: { inheritsId: parent.id } })
  }
}

async function seedStaff() {
  console.log('Staff…')
  const passwordHash = await hashPassword(ADMIN_PASSWORD)

  await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: { email: ADMIN_EMAIL, name: 'Store Owner', passwordHash, role: 'SUPER_ADMIN', status: 'ACTIVE', emailVerifiedAt: new Date() },
    update: { role: 'SUPER_ADMIN', status: 'ACTIVE' },
  })

  for (const person of STAFF) {
    const role = await db.adminRole.findUnique({ where: { slug: person.roleSlug }, select: { id: true } })
    await db.user.upsert({
      where: { email: person.email },
      create: {
        email: person.email,
        name: person.name,
        passwordHash,
        role: person.role,
        adminRoleId: role?.id,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        lastLoginAt: daysAgo(Math.floor(random() * 5)),
      },
      update: { role: person.role, adminRoleId: role?.id, status: 'ACTIVE' },
    })
  }
}

async function seedCustomers() {
  console.log('Customers…')
  const passwordHash = await hashPassword('Shopper!2026')

  for (const [index, customer] of CUSTOMERS.entries()) {
    const [city, state, zip] = CITIES[index % CITIES.length]
    const user = await db.user.upsert({
      where: { email: customer.email },
      create: {
        email: customer.email,
        name: customer.name,
        passwordHash,
        role: 'CUSTOMER',
        status: customer.tags.includes('returns-risk') ? 'ACTIVE' : 'ACTIVE',
        segment: customer.segment,
        tags: customer.tags,
        marketingOptIn: index % 3 !== 0,
        emailVerifiedAt: index % 4 === 0 ? null : daysAgo(60 + index),
        lastLoginAt: daysAgo(index),
        createdAt: daysAgo(90 - index * 4),
        notes: customer.tags.includes('returns-risk') ? 'Three returns in two months — check before comping anything.' : null,
      },
      update: { segment: customer.segment, tags: customer.tags },
      select: { id: true, addresses: { select: { id: true } } },
    })

    if (user.addresses.length === 0) {
      await db.address.create({
        data: {
          userId: user.id,
          fullName: customer.name,
          line1: `${100 + index * 7} Marigold Street`,
          line2: index % 3 === 0 ? `Apt ${index + 2}` : null,
          city,
          state,
          zip,
          isDefault: true,
        },
      })
    }
  }
}

async function seedOrders() {
  console.log('Orders…')
  const [products, customers] = await Promise.all([
    db.product.findMany({ take: 60, select: { id: true, name: true, priceCents: true, variants: { select: { optionValue: true } } } }),
    db.user.findMany({ where: { role: 'CUSTOMER' }, select: { id: true, email: true, name: true, addresses: true } }),
  ])
  if (products.length === 0) {
    console.log('  No products — run `npm run db:seed` first. Skipping orders.')
    return
  }

  const existing = await db.order.count()
  if (existing >= 40) {
    console.log(`  ${existing} orders already present. Skipping.`)
    return
  }

  for (let index = 0; index < 60; index++) {
    const customer = pick(customers)
    const address = customer.addresses[0]
    const [city, state, zip] = CITIES[index % CITIES.length]
    const lineCount = 1 + Math.floor(random() * 3)

    const items = Array.from({ length: lineCount }, () => {
      const product = pick(products)
      const quantity = 1 + Math.floor(random() * 2)
      return {
        productId: product.id,
        name: product.name,
        variantName: product.variants.length > 0 ? pick(product.variants).optionValue : null,
        unitCents: product.priceCents,
        quantity,
      }
    })

    const subtotalCents = items.reduce((sum, item) => sum + item.unitCents * item.quantity, 0)
    const shippingCents = subtotalCents >= 5900 ? 0 : 599
    const taxCents = Math.round(subtotalCents * 0.0725)
    const status = pick(ORDER_STATUSES)
    const createdAt = daysAgo(Math.floor(random() * 75))
    const totalCents = subtotalCents + shippingCents + taxCents

    const order = await db.order.create({
      data: {
        number: reference('IB'),
        email: customer.email,
        userId: customer.id,
        status,
        subtotalCents,
        shippingCents,
        taxCents,
        totalCents,
        refundedCents: status === 'REFUNDED' ? totalCents : 0,
        shipName: address?.fullName ?? customer.name ?? 'Guest',
        shipLine1: address?.line1 ?? `${200 + index} Juniper Way`,
        shipLine2: address?.line2 ?? null,
        shipCity: address?.city ?? city,
        shipState: address?.state ?? state,
        shipZip: address?.zip ?? zip,
        paymentProvider: 'dev',
        paymentReference: reference('PAY'),
        carrier: status === 'FULFILLED' ? pick(['USPS', 'UPS']) : null,
        trackingNumber: status === 'FULFILLED' ? reference('TRK') : null,
        shippedAt: status === 'FULFILLED' ? createdAt : null,
        fraudFlag: index % 23 === 0 ? 'Billing ZIP mismatch' : null,
        fraudScore: index % 23 === 0 ? 62 : null,
        createdAt,
        items: { create: items },
        events: {
          create: [
            { type: 'PAYMENT', actor: 'checkout', message: `Payment captured — ${(totalCents / 100).toFixed(2)} USD.`, createdAt, visibleToCustomer: true },
            ...(status === 'FULFILLED'
              ? [{ type: 'SHIPPING' as const, actor: 'ops@intimatebunnie.test', message: 'Shipped, tracking added.', createdAt, visibleToCustomer: true }]
              : []),
            ...(index % 11 === 0
              ? [{ type: 'NOTE' as const, actor: 'support@intimatebunnie.test', message: 'Customer asked for plain packaging — already the default, confirmed by email.', createdAt }]
              : []),
          ],
        },
      },
      select: { id: true, number: true },
    })

    // A handful of orders develop returns, so the returns screen has work.
    if (index % 9 === 0 && (status === 'FULFILLED' || status === 'PAID')) {
      const orderItems = await db.orderItem.findMany({ where: { orderId: order.id }, select: { id: true, quantity: true, unitCents: true } })
      const chosen = orderItems.slice(0, 1)
      const requestStatus = index % 27 === 0 ? 'APPROVED' : 'REQUESTED'
      const refundCents = requestStatus === 'APPROVED' ? chosen.reduce((sum, item) => sum + item.unitCents * item.quantity, 0) : 0

      await db.return.create({
        data: {
          number: reference('RMA'),
          orderId: order.id,
          status: requestStatus,
          reason: pick([
            'Arrived with the seal broken on the outer box.',
            'Sizing runs small — need the next size up.',
            'Motor rattles at the highest setting.',
            'Ordered the wrong colour.',
          ]),
          refundCents,
          resolvedAt: requestStatus === 'APPROVED' ? createdAt : null,
          createdAt,
          items: { create: chosen.map((item) => ({ orderItemId: item.id, quantity: item.quantity })) },
        },
      })
    }
  }
}

async function seedInventory() {
  console.log('Inventory history…')
  if ((await db.inventoryAdjustment.count()) > 0) return

  const products = await db.product.findMany({ take: 30, select: { id: true, inventory: true } })
  for (const [index, product] of products.entries()) {
    let level = product.inventory
    for (let step = 0; step < 3; step++) {
      const delta = step === 0 ? 40 : -(1 + Math.floor(random() * 6))
      level = Math.max(0, level + delta)
      await db.inventoryAdjustment.create({
        data: {
          productId: product.id,
          delta,
          resulting: level,
          reason: step === 0 ? 'RECEIVED' : pick(['SOLD', 'DAMAGED', 'CORRECTION']),
          note: step === 0 ? 'Opening purchase order' : null,
          actor: 'merch@intimatebunnie.test',
          createdAt: daysAgo(30 - index - step),
        },
      })
    }
  }

  // A few products pushed under their threshold so the alerts screen is real.
  const low = products.slice(0, 4)
  for (const [index, product] of low.entries()) {
    await db.product.update({ where: { id: product.id }, data: { inventory: index === 0 ? 0 : index, lowStockAt: 5, incomingStock: index * 12 } })
  }
}

async function seedContent() {
  console.log('Content and blog…')
  const author = await db.user.findUnique({ where: { email: ADMIN_EMAIL }, select: { id: true } })

  const entries = [
    { type: 'PAGE' as const, slug: 'size-guide', title: 'Size Guide', excerpt: 'Measurements for every lingerie cut we carry.', body: '<h2>How to measure</h2><p>Use a soft tape, standing relaxed. Band under the bust, cup at the fullest point.</p><ul><li>XS — 30–32 band</li><li>S — 32–34 band</li><li>M — 34–36 band</li><li>L — 36–38 band</li></ul>', status: 'PUBLISHED' as const },
    { type: 'PAGE' as const, slug: 'materials', title: 'Materials We Use', excerpt: 'Platinum-cured silicone, implant-grade steel, solid gold.', body: '<p>Every item is chosen for material first. If a material is porous or unclear, we do not carry it.</p>', status: 'PUBLISHED' as const },
    { type: 'POLICY' as const, slug: 'accessibility', title: 'Accessibility Statement', excerpt: 'What we commit to, and where to tell us we fell short.', body: '<p>We target WCAG 2.2 AA. If something on this site blocks you, email us and we will fix it.</p>', status: 'PUBLISHED' as const },
    { type: 'FAQ' as const, slug: 'discreet-billing', title: 'Will my card statement say Intimate Bunnie?', excerpt: null, body: '<p>No. The descriptor is a neutral business name with no product wording.</p>', status: 'PUBLISHED' as const, position: 0 },
    { type: 'FAQ' as const, slug: 'silicone-lube', title: 'Can I use silicone lubricant on silicone toys?', excerpt: null, body: '<p>No — silicone lubricant degrades silicone surfaces and creates pits that cannot be fully cleaned. Use water-based.</p>', status: 'PUBLISHED' as const, position: 1 },
    { type: 'ANNOUNCEMENT' as const, slug: 'spring-restock', title: 'Spring restock is live', excerpt: null, body: '<p>Everything that sold out in February is back.</p>', status: 'PUBLISHED' as const, linkUrl: '/shop', position: 0 },
    { type: 'BANNER' as const, slug: 'free-shipping', title: 'Free U.S. shipping over $59', excerpt: null, body: '<p>Plain packaging as standard.</p>', status: 'PUBLISHED' as const, linkUrl: '/shop', position: 0, heroImage: 'https://picsum.photos/seed/ib-banner/1600/600' },
    { type: 'POST' as const, slug: 'how-to-clean-silicone', title: 'How to clean silicone properly', excerpt: 'Mild soap, warm water, and the one thing that quietly ruins it.', body: '<p>Wash before and after every use with an unscented soap.</p><h2>What not to do</h2><p>Skip alcohol, skip the dishwasher, and never store two silicone pieces touching — they bond and pit.</p>', status: 'PUBLISHED' as const, category: 'Care', tags: ['silicone', 'care'] },
    { type: 'POST' as const, slug: 'body-safe-materials', title: 'What "body-safe" actually means', excerpt: 'The word is unregulated. Here is what we check before we buy.', body: '<p>Porosity is the whole game. A porous material holds bacteria no cleaning routine reaches.</p>', status: 'PUBLISHED' as const, category: 'Guides', tags: ['materials'] },
    { type: 'POST' as const, slug: 'piercing-aftercare', title: 'Piercing aftercare, without the folklore', excerpt: 'Saline, patience, and nothing else.', body: '<p>No alcohol, no peroxide, no twisting. Sterile saline twice a day.</p>', status: 'DRAFT' as const, category: 'Guides', tags: ['jewelry'] },
  ]

  for (const entry of entries) {
    await db.contentEntry.upsert({
      where: { type_slug: { type: entry.type, slug: entry.slug } },
      create: {
        ...entry,
        authorId: author?.id,
        publishAt: entry.status === 'PUBLISHED' ? daysAgo(Math.floor(random() * 40)) : null,
        seoTitle: entry.title,
        seoDesc: entry.excerpt,
      },
      update: {},
    })
  }
}

async function seedMenusAndMedia() {
  console.log('Menus, media, redirects…')

  if ((await db.menuItem.count()) === 0) {
    const menu = [
      { menu: 'HEADER' as const, label: 'Shop all', url: '/shop', position: 0 },
      { menu: 'HEADER' as const, label: 'New in', url: '/shop?sort=newest', position: 1 },
      { menu: 'FOOTER' as const, label: 'Shipping & Discretion', url: '/pages/shipping', position: 0 },
      { menu: 'FOOTER' as const, label: 'Returns', url: '/pages/returns', position: 1 },
      { menu: 'FOOTER' as const, label: 'Size Guide', url: '/pages/size-guide', position: 2 },
      { menu: 'FOOTER' as const, label: 'Privacy Policy', url: '/pages/privacy', position: 3 },
    ]
    await db.menuItem.createMany({ data: menu })
  }

  if ((await db.mediaAsset.count()) === 0) {
    await db.mediaAsset.createMany({
      data: Array.from({ length: 12 }, (_, index) => ({
        url: `https://picsum.photos/seed/ib-media-${index}/1200/1500`,
        filename: `library-${index + 1}.jpg`,
        folder: index < 6 ? 'products' : 'editorial',
        altText: index % 3 === 0 ? '' : `Editorial still life ${index + 1}`,
        mimeType: 'image/jpeg',
        width: 1200,
        height: 1500,
        bytes: 240_000 + index * 1000,
        createdBy: 'merch@intimatebunnie.test',
      })),
      skipDuplicates: true,
    })
  }

  const redirects = [
    { source: '/shop/toys', destination: '/shop/vibrators', statusCode: 301, note: 'Category renamed in March.' },
    { source: '/pages/sizing', destination: '/pages/size-guide', statusCode: 301, note: 'Slug tidied.' },
    { source: '/sale', destination: '/shop', statusCode: 302, note: 'Temporary while the sale page is rebuilt.' },
  ]
  for (const redirect of redirects) {
    await db.redirect.upsert({ where: { source: redirect.source }, create: redirect, update: {} })
  }
}

async function seedPromotions() {
  console.log('Promotions…')
  const promotions = [
    { code: 'WELCOME10', name: 'Welcome 10%', kind: 'CODE' as const, percentOff: 10, description: 'First-order discount linked from the newsletter.', usedCount: 34, perCustomerLimit: 1 },
    { code: 'SPRING25', name: 'Spring flash sale', kind: 'FLASH_SALE' as const, percentOff: 25, startsAt: daysAgo(6), expiresAt: daysAgo(-2), usedCount: 88, usageLimit: 500 },
    { code: 'FREESHIP', name: 'Free shipping over $40', kind: 'AUTOMATIC' as const, amountOffCents: 599, minSpendCents: 4000, usedCount: 210 },
    { code: 'BUNDLE2', name: 'Two-for bundle', kind: 'BUNDLE' as const, percentOff: 15, description: 'Any two wellness items.', usedCount: 12 },
    { code: 'GC-STARTER', name: 'Gift card — $50', kind: 'GIFT_CARD' as const, balanceCents: 5000, description: 'Architecture only; redemption is not wired into checkout.' },
    { code: 'REFER15', name: 'Referral campaign', kind: 'REFERRAL' as const, percentOff: 15, description: 'Given to a referred friend.', usedCount: 7 },
    { code: 'LASTYEAR', name: 'Expired holiday code', kind: 'CODE' as const, percentOff: 20, expiresAt: daysAgo(120), active: false, usedCount: 143 },
  ]

  for (const promotion of promotions) {
    await db.coupon.upsert({ where: { code: promotion.code }, create: promotion, update: {} })
  }
}

async function seedSettingsAndNotifications() {
  console.log('Settings and notifications…')

  for (const [key, value] of Object.entries(SETTINGS_DEFAULTS)) {
    await db.setting.upsert({
      where: { key },
      create: { key, value: value as object, updatedBy: ADMIN_EMAIL },
      update: {},
    })
  }

  if ((await db.adminNotification.count()) === 0) {
    const lowStock = await db.product.findFirst({ where: { inventory: 0 }, select: { id: true, name: true } })
    await db.adminNotification.createMany({
      data: [
        { type: 'ORDER', level: 'INFO', title: 'New order IB-7K2M4Q — $128.40', body: '3 items for dani.reyes@example.com', link: '/admin/orders', createdAt: daysAgo(0) },
        ...(lowStock
          ? [{ type: 'LOW_STOCK' as const, level: 'CRITICAL' as const, title: `Out of stock: ${lowStock.name}`, body: '0 left on hand.', link: `/admin/inventory?product=${lowStock.id}`, createdAt: daysAgo(1) }]
          : []),
        { type: 'REFUND', level: 'WARNING', title: 'Return requested on IB-4F7K2Q', body: 'Sizing runs small — need the next size up.', link: '/admin/returns', createdAt: daysAgo(1) },
        { type: 'PAYMENT_FAILED', level: 'WARNING', title: 'Payment declined on a $64.00 cart', body: 'Card issuer declined — customer was shown the retry screen.', createdAt: daysAgo(2) },
        { type: 'CUSTOMER', level: 'INFO', title: 'New customer: omar.haddad@example.com', link: '/admin/customers', createdAt: daysAgo(3) },
        { type: 'SYSTEM', level: 'INFO', title: 'Scheduled publish ran', body: '2 products and 1 post went live.', createdAt: daysAgo(4), readAt: daysAgo(3) },
      ],
    })
  }

  if ((await db.auditLog.count()) === 0) {
    await db.auditLog.createMany({
      data: [
        { actor: ADMIN_EMAIL, action: 'auth.login', ip: '203.0.113.24', createdAt: daysAgo(0) },
        { actor: 'merch@intimatebunnie.test', action: 'product.update', target: 'seeded', meta: { name: 'Rose Suction Vibrator' }, createdAt: daysAgo(0) },
        { actor: 'support@intimatebunnie.test', action: 'order.fulfilled', target: 'IB-7K2M4Q', createdAt: daysAgo(1) },
        { actor: 'unknown@example.com', action: 'auth.login.failed', ip: '198.51.100.7', createdAt: daysAgo(1) },
        { actor: ADMIN_EMAIL, action: 'settings.update', target: 'shipping', createdAt: daysAgo(2) },
      ],
    })
  }
}

async function main() {
  await seedRoles()
  await seedStaff()
  await seedCustomers()
  await seedOrders()
  await seedInventory()
  await seedContent()
  await seedMenusAndMedia()
  await seedPromotions()
  await seedSettingsAndNotifications()

  console.log('\nAdmin seed complete.')
  console.log(`  Sign in at /admin as ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  console.log('  Change that password before this database is reachable from the internet.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
