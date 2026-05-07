// Fetch stan.store with a generic handle and see what's actually in the
// HTML — what emails the regex picks up + whether the blocklist catches
// them. Reproduces the exact path the methodology takes.
import axios from 'axios'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'

const PLATFORM_DOMAIN_SUFFIXES = [
  'patreon.com', 'substack.com', 'beehiiv.com', 'ck.page',
  'convertkit.com', 'mailchimp.com', 'gumroad.com', 'kajabi.com',
  'teachable.com', 'thinkific.com', 'memberstack.com', 'circle.so',
  'linktr.ee', 'beacons.ai', 'stan.store', 'stanwith.me', 'campsite.bio',
  'allmylinks.com', 'lnk.bio', 'bio.fm', 'solo.to', 'pillar.io',
  'about.me', 'contact.me', 'msha.ke', 'withkoji.com',
  'buymeacoffee.com', 'ko-fi.com', 'kofi.com', 'paypalme.com',
  'tipjar.com', 'flowcode.com', 'koji.to', 'milkshake.app',
]

function isPlatformDomain(domain: string): boolean {
  const d = domain.toLowerCase()
  for (const suffix of PLATFORM_DOMAIN_SUFFIXES) {
    if (d === suffix || d.endsWith('.' + suffix)) return true
  }
  return false
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

async function fetchAndScan(url: string) {
  console.log(`\n--- ${url} ---`)
  try {
    const resp = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
      validateStatus: () => true,
      maxRedirects: 5,
    })
    const html = typeof resp.data === 'string' ? resp.data : ''
    console.log(`status: ${resp.status}, length: ${html.length}`)
    if (!html) return

    const matches = html.match(EMAIL_RE) || []
    const unique = [...new Set(matches.map(e => e.toLowerCase()))]
    console.log(`emails found in HTML (${unique.length}):`)
    for (const e of unique) {
      const domain = e.split('@')[1]
      const blocked = isPlatformDomain(domain)
      console.log(`  ${blocked ? '✗ BLOCKED' : '✓ ALLOWED'}  ${e}  (domain=${domain})`)
    }

    // Also check whether stanwith.me appears as raw text (even if regex didn't pick it up)
    const stanwithMatches = [...html.matchAll(/[a-zA-Z0-9._%+-]*stanwith[^"'\s<>]*/gi)]
    if (stanwithMatches.length > 0) {
      console.log(`raw 'stanwith' substring matches:`)
      for (const m of stanwithMatches.slice(0, 5)) {
        console.log(`  "${m[0]}"`)
      }
    }
  } catch (e) {
    console.log(`error: ${(e as Error).message}`)
  }
}

async function main() {
  // Probe a few generic handles that the methodology would derive from
  // channel names like "Channel Junkies", "Real Estate Rookie", etc.
  await fetchAndScan('https://stan.store/channel')
  await fetchAndScan('https://stan.store/real')
  await fetchAndScan('https://stan.store/the')
  await fetchAndScan('https://stan.store/reality')
}

main()
