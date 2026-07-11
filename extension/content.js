/**
 * Creator Outreach extension — content script (youtube.com).
 *
 * Renders a small fixed pill (bottom-right, Shadow DOM so YouTube's CSS
 * can't touch it) on channel pages and video pages:
 *
 *   ＋ Add <creator> to Creator Outreach   → POST /api/v1/leads
 *   ✓ In your outreach                     → already on the board
 *   Connect Creator Outreach               → no API key saved yet
 *
 * YouTube is an SPA — we listen for its `yt-navigate-finish` event plus
 * a URL poller fallback, and re-resolve on every navigation. Channel
 * identity comes from the background worker re-fetching the page HTML
 * (see background.js for why we don't scrape the live DOM).
 */

const HOST_ID = 'creator-outreach-ext-host'
let renderToken = 0 // invalidates in-flight work when the user navigates again
let dismissedFor = '' // href the user dismissed the pill on (until next nav)

// ── Page classification ────────────────────────────────────────────────

function classifyPage() {
  const p = location.pathname
  if (p.startsWith('/watch')) return { kind: 'watch', url: location.href }
  if (/^\/(@[^/]+|channel\/UC[0-9A-Za-z_-]{10,}|c\/[^/]+|user\/[^/]+)/.test(p)) {
    // Normalize to the channel ROOT (drop /videos, /shorts tab suffixes)
    const seg = p.split('/').filter(Boolean)
    const root = seg[0] === 'channel' || seg[0] === 'c' || seg[0] === 'user'
      ? `/${seg[0]}/${seg[1] ?? ''}`
      : `/${seg[0]}`
    return { kind: 'channel', url: `${location.origin}${root}` }
  }
  return null
}

// ── Shadow-DOM pill ────────────────────────────────────────────────────

function removePill() {
  const el = document.getElementById(HOST_ID)
  if (el) el.remove()
}

function ensurePill() {
  let host = document.getElementById(HOST_ID)
  if (host) return host.shadowRoot.getElementById('root')
  host = document.createElement('div')
  host.id = HOST_ID
  const shadow = host.attachShadow({ mode: 'open' })
  shadow.innerHTML = `
    <style>
      #root {
        position: fixed; right: 20px; bottom: 20px; z-index: 2147483646;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex; align-items: center; gap: 8px;
        background: #17141f; color: #f4f2fa;
        border: 1px solid rgba(139, 92, 246, 0.45);
        border-radius: 12px; padding: 8px 10px 8px 12px;
        box-shadow: 0 8px 28px rgba(0,0,0,0.45);
        font-size: 13px; line-height: 1.2; max-width: 340px;
      }
      #root.hidden { display: none; }
      .dot {
        width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
        background: linear-gradient(135deg, #8b5cf6, #3b82f6);
      }
      .msg { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .msg .name { font-weight: 600; }
      button.cta {
        all: unset; cursor: pointer; font-weight: 600; font-size: 13px;
        background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff;
        border-radius: 8px; padding: 6px 12px; white-space: nowrap;
      }
      button.cta:hover { filter: brightness(1.12); }
      button.cta:disabled { opacity: 0.6; cursor: default; }
      a.link { color: #b7a5f7; text-decoration: none; white-space: nowrap; }
      a.link:hover { text-decoration: underline; }
      .ok { color: #6ee7b7; font-weight: 600; white-space: nowrap; }
      .err { color: #fda4af; }
      button.x {
        all: unset; cursor: pointer; color: #8d87a0; font-size: 14px;
        padding: 2px 4px; line-height: 1; flex-shrink: 0;
      }
      button.x:hover { color: #f4f2fa; }
    </style>
    <div id="root"><span class="dot"></span><span id="body" class="msg">…</span><button class="x" id="close" title="Hide until next page">×</button></div>
  `
  document.documentElement.appendChild(host)
  shadow.getElementById('close').addEventListener('click', () => {
    dismissedFor = location.href
    removePill()
  })
  return shadow.getElementById('root')
}

function setPill(html) {
  const root = ensurePill()
  root.querySelector('#body').innerHTML = html
  return root
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

const send = (msg) => new Promise(resolve => chrome.runtime.sendMessage(msg, resolve))

// ── Main flow ──────────────────────────────────────────────────────────

async function onNavigate() {
  const token = ++renderToken
  const page = classifyPage()
  if (!page || dismissedFor === location.href) { removePill(); return }

  // Don't render anything until we know who this is — avoids flicker on
  // every stray navigation.
  const [{ hasKey }, resolved] = await Promise.all([
    send({ type: 'has-key' }),
    send({ type: 'resolve', url: page.url, kind: page.kind }),
  ])
  if (token !== renderToken) return // user already navigated away
  if (!resolved || !resolved.ok || (!resolved.channelId && !resolved.name)) {
    removePill(); return // not a resolvable creator page — stay invisible
  }

  const lead = {
    channelName: resolved.name || '',
    channelUrl: resolved.channelUrl || page.url,
    channelId: resolved.channelId || undefined,
    subscribers: resolved.subscribers || '',
  }

  if (!hasKey) {
    setPill(
      `<span>Connect <span class="name">Creator Outreach</span> — click the extension icon and paste your API key.</span>`,
    )
    return
  }

  // Already on the board?
  const check = await send({ type: 'check', channelId: lead.channelId || '', channelUrl: lead.channelUrl })
  if (token !== renderToken) return
  if (check.status === 200 && Array.isArray(check.body.leads) && check.body.leads.length > 0) {
    renderAdded(check.body.leads[0].status)
    return
  }
  if (check.status === 401) {
    setPill(`<span class="err">API key invalid — click the extension icon to update it.</span>`)
    return
  }

  renderAddButton(lead, token)
}

function renderAddButton(lead, token) {
  const root = setPill(
    `<button class="cta" id="co-add">＋ Add ${esc(shortName(lead.channelName))} to Creator Outreach</button>`,
  )
  root.querySelector('#co-add').addEventListener('click', async (ev) => {
    ev.target.disabled = true
    ev.target.textContent = 'Adding…'
    const res = await send({ type: 'add', lead })
    if (token !== renderToken) return
    if (res.status === 200 && res.body.ok) {
      renderAdded('Not Outreached', res.body.action)
    } else if (res.status === 401) {
      setPill(`<span class="err">API key invalid — click the extension icon to update it.</span>`)
    } else if (res.status === 429) {
      setPill(`<span class="err">Rate limited — try again in a minute.</span>`)
    } else {
      setPill(`<span class="err">Couldn't add: ${esc(res.body.error || 'network error')}</span>`)
    }
  })
}

function renderAdded(status, action) {
  const label = action === 'updated'
    ? 'Already in your outreach — updated'
    : action === 'created'
      ? 'Added to your outreach'
      : `In your outreach${status ? ` · ${esc(status)}` : ''}`
  setPill(
    `<span class="ok">✓ ${label}</span>&nbsp;<a class="link" href="https://creatoroutreach.net/?tab=outreach" target="_blank" rel="noreferrer">open →</a>`,
  )
}

function shortName(name) {
  const n = (name || '').trim()
  if (!n) return 'this creator'
  return n.length > 24 ? n.slice(0, 22) + '…' : n
}

// ── SPA navigation hooks ───────────────────────────────────────────────

let debounceTimer = null
function scheduleNavigate() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(onNavigate, 350)
}

window.addEventListener('yt-navigate-finish', scheduleNavigate, true)
let lastHref = ''
setInterval(() => {
  if (location.href !== lastHref) {
    lastHref = location.href
    scheduleNavigate()
  }
}, 1200)
scheduleNavigate()
