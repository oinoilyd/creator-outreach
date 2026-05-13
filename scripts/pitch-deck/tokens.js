// Creator Outreach — pitch deck design tokens (light mode brand).
// Mirrors lib/legal + globals.css palette:
//   --brand     oklch(0.40 0.265 290)  ~ deep purple
//   --brand-2   oklch(0.50 0.150 215)  ~ blue
// On white background with dark navy ink.

const COLORS = {
  // Brand
  brandPurple: '5028C2',     // deep purple
  brandBlue:   '1A6FBE',     // mid blue
  brandPurpleDark: '3D1E96', // darker purple for accents
  brandBlueDark:   '0F4F8A', // darker blue for accents

  // Light tints (for soft cards/backgrounds)
  tintPurpleLight: 'F1ECFF', // very soft purple wash
  tintBlueLight:   'E8F1FB', // very soft blue wash
  tintWarm:        'FCFAF6', // warm off-white (matches site bg)

  // Neutrals
  white:    'FFFFFF',
  ink:      '0F1733',     // dark navy text
  inkSoft:  '2A3358',     // softer body text
  muted:    '6B7493',     // captions / metadata
  hairline: 'E5E7F0',     // dividers
  surface:  'F7F8FB',     // card surface
}

const FONTS = {
  // System-safe pairing. Inter would be ideal but system fonts render reliably in PowerPoint.
  display: 'Calibri',         // headings (we'll bold)
  body:    'Calibri',         // body
  mono:    'Consolas',        // numbers / small caps
}

const SIZES = {
  // Slide is 13.333" × 7.5" (16:9 default for pptxgenjs)
  slideW: 13.333,
  slideH: 7.5,
  margin: 0.6,
  gutter: 0.4,
}

// Re-usable gradient stops — pptxgenjs doesn't support real gradients on shape
// fills, so we simulate with stacked rects or use solid blocks tactically.
const GRADIENT_STOPS = [
  { pos: 0,   color: COLORS.brandPurple },
  { pos: 50,  color: '3548D0' },          // midpoint blend
  { pos: 100, color: COLORS.brandBlue },
]

module.exports = { COLORS, FONTS, SIZES, GRADIENT_STOPS }
