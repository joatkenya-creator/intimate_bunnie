import { PrismaClient } from '../src/generated/prisma/client.ts'
import { PrismaPg } from '@prisma/adapter-pg'

// Catalog seed. Images are deterministic remote placeholders for development —
// swap `img()` for real, licensed media before launch.

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const img = (seed: string, n = 1) => `https://picsum.photos/seed/${seed}-${n}/900/1125`

// Real landscape category banners live in /public/heroes; the rest still get a
// placeholder. Re-seeding must not throw the real art away.
const HEROES: Record<string, string> = Object.fromEntries(
  ['lingerie', 'thongs', 'babydolls', 'bodysuits'].map((slug) => [slug, `/heroes/${slug}.webp`]),
)
const hero = (slug: string) => HEROES[slug] ?? img(slug)

type CategorySeed = { slug: string; name: string; description: string; children?: CategorySeed[] }

const CATEGORIES: CategorySeed[] = [
  {
    slug: 'lingerie',
    name: 'Lingerie',
    description: 'Sheer lace, strappy mesh, and barely-there silk. Sizes XS through 3X.',
    children: [
      { slug: 'thongs', name: 'Thongs & Panties', description: 'Lace thongs, crotchless briefs, and pearl strings.' },
      { slug: 'babydolls', name: 'Babydolls & Sets', description: 'Matched sets and sheer babydolls with garter detail.' },
      { slug: 'bodysuits', name: 'Bodysuits & Teddies', description: 'Fishnet, strappy, and open-back one-pieces.' },
    ],
  },
  {
    slug: 'vibrators',
    name: 'Vibrators',
    description: 'Suction, rumble, and flutter. Whisper-quiet motors in body-safe silicone.',
    children: [
      { slug: 'rose-vibrators', name: 'Rose Vibrators', description: 'The suction rose, in every size and finish.' },
      { slug: 'bullet-wand', name: 'Bullets & Wands', description: 'Precise bullets and deep-rumble wands.' },
    ],
  },
  {
    slug: 'dildos',
    name: 'Dildos',
    description: 'Silicone, glass, and dual-density. Suction bases and harness-compatible shapes.',
  },
  {
    slug: 'for-him',
    name: 'For Him',
    description: 'Rings, strokers, and enhancement — chosen for material and honest sizing.',
    children: [
      { slug: 'penis-rings', name: 'Penis Rings', description: 'Silicone and steel rings, vibrating and plain.' },
      { slug: 'strokers', name: 'Strokers & Sleeves', description: 'Pocket pleasure sleeves and textured solo strokers.' },
      { slug: 'enhancement', name: 'Enhancement', description: 'Pumps, extenders, and sleeves for added length and girth.' },
    ],
  },
  {
    slug: 'wellness',
    name: 'Oils & Lubricants',
    description: 'Water-based lubricants, warming oils, and gold shimmer for skin.',
    children: [
      { slug: 'lubricants', name: 'Lubricants', description: 'Water-based, silicone, and warming formulas.' },
      { slug: 'body-oils', name: 'Body Oils', description: 'Shimmer oils, massage blends, and gold-flecked glow.' },
      { slug: 'condoms', name: 'Condoms', description: 'Ultra-thin, ribbed, warming, and vegan-friendly.' },
    ],
  },
  {
    slug: 'body-jewelry',
    name: 'Body Jewelry',
    description: 'Implant-grade steel and solid gold for belly, nose, tongue, and nipple.',
    children: [
      { slug: 'belly-rings', name: 'Belly Rings', description: 'Dangles, opals, and simple curved barbells.' },
      { slug: 'nose-jewelry', name: 'Nose Jewelry', description: 'Studs, hoops, and septum clickers.' },
      { slug: 'tongue-bars', name: 'Tongue Bars', description: 'Straight barbells in steel and titanium.' },
      { slug: 'nipple-jewelry', name: 'Nipple Jewelry', description: 'Shields, barbells, and non-piercing clamps.' },
    ],
  },
]

