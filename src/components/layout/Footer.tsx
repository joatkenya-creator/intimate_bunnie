import Link from 'next/link'
import { BunnieMark } from '@/components/ui/icons'
import { site } from '@/config/site'

const columns = [
  {
    title: 'Shop',
    links: [
      { href: '/shop/lingerie', label: 'Lingerie & Thongs' },
      { href: '/shop/vibrators', label: 'Vibrators' },
      { href: '/shop/dildos', label: 'Dildos' },
      { href: '/shop/for-him', label: 'For Him' },
      { href: '/shop/body-jewelry', label: 'Body Jewelry' },
      { href: '/shop/wellness', label: 'Oils & Lubricants' },
    ],
  },
  {
    title: 'Help',
    links: [
      { href: '/pages/shipping', label: 'Shipping & Discretion' },
      { href: '/pages/returns', label: 'Returns' },
      { href: '/pages/care', label: 'Body-Safe Materials' },
      { href: '/pages/faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/pages/about', label: 'About Us' },
      { href: '/pages/privacy', label: 'Privacy Policy' },
      { href: '/pages/terms', label: 'Terms of Service' },
      { href: '/account', label: 'Your Account' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-shell">
      <div className="container-ib grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <div className="flex items-center gap-2">
            <BunnieMark className="h-9 w-9" />
            <span className="font-display text-lg">Intimate Bunnie</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-plum-500">{site.description}</p>
          <p className="mt-4 text-sm text-plum-500">
            <a href={`mailto:${site.email}`} className="link-underline">
              {site.email}
            </a>
          </p>
        </div>

        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="eyebrow mb-3">{col.title}</h2>
            <ul className="space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-plum-700 hover:text-rose-500">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-line">
        <div className="container-ib flex flex-col gap-2 py-5 text-xs text-plum-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Intimate Bunnie. All rights reserved.</p>
          <p>Adults 18+ only. Prices in USD. Ships within the United States.</p>
        </div>
      </div>
    </footer>
  )
}
