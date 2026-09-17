import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { pageMetadata, jsonLd } from '@/lib/seo'
import { site } from '@/config/site'
import { queryOne } from '@/lib/sql'
import { getSettings } from '@/server/settings'

type Params = { slug: string }

type Doc = { title: string; description: string; body: string[]; faq?: { q: string; a: string }[] }

// Static policy copy. It changes a few times a year — a CMS would be four
// moving parts for something a deploy already handles.
const DOCS: Record<string, Doc> = {
  about: {
    title: 'About Intimate Bunnie',
    description:
      'Intimate Bunnie is a U.S. adult boutique built around body-safe materials, honest descriptions, and packaging nobody can read from the porch.',
    body: [
      'We started Intimate Bunnie because shopping for intimates online usually means one of two things: a clinical warehouse listing, or a site that treats women like an afterthought. We wanted the third option — a boutique that is frank about what a product does and beautiful enough to browse.',
      'Every item is chosen for material first. Silicone is platinum-cured, body jewelry is implant-grade steel or solid gold, and oils are food-grade where they could ever end up somewhere food-grade matters. If a material is porous or unclear, we do not carry it.',
      'We are based in the United States and ship domestically. Orders leave in unbranded boxes, and your card statement shows a neutral descriptor.',
    ],
  },
  shipping: {
    title: 'Shipping Policy',
    description:
      'Free U.S. shipping over $59, flat $5.99 otherwise. Every order ships in plain, unbranded packaging with a neutral billing descriptor.',
    body: [
      'We ship within the United States only, including Alaska, Hawaii, and APO/FPO addresses. We do not ship internationally.',
      'Orders placed before 2pm ET on a business day are dispatched the same day; later orders leave the next business day. Standard delivery by USPS or UPS takes 3–5 business days within the contiguous United States. Alaska, Hawaii, and military addresses may take 7–10 business days.',
      'Shipping is free on orders over $59. Below that, it is a flat $5.99. Expedited delivery (2–3 business days) is available at checkout for $14.99. Rates and thresholds are shown before you pay.',
      'You will receive an email with a tracking number as soon as your order is dispatched. Orders can also be tracked from your account under Orders.',
      'Discretion is the default, not an upgrade. The outer box carries no branding, no product names, and no indication of the contents. The return address is a neutral business name, and your card statement shows the same.',
      'If a parcel is returned to us as undeliverable, we will contact you to confirm the address and re-ship at no charge, or refund the order less the original shipping cost.',
    ],
  },
  returns: {
    title: 'Returns & Refunds',
    description: 'Unopened items can be returned within 30 days for a full refund. For health reasons, opened intimate products cannot.',
    body: [
      'You have 30 days from delivery to return unopened, unused items in their original sealed packaging for a full refund of the item price.',
      'For health and hygiene reasons, we cannot accept returns on lingerie, toys, lubricants, oils, condoms, or body jewelry once the seal or packaging has been opened. This is standard across the industry and it is not negotiable.',
      'If an item arrives damaged, defective, or is not what you ordered, contact us within 14 days of delivery and we will replace it or refund it in full, opened or not, including any return postage.',
      'To start a return, sign in to your account, open the order under Orders, and choose Request a return. We will email you a return authorisation and the address to send it to. Returns without an authorisation may be delayed.',
      'Refunds are issued to the original payment method within 5–10 business days of the return arriving with us. Original shipping charges are refunded only when the return is due to our error. Return postage for change-of-mind returns is paid by the customer.',
      'Orders can be cancelled for a full refund at any time before they are dispatched. Once an order has shipped, the return policy above applies.',
      `Questions about a return go to ${site.email}.`,
    ],
  },
  care: {
    title: 'Body-Safe Materials & Care',
    description: 'How to clean and store silicone toys, body jewelry, and lingerie so they last.',
    body: [
      'Silicone: wash with mild unscented soap and warm water before and after every use. Use water-based lubricant only — silicone lubricant degrades silicone surfaces over time.',
      'Body jewelry: implant-grade steel and solid gold can be cleaned with warm water and a fragrance-free soap. Avoid alcohol and peroxide on fresh piercings.',
      'Lingerie: hand wash cold, lay flat to dry. Lace and mesh do not survive a dryer.',
      'Store toys separately and dry. Silicone pieces left touching each other can bond and pit.',
    ],
  },
  faq: {
    title: 'Frequently Asked Questions',
    description: 'Answers about discreet shipping, materials, returns, and payment at Intimate Bunnie.',
    body: [],
    faq: [
      {
        q: 'Is the packaging really discreet?',
        a: 'Yes. Orders ship in a plain box with no branding or product names, from a neutral return address. Your card statement shows a neutral descriptor.',
      },
      {
        q: 'Do you ship outside the United States?',
        a: 'Not yet. We currently ship within the United States, including Alaska, Hawaii, and APO/FPO addresses.',
      },
      {
        q: 'What lubricant should I use with silicone toys?',
        a: 'Water-based. Silicone lubricant breaks down silicone surfaces over time, which creates pits that are impossible to fully clean.',
      },
      {
        q: 'Can I return something I opened?',
        a: 'For health reasons, no — opened intimate products cannot be returned. Unopened items can be returned within 30 days, and anything damaged or defective is replaced regardless.',
      },
      {
        q: 'How old do I have to be to order?',
        a: 'You must be 18 or older to purchase from Intimate Bunnie.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'What data Intimate Bunnie collects, why, who it is shared with, and how long we keep it.',
    body: [
      'What we collect. To sell you something and deliver it we collect your name, email address, shipping and billing address, phone number if you give one, and the contents of your orders. If you create an account we also store a hashed password and your order history.',
      'Payments. Card payments are processed by our payment provider. Card numbers are entered directly with the provider and never touch our servers or our database. We receive only a confirmation of payment and the last four digits of the card for your receipt.',
      'What we do not do. We do not sell customer data. We do not share your order contents with advertising networks. Your card statement and your parcel show a neutral business name, never a product name.',
      'Who we share with. Your shipping details go to the carrier delivering your order (USPS or UPS). Your email and order details go to our transactional email service to send confirmations and tracking. Each of these processes data only on our instructions.',
      'Cookies and analytics. We use a strictly necessary cookie to keep you signed in and to remember your cart, and a local setting to remember that you have confirmed your age. We use privacy-respecting analytics to understand which pages work; you can block them with any standard content blocker without breaking the store.',
      'Retention. Order records are kept for seven years to meet tax and accounting obligations. Account data is kept until you delete your account, which you can do at any time from Account → Settings.',
      `Your rights. Email ${site.email} to request a copy of your data, correct it, or ask us to delete your account. We respond within 30 days.`,
      'Age. This site is for adults 18 and over. We do not knowingly collect data from anyone under 18; if you believe we have, contact us and we will delete it.',
    ],
  },
  terms: {
    title: 'Terms of Service',
    description: 'The terms that apply when you shop at Intimate Bunnie.',
    body: [
      'Eligibility. By using this site or placing an order you confirm you are at least 18 years old and legally able to purchase adult products where you live. We may cancel any order where we cannot reasonably verify this.',
      'Products. Everything sold here is a lawful consumer product sold at retail: intimate apparel, personal massagers and pleasure products, personal lubricants, condoms, body oils, and body jewelry. Product descriptions are written to be accurate about materials and dimensions. Nothing sold here is a medical device, and nothing on this site is medical advice.',
      'Prices and payment. Prices are in U.S. dollars and exclude sales tax, which is calculated at checkout where applicable. Payment is taken in full at the time of order. We reserve the right to cancel and refund any order, including for pricing errors, stock errors, or suspected fraud.',
      'Shipping, returns, and refunds. Delivery times, return eligibility, and refund timing are set out in our Shipping Policy and Returns & Refunds policy, which form part of these terms.',
      'Billing descriptor. Charges appear on your card statement under a neutral business name. Please check your statement before disputing a charge you do not recognise; contact us first and we will resolve it faster than a chargeback will.',
      'Accounts. You are responsible for keeping your password confidential and for activity under your account. Tell us promptly if you believe it has been used without your permission.',
      'Intellectual property. The site, its copy, and its imagery belong to Intimate Bunnie and may not be reproduced without permission.',
      'Liability. To the fullest extent permitted by law, our liability for any order is limited to the amount you paid for it. Nothing in these terms limits liability that cannot be limited by law.',
      'Governing law. These terms are governed by the laws of the United States and of the state in which our registered business address, shown on our Contact page, is located.',
      `Contact. Questions about these terms go to ${site.email}, or by post to the business address on our Contact page.`,
    ],
  },
}

// Dynamic since the CMS took over: a page edited in the admin has to be live
// on the next request, not on the next deploy. The static DOCS below stay as
// the fallback, so a fresh database still serves every policy.
export const dynamic = 'force-dynamic'

/**
 * A published Page or Policy in the admin CMS wins over the static copy above.
 * The static documents stay as the fallback so the store still has its policies
 * on a fresh database — and so removing a CMS entry cannot 404 a legal page.
 */
async function managed(slug: string) {
  try {
    return await queryOne<{
      title: string
      excerpt: string | null
      body: string
      seoTitle: string | null
      seoDesc: string | null
      canonicalUrl: string | null
      robots: string | null
      heroImage: string | null
    }>(
      `SELECT "title", "excerpt", "body", "seoTitle", "seoDesc", "canonicalUrl", "robots", "heroImage"
       FROM "ContentEntry"
       WHERE "slug" = $1 AND "type" IN ('PAGE', 'POLICY') AND "status" = 'PUBLISHED'
       LIMIT 1`,
      [slug],
    )
  } catch {
    // A page must not go down because the database blinked.
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const entry = await managed(slug)
  if (entry) {
    return pageMetadata({
      title: entry.seoTitle ?? entry.title,
      description: entry.seoDesc ?? entry.excerpt ?? '',
      path: `/pages/${slug}`,
      image: entry.heroImage,
      canonical: entry.canonicalUrl,
      robots: entry.robots,
    })
  }

  const doc = DOCS[slug]
  // 404: no canonical rather than one pointing at the homepage.
  if (!doc) {
    return pageMetadata({
      title: 'Not found',
      description: 'This page is no longer available.',
      path: `/pages/${slug}`,
      canonical: false,
      noindex: true,
    })
  }
  return pageMetadata({ title: doc.title, description: doc.description, path: `/pages/${slug}` })
}

export default async function ContentPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params

  const entry = await managed(slug)
  if (entry) {
    return (
      <div className="container-ib max-w-2xl py-16">
        <h1 className="text-4xl">{entry.title}</h1>
        {/* Sanitised on write in actions/admin/content.ts — never on read. */}
        <div
          className="mt-6 space-y-5 text-[0.9375rem] leading-relaxed text-plum-700"
          dangerouslySetInnerHTML={{ __html: entry.body }}
        />
      </div>
    )
  }

  const doc = DOCS[slug]
  if (!doc) notFound()

  const legal = await getSettings('legal')

  const faqSchema =
    doc.faq &&
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: doc.faq.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    })

  return (
    <div className="container-ib max-w-2xl py-16">
      {faqSchema && <script type={faqSchema.type} dangerouslySetInnerHTML={{ __html: faqSchema.html }} />}
      <h1 className="text-4xl">{doc.title}</h1>
      <div className="mt-6 space-y-5 text-[0.9375rem] leading-relaxed text-plum-700">
        {doc.body.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      {doc.faq && (
        <dl className="mt-8 divide-y divide-line border-y border-line">
          {doc.faq.map((item) => (
            <div key={item.q} className="py-5">
              <dt className="font-display text-lg">{item.q}</dt>
              <dd className="mt-2 text-[0.9375rem] leading-relaxed text-plum-700">{item.a}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className="mt-10 whitespace-pre-line border-t border-line pt-5 text-xs leading-relaxed text-plum-500">
        {legal.businessName}
        {legal.address ? `\n${legal.address}` : ''}
        {'\n'}
        <Link href="/pages/contact" className="link-underline">
          Contact us
        </Link>
      </p>
    </div>
  )
}