type ProductSeed = {
  slug: string
  name: string
  category: string
  summary: string
  description: string
  price: number
  compare?: number
  inventory?: number
  featured?: boolean
  rating?: number
  reviews?: number
  tags: string[]
  sizes?: string[]
  colors?: string[]
}

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2X']

const PRODUCTS: ProductSeed[] = [
  // ── Lingerie ────────────────────────────────────────────────────────────
  {
    slug: 'sheer-bloom-lace-thong',
    name: 'Sheer Bloom Lace Thong',
    category: 'thongs',
    summary: 'Featherweight floral lace with a scalloped edge that disappears under everything.',
    description:
      'Cut from a single panel of stretch floral lace with no side seams, so nothing prints through a slip dress.\n\nThe scalloped waist sits low on the hip and the back is a narrow 8mm strap. Cotton gusset, because comfort is not optional.\n\nHand wash cold, lay flat to dry.',
    price: 1800,
    compare: 2400,
    featured: true,
    rating: 4.7,
    reviews: 214,
    tags: ['lace', 'thong', 'sheer'],
    sizes: SIZES,
  },
  {
    slug: 'pearl-string-crotchless-brief',
    name: 'Pearl String Crotchless Brief',
    category: 'thongs',
    summary: 'A strand of glass pearls along the seam, set into soft mesh.',
    description:
      'Glass pearls are strung on a reinforced elastic core and set into a soft micro-mesh brief. The pearls move with you rather than sitting rigid.\n\nOpen gusset. Fully adjustable at the hip.',
    price: 2600,
    rating: 4.5,
    reviews: 88,
    tags: ['pearl', 'crotchless', 'mesh'],
    sizes: SIZES,
  },
  {
    slug: 'midnight-strappy-thong-set-of-3',
    name: 'Midnight Strappy Thong, Set of 3',
    category: 'thongs',
    summary: 'Three strappy microfiber thongs in black, peach, and rose.',
    description:
      'Everyday microfiber with a strappy cage detail across the hip. Soft enough for a twelve-hour day, sharp enough to be seen in.\n\nSet includes one each in black, peach, and rose.',
    price: 3200,
    compare: 4200,
    rating: 4.8,
    reviews: 341,
    tags: ['thong', 'set', 'microfiber'],
    sizes: SIZES,
  },
  {
    slug: 'rosewater-babydoll-set',
    name: 'Rosewater Babydoll Set',
    category: 'babydolls',
    summary: 'Sheer chiffon babydoll with an underwire cup and matching thong.',
    description:
      'A blush chiffon babydoll with a structured underwire cup, adjustable straps, and a skirt that falls just past the hip.\n\nComes with a matching lace thong. The chiffon is genuinely sheer — that is the point.',
    price: 5800,
    compare: 7400,
    featured: true,
    rating: 4.9,
    reviews: 176,
    tags: ['babydoll', 'set', 'sheer', 'peach'],
    sizes: SIZES,
  },
  {
    slug: 'garter-lace-two-piece',
    name: 'Garter Lace Two-Piece',
    category: 'babydolls',
    summary: 'Bralette and high-waist garter belt in eyelash lace, stockings included.',
    description:
      'Eyelash lace bralette with a soft triangle cup, paired with a high-waist garter belt and four adjustable straps.\n\nSheer thigh-high stockings included. Hooks are coated so they will not snag the lace.',
    price: 6800,
    rating: 4.6,
    reviews: 97,
    tags: ['garter', 'lace', 'stockings'],
    sizes: SIZES,
  },
  {
    slug: 'fishnet-open-back-bodysuit',
    name: 'Fishnet Open-Back Bodysuit',
    category: 'bodysuits',
    summary: 'Wide-gauge fishnet with an open back and snap closure.',
    description:
      'A single piece of wide-gauge fishnet with a deep scoop back and a three-snap gusset. Stretches four ways and returns to shape.\n\nWears well under an open blazer, or under nothing.',
    price: 3400,
    featured: true,
    rating: 4.4,
    reviews: 129,
    tags: ['fishnet', 'bodysuit', 'open-back'],
    sizes: SIZES,
  },
  {
    slug: 'silk-strap-teddy',
    name: 'Silk Strap Teddy',
    category: 'bodysuits',
    summary: 'Washed silk teddy with adjustable rose-gold hardware.',
    description:
      'Cut from 19-momme washed silk with a bias front that skims rather than clings. Rose-gold sliders on every strap.\n\nMachine washable on cold, delicate cycle, in a mesh bag.',
    price: 8900,
    compare: 11000,
    rating: 4.9,
    reviews: 64,
    tags: ['silk', 'teddy', 'luxury'],
    sizes: SIZES,
  },

  // ── Vibrators ───────────────────────────────────────────────────────────
  {
    slug: 'rose-suction-vibrator',
    name: 'The Rose Suction Vibrator',
    category: 'rose-vibrators',
    summary: 'Seven suction intensities in a silicone rose that fits in a palm.',
    description:
      'The original rose shape, in platinum-cured silicone with a soft matte finish. Seven suction patterns, from a slow pulse to a steady draw.\n\nFully waterproof (IPX7) and USB-C magnetic charging — two hours of charge gives about ninety minutes of use.\n\nUse with water-based lubricant only.',
    price: 4200,
    compare: 5900,
    featured: true,
    rating: 4.8,
    reviews: 1893,
    tags: ['rose', 'suction', 'waterproof', 'bestseller'],
    colors: ['Rose Red', 'Peach', 'Blush Pink', 'Deep Plum'],
  },
  {
    slug: 'rose-duo-tongue-flutter',
    name: 'Rose Duo Tongue & Flutter',
    category: 'rose-vibrators',
    summary: 'Suction on one end, a fluttering silicone tongue on the other.',
    description:
      'A double-ended rose: air-pulse suction at the bloom and a flexible fluttering tongue at the stem. Ten patterns each, controlled independently.\n\nBody-safe silicone, waterproof, magnetic USB-C charging.',
    price: 5600,
    compare: 6900,
    featured: true,
    rating: 4.7,
    reviews: 742,
    tags: ['rose', 'suction', 'dual'],
    colors: ['Rose Red', 'Peach'],
  },
  {
    slug: 'petite-rose-travel-vibrator',
    name: 'Petite Rose Travel Vibrator',
    category: 'rose-vibrators',
    summary: 'Palm-sized rose with a travel lock and a discreet zip pouch.',
    description:
      'Half the size of the original rose and quiet enough for thin walls — under 45 decibels at the highest setting.\n\nPress-and-hold travel lock so it never wakes up in a bag. Ships with a zip pouch.',
    price: 3200,
    rating: 4.6,
    reviews: 418,
    tags: ['rose', 'travel', 'quiet'],
    colors: ['Rose Red', 'Peach', 'Ivory'],
  },
  {
    slug: 'velvet-bullet-mini',
    name: 'Velvet Bullet Mini',
    category: 'bullet-wand',
    summary: 'A precise ten-speed bullet with a velvet-soft coating.',
    description:
      'Small, pointed, and rumbly rather than buzzy. Ten speeds on a single button, with a memory that returns to your last setting.\n\nWaterproof and USB rechargeable.',
    price: 2400,
    compare: 3200,
    rating: 4.5,
    reviews: 552,
    tags: ['bullet', 'compact', 'quiet'],
    colors: ['Peach', 'Rose', 'Black'],
  },
  {
    slug: 'lush-wand-massager',
    name: 'Lush Wand Massager',
    category: 'bullet-wand',
    summary: 'Deep, low-frequency rumble with a flexible silicone head.',
    description:
      'A full-size wand tuned for low-frequency rumble rather than high-frequency buzz — the difference you feel after ten minutes.\n\nFlexible neck, eight speeds, twenty patterns. Cordless with a three-hour runtime.',
    price: 7900,
    featured: true,
    rating: 4.9,
    reviews: 631,
    tags: ['wand', 'rumble', 'cordless'],
  },

  // ── Dildos ──────────────────────────────────────────────────────────────
  {
    slug: 'dual-density-silicone-dildo-7',
    name: 'Dual-Density Silicone Dildo, 7"',
    category: 'dildos',
    summary: 'Firm core, soft outer layer, strong suction base.',
    description:
      'Two densities of platinum silicone: a firm inner core with a softer outer layer that moves like skin.\n\n7 inches insertable, 1.5 inch diameter. The suction base holds on tile and glass and is harness-compatible.\n\nWater-based lubricant only.',
    price: 6400,
    featured: true,
    rating: 4.8,
    reviews: 287,
    tags: ['silicone', 'suction-base', 'dual-density'],
    colors: ['Blush', 'Caramel', 'Deep Plum'],
  },
  {
    slug: 'borosilicate-glass-wand',
    name: 'Borosilicate Glass Wand',
    category: 'dildos',
    summary: 'Hand-blown glass with a spiral ridge. Warms or chills.',
    description:
      'Hand-blown borosilicate — the same glass as laboratory equipment, so it will not chip or scratch.\n\nRun it under warm or cool water before use. Compatible with every lubricant, including silicone. Dishwasher safe.',
    price: 4800,
    rating: 4.7,
    reviews: 143,
    tags: ['glass', 'temperature-play', 'non-porous'],
  },
  {
    slug: 'curved-g-spot-silicone-dildo',
    name: 'Curved G-Spot Silicone Dildo',
    category: 'dildos',
    summary: 'A deliberate 35-degree curve with a bulbous tip.',
    description:
      'The curve is the whole product: 35 degrees with a bulbous tip that keeps contact through the stroke.\n\n6 inches insertable, flared base. Matte silicone that does not drag.',
    price: 5200,
    compare: 6400,
    rating: 4.6,
    reviews: 208,
    tags: ['g-spot', 'silicone', 'curved'],
    colors: ['Blush', 'Rose'],
  },

  // ── For Him ─────────────────────────────────────────────────────────────
  {
    slug: 'silicone-penis-ring-set-of-3',
    name: 'Silicone Penis Ring, Set of 3',
    category: 'penis-rings',
    summary: 'Three stretch sizes in soft platinum silicone.',
    description:
      'Three rings — 1.25", 1.5", and 1.75" relaxed diameter — in soft platinum silicone that stretches to roughly double without losing tension.\n\nStart with the largest. Remove after twenty minutes.',
    price: 1900,
    compare: 2600,
    featured: true,
    rating: 4.6,
    reviews: 496,
    tags: ['penis-ring', 'silicone', 'set'],
  },
  {
    slug: 'vibrating-couples-ring',
    name: 'Vibrating Couples Ring',
    category: 'penis-rings',
    summary: 'Ten-mode motor positioned for clitoral contact.',
    description:
      'A stretch silicone ring with the motor set at the top, so it sits where it needs to during penetration.\n\nTen modes, one button, waterproof. USB rechargeable with about sixty minutes of runtime.',
    price: 3400,
    rating: 4.5,
    reviews: 312,
    tags: ['penis-ring', 'vibrating', 'couples'],
  },
  {
    slug: 'stainless-steel-weighted-ring',
    name: 'Stainless Steel Weighted Ring',
    category: 'penis-rings',
    summary: 'Polished 316L steel with real heft.',
    description:
      'Solid 316L surgical steel, mirror polished, with no seam or coating to wear off. The weight is the appeal.\n\nAvailable in three inner diameters. Non-porous and boil-safe.',
    price: 2900,
    rating: 4.4,
    reviews: 87,
    tags: ['penis-ring', 'steel', 'weighted'],
    colors: ['45mm', '50mm', '55mm'],
  },
  {
    slug: 'solo-pocket-pleasure-sleeve',
    name: 'Solo Pocket Pleasure Sleeve',
    category: 'strokers',
    summary: 'Discreet pocket stroker with a textured internal canal.',
    description:
      'A soft TPE canal with a ribbed and nubbed interior, inside a hard shell that looks like nothing in particular on a shelf.\n\nOpen-ended for easy cleaning and adjustable suction. Rinse with warm water, air dry, and dust with renewing powder.',
    price: 2800,
    compare: 3900,
    featured: true,
    rating: 4.5,
    reviews: 673,
    tags: ['stroker', 'pocket', 'discreet', 'solo'],
  },
  {
    slug: 'dual-texture-stroker-sleeve',
    name: 'Dual-Texture Stroker Sleeve',
    category: 'strokers',
    summary: 'Two textures, one sleeve — ribbed one way, nubbed the other.',
    description:
      'Reversible: one end is a tight ribbed canal, the other is looser with raised nubs. Fully open-ended.\n\nUltra-soft TPE. Use with a generous amount of water-based lubricant.',
    price: 3600,
    rating: 4.4,
    reviews: 221,
    tags: ['stroker', 'reversible', 'textured'],
  },
  {
    slug: 'hydro-enlargement-pump',
    name: 'Hydro Enlargement Pump',
    category: 'enhancement',
    summary: 'Water-based pump with a pressure gauge and quick-release valve.',
    description:
      'A water-based pump rather than an air pump — pressure distributes evenly, which is both more comfortable and less risky.\n\nBuilt-in gauge and a quick-release valve. Use for no more than fifteen minutes per session.\n\nThis is a wellness product, not a medical device, and results vary.',
    price: 5900,
    compare: 7900,
    rating: 4.2,
    reviews: 158,
    tags: ['enhancement', 'pump', 'hydro'],
  },
  {
    slug: 'girth-extender-sleeve',
    name: 'Girth Extender Sleeve',
    category: 'enhancement',
    summary: 'Adds an inch of length and noticeable girth, in soft silicone.',
    description:
      'A hollow platinum-silicone sleeve that adds roughly one inch of length and a half inch of girth, with a textured exterior.\n\nStretches to fit most sizes. Wash before and after every use with mild soap.',
    price: 3800,
    rating: 4.1,
    reviews: 204,
    tags: ['enhancement', 'sleeve', 'silicone'],
  },

  // ── Oils, lubricants, condoms ───────────────────────────────────────────
  {
    slug: 'water-based-lubricant-8oz',
    name: 'Water-Based Lubricant, 8 oz',
    category: 'lubricants',
    summary: 'Slick, pH-balanced, glycerin-free. Safe with every toy.',
    description:
      'A glycerin-free, paraben-free, pH-balanced water-based formula that stays slick without going tacky.\n\nSafe with silicone toys, glass, steel, and latex condoms. Rinses clean with water and does not stain sheets.',
    price: 1600,
    featured: true,
    rating: 4.8,
    reviews: 984,
    tags: ['lubricant', 'water-based', 'toy-safe'],
  },
  {
    slug: 'warming-cinnamon-lubricant',
    name: 'Warming Cinnamon Lubricant',
    category: 'lubricants',
    summary: 'A gentle warming glide that builds with friction.',
    description:
      'Warms on contact and builds with movement rather than arriving all at once. Cinnamon leaf, no capsaicin.\n\nWater-based and toy-safe. Patch test first if you have sensitive skin.',
    price: 1900,
    rating: 4.3,
    reviews: 267,
    tags: ['lubricant', 'warming', 'water-based'],
  },
  {
    slug: 'silicone-lubricant-4oz',
    name: 'Silicone Lubricant, 4 oz',
    category: 'lubricants',
    summary: 'Long-lasting and waterproof. Not for silicone toys.',
    description:
      'A pure dimethicone blend that lasts far longer than water-based lube and works in the shower.\n\nDo not use with silicone toys — it degrades the surface. Glass and steel are fine.',
    price: 2200,
    rating: 4.6,
    reviews: 189,
    tags: ['lubricant', 'silicone', 'waterproof'],
  },
  {
    slug: 'gold-shimmer-body-oil',
    name: 'Gold Shimmer Body Oil',
    category: 'body-oils',
    summary: 'Fine gold mica in a dry-touch jojoba oil. Glow, not grease.',
    description:
      'Ultra-fine gold mica suspended in jojoba and sweet almond oil, formulated to absorb rather than sit on the skin. The shimmer catches low light without looking like glitter.\n\nShake before use. Warm a few drops between your palms and press into shoulders, collarbone, and legs.\n\nFragranced with vanilla and warm amber. 4 oz glass bottle with a pump.',
    price: 3400,
    compare: 4200,
    featured: true,
    rating: 4.9,
    reviews: 812,
    tags: ['body-oil', 'shimmer', 'gold', 'glow'],
  },
  {
    slug: 'rose-massage-oil',
    name: 'Rose Massage Oil',
    category: 'body-oils',
    summary: 'Slow-absorbing rose and sweet almond blend for long massages.',
    description:
      'Sweet almond and grapeseed with real rose absolute — it stays slick long enough for an actual massage rather than three minutes of one.\n\nNot for use with latex condoms. 8 oz glass bottle.',
    price: 2800,
    rating: 4.7,
    reviews: 341,
    tags: ['body-oil', 'massage', 'rose'],
  },
  {
    slug: 'peach-glow-dry-oil-mist',
    name: 'Peach Glow Dry Oil Mist',
    category: 'body-oils',
    summary: 'A fine mist of peach kernel oil that dries in seconds.',
    description:
      'A dry oil that sprays as a fine mist and absorbs almost immediately, leaving a soft peach scent and a subtle sheen.\n\nPeach kernel, apricot, and vitamin E. Good over damp skin straight out of the shower.',
    price: 2400,
    rating: 4.6,
    reviews: 229,
    tags: ['body-oil', 'peach', 'dry-oil'],
  },
  {
    slug: 'ultra-thin-condoms-12pk',
    name: 'Ultra-Thin Condoms, 12 pack',
    category: 'condoms',
    summary: '0.045mm latex with a silicone-free lubricant coating.',
    description:
      '0.045mm natural latex — about a third thinner than standard — electronically tested one by one.\n\nStraight-walled with a reservoir tip and a light odorless lubricant. 12 individually wrapped.',
    price: 1400,
    rating: 4.7,
    reviews: 502,
    tags: ['condoms', 'ultra-thin', 'latex'],
  },
  {
    slug: 'ribbed-and-dotted-condoms-12pk',
    name: 'Ribbed & Dotted Condoms, 12 pack',
    category: 'condoms',
    summary: 'Raised ribs and dots along the shaft, roomier tip.',
    description:
      'Alternating rib and dot texture along the shaft with a slightly wider head for comfort.\n\nNatural latex, electronically tested, 12 individually wrapped.',
    price: 1600,
    rating: 4.4,
    reviews: 288,
    tags: ['condoms', 'textured', 'ribbed'],
  },
  {
    slug: 'vegan-latex-free-condoms-10pk',
    name: 'Vegan Latex-Free Condoms, 10 pack',
    category: 'condoms',
    summary: 'Polyisoprene, no casein, no latex smell. Safe for latex allergies.',
    description:
      'Polyisoprene rather than latex — no latex protein, no casein, and none of the smell. Softer and more heat-conductive than latex.\n\nSafe for latex allergies. Compatible with water-based and silicone lubricants. 10 individually wrapped.',
    price: 1900,
    featured: true,
    rating: 4.8,
    reviews: 176,
    tags: ['condoms', 'vegan', 'latex-free', 'hypoallergenic'],
  },

  // ── Body jewelry ────────────────────────────────────────────────────────
  {
    slug: 'opal-dangle-belly-ring',
    name: 'Opal Dangle Belly Ring',
    category: 'belly-rings',
    summary: 'Lab opal drop on a 14g implant-grade steel curved barbell.',
    description:
      'A lab-created opal drop on a 14g curved barbell in implant-grade ASTM F-136 titanium — nickel-free and safe for healed piercings.\n\n10mm bar length. Internally threaded, so nothing scrapes on the way in.',
    price: 2200,
    compare: 2900,
    featured: true,
    rating: 4.8,
    reviews: 394,
    tags: ['belly-ring', 'opal', 'titanium'],
    colors: ['White Opal', 'Peach Opal', 'Rose Opal'],
  },
  {
    slug: 'gold-chain-belly-ring',
    name: 'Gold Chain Belly Ring',
    category: 'belly-rings',
    summary: 'Solid 14k gold barbell with a fine draped chain.',
    description:
      'Solid 14k yellow gold — not plated, not filled — with a fine draped chain that moves when you do.\n\n14g, 10mm bar. Weighs 1.2g.',
    price: 12800,
    rating: 4.9,
    reviews: 71,
    tags: ['belly-ring', 'gold', 'chain', 'luxury'],
  },
  {
    slug: 'titanium-nose-stud-trio',
    name: 'Titanium Nose Stud Trio',
    category: 'nose-jewelry',
    summary: 'Three 20g L-bend studs: crystal, opal, and plain ball.',
    description:
      'Three implant-grade titanium L-bend nose studs — one CZ crystal, one lab opal, one plain 2mm ball.\n\n20g, 8mm post. Nickel-free and safe for sensitive skin.',
    price: 1800,
    rating: 4.6,
    reviews: 263,
    tags: ['nose', 'stud', 'titanium', 'set'],
  },
  {
    slug: 'septum-clicker-hoop',
    name: 'Septum Clicker Hoop',
    category: 'nose-jewelry',
    summary: 'Hinged 16g clicker with a pavé crystal front.',
    description:
      'A hinged clicker that snaps closed with one hand — no fumbling with tiny balls over a sink.\n\n16g, 8mm inner diameter, implant-grade steel with a pavé CZ front.',
    price: 2400,
    rating: 4.7,
    reviews: 158,
    tags: ['septum', 'clicker', 'hoop'],
    colors: ['Silver', 'Gold', 'Rose Gold'],
  },
  {
    slug: 'titanium-tongue-barbell-pair',
    name: 'Titanium Tongue Barbell, Pair',
    category: 'tongue-bars',
    summary: 'Two 14g straight barbells with smooth-polished ball ends.',
    description:
      'Implant-grade titanium straight barbells, 14g with 16mm bars and 5mm balls polished smooth so they are gentle on enamel.\n\nSet of two. Autoclave safe.',
    price: 1600,
    rating: 4.5,
    reviews: 132,
    tags: ['tongue', 'barbell', 'titanium'],
    colors: ['Silver', 'Black', 'Rainbow'],
  },
  {
    slug: 'opal-nipple-barbell-pair',
    name: 'Opal Nipple Barbell, Pair',
    category: 'nipple-jewelry',
    summary: 'Lab opal ends on 14g internally threaded titanium.',
    description:
      'Lab-created opal ends on 14g internally threaded implant-grade titanium — the threading is inside the bar, so nothing catches.\n\n14mm bar length. Sold as a pair.',
    price: 3200,
    featured: true,
    rating: 4.8,
    reviews: 187,
    tags: ['nipple', 'opal', 'titanium'],
    colors: ['White Opal', 'Peach Opal'],
  },
  {
    slug: 'non-piercing-nipple-shields',
    name: 'Non-Piercing Nipple Shields',
    category: 'nipple-jewelry',
    summary: 'Adjustable gold-tone shields with a crystal drop. No piercing needed.',
    description:
      'Adjustable clamps set into decorative gold-tone shields with a crystal drop. Tension adjusts with a small screw, so you set the pressure.\n\nNo piercing required. Sold as a pair.',
    price: 2600,
    rating: 4.3,
    reviews: 94,
    tags: ['nipple', 'non-piercing', 'shields'],
  },
]

