'use client'

import { useState } from 'react'
import { imageUrl, PLACEHOLDER_IMAGE } from '@/services/media'

type Media = { url: string; altText: string; width?: number | null; height?: number | null }

export function Gallery({ media, productName }: { media: Media[]; productName: string }) {
  const [active, setActive] = useState(0)
  const current = media[active]

  return (
    <div className="flex flex-col-reverse gap-4 lg:flex-row">
      {media.length > 1 && (
        <ul className="flex gap-3 lg:flex-col" role="tablist" aria-label={`${productName} images`}>
          {media.map((item, i) => (
            <li key={item.url}>
              <button
                role="tab"
                aria-selected={i === active}
                aria-label={`View image ${i + 1} of ${media.length}`}
                onClick={() => setActive(i)}
                className={`block h-20 w-16 overflow-hidden border transition-colors ${
                  i === active ? 'border-plum-900' : 'border-transparent hover:border-peach-300'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl(item.url, { width: 160 })}
                  alt=""
                  width={128}
                  height={160}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex-1 bg-shell">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current ? imageUrl(current.url, { width: 1000 }) : PLACEHOLDER_IMAGE}
          alt={current?.altText || productName}
          width={current?.width ?? 1000}
          height={current?.height ?? 1250}
          fetchPriority="high"
          className="aspect-[4/5] w-full object-cover"
        />
      </div>
    </div>
  )
}
