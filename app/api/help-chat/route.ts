/**
 * POST /api/help-chat — the AI help/sales chatbox engine.
 *
 * One engine, two personas via `mode`:
 *   help  — in-app, AUTH REQUIRED, per-user Redis rate limit.
 *   sales — public marketing pages, UNAUTHENTICATED → hard caps:
 *           Cloudflare Turnstile (fail-closed if no secret), per-IP
 *           rate limit, and a global daily ceiling that degrades the
 *           bot to "use the contact form" instead of spending more.
 *
 * Sonnet on both (Dylan's call). Costs are bounded by the caps above +
 * clamped history / output tokens. Non-streaming v1.
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireUser, rateLimitRedis } from '@/lib/api-auth'
import { cacheIncrWindow } from '@/lib/cache'
import { buildSystemPrompt, type ChatMode } from '@/lib/help/knowledge'

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic({ apiKey: process.env.AI_Score_Key })
const MODEL = 'claude-sonnet-4-6'
const MAX_INPUT_CHARS = 1200    // per message — bounds token cost + abuse
const MAX_HISTORY = 12          // messages sent to the model
const PUBLIC_DAILY_CEILING = Number(process.env.HELP_PUBLIC_DAILY_CEILING || 2000)

interface ChatMsg { role: 'user' | 'assistant'; content: string }

/** Verify a Cloudflare Turnstile token. Fail-closed: no secret ⇒ the
 *  public bot is OFF (we never expose an unprotected Sonnet endpoint). */
async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret || !token) return false
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    })
    const d = await r.json().catch(() => ({}))
    return !!d?.success
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.AI_Score_Key) {
    return NextResponse.json({ error: 'Chat is unavailable right now.' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const mode: ChatMode = body?.mode === 'sales' ? 'sales' : 'help'

  const messages: ChatMsg[] = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m: unknown): m is ChatMsg =>
      !!m && typeof m === 'object'
      && ((m as ChatMsg).role === 'user' || (m as ChatMsg).role === 'assistant')
      && typeof (m as ChatMsg).content === 'string')
    .slice(-MAX_HISTORY)
    .map((m: ChatMsg) => ({ role: m.role, content: m.content.slice(0, MAX_INPUT_CHARS) }))
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'No message.' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  if (mode === 'help') {
    const auth = await requireUser()
    if (auth instanceof NextResponse) return auth
    const limited = await rateLimitRedis(auth.id, 'help-chat', 60, auth.email)
    if (limited) return limited
  } else {
    // Public sales bot — fail-closed Turnstile, per-IP cap, daily ceiling.
    if (!(await verifyTurnstile(body?.turnstileToken, ip))) {
      return NextResponse.json({ error: 'Please complete the verification.', code: 'turnstile' }, { status: 403 })
    }
    const limited = await rateLimitRedis(`ip:${ip}`, 'help-chat-public', 25)
    if (limited) return limited
    const dayCount = await cacheIncrWindow('help:public:daily', 60 * 60 * 24)
    if (dayCount != null && dayCount > PUBLIC_DAILY_CEILING) {
      return NextResponse.json(
        { error: "We're getting a lot of questions right now — please use the contact form and we'll get back to you.", code: 'ceiling' },
        { status: 429 },
      )
    }
  }

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      // Prompt-cache the system block. It's large (product facts + the full
      // feature catalog + link map) and identical across every message in a
      // mode, so caching it cuts both latency and input-token cost on the
      // 2nd+ turn of a conversation (5-min cache window).
      system: [{ type: 'text', text: buildSystemPrompt(mode), cache_control: { type: 'ephemeral' } }],
      messages,
    })
    const reply = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()
    return NextResponse.json({ reply: reply || "Sorry — I didn't catch that. Try rephrasing?" })
  } catch (e) {
    console.error('[help-chat] error', (e as Error)?.message)
    return NextResponse.json({ error: 'I hit a snag — try again, or use "Talk to a human".' }, { status: 500 })
  }
}
