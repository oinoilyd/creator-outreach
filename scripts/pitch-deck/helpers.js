// Re-usable drawing primitives for pitch-deck slides.
// All measurements are in inches unless noted.

const { COLORS, FONTS, SIZES } = require('./tokens')

// ── Background helpers ───────────────────────────────────────────────

function paintBackground(slide, color = COLORS.white) {
  slide.background = { color }
}

// Add a colored full-bleed rect (useful for half-bleed or banded layouts).
function addBlock(slide, { x, y, w, h, color, line }) {
  slide.addShape('rect', {
    x, y, w, h,
    fill: { color },
    line: line || { type: 'none' },
  })
}

// Simulate gradient by stacking a fine vertical strip ramp.
// stops: [{ pos: 0..100, color: 'RRGGBB' }, ...]
function addGradientBlock(slide, { x, y, w, h, stops, direction = 'horizontal' }) {
  const steps = 64
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const color = interpolateStops(stops, t * 100)
    if (direction === 'horizontal') {
      slide.addShape('rect', {
        x: x + (w * i) / steps,
        y,
        w: w / steps + 0.01, // overlap to avoid hairlines
        h,
        fill: { color },
        line: { type: 'none' },
      })
    } else {
      slide.addShape('rect', {
        x,
        y: y + (h * i) / steps,
        w,
        h: h / steps + 0.01,
        fill: { color },
        line: { type: 'none' },
      })
    }
  }
}

// Diagonal gradient simulated by rotated narrow rects (parallelograms via rotation).
function addDiagonalGradientBlock(slide, { x, y, w, h, stops, angle = -25 }) {
  // Simpler: do a horizontal gradient and let the caller mask with a diagonal cut.
  addGradientBlock(slide, { x, y, w, h, stops, direction: 'horizontal' })
}

function interpolateStops(stops, pos) {
  const sorted = [...stops].sort((a, b) => a.pos - b.pos)
  if (pos <= sorted[0].pos) return sorted[0].color
  if (pos >= sorted[sorted.length - 1].pos) return sorted[sorted.length - 1].color
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (pos >= a.pos && pos <= b.pos) {
      const t = (pos - a.pos) / (b.pos - a.pos)
      return mixHex(a.color, b.color, t)
    }
  }
  return sorted[0].color
}

