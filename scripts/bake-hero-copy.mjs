// Bakes the category copy into the negative space of the three vibrator hero
// banners, so the words travel with the image instead of only existing as an
// HTML overlay.
//
// Sources are the text-free banners in assets/hero-src. They live in the repo
// because the 2560px art they came from is gone, and without them this script
// cannot run at all. Re-point SRC at the originals if they ever turn up.
//
// The result is written at full canvas size and high quality on purpose: it is
// a source for Next's optimiser, not a rendition a browser downloads.
// Downscaling here would resample the baked type once before the optimiser
// resamples it again, and thin serif strokes do not survive that twice.
//
// Run after editing any headline or line break below:
//   node scripts/bake-hero-copy.mjs [sourceDir]
//
// sharp comes in transitively with Next. Fonts resolve from the system, so this
// expects Georgia — the display fallback declared in globals.css.
import sharp from 'sharp'

const SRC = process.argv[2] ?? 'assets/hero-src'
const SRC_W = 1672
const H = 941
const CREAM = '#fffaf7'

// The banner runs full width, so its aspect ratio is its height: 16:9 gave an
// 810px hero at 1440px wide. Rather than crop the art, the canvas is widened
// past the source's 1.78 and the extra is the left gradient carried outwards —
// nothing is lost and the negative space the copy sits in only gets roomier.
// Raise this to flatten the hero further, lower it to give the products height.
const ASPECT = 2.5
const W = Math.round(H * ASPECT)
const PAD = W - SRC_W

// Type metrics were set against a 1440px-tall canvas; scaling them off H keeps
// the layout identical whatever resolution the source art arrives at.
const u = (n) => (n * H) / 1440

// Lines are hand-broken rather than measured: three banners, and a wrap that
// runs past the clean left third is the one thing worth eyeballing anyway.
const BANNERS = [
  {
    slug: 'vibrators',
    heading: 'Vibrators',
    lines: ['Suction, rumble, and flutter.', 'Whisper-quiet motors in', 'body-safe silicone.'],
  },
  {
    slug: 'rose-vibrators',
    heading: 'Rose Vibrators',
    lines: ['The suction rose, in every', 'size and finish.'],
  },
  {
    slug: 'bullet-wand',
    heading: 'Bullets & Wands',
    lines: ['Precise bullets and', 'deep-rumble wands.'],
  },
]

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// The left scrim carries the contrast. bullet-wand's negative space is a bright
// coral that cream text alone only reaches ~3:1 against; darkened it clears 7:1,
// and the two darker banners are unharmed by it.
const overlay = ({ heading, lines }) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="scrim" x1="0" x2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.55"/>
      <stop offset="0.42" stop-color="#000" stop-opacity="0.34"/>
      <stop offset="0.72" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#scrim)"/>
  <text x="${u(170)}" y="${u(640)}" font-family="Georgia" font-size="${u(118)}" fill="${CREAM}">${esc(heading)}</text>
  ${lines
    .map(
      (line, i) =>
        `<text x="${u(174)}" y="${u(748 + i * 64)}" font-family="Karla, Segoe UI, sans-serif" font-size="${u(46)}" fill="${CREAM}" fill-opacity="0.88">${esc(line)}</text>`,
    )
    .join('\n  ')}
</svg>`)

for (const banner of BANNERS) {
  const out = `public/heroes/${banner.slug}-wide.webp`
  // Each stage is its own pipeline: sharp honours one resize per pipeline, so
  // chaining the column stretch onto the source resize silently drops it.
  const src = await sharp(`${SRC}/${banner.slug}.webp`).resize(SRC_W, H).png().toBuffer()
  // The widened strip is the source's leftmost pixel column stretched across
  // PAD. That column is a smooth vertical gradient with no horizontal detail,
  // so it meets the original seamlessly and invents no content.
  const column = await sharp(src).extract({ left: 0, top: 0, width: 1, height: H }).png().toBuffer()
  const edge = await sharp(column).resize(PAD, H, { fit: 'fill' }).png().toBuffer()
  const info = await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } })
    .composite([
      { input: edge, left: 0, top: 0 },
      { input: src, left: PAD, top: 0 },
      { input: overlay(banner), left: 0, top: 0 },
    ])
    .webp({ quality: 88 })
    .toFile(out)
  console.log(out, `${info.width}x${info.height}`, `${Math.round(info.size / 1024)}KB`)
}
