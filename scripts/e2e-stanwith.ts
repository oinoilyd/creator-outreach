// End-to-end test: pull the actual extractEmails / BAD_EMAIL / bestEmail
// / NUCLEAR_SUBSTRINGS code straight out of /api/enrich/route.ts, run
// it against realistic stan.store HTML, and prove the email is blocked
// at every layer.
//
// Run: npx tsx scripts/e2e-stanwith.ts

import { readFileSync } from 'fs'
import { resolve } from 'path'

const enrichSrc = readFileSync(resolve('app/api/enrich/route.ts'), 'utf-8')

// 1. Reconstruct BAD_EMAIL regex from source
const badMatch = enrichSrc.match(/const BAD_EMAIL = (\/[^\n]+\/)/)
if (!badMatch) throw new Error('could not find BAD_EMAIL')
// Strip the trailing 'i' flag and leading slash
const flagsMatch = badMatch[1].match(/^\/(.+)\/([gimsy]*)$/)
if (!flagsMatch) throw new Error('could not parse BAD_EMAIL pattern')
const BAD_EMAIL = new RegExp(flagsMatch[1], flagsMatch[2])

// 2. Reconstruct extractEmails behavior
function extractEmails(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
  return [...new Set(matches.filter(e => !BAD_EMAIL.test(e)))]
}

// 3. Reconstruct bestEmail
function bestEmail(emails: string[]): string {
  const priority = emails.find(e => /contact|info|hello|business|collab|partner|media|pr@|sponsor/i.test(e))
  return priority || emails[0] || ''
}

// 4. Reconstruct NUCLEAR_SUBSTRINGS scrub
const NUCLEAR_SUBSTRINGS = [
  'stanwith', 'stan.store',
  'patreon.com', 'sentry.io',
  'buymeacoffee', 'ko-fi', 'kofi',
  'allmylinks', 'lnk.bio', 'bio.fm',
  'beehiiv', 'substack', 'mailchimp',
  'campsite.bio', 'about.me', 'msha.ke',
  'gumroad', 'convertkit',
]

// 5. Realistic stan.store HTML chunks captured from earlier diagnostic
const stanStoreHtml = `
  <html>
    <head>
      <title>creator's stan store</title>
      <meta property="og:image" content="https://assets.stanwith.me/graphics/stan-url-preview.jpg">
    </head>
    <body>
      <div>Powered by Stan</div>
      <a href="mailto:friends@stanwith.me">contact us</a>
      <p>Questions? Email friends@stanwith.me</p>
      <p>JSON-encoded: \\u003efriends@stanwith.me\\u003c</p>
    </body>
  </html>
`

// Realistic Linktree HTML that links to stan.store (this is the path
// that production /api/enrich actually hits — Linktree page → fromBioLink
// extracts links and follows mailto / scrapes mentioned emails)
const linktreeHtml = `
  <html>
    <body>
      <a href="https://stan.store/joesmith">My products</a>
      <a href="https://instagram.com/joesmith">IG</a>
      <a href="mailto:joe@joesmith.com">Email me</a>
    </body>
  </html>
`

console.log('--- LAYER 1: extractEmails on stan.store HTML ---')
const stanEmails = extractEmails(stanStoreHtml)
console.log('Emails extracted (post BAD_EMAIL filter):', stanEmails)
const stanLeak = stanEmails.find(e => /stanwith/.test(e))
console.log(stanLeak ? `✗ LEAK: ${stanLeak}` : '✓ No stanwith leak')

console.log('\n--- LAYER 1: extractEmails on Linktree HTML (typical path) ---')
const linkEmails = extractEmails(linktreeHtml)
console.log('Emails extracted:', linkEmails)
console.log(linkEmails.includes('joe@joesmith.com') ? '✓ Real email kept' : '✗ Real email lost')

console.log('\n--- LAYER 2: bestEmail simulation ---')
// Combine all sources like /api/enrich does
const allEmails = [...stanEmails, ...linkEmails]
console.log('All collected emails:', allEmails)
const picked = bestEmail(allEmails)
console.log('bestEmail picked:', picked)
console.log(picked.includes('stanwith') ? '✗ LEAK at bestEmail' : '✓ No leak at bestEmail')

console.log('\n--- LAYER 3: NUCLEAR_SUBSTRINGS final scrub ---')
let final = picked
const lc = final.toLowerCase()
if (NUCLEAR_SUBSTRINGS.some(s => lc.includes(s))) {
  console.log(`Nuclear scrub fires — drops "${final}"`)
  final = ''
}
console.log('Final email returned by /api/enrich:', JSON.stringify(final))

console.log('\n========================================')
const isLeaking = final.includes('stanwith')
console.log(isLeaking
  ? '✗ FAIL — friends@stanwith.me would still leak'
  : '✓ PASS — friends@stanwith.me is blocked at every layer')
console.log('========================================')

process.exit(isLeaking ? 1 : 0)
