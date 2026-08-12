import Script from 'next/script'
import { Analytics as VercelAnalytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

// Thin wrapper, no analytics SDKs. Each script loads only when its ID is
// configured, and always after hydration so it never blocks paint.
//
// The two Vercel ones need no ID: both scripts are served from this origin
// (/_vercel/…) and only record on a Vercel deployment, so they are safe to
// render unconditionally. Rendered here rather than in the layout means /admin,
// which returns before this component, stays out of the visitor counts and out
// of the Core Web Vitals — a slow admin table must not read as a slow store.
export function Analytics() {
  const ga = process.env.NEXT_PUBLIC_GA_ID
  const clarity = process.env.NEXT_PUBLIC_CLARITY_ID

  return (
    <>
      <VercelAnalytics />
      <SpeedInsights />
      {ga && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga}');`}
          </Script>
        </>
      )}
      {clarity && (
        <Script id="clarity-init" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${clarity}");`}
        </Script>
      )}
    </>
  )
}
