// Hand-rolled SVGs. An icon library would ship hundreds of unused paths.
type IconProps = { className?: string }

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const SearchIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

export const BagIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 7h16l-1.2 13.2a1 1 0 0 1-1 .8H6.2a1 1 0 0 1-1-.8Z" />
    <path d="M9 10V6a3 3 0 0 1 6 0v4" />
  </svg>
)

export const HeartIcon = ({ className, filled }: IconProps & { filled?: boolean }) => (
  <svg {...base} className={className} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.6 12 20 12 20Z" />
  </svg>
)

export const UserIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
  </svg>
)

export const MenuIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)

export const CloseIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const StarIcon = ({ className, filled }: IconProps & { filled?: boolean }) => (
  <svg {...base} className={className} fill={filled ? 'currentColor' : 'none'} strokeWidth={1.25}>
    <path d="m12 4 2.3 4.9 5.2.7-3.8 3.7.9 5.3-4.6-2.6-4.6 2.6.9-5.3L4.5 9.6l5.2-.7Z" />
  </svg>
)

export const ChevronIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="m9 5 7 7-7 7" />
  </svg>
)

/** The mark: a bunny silhouette drawn as two ears over a rounded head. */
export const BunnieMark = ({ className }: IconProps) => (
  <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden>
    <path d="M11.4 3.2c1.1 0 1.9 1 2.1 2.3l.9 6.1a7.6 7.6 0 0 0-2.7.6L9.5 6.1c-.5-1.4.3-2.9 1.9-2.9Zm9.2 0c1.6 0 2.4 1.5 1.9 2.9l-2.2 6.1a7.6 7.6 0 0 0-2.7-.6l.9-6.1c.2-1.3 1-2.3 2.1-2.3Z" />
    <path d="M16 12.6c4.6 0 8.3 3.5 8.3 7.9 0 4.3-3.7 7.8-8.3 7.8s-8.3-3.5-8.3-7.8c0-4.4 3.7-7.9 8.3-7.9Z" />
  </svg>
)
