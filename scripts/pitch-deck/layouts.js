// Seven layout templates. Each is a pure function:  layout(slide, content)
// content shape (varies per layout):
//   { eyebrow, title, subtitle, body, bullets, stat, statLabel, cards, quote,
//     attribution, steps, callout, source, theme }
//
// theme: 'light' (default) | 'dark' | 'tint'

const { COLORS, FONTS, SIZES, GRADIENT_STOPS } = require('./tokens')
const H = require('./helpers')

const W = SIZES.slideW
const Hh = SIZES.slideH
const M = SIZES.margin

// ── Layout A: HERO_CENTER ────────────────────────────────────────────
// Big centered headline, eyebrow above, subhead below, brand mark bottom-left.
function layoutHero(slide, c) {
  H.paintBackground(slide, COLORS.white)

  // Decorative gradient ring in top-right (soft accent).
  H.addDot(slide, { x: W - 2.2, y: -1.0, size: 3.5, color: COLORS.tintPurpleLight })
  H.addDot(slide, { x: W - 1.5, y: -0.6, size: 2.4, color: COLORS.tintBlueLight, transparency: 40 })

  // Bottom-left dot grid pattern.
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) {
      H.addDot(slide, {
        x: M + i * 0.18,
        y: Hh - 1.5 + j * 0.18,
        size: 0.06,
        color: COLORS.brandPurple,
        transparency: 70,
      })
    }
  }

  if (c.eyebrow) {
    H.addEyebrow(slide, { x: M, y: 1.2, text: c.eyebrow, w: W - 2 * M })
  }

  slide.addText(c.title, {
    x: M, y: 1.7, w: W - 2 * M, h: 3.4,
    fontFace: FONTS.display,
    fontSize: c.titleSize || 64,
    bold: true,
    color: COLORS.ink,
    align: 'left',
    valign: 'top',
    margin: 0,
    charSpacing: -1,
    paraSpaceAfter: 0,
  })

  if (c.subtitle) {
    slide.addText(c.subtitle, {
      x: M, y: 5.2, w: W - 2 * M - 2, h: 1.2,
      fontFace: FONTS.body,
      fontSize: 18,
      color: COLORS.inkSoft,
      align: 'left',
      valign: 'top',
      margin: 0,
    })
  }
}

// ── Layout B: SPLIT_RIGHT ────────────────────────────────────────────
// 58% left text column, 42% right gradient panel with stat/visual.
function layoutSplit(slide, c) {
  H.paintBackground(slide, COLORS.white)

  // Right gradient panel — full bleed right side.
  const panelX = W * 0.58
  H.addGradientBlock(slide, {
    x: panelX, y: 0, w: W - panelX, h: Hh,
    stops: GRADIENT_STOPS,
    direction: 'vertical',
  })

  // Left content
  if (c.eyebrow) H.addEyebrow(slide, { x: M, y: 1.15, text: c.eyebrow })

  slide.addText(c.title, {
    x: M, y: 1.55, w: panelX - M - 0.4, h: 2.4,
    fontFace: FONTS.display, fontSize: c.titleSize || 42, bold: true,
    color: COLORS.ink, align: 'left', valign: 'top', margin: 0, charSpacing: -0.5,
  })

  // Body + bullets share the lower-left column. If both are given,
  // body is the lead paragraph and bullets sit below as proof points.
  const hasBody = !!c.body
  const hasBullets = c.bullets && c.bullets.length
  const bodyW = panelX - M - 0.4

  if (hasBody && hasBullets) {
    slide.addText(c.body, {
      x: M, y: 4.0, w: bodyW, h: 1.2,
      fontFace: FONTS.body, fontSize: 14, color: COLORS.inkSoft,
      align: 'left', valign: 'top', margin: 0, paraSpaceAfter: 6,
    })
    const bulletText = c.bullets.map((b) => ({ text: b, options: { bullet: { code: '25CF' } } }))
    slide.addText(bulletText, {
      x: M, y: 5.3, w: bodyW, h: 1.6,
      fontFace: FONTS.body, fontSize: 13, color: COLORS.inkSoft,
      align: 'left', valign: 'top', margin: 0, paraSpaceAfter: 6,
    })
  } else if (hasBody) {
    slide.addText(c.body, {
      x: M, y: 4.0, w: bodyW, h: 2.6,
      fontFace: FONTS.body, fontSize: 15, color: COLORS.inkSoft,
      align: 'left', valign: 'top', margin: 0, paraSpaceAfter: 8,
    })
  } else if (hasBullets) {
    const bulletText = c.bullets.map((b) => ({ text: b, options: { bullet: { code: '25CF' } } }))
    slide.addText(bulletText, {
      x: M, y: 4.0, w: bodyW, h: 2.6,
      fontFace: FONTS.body, fontSize: 14, color: COLORS.inkSoft,
      align: 'left', valign: 'top', margin: 0, paraSpaceAfter: 8,
    })
  }

  // Right panel content — big stat or quote.
  if (c.stat) {
    slide.addText(c.stat, {
      x: panelX + 0.4, y: 1.5, w: W - panelX - 0.8, h: 2.6,
      fontFace: FONTS.display, fontSize: 96, bold: true,
      color: COLORS.white, align: 'left', valign: 'top', margin: 0, charSpacing: -2,
    })
    if (c.statLabel) {
      slide.addText(c.statLabel, {
        x: panelX + 0.4, y: 4.2, w: W - panelX - 0.8, h: 2.0,
        fontFace: FONTS.body, fontSize: 16, color: COLORS.white,
        align: 'left', valign: 'top', margin: 0, transparency: 10,
      })
    }
  } else if (c.callout) {
    slide.addText(c.callout, {
      x: panelX + 0.4, y: 1.5, w: W - panelX - 0.8, h: 4.5,
      fontFace: FONTS.display, fontSize: 28, italic: true,
      color: COLORS.white, align: 'left', valign: 'top', margin: 0,
    })
  }
}

