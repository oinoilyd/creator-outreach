/** Popup: save the co_live_ platform API key + test it against the API. */

const keyInput = document.getElementById('key')
const statusEl = document.getElementById('status')

function setStatus(text, cls) {
  statusEl.textContent = text
  statusEl.className = cls || ''
}

// Show whether a key is already saved (masked — never echo the value).
chrome.storage.sync.get('apiKey').then(({ apiKey }) => {
  if (apiKey) {
    keyInput.placeholder = `saved: ${apiKey.slice(0, 8)}…${apiKey.slice(-4)}`
    setStatus('A key is saved. Paste a new one to replace it.', '')
  }
})

document.getElementById('save').addEventListener('click', async () => {
  const v = keyInput.value.trim()
  if (!v) { setStatus('Paste a key first.', 'err'); return }
  if (!v.startsWith('co_live_')) {
    setStatus('That doesn’t look like a Creator Outreach key (co_live_…).', 'err')
    return
  }
  await chrome.storage.sync.set({ apiKey: v })
  keyInput.value = ''
  keyInput.placeholder = `saved: ${v.slice(0, 8)}…${v.slice(-4)}`
  setStatus('Saved. Open any YouTube channel to try it.', 'ok')
})

document.getElementById('test').addEventListener('click', () => {
  setStatus('Testing…', '')
  chrome.runtime.sendMessage({ type: 'test' }, (res) => {
    if (!res) { setStatus('No response from the extension worker.', 'err'); return }
    if (res.status === 200) setStatus('✓ Connected — key works.', 'ok')
    else if (res.body && res.body.error === 'no-key') setStatus('No key saved yet.', 'err')
    else if (res.status === 401) setStatus('Key rejected — create a fresh one in the Integrations panel.', 'err')
    else setStatus(`Connection failed (${res.status || 'network'}).`, 'err')
  })
})