const REVIEW_SNIPPETS = [
  { title: 'Exactly as described', body: 'Arrived in two days in a plain box. The material feels every bit as good as the listing says.' },
  { title: 'Worth it', body: 'I hesitated at the price and I should not have. The quality difference is obvious the moment you hold it.' },
  { title: 'Discreet packaging is real', body: 'Nothing on the box, neutral return address, and the card statement was unremarkable. Exactly what I needed.' },
  { title: 'Runs slightly small', body: 'Lovely piece, but I would size up if you are between sizes. Otherwise no notes.' },
  { title: 'My new favorite', body: 'Quiet, well made, and easy to clean. This one is staying in the nightstand.' },
]

async function main() {
  console.log('Clearing catalog…')
  await db.orderItem.deleteMany()
  await db.order.deleteMany()
  await db.review.deleteMany()
  await db.productMedia.deleteMany()
  await db.variant.deleteMany()
  await db.product.deleteMany()
  await db.category.deleteMany()

  console.log('Seeding categories…')
  const categoryIds = new Map<string, string>()

  for (const [index, parent] of CATEGORIES.entries()) {
    const created = await db.category.create({
      data: {
        slug: parent.slug,
        name: parent.name,
        description: parent.description,
        heroImage: hero(parent.slug),
        position: index,
        seoTitle: `${parent.name} — Shop ${parent.name} Online`,
        seoDesc: parent.description,
      },
      select: { id: true },
    })
    categoryIds.set(parent.slug, created.id)

    for (const [childIndex, child] of (parent.children ?? []).entries()) {
      const createdChild = await db.category.create({
        data: {
          slug: child.slug,
          name: child.name,
          description: child.description,
          heroImage: hero(child.slug),
          position: childIndex,
          parentId: created.id,
          seoTitle: `${child.name}`,
          seoDesc: child.description,
        },
        select: { id: true },
      })
      categoryIds.set(child.slug, createdChild.id)
    }
  }

  console.log(`Seeding ${PRODUCTS.length} products…`)
  for (const [index, product] of PRODUCTS.entries()) {
    const categoryId = categoryIds.get(product.category)
    if (!categoryId) throw new Error(`Unknown category: ${product.category}`)

    const optionValues = product.sizes ?? product.colors ?? []
    const optionName = product.sizes ? 'Size' : product.colors ? 'Color' : null
    const sku = `IB-${String(index + 1).padStart(4, '0')}`

    await db.product.create({
      data: {
        slug: product.slug,
        name: product.name,
        summary: product.summary,
        description: product.description,
        priceCents: product.price,
        comparePrice: product.compare,
        sku,
        inventory: product.inventory ?? 40,
        featured: product.featured ?? false,
        rating: product.rating ?? 0,
        reviewCount: product.reviews ?? 0,
        tags: product.tags,
        categoryId,
        seoTitle: `${product.name}`,
        seoDesc: product.summary,
        media: {
          create: [1, 2, 3].map((n) => ({
            url: img(product.slug, n),
            altText: `${product.name} — view ${n}`,
            width: 900,
            height: 1125,
            mimeType: 'image/jpeg',
            position: n - 1,
            sourceType: 'placeholder',
            licenseStatus: 'development-placeholder',
          })),
        },
        variants: optionName
          ? {
              create: optionValues.map((value, i) => ({
                optionName,
                optionValue: value,
                sku: `${sku}-${value.replace(/\s+/g, '').toUpperCase().slice(0, 6)}`,
                priceDelta: 0,
                inventory: 10 + i,
              })),
            }
          : undefined,
        reviews: {
          create: REVIEW_SNIPPETS.slice(0, (index % 3) + 1).map((snippet, i) => ({
            authorName: ['Dani R.', 'Mia K.', 'Tasha B.', 'Jordan L.'][(index + i) % 4],
            rating: i === 3 ? 4 : 5,
            title: snippet.title,
            body: snippet.body,
            approved: true,
          })),
        },
      },
    })
  }

  console.log('Done. Create an admin with:')
  console.log("  UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'you@example.com';")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