// ── Layout C: GRID_3 ─────────────────────────────────────────────────
// Heading row + 3 equal column cards.
function layoutGrid3(slide, c) {
  H.paintBackground(slide, COLORS.white)

  if (c.eyebrow) H.addEyebrow(slide, { x: M, y: 1.15, text: c.eyebrow })

  slide.addText(c.title, {
    x: M, y: 1.55, w: W - 2 * M, h: 1.3,
    fontFace: FONTS.display, fontSize: c.titleSize || 38, bold: true,
    color: COLORS.ink, align: 'left', valign: 'top', margin: 0, charSpacing: -0.5,
  })

  if (c.subtitle) {
    slide.addText(c.subtitle, {
      x: M, y: 2.85, w: W * 0.7, h: 0.5,
      fontFace: FONTS.body, fontSize: 16, color: COLORS.inkSoft,
      align: 'left', valign: 'top', margin: 0,
    })
  }

  // Three cards
  const cards = c.cards || []
  const cardY = 3.4
  const cardH = 3.3
  const gap = 0.25
  const cardW = (W - 2 * M - 2 * gap) / 3

  cards.slice(0, 3).forEach((card, i) => {
    const x = M + i * (cardW + gap)
    H.addCard(slide, { x, y: cardY, w: cardW, h: cardH })

    // Top color bar (varies per column)
    const bandColors = [COLORS.brandPurple, '3548D0', COLORS.brandBlue]
    H.addBlock(slide, { x, y: cardY, w: cardW, h: 0.08, color: bandColors[i] })

    // Number badge
    H.addNumberBadge(slide, {
      x: x + 0.35, y: cardY + 0.4, n: i + 1, size: 0.5,
      fill: bandColors[i],
    })

    // Title
    slide.addText(card.title, {
      x: x + 0.35, y: cardY + 1.1, w: cardW - 0.7, h: 0.6,
      fontFace: FONTS.display, fontSize: 18, bold: true,
      color: COLORS.ink, align: 'left', valign: 'top', margin: 0,
    })

    // Body
    slide.addText(card.body, {
      x: x + 0.35, y: cardY + 1.75, w: cardW - 0.7, h: cardH - 1.9,
      fontFace: FONTS.body, fontSize: 13, color: COLORS.inkSoft,
      align: 'left', valign: 'top', margin: 0, paraSpaceAfter: 6,
    })
  })
}

