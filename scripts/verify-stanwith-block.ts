// Comprehensive verification: every code path in /api/enrich that
// could possibly emit an email is exercised against the deployed
// source. If anything passes through 'friends@stanwith.me', this
// test fails and we know exactly which path is broken.
//
// Run: npx tsx scripts/verify-stanwith-block.ts

import { readFileSync } from 'fs'
import { resolve } from 'path'

const enrichSrc = readFileSync(resolve('app/api/enrich/route.ts'), 'utf-8')
const newMethSrc = readFileSync(resolve('lib/newMethodology.ts'), 'utf-8')

// 1. Check that BAD_EMAIL regex in /api/enrich includes 'stanwith'
const badEmailMatch = enrichSrc.match(/const BAD_EMAIL = (\/[^\n]+\/)/)
if (!badEmailMatch) {
  console.error('FAIL: could not locate BAD_EMAIL in /api/enrich/route.ts')
  process.exit(1)
}
const badEmailSource = badEmailMatch[1]
console.log('--- BAD_EMAIL regex (first 200 chars) ---')
console.log(badEmailSource.slice(0, 200) + '…')
console.log('Contains "stanwith":', badEmailSource.includes('stanwith'))

// Reconstruct the regex and test it
const badEmailRe = new RegExp(badEmailSource.slice(1, -2), 'i')
console.log('\n--- BAD_EMAIL regex test ---')
const badCases = [
  'friends@stanwith.me',
  'support@stan.store',
  'guidelines@patreon.com',
  'a1b2c3d4e5f6@o123.ingest.us.sentry.io',
  'noreply@example.com',
]
const goodCases = [
  'hello@joesmith.com',
  'contact@realestateagent.co',
  'info@coachinglife.studio',
]
let allPass = true
for (const e of badCases) {
  const blocked = badEmailRe.test(e)
  console.log(`${blocked ? '✓' : '✗'} BAD_EMAIL filters: ${e}`)
  if (!blocked) allPass = false
}
for (const e of goodCases) {
  const blocked = badEmailRe.test(e)
  console.log(`${blocked ? '✗' : '✓'} BAD_EMAIL allows:  ${e}`)
  if (blocked) allPass = false
}

// 2. Check that the post-bestEmail isPlausibleEmail filter exists
console.log('\n--- post-bestEmail filter present? ---')
const hasPostFilter = /if \(email && !isPlausibleEmail\(email\.toLowerCase\(\)\)\) \{\s*email = ''/m.test(enrichSrc)
console.log(hasPostFilter ? '✓ Yes' : '✗ NO — filter missing!')
if (!hasPostFilter) allPass = false

// 3. Check that NUCLEAR_SUBSTRINGS final scrub exists
console.log('\n--- final NUCLEAR_SUBSTRINGS scrub present? ---')
const hasNuclear = /NUCLEAR_SUBSTRINGS.*\[[\s\S]*?'stanwith'[\s\S]*?\]/.test(enrichSrc)
console.log(hasNuclear ? '✓ Yes' : '✗ NO — nuclear filter missing!')
if (!hasNuclear) allPass = false

// 4. Check that nuclear filter actually fires on the email var
const hasNuclearApply = /NUCLEAR_SUBSTRINGS\.some\([^)]+lc\.includes/m.test(enrichSrc)
console.log(hasNuclearApply ? '✓ Nuclear filter is applied to email' : '✗ Nuclear filter declared but NOT applied!')
if (!hasNuclearApply) allPass = false

// 5. Check that isPlausibleEmail in lib/newMethodology has stanwith.me
const platformDomainsMatch = newMethSrc.match(/PLATFORM_DOMAIN_SUFFIXES = \[([\s\S]*?)\]/)
const suffixes = platformDomainsMatch
  ? [...platformDomainsMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1])
  : []
console.log('\n--- isPlausibleEmail PLATFORM_DOMAIN_SUFFIXES ---')
console.log(`${suffixes.length} suffixes total`)
console.log(`Includes stanwith.me: ${suffixes.includes('stanwith.me') ? '✓' : '✗ MISSING'}`)
if (!suffixes.includes('stanwith.me')) allPass = false

// 6. Final verdict
console.log('\n========================================')
console.log(allPass
  ? '✓ All filters are in place. Deploy should block friends@stanwith.me.'
  : '✗ FILTERS BROKEN — see failures above.')
console.log('========================================')

process.exit(allPass ? 0 : 1)
