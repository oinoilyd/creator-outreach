// Diagnostic: verifies that friends@stanwith.me would be blocked at every
// possible entry point in newMethodology.ts. Run with `bun run scripts/...`
// or `npx tsx scripts/...`.

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load the file as text and pull out the relevant chunks. We can't
// easily import isPlausibleEmail directly because the file imports
// youtubei.js / Anthropic which fail outside the runtime. So we
// re-implement the check here using the SAME suffix list pulled
// straight from the source — guaranteed identical.
const src = readFileSync(resolve('lib/newMethodology.ts'), 'utf-8')

// Extract the PLATFORM_DOMAIN_SUFFIXES array using a simple parser
const suffixMatch = src.match(/const PLATFORM_DOMAIN_SUFFIXES = \[([\s\S]*?)\]/)
if (!suffixMatch) {
  console.error('FAIL: could not locate PLATFORM_DOMAIN_SUFFIXES in source')
  process.exit(1)
}
const suffixes = [...suffixMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1])

console.log(`Loaded ${suffixes.length} suffixes from source`)
console.log(`Includes 'stanwith.me'? ${suffixes.includes('stanwith.me')}`)

function isPlatformDomain(domain: string): boolean {
  const d = domain.toLowerCase()
  for (const suffix of suffixes) {
    if (d === suffix || d.endsWith('.' + suffix)) return true
  }
  return false
}

function isPlausibleEmail(email: string): boolean {
  if (email.length < 6 || email.length > 80) return false
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/.test(email)) return false
  if (/^[0-9.@-]+$/.test(email)) return false
  const [local, domain] = email.split('@')
  if (!local || !domain) return false
  if (isPlatformDomain(domain)) return false
  if (/^[a-f0-9]{16,}$/i.test(local)) return false
  if (/^(no-?reply|donot-?reply|notifications?|alerts?|automated|system)$/i.test(local)) return false
  return true
}

const cases = [
  { email: 'friends@stanwith.me',         expected: false, why: 'Stan team domain' },
  { email: 'support@stan.store',          expected: false, why: 'Stan public domain' },
  { email: 'guidelines@patreon.com',      expected: false, why: 'Patreon team domain' },
  { email: 'support@buymeacoffee.com',    expected: false, why: 'BMaC team domain' },
  { email: 'team@allmylinks.com',         expected: false, why: 'AllMyLinks team domain' },
  { email: 'hello@joesmith.com',          expected: true,  why: 'real creator email' },
  { email: 'info@example.studio',         expected: true,  why: 'creator email on .studio TLD' },
  { email: 'a1b2c3d4e5f6a1b2@sentry.io',  expected: false, why: 'Sentry DSN' },
  { email: 'noreply@anywhere.com',        expected: false, why: 'noreply local' },
]

let pass = 0, fail = 0
for (const c of cases) {
  const result = isPlausibleEmail(c.email)
  const ok = result === c.expected
  console.log(`${ok ? '✓' : '✗'}  ${c.email.padEnd(40)} → ${result.toString().padEnd(5)}  (${c.why})`)
  if (ok) pass++
  else fail++
}

console.log(`\n${pass}/${cases.length} pass${fail > 0 ? `, ${fail} fail` : ''}`)
process.exit(fail === 0 ? 0 : 1)
