// The product-grid skeleton, scoped to /search rather than the app root.
//
// At the root it wrapped every route in a Suspense boundary, which meant the
// HTML shell was flushed before the page had decided anything — and a response
// whose body has started cannot change its status. Every notFound() therefore
// answered 200 with 404 content, and every redirect() degraded to a one-second
// <meta refresh>. /search is the one grid route that never does either.
export default function Loading() {
  return (
    <div className="container-ib py-14">
      <div className="h-8 w-56 animate-pulse bg-shell" />
      <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-[4/5] bg-shell" />
            <div className="mt-3 h-3 w-2/3 bg-shell" />
            <div className="mt-2 h-3 w-1/3 bg-shell" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading products…</span>
    </div>
  )
}