// ── Layout D: BIG_STAT ───────────────────────────────────────────────
// Massive number anchors the slide. Light bg with side accent stripe.
// Stat box uses valign='middle' so font size variations don't push label down.
function layoutBigStat(slide, c) {
  H.paintBackground(slide, COLORS.tintWarm)

  // Left accent bar
  H.addGradientBlock(slide, {
    x: 0, y: 0, w: 0.35, h: Hh,
    stops: GRADIENT_STOPS,
    direction: 'vertical',
  })

  if (c.eyebrow) H.addEyebrow(slide, { x: M + 0.2, y: 1.15, text: c.eyebrow })

  // Cap stat font size to fit within the stat container.
  // At 200pt rendered height ≈ 3.0in. Container is 3.5in. We allow up to 220pt.
  const statSize = Math.min(c.statSize || 200, 220)
  slide.addText(c.stat, {
    x: M, y: 1.7, w: W - 2 * M, h: 3.5,
    fontFace: FONTS.display, fontSize: statSize, bold: true,
    color: COLORS.brandPurple, align: 'left', valign: 'middle', margin: 0, charSpacing: -6,
  })

  if (c.statLabel) {
    slide.addText(c.statLabel, {
      x: M, y: 5.45, w: W - 2 * M, h: 0.5,
      fontFace: FONTS.display, fontSize: 22, bold: true,
      color: COLORS.ink, align: 'left', valign: 'top', margin: 0,
    })
  }

  if (c.body) {
    slide.addText(c.body, {
      x: M, y: 6.0, w: W - 2 * M - 0.5, h: 0.7,
      fontFace: FONTS.body, fontSize: 13, color: COLORS.inkSoft,
      align: 'left', valign: 'top', margin: 0,
    })
  }

  if (c.source) {
    slide.addText(c.source, {
      x: M, y: 6.75, w: 8, h: 0.25,
      fontFace: FONTS.body, fontSize: 10, italic: true, color: COLORS.muted,
      align: 'left', valign: 'top', margin: 0,
    })
  }
}

// ── Layout E: QUOTE_FULL ─────────────────────────────────────────────
// Large quote treatment on tinted background.
function layoutQuote(slide, c) {
  H.paintBackground(slide, COLORS.tintPurpleLight)

  // Massive open-quote glyph
  slide.addText('"', {
    x: M - 0.1, y: 0.4, w: 2.5, h: 2.5,
    fontFace: 'Georgia', fontSize: 240, bold: true,
    color: COLORS.brandPurple, align: 'left', valign: 'top', margin: 0,
  })

  // Quote text
  slide.addText(c.quote, {
    x: M + 1.5, y: 1.9, w: W - 2 * M - 1.5, h: 3.4,
    fontFace: 'Georgia', fontSize: c.quoteSize || 32, italic: true,
    color: COLORS.ink, align: 'left', valign: 'top', margin: 0,
  })

  // Attribution
  H.addRule(slide, { x: M + 1.5, y: 5.6, w: 0.7, color: COLORS.brandPurple, thickness: 2 })
  if (c.attribution) {
    slide.addText(c.attribution, {
      x: M + 1.5, y: 5.7, w: W - 2 * M - 1.5, h: 0.5,
      fontFace: FONTS.body, fontSize: 14, bold: true,
      color: COLORS.brandPurpleDark, align: 'left', valign: 'top', margin: 0, charSpacing: 1,
    })
  }
  if (c.attributionSub) {
    slide.addText(c.attributionSub, {
      x: M + 1.5, y: 6.05, w: W - 2 * M - 1.5, h: 0.4,
      fontFace: FONTS.body, fontSize: 12, color: COLORS.muted,
      align: 'left', valign: 'top', margin: 0,
    })
  }
}

// ── Layout F: DIAGONAL ───────────────────────────────────────────────
// Bottom-right gradient triangle wedge, content on top-left.
function layoutDiagonal(slide, c) {
  H.paintBackground(slide, COLORS.white)

  // Wedge — wider, starting earlier so callout text stays on dark fill.
  // Original triangle: from (W*0.25, 0) at top to (W, Hh) at bottom.
  slide.addShape('rtTriangle', {
    x: W * 0.25, y: 0, w: W * 0.75, h: Hh,
    fill: { color: COLORS.brandPurple },
    line: { type: 'none' },
    flipH: true,
  })
  // Overlay second triangle for gradient feel — slightly inset.
  slide.addShape('rtTriangle', {
    x: W * 0.4, y: Hh * 0.15, w: W * 0.65, h: Hh * 0.95,
    fill: { color: COLORS.brandBlue, transparency: 25 },
    line: { type: 'none' },
    flipH: true,
  })

  if (c.eyebrow) H.addEyebrow(slide, { x: M, y: 1.15, text: c.eyebrow })

  slide.addText(c.title, {
    x: M, y: 1.55, w: W * 0.5, h: 2.5,
    fontFace: FONTS.display, fontSize: c.titleSize || 40, bold: true,
    color: COLORS.ink, align: 'left', valign: 'top', margin: 0, charSpacing: -0.5,
  })

  if (c.body) {
    slide.addText(c.body, {
      x: M, y: 4.2, w: W * 0.5 - 0.3, h: 2.3,
      fontFace: FONTS.body, fontSize: 14, color: COLORS.inkSoft,
      align: 'left', valign: 'top', margin: 0, paraSpaceAfter: 6,
    })
  }

  // Big white caption on the wedge — positioned in the wide bottom portion
  // where the wedge has the most fill, so text always stays on dark.
  if (c.callout) {
    slide.addText(c.callout, {
      x: W * 0.55, y: 3.2, w: W * 0.4, h: 3.6,
      fontFace: FONTS.display, fontSize: 32, bold: true,
      color: COLORS.white, align: 'right', valign: 'middle', margin: 0,
      charSpacing: -0.5,
    })
  }
}

