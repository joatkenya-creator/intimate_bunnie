import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'
import { getSettings } from '@/server/settings'

// Business identity comes from Settings → General / Legal so the address and
// phone are edited in the admin, not in a deploy. A static sibling of
// pages/[slug] wins the route, so this never falls through to the CMS lookup.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = pageMetadata({
  title: 'Contact Us',
  description: 'Reach Intimate Bunnie by email or phone, or write to our registered business address.',
  path: '/pages/contact',
})

export default async function ContactPage() {
  const [general, legal] = await Promise.all([getSettings('general'), getSettings('legal')])

  return (
    <div className="container-ib max-w-2xl py-16">
      <h1 className="text-4xl">Contact Us</h1>
      <p className="mt-6 text-[0.9375rem] leading-relaxed text-plum-700">
        Questions about an order, a product, or a return? Email is fastest — we reply within one business day,
        Monday to Friday, 9am–5pm Eastern.
      </p>

      <dl className="mt-8 divide-y divide-line border-y border-line text-[0.9375rem]">
        <div className="grid gap-1 py-5 sm:grid-cols-[10rem_1fr]">
          <dt className="eyebrow">Email</dt>
          <dd>
            <a href={`mailto:${general.supportEmail}`} className="link-underline">
              {general.supportEmail}
            </a>
          </dd>
        </div>
        {general.phone && (
          <div className="grid gap-1 py-5 sm:grid-cols-[10rem_1fr]">
            <dt className="eyebrow">Phone</dt>
            <dd>
              <a href={`tel:${general.phone.replace(/[^\d+]/g, '')}`} className="link-underline">
                {general.phone}
              </a>
            </dd>
          </div>
        )}
        <div className="grid gap-1 py-5 sm:grid-cols-[10rem_1fr]">
          <dt className="eyebrow">Business address</dt>
          <dd className="whitespace-pre-line text-plum-700">
            {legal.businessName}
            {legal.address ? `\n${legal.address}` : ''}
          </dd>
        </div>
        <div className="grid gap-1 py-5 sm:grid-cols-[10rem_1fr]">
          <dt className="eyebrow">Orders & returns</dt>
          <dd className="text-plum-700">
            Include your order number (it starts with {general.orderPrefix}-) so we can find it straight away.
            Returns are started from your account under Orders.
          </dd>
        </div>
      </dl>

      <p className="mt-8 text-sm leading-relaxed text-plum-500">
        Intimate Bunnie is an online-only retailer of adult products for customers 18 and over. We ship within
        the United States; the address above is our registered business address, not a showroom.
      </p>
    </div>
  )
}
