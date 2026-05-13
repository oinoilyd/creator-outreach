// Pitch deck builder — Creator Outreach
// Renders 18 topics × 7 variations = 126 slides to docs/pitch-deck.pptx
//
//   node scripts/pitch-deck/build.js
//
// Optional flags:
//   --slim   Render only first variation per topic (18 slides) — fast smoke test
//   --topic <id>   Render all 7 variations for a single topic — focused QA

const path = require('path')
const PptxGenJS = require('pptxgenjs')
const { COLORS, FONTS, SIZES } = require('./tokens')
const { LAYOUTS, LAYOUT_ORDER } = require('./layouts')
const { TOPICS } = require('./content')
const H = require('./helpers')

const OUTPUT_PATH = path.resolve(__dirname, '../../docs/pitch-deck.pptx')

// ── Parse flags ──────────────────────────────────────────────────────
const args = process.argv.slice(2)
const slim = args.includes('--slim')
const topicArgIdx = args.indexOf('--topic')
const topicFilter = topicArgIdx >= 0 ? args[topicArgIdx + 1] : null

// ── Initialize deck ──────────────────────────────────────────────────
const pres = new PptxGenJS()
pres.title = 'Creator Outreach — Pitch Deck'
pres.subject = 'Creator Outreach (Gaynor Media LLC) — Pitch Deck · May 2026'
pres.author = 'Dylan Meehan'
pres.company = 'Gaynor Media LLC'
pres.layout = 'LAYOUT_WIDE'   // 13.333 × 7.5 inches
pres.defineLayout({ name: 'CO_WIDE', width: SIZES.slideW, height: SIZES.slideH })
pres.layout = 'CO_WIDE'

// ── Build the slide list ─────────────────────────────────────────────
let topics = TOPICS
if (topicFilter) {
  topics = TOPICS.filter((t) => t.id === topicFilter)
  if (!topics.length) {
    console.error(`✗ Unknown topic id: ${topicFilter}`)
    console.error(`  Known ids: ${TOPICS.map((t) => t.id).join(', ')}`)
    process.exit(1)
  }
}

const slideList = []
topics.forEach((topic, topicIdx) => {
  const variations = slim ? topic.variations.slice(0, 1) : topic.variations
  variations.forEach((variation, varIdx) => {
    slideList.push({
      topic: topic.id,
      topicTitle: topic.title,
      topicNumber: topicIdx + 1,
      variationLabel: String.fromCharCode(65 + varIdx), // A, B, C...
      layout: variation.layout,
      content: variation.content,
    })
  })
})

const totalSlides = slideList.length
console.log(`Building ${totalSlides} slides...`)

// ── Render ────────────────────────────────────────────────────────────
slideList.forEach((entry, idx) => {
  const slide = pres.addSlide()
  const layoutFn = LAYOUTS[entry.layout]
  if (!layoutFn) {
    console.error(`✗ Unknown layout: ${entry.layout}`)
    return
  }

  layoutFn(slide, entry.content)

  // Top-left brand mark on every slide except slide 1 cover hero (it's the title).
  const showBrandMark = !(entry.topic === 'cover' && entry.variationLabel === 'A')
  if (showBrandMark) {
    // Use mono mark on quote / hero / split panel slides to avoid color clash.
    const useMonoMark = entry.layout === 'split' || entry.layout === 'diagonal'
    H.addBrandMark(slide, {
      x: SIZES.margin,
      y: SIZES.margin - 0.05,
      size: 0.32,
      withWordmark: true,
      mono: false,
    })
  }

  // Layouts with a dark right panel — tag + page number need white text.
  const darkRightPanel = entry.layout === 'split' || entry.layout === 'diagonal'

  // Slide topic + variation tag in top-right.
  slide.addText(`${String(entry.topicNumber).padStart(2, '0')} · ${entry.topicTitle}  ·  v${entry.variationLabel}`, {
    x: SIZES.slideW - SIZES.margin - 4.5,
    y: SIZES.margin - 0.05,
    w: 4.5,
    h: 0.35,
    fontFace: FONTS.body,
    fontSize: 9,
    color: darkRightPanel ? COLORS.white : COLORS.muted,
    align: 'right',
    valign: 'middle',
    margin: 0,
    charSpacing: 1,
    transparency: darkRightPanel ? 15 : 0,
  })

  H.addFooter(slide, { slideNum: idx + 1, total: totalSlides, dark: darkRightPanel })

  // Speaker notes — a short summary so presenters know which variant is which.
  slide.addNotes(
    `Topic ${entry.topicNumber} — ${entry.topicTitle}\n` +
    `Variation ${entry.variationLabel} (${entry.layout} layout)\n` +
    `Slide ${idx + 1} of ${totalSlides}`
  )

  if ((idx + 1) % 25 === 0 || idx === slideList.length - 1) {
    console.log(`  ✓ ${idx + 1}/${totalSlides} slides built`)
  }
})

// ── Write ─────────────────────────────────────────────────────────────
pres
  .writeFile({ fileName: OUTPUT_PATH })
  .then((filename) => {
    console.log(`✓ Saved ${filename}`)
  })
  .catch((err) => {
    console.error(`✗ Failed to save: ${err.message}`)
    process.exit(1)
  })
