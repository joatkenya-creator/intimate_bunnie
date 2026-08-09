import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/config/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Thin, personal, or infinite-surface routes.
      disallow: ['/admin', '/account', '/cart', '/checkout', '/search', '/api/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