function mixHex(a, b, t) {
  const ar = parseInt(a.slice(0, 2), 16)
  const ag = parseInt(a.slice(2, 4), 16)
  const ab = parseInt(a.slice(4, 6), 16)
  const br = parseInt(b.slice(0, 2), 16)
  const bg = parseInt(b.slice(2, 4), 16)
  const bb = parseInt(b.slice(4, 6), 16)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return [r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
}

// ── Brand mark ───────────────────────────────────────────────────────

// 32px-style rounded gradient tile with white "C" wordmark.
// Matches components/landing/LandingTopNav.tsx pattern.
function addBrandMark(slide, { x, y, size = 0.45, withWordmark = true, mono = false }) {
  // Rounded square — approximate via roundRect.
  if (mono) {
    slide.addShape('roundRect', {
      x, y, w: size, h: size,
      fill: { color: COLORS.ink },
      line: { type: 'none' },
      rectRadius: 0.08,
    })
  } else {
    // Two-tone gradient via stacked semi-transparent layers (purple base + blue overlay).
    slide.addShape('roundRect', {
      x, y, w: size, h: size,
      fill: { color: COLORS.brandPurple },
      line: { type: 'none' },
      rectRadius: 0.08,
    })
    slide.addShape('roundRect', {
      x, y, w: size, h: size,
      fill: { color: COLORS.brandBlue, transparency: 50 },
      line: { type: 'none' },
      rectRadius: 0.08,
    })
  }
  slide.addText('C', {
    x, y, w: size, h: size,
    fontFace: FONTS.display,
    fontSize: Math.round(size * 40),
    bold: true,
    color: COLORS.white,
    align: 'center',
    valign: 'middle',
    margin: 0,
  })

  if (withWordmark) {
    slide.addText('Creator Outreach', {
      x: x + size + 0.12,
      y: y + 0.02,
      w: 2.4,
      h: size - 0.04,
      fontFace: FONTS.display,
      fontSize: 13,
      bold: true,
      color: COLORS.ink,
      valign: 'middle',
      margin: 0,
      charSpacing: -0.2,
    })
  }
}

// ── Footer ───────────────────────────────────────────────────────────

// Footer — `dark` controls only the right-side page indicator, since
// the left attribution always sits on the white half of every layout.
function addFooter(slide, { slideNum, total, dark = false }) {
  slide.addText(`Creator Outreach  ·  Gaynor Media LLC  ·  creatoroutreach.net`, {
    x: SIZES.margin,
    y: SIZES.slideH - 0.4,
    w: 8,
    h: 0.25,
    fontFace: FONTS.body,
    fontSize: 9,
    color: COLORS.muted,
    align: 'left',
    valign: 'middle',
    margin: 0,
    charSpacing: 0.5,
  })
  slide.addText(`${String(slideNum).padStart(3, '0')} / ${String(total).padStart(3, '0')}`, {
    x: SIZES.slideW - SIZES.margin - 1.6,
    y: SIZES.slideH - 0.4,
    w: 1.6,
    h: 0.25,
    fontFace: FONTS.mono,
    fontSize: 9,
    color: dark ? COLORS.white : COLORS.muted,
    align: 'right',
    valign: 'middle',
    margin: 0,
    transparency: dark ? 15 : 0,
  })
}

// ── Labels & pills ───────────────────────────────────────────────────

function addEyebrow(slide, { x, y, text, color = COLORS.brandPurple, w = 4 }) {
  slide.addText(text.toUpperCase(), {
    x, y, w, h: 0.3,
    fontFace: FONTS.body,
    fontSize: 11,
    bold: true,
    color,
    align: 'left',
    valign: 'middle',
    margin: 0,
    charSpacing: 4,
  })
}

function addPillLabel(slide, { x, y, text, fill = COLORS.tintPurpleLight, fg = COLORS.brandPurpleDark }) {
  const w = Math.max(1.1, text.length * 0.09 + 0.5)
  slide.addShape('roundRect', {
    x, y, w, h: 0.32,
    fill: { color: fill },
    line: { type: 'none' },
    rectRadius: 0.16,
  })
  slide.addText(text.toUpperCase(), {
    x, y, w, h: 0.32,
    fontFace: FONTS.body,
    fontSize: 9,
    bold: true,
    color: fg,
    align: 'center',
    valign: 'middle',
    margin: 0,
    charSpacing: 3,
  })
}

// Numbered circle (for step indicators).
function addNumberBadge(slide, { x, y, n, size = 0.55, fill = COLORS.brandPurple, fg = COLORS.white }) {
  slide.addShape('ellipse', {
    x, y, w: size, h: size,
    fill: { color: fill },
    line: { type: 'none' },
  })
  slide.addText(String(n), {
    x, y, w: size, h: size,
    fontFace: FONTS.display,
    fontSize: Math.round(size * 38),
    bold: true,
    color: fg,
    align: 'center',
    valign: 'middle',
    margin: 0,
  })
}

// Decorative dot (for accents and pattern fills).
function addDot(slide, { x, y, size = 0.08, color = COLORS.brandPurple, transparency = 0 }) {
  slide.addShape('ellipse', {
    x, y, w: size, h: size,
    fill: { color, transparency },
    line: { type: 'none' },
  })
}

// Hairline rule.
function addRule(slide, { x, y, w, color = COLORS.hairline, thickness = 1 }) {
  slide.addShape('line', {
    x, y, w, h: 0,
    line: { color, width: thickness },
  })
}

// Card with soft border.
function addCard(slide, { x, y, w, h, fill = COLORS.white, border = COLORS.hairline, radius = 0.12 }) {
  slide.addShape('roundRect', {
    x, y, w, h,
    fill: { color: fill },
    line: { color: border, width: 0.75 },
    rectRadius: radius,
  })
}

// Speaker notes helper — adds a paragraph; pptxgenjs accepts plain string.
function addNotes(slide, text) {
  if (text) slide.addNotes(text)
}

module.exports = {
  paintBackground,
  addBlock,
  addGradientBlock,
  addDiagonalGradientBlock,
  addBrandMark,
  addFooter,
  addEyebrow,
  addPillLabel,
  addNumberBadge,
  addDot,
  addRule,
  addCard,
  addNotes,
  interpolateStops,
  mixHex,
}