// ── Layout G: BENTO ──────────────────────────────────────────────────
// Asymmetric grid — one hero card + 3 supporting.
function layoutBento(slide, c) {
  H.paintBackground(slide, COLORS.tintWarm)

  if (c.eyebrow) H.addEyebrow(slide, { x: M, y: 1.15, text: c.eyebrow })

  slide.addText(c.title, {
    x: M, y: 1.55, w: W - 2 * M, h: 1.0,
    fontFace: FONTS.display, fontSize: c.titleSize || 34, bold: true,
    color: COLORS.ink, align: 'left', valign: 'top', margin: 0, charSpacing: -0.5,
  })

  const gridTop = 2.75
  const gridH = 4.05
  const cardGap = 0.18

  // Hero card (left, full height, 50% width)
  const heroW = (W - 2 * M) * 0.5 - cardGap / 2
  const heroX = M
  H.addGradientBlock(slide, {
    x: heroX, y: gridTop, w: heroW, h: gridH,
    stops: GRADIENT_STOPS, direction: 'vertical',
  })

  const hero = (c.cards && c.cards[0]) || {}
  slide.addText(hero.title || '', {
    x: heroX + 0.4, y: gridTop + 0.4, w: heroW - 0.8, h: 1.0,
    fontFace: FONTS.body, fontSize: 11, bold: true, color: COLORS.white,
    align: 'left', valign: 'top', margin: 0, charSpacing: 3,
  })
  slide.addText(hero.headline || '', {
    x: heroX + 0.4, y: gridTop + 0.95, w: heroW - 0.8, h: 2.2,
    fontFace: FONTS.display, fontSize: 32, bold: true, color: COLORS.white,
    align: 'left', valign: 'top', margin: 0, charSpacing: -0.5,
  })
  slide.addText(hero.body || '', {
    x: heroX + 0.4, y: gridTop + 2.9, w: heroW - 0.8, h: 1.2,
    fontFace: FONTS.body, fontSize: 13, color: COLORS.white,
    align: 'left', valign: 'top', margin: 0,
  })

  // Right column — 3 stacked small cards
  const rightX = M + heroW + cardGap
  const rightW = W - 2 * M - heroW - cardGap
  const smallH = (gridH - 2 * cardGap) / 3
  const smalls = (c.cards || []).slice(1, 4)

  smalls.forEach((card, i) => {
    const y = gridTop + i * (smallH + cardGap)
    H.addCard(slide, { x: rightX, y, w: rightW, h: smallH })
    // Left color bar accent
    const bar = i === 0 ? COLORS.brandPurple : i === 1 ? '3548D0' : COLORS.brandBlue
    H.addBlock(slide, { x: rightX, y, w: 0.08, h: smallH, color: bar })

    slide.addText(card.title || '', {
      x: rightX + 0.28, y: y + 0.2, w: rightW - 0.5, h: 0.4,
      fontFace: FONTS.display, fontSize: 16, bold: true, color: COLORS.ink,
      align: 'left', valign: 'top', margin: 0,
    })
    slide.addText(card.body || '', {
      x: rightX + 0.28, y: y + 0.62, w: rightW - 0.5, h: smallH - 0.7,
      fontFace: FONTS.body, fontSize: 12, color: COLORS.inkSoft,
      align: 'left', valign: 'top', margin: 0,
    })
  })
}

// ── Registry ─────────────────────────────────────────────────────────

const LAYOUTS = {
  hero: layoutHero,
  split: layoutSplit,
  grid3: layoutGrid3,
  bigStat: layoutBigStat,
  quote: layoutQuote,
  diagonal: layoutDiagonal,
  bento: layoutBento,
}

const LAYOUT_ORDER = ['hero', 'split', 'grid3', 'bigStat', 'quote', 'diagonal', 'bento']

module.exports = { LAYOUTS, LAYOUT_ORDER }
