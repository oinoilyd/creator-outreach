import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { requireUser, rateLimit } from '@/lib/api-auth'
import { clampString } from '@/lib/security'

/**
 * Given a YouTube URL of any common form, resolve it to a channel ID +
 * basic channel metadata. The client uses this when the user pastes a
 * URL into the search box (or the manual-add form in Outreach).
 *
 * Supported URL forms:
 *   https://www.youtube.com/channel/UC...
 *   https://www.youtube.com/@handle
 *   https://www.youtube.com/c/customname
 *   https://www.youtube.com/user/legacyname
 */

const CHANNEL_ID_RE = /\/channel\/(UC[\w-]{22})/

function extractChannelIdFromHtml(html: string): string | null {
  // 1) og:url usually contains the canonical /channel/UC... form
  const og = html.match(/<meta\s+property="og:url"\s+content="([^"]+)"/i)
  if (og) {
    const m = og[1].match(CHANNEL_ID_RE)
    if (m) return m[1]
  }
  // 2) JSON-LD / inline JS sometimes has externalId
  const ext = html.match(/"externalId":"(UC[\w-]{22})"/)
  if (ext) return ext[1]
  // 3) channelId meta tag
  const meta = html.match(/<meta\s+itemprop="(?:identifier|channelId)"\s+content="(UC[\w-]{22})"/i)
  if (meta) return meta[1]
  // 4) browseId on a tab
  const browse = html.match(/"browseId":"(UC[\w-]{22})"/)
  if (browse) return browse[1]
  return null
}

function extractMetaContent(html: string, prop: string): string {
  const re = new RegExp(`<meta\\s+(?:property|name)="${prop}"\\s+content="([^"]+)"`, 'i')
  const m = html.match(re)
  return m ? m[1] : ''
}

function isYouTubeUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return /(?:^|\.)youtube\.com$/.test(u.hostname) || u.hostname === 'youtu.be'
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth

  const limited = rateLimit(auth.id, 'lookup-channel', 200)
  if (limited) return limited

  const { searchParams } = new URL(req.url)
  const raw = clampString(searchParams.get('url'), 500)
  if (!raw) return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })

  // Normalise: prepend https:// if missing, allow bare youtube.com paths
  const normalized = raw.startsWith('http') ? raw : `https://${raw.replace(/^\/+/, '')}`
  if (!isYouTubeUrl(normalized)) {
    return NextResponse.json({ error: 'Not a YouTube URL' }, { status: 400 })
  }

  // Direct channel ID short-circuit — no fetch needed
  const direct = normalized.match(CHANNEL_ID_RE)
  if (direct) {
    const channelId = direct[1]
    // Still fetch to get name + description; if it fails, return what we have
    const meta = await fetchChannelMeta(`https://www.youtube.com/channel/${channelId}`).catch(() => null)
    return NextResponse.json({
      channelId,
      channelName: meta?.name || '',
      channelUrl: `https://www.youtube.com/channel/${channelId}`,
      description: meta?.description || '',
    })
  }

  // Otherwise fetch the page and resolve
  try {
    const meta = await fetchChannelMeta(normalized)
    if (!meta?.channelId) {
      return NextResponse.json({ error: 'Could not resolve channel from URL' }, { status: 404 })
    }
    return NextResponse.json({
      channelId: meta.channelId,
      channelName: meta.name,
      channelUrl: `https://www.youtube.com/channel/${meta.channelId}`,
      description: meta.description,
    })
  } catch (e: any) {
    return NextResponse.json({ error: `Lookup failed: ${e?.message || e}` }, { status: 500 })
  }
}

async function fetchChannelMeta(url: string): Promise<{ channelId: string | null; name: string; description: string }> {
  const res = await axios.get(url, {
    timeout: 8000,
    maxRedirects: 5,
    headers: {
      // Pretend to be a normal browser so YouTube returns the public HTML
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    validateStatus: () => true,
  })
  if (res.status >= 400) throw new Error(`HTTP ${res.status}`)
  const html: string = typeof res.data === 'string' ? res.data : ''
  const channelId = extractChannelIdFromHtml(html)
  const name = extractMetaContent(html, 'og:title') || extractMetaContent(html, 'title')
  const description = extractMetaContent(html, 'og:description') || extractMetaContent(html, 'description')
  return { channelId, name, description }
}
