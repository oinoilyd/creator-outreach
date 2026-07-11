/**
 * Creator Outreach extension — background service worker.
 *
 * Owns ALL network I/O. The content script messages here so requests
 * ride the extension's host_permissions (no CORS involvement):
 *   • resolve — fetch a YouTube channel/watch page and extract the
 *     channel identity from the embedded JSON. We deliberately do NOT
 *     scrape the live DOM: YouTube is an SPA whose inline ytInitialData
 *     goes stale after client-side navigation, and its DOM classes
 *     churn. A fresh cookieless GET of the same URL always contains
 *     server-rendered JSON with stable keys.
 *   • check — GET /api/v1/leads?channelId=&channelUrl= ("already in
 *     your outreach?")
 *   • add — POST /api/v1/leads
 *   • test — key validation for the popup.
 *
 * Auth: the platform API key (co_live_…) the user creates in the app's
 * Integrations panel, stored in chrome.storage.sync.
 */

const API_BASE = 'https://creatoroutreach.net/api/v1'

// ── Pure HTML parsing (unit-testable; see extension/test/) ─────────────

/** Unescape a JSON-escaped string fragment captured by regex. */
function jsonUnescape(s) {
  if (!s) return s
  try { return JSON.parse('"' + s + '"') } catch { return s }
}

/** Decode the handful of HTML entities YouTube uses in meta content. */
function decodeEntities(s) {
  if (!s) return s
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/** Strip " subscribers" wording → keep the count text ("1.2M"). */
function cleanSubs(s) {
  if (!s) return ''
  return s.replace(/\s*subscribers?\s*$/i, '').trim()
}

/**
 * Extract channel identity from a fetched YouTube page's HTML.
 * kind: 'channel' (any /@handle, /channel/, /c/, /user/ page) or
 * 'watch' (a /watch video page → the video's owner channel).
 * Every field is best-effort; channelId matters most (it's the app's
 * canonical dedupe key), name second, subscribers nice-to-have.
 */
function parseChannelHtml(html, kind) {
  const out = { channelId: null, name: null, channelUrl: null, subscribers: '' }
  if (!html) return out

  if (kind === 'watch') {
    // ytInitialPlayerResponse: the video's owning channel.
    out.channelId = (html.match(/"channelId":"(UC[0-9A-Za-z_-]{10,})"/) || [])[1] || null
    out.name = jsonUnescape((html.match(/"author":"((?:[^"\\]|\\.)*)"/) || [])[1] || null)
    const owner = (html.match(/"ownerProfileUrl":"(https?:[^"]+)"/) || [])[1]
    if (owner) out.channelUrl = jsonUnescape(owner).replace(/^http:/, 'https:')
  } else {
    // Channel pages: channelMetadataRenderer carries externalId; the
    // server-rendered og: tags carry the display name.
    out.channelId = (html.match(/"externalId":"(UC[0-9A-Za-z_-]{10,})"/) || [])[1] || null
    const og = (html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1]
    if (og) out.name = decodeEntities(og)
    if (!out.name) {
      out.name = jsonUnescape(
        (html.match(/"channelMetadataRenderer":\{"title":"((?:[^"\\]|\\.)*)"/) || [])[1] || null,
      )
    }
    const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1]
    if (canonical) out.channelUrl = decodeEntities(canonical)
  }

  // Subscribers — two known shapes, then a plain-text sweep.
  let subs = (html.match(/"subscriberCountText":\{"simpleText":"([^"]+)"/) || [])[1]
  if (!subs) subs = (html.match(/"subscriberCountText":\{[^}]*?"content":"([^"]+)"/) || [])[1]
  if (!subs) subs = (html.match(/([\d.,]+\s*[KMB]?)\s+subscribers/i) || [])[1]
  out.subscribers = cleanSubs(jsonUnescape(subs || ''))

  // Fall back to the /channel/UC… form when the page had no canonical.
  if (!out.channelUrl && out.channelId) {
    out.channelUrl = `https://www.youtube.com/channel/${out.channelId}`
  }
  return out
}

// ── API plumbing ────────────────────────────────────────────────────────

async function getKey() {
  const { apiKey } = await chrome.storage.sync.get('apiKey')
  return apiKey || ''
}

async function api(path, options = {}) {
  const key = await getKey()
  if (!key) return { status: 0, body: { error: 'no-key' } }
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
    const body = await res.json().catch(() => ({}))
    return { status: res.status, body }
  } catch (e) {
    return { status: 0, body: { error: String((e && e.message) || e) } }
  }
}

async function resolveChannel(pageUrl, kind) {
  try {
    // credentials:'omit' — a plain public fetch; we never send the
    // user's YouTube cookies anywhere.
    const res = await fetch(pageUrl, { credentials: 'omit' })
    const html = await res.text()
    const parsed = parseChannelHtml(html, kind)
    return { ok: true, ...parsed }
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) }
  }
}

// ── Message router ─────────────────────────────────────────────────────

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    ;(async () => {
      try {
        if (msg.type === 'resolve') {
          sendResponse(await resolveChannel(msg.url, msg.kind))
        } else if (msg.type === 'check') {
          const params = new URLSearchParams({ limit: '1' })
          if (msg.channelId) params.set('channelId', msg.channelId)
          if (msg.channelUrl) params.set('channelUrl', msg.channelUrl)
          sendResponse(await api(`/leads?${params.toString()}`))
        } else if (msg.type === 'add') {
          sendResponse(await api('/leads', { method: 'POST', body: JSON.stringify(msg.lead) }))
        } else if (msg.type === 'test') {
          sendResponse(await api('/leads?limit=1'))
        } else if (msg.type === 'has-key') {
          sendResponse({ hasKey: !!(await getKey()) })
        } else {
          sendResponse({ status: 0, body: { error: 'unknown-message' } })
        }
      } catch (e) {
        sendResponse({ status: 0, body: { error: String((e && e.message) || e) } })
      }
    })()
    return true // keep the channel open for the async sendResponse
  })
}

// Node test hook (ignored by the browser service worker).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseChannelHtml, cleanSubs, decodeEntities, jsonUnescape }
}
