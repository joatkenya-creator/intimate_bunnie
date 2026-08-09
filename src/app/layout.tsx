import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Karla } from 'next/font/google'
import './globals.css'
import { site } from '@/config/site'
import { jsonLd, organizationSchema } from '@/lib/seo'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartProvider } from '@/components/cart/CartProvider'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { AgeGate } from '@/components/AgeGate'
import { Analytics } from '@/components/Analytics'

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-display',
  display: 'swap',
})

const body = Karla({ subsets: ['latin'], variable: '--font-body', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} — ${site.tagline}`, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  category: 'shopping',
  robots: { index: true, follow: true, 'max-image-preview': 'large' },
  openGraph: { type: 'website', siteName: site.name, locale: 'en_US', url: site.url },
  twitter: { card: 'summary_large_image' },
}

export const viewport: Viewport = {
  themeColor: '#e91e63',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const org = jsonLd(organizationSchema())

  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <script type={org.type} dangerouslySetInnerHTML={{ __html: org.html }} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:bg-plum-900 focus:px-4 focus:py-2 focus:text-cream"
        >
          Skip to content
        </a>
        <CartProvider>
          <Header />
          <main id="main">{children}</main>
          <Footer />
          <CartDrawer />
        </CartProvider>
        <AgeGate />
        <Analytics />
      </body>
    </html>
  )
}
