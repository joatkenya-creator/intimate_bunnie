import Link from 'next/link'
import { BunnieMark } from '@/components/ui/icons'

export default function NotFound() {
  return (
    <div className="container-ib flex flex-col items-center py-28 text-center">
      <BunnieMark className="h-10 w-10 text-peach-300" />
      <p className="eyebrow mt-6">404</p>
      <h1 className="mt-2 text-3xl">We can&apos;t find that page</h1>
      <p className="mt-3 max-w-sm text-sm text-plum-500">
        It may have sold out or moved. Try the shop, or search for what you had in mind.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/shop" className="btn btn-primary">
          Shop all
        </Link>
        <Link href="/" className="btn btn-outline">
          Home
        </Link>
      </div>
    </div>
  )
}
