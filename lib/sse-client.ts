/**
 * Tiny SSE client for browser fetch streams.
 *
 * Why hand-rolled vs `EventSource`: EventSource only supports GET +
 * no custom headers, and we want to call /api/search from a fetch
 * (so auth cookies + same-origin work cleanly with the existing
 * route). The parser below is enough for our event shape:
 *
 *   event: <name>
 *   data: <json>\n\n
 *
 * Each event block is split on the double-newline. Within a block,
 * lines starting with `event:` set the event name, lines starting
 * with `data:` accumulate the payload (joined by '\n' if multi-line).
 */

export interface SseEvent {
  event: string
  data: unknown
}

/**
 * Consume a fetch Response's body as an SSE stream. Calls `onEvent`
 * for each parsed event. Resolves when the stream closes naturally.
 * Throws if the response isn't 2xx or if the body is missing.
 */
export async function consumeSse(
  response: Response,
  onEvent: (event: SseEvent) => void,
): Promise<void> {
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`SSE request failed (${response.status}): ${text || response.statusText}`)
  }
  if (!response.body) {
    throw new Error('SSE response has no body')
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // SSE events are separated by a blank line (\n\n). Pull complete
    // events out of the buffer and leave any partial trailing event
    // for the next chunk.
    let sepIdx: number
    while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, sepIdx)
      buffer = buffer.slice(sepIdx + 2)
      const event = parseEvent(raw)
      if (event) onEvent(event)
    }
  }
  // Handle any final event without a trailing blank line.
  if (buffer.trim()) {
    const event = parseEvent(buffer)
    if (event) onEvent(event)
  }
}

function parseEvent(block: string): SseEvent | null {
  const lines = block.split(/\r?\n/)
  let name = 'message'
  const dataLines: string[] = []
  for (const line of lines) {
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('event:')) {
      name = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  }
  if (dataLines.length === 0) return null
  const raw = dataLines.join('\n')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = raw
  }
  return { event: name, data: parsed }
}
