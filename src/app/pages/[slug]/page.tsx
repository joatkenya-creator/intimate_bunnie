import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { pageMetadata, jsonLd } from '@/lib/seo'
import { site } from '@/config/site'
import { queryOne } from '@/lib/sql'

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
    title: 'Shipping & Discretion',
    description:
      'Free U.S. shipping over $59, flat $5.99 otherwise. Every order ships in plain, unbranded packaging with a neutral billing descriptor.',
    body: [
      'Orders placed before 2pm ET on a business day ship the same day. Standard delivery runs 3–5 business days within the contiguous United States.',
      'Shipping is free on orders over $59. Below that, it is a flat $5.99. Alaska, Hawaii, and APO/FPO addresses may take longer.',
      'Discretion is the default, not an upgrade. The outer box carries no branding, no product names, and no indication of the contents. The return address is a neutral business name, and your card statement shows the same.',
    ],
  },
  returns: {
    title: 'Returns',
    description: 'Unopened items can be returned within 30 days. For health reasons, opened intimate products cannot.',
    body: [
      'You have 30 days from delivery to return unopened, unused items in their original packaging for a full refund.',
      'For health and hygiene reasons, we cannot accept returns on lingerie, toys, lubricants, oils, condoms, or body jewelry once the seal or packaging has been opened. This is standard across the industry and it is not negotiable.',
      'If an item arrives damaged or defective, email us within 14 days and we will replace it or refund it, opened or not.',
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
    description: 'What data Intimate Bunnie collects, why, and how long we keep it.',
    body: [
      'We collect the minimum needed to sell you something and deliver it: your email, shipping address, and order contents. We do not sell customer data, and we do not share your order contents with advertising networks.',
      'Payment details are handled by our payment provider. Card numbers never touch our servers or our database.',
      'We use privacy-respecting analytics to understand which pages work. You can block them with any standard content blocker without breaking the store.',
      `Email ${site.email} to request a copy of your data or ask us to delete your account.`,
    ],
  },
  terms: {
    title: 'Terms of Service',
    description: 'The terms that apply when you shop at Intimate Bunnie.',
    body: [
      'By placing an order you confirm you are at least 18 years old and legally able to purchase adult products where you live.',
      'Prices are in U.S. dollars and may change without notice. We reserve the right to cancel and refund any order, including for pricing errors or suspected fraud.',
      'Product descriptions are written to be accurate about materials and dimensions. Nothing sold here is a medical device, and nothing on this site is medical advice.',
      `Questions about these terms go to ${site.email}.`,
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
    </div>
  )
}
