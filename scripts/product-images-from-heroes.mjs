// Product images cropped from the category banners.
//
// The catalog shipped with picsum placeholders — random stock photos next to
// product names, which reads as a test store to anyone reviewing it. The
// category banners are real, product-only art we already own, so each product
// gets a 4:5 portrait crop of its category banner. Siblings in a category take
// evenly spaced horizontal windows, so three vibrators are three different
// crops of the same still life rather than one image repeated.
//
// ponytail: interim until supplier packshots exist — replace per product in
// /admin/products, which overrides these rows.
//
//   node --env-file=.env scripts/product-images-from-heroes.mjs [--dry]
//
// --dry writes the files and the contact sheet but leaves the database alone.
import sharp from 'sharp'
import { existsSync, mkdirSync } from 'node:fs'
import pg from 'pg'

const dry = process.argv.includes('--dry')
const OUT = 'public/products'
const W = 900
const H = 1125

// The three vibrator banners carry baked headline copy; use the text-free
// sources for those so no words end up in a product shot.
const source = (slug) =>
  existsSync(`assets/hero-src/${slug}.webp`) ? `assets/hero-src/${slug}.webp` : `public/heroes/${slug}-wide.webp`

const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()

const { rows } = await db.query(
  `SELECT p.id, p.slug, p.name, c.slug AS category
   FROM "Product" p JOIN "Category" c ON c.id = p."categoryId"
   ORDER BY c.slug, p."createdAt"`,
)

mkdirSync(OUT, { recursive: true })
const byCategory = Map.groupBy(rows, (r) => r.category)
const written = []

// Banners keep a third of their width as negative space for headline copy, and
// a few are letterboxed. Cropping blindly lands products in the dark, so find
// the box the detail actually sits in first: sum of pixel deltas per column and
// per row at thumbnail size, thresholded against the busiest line.
async function contentBox(src) {
  const { data, info } = await sharp(src).resize(256).greyscale().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const cols = new Float64Array(w)
  const rows = new Float64Array(h)
  for (let y = 1; y < h; y++)
    for (let x = 1; x < w; x++) {
      const p = data[y * w + x]
      cols[x] += Math.abs(p - data[(y - 1) * w + x])
      rows[y] += Math.abs(p - data[y * w + x - 1])
    }
  const span = (arr) => {
    const cut = Math.max(...arr) * 0.4
    let a = 0
    let b = arr.length - 1
    while (a < b && arr[a] < cut) a++
    while (b > a && arr[b] < cut) b--
    return [a / arr.length, (b + 1) / arr.length]
  }
  const [x0, x1] = span(cols)
  const [y0, y1] = span(rows)
  return { x0, x1, y0, y1 }
}

for (const [category, products] of byCategory) {
  const src = source(category)
  const meta = await sharp(src).metadata()
  const box = await contentBox(src)
  const bx = Math.round(box.x0 * meta.width)
  const bw = Math.round((box.x1 - box.x0) * meta.width)
  const by = Math.round(box.y0 * meta.height)
  const bh = Math.round((box.y1 - box.y0) * meta.height)
  // Tallest 4:5 window that fits the content box; siblings slide it across.
  let height = bh
  let width = Math.round((height * W) / H)
  if (width > bw) {
    width = bw
    height = Math.round((width * H) / W)
  }
  const top = by + Math.round((bh - height) / 2)
  const span = bw - width
  for (const [i, product] of products.entries()) {
    const left = bx + Math.round(products.length === 1 ? span / 2 : (span * i) / (products.length - 1))
    const file = `${OUT}/${product.slug}.webp`
    await sharp(src).extract({ left, top, width, height }).resize(W, H).webp({ quality: 82 }).toFile(file)
    written.push({ ...product, file })
  }
}

// Contact sheet so the crops can be eyeballed before the database changes.
const tiles = await Promise.all(written.map((w) => sharp(w.file).resize(180, 225).png().toBuffer()))
const cols = 8
await sharp({
  create: { width: cols * 180, height: Math.ceil(tiles.length / cols) * 225, channels: 3, background: '#fff' },
})
  .composite(tiles.map((input, i) => ({ input, left: (i % cols) * 180, top: Math.floor(i / cols) * 225 })))
  .png()
  .toFile(`${OUT}/_contact-sheet.png`)

if (!dry) {
  for (const w of written) {
    await db.query(`DELETE FROM "ProductMedia" WHERE "productId" = $1 AND "licenseStatus" = 'development-placeholder'`, [w.id])
    await db.query(
      `INSERT INTO "ProductMedia" ("id", "productId", "url", "altText", "width", "height", "mimeType", "position", "sourceType", "licenseStatus")
       VALUES ($1, $2, $3, $4, $5, $6, 'image/webp', 0, 'category-art', 'store-owned')
       ON CONFLICT DO NOTHING`,
      [`pm_${w.slug}`.slice(0, 30), w.id, `/products/${w.slug}.webp`, w.name, W, H],
    )
  }
}

await db.end()
console.log(`${written.length} product images → ${OUT}${dry ? ' (dry run, database untouched)' : ''}`)
