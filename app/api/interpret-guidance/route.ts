import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.AI_Score_Key })

const CONDITIONS_DOC = `
Available condition types — use the EXACT string for "condition":

CONTACT / REACHABILITY
  "has_email"              → creator has an email address found
  "no_email"               → creator has no email address
  "has_linkedin"           → creator has a LinkedIn profile
  "has_website"            → creator has a personal website or link

SOCIAL PRESENCE
  "has_instagram"          → creator has an Instagram link
  "has_tiktok"             → creator has a TikTok link
  "multi_platform"         → creator is active on 2+ social platforms (Instagram, TikTok, Twitter, LinkedIn, website)

CHANNEL SIZE
  "subs_gte"               → subscriber count ≥ value  (e.g. { condition: "subs_gte", value: 10000 })
  "subs_lte"               → subscriber count ≤ value  (e.g. { condition: "subs_lte", value: 500000 })

CONTENT PERFORMANCE
  "views_gte"              → average views ≥ value     (e.g. { condition: "views_gte", value: 5000 })
  "views_lte"              → average views ≤ value     (e.g. { condition: "views_lte", value: 100000 })
  "posts_recent"           → most recent post was within the last 30 days

CREATOR BUSINESS SIGNALS
  "has_product_mention"    → channel description mentions products, courses, coaching, books, merchandise, membership, store, consulting, or workshops — signals the creator sells something beyond just content
  "has_english_description"→ channel description is primarily in English — signals English-speaking audience (useful for targeting US/UK/AU/CA market creators)
`

export async function POST(req: NextRequest) {
  const { text } = await req.json() as { text: string }

  if (!text?.trim()) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }

  const prompt = `You are building scoring logic for a YouTube creator outreach tool. A user has described a criterion for what makes a great lead. Your job is to convert it into precise, evaluatable scoring rules.

${CONDITIONS_DOC}

Each rule:
- "condition": one of the exact condition strings above
- "value": a number (ONLY for subs_gte, subs_lte, views_gte, views_lte — omit for all others)
- "points": integer from -10 to +10. Positive = good signal, negative = bad signal. Scale: ±2–3 mild preference, ±5–7 strong preference, ±8–10 near deal-breaker.
- "label": short human-readable label under 8 words (e.g. "Has product/course to sell", "Posts in English")

User's lead criterion: "${text}"

Think carefully about what this implies about a creator's profile. Consider:
- Does it say anything about what platforms they're on?
- Does it say anything about their audience or market?
- Does it suggest they sell something or have a business?
- Does it say anything about how active or large they are?

Return ONLY valid JSON — no explanation, no markdown:
{
  "rules": [
    { "condition": "has_product_mention", "points": 8, "label": "Has product/course to sell" },
    ...
  ],
  "summary": "<one sentence in plain English under 20 words: what this criterion looks for and why it matters>"
}

Important:
- Extract 1–4 rules maximum
- Only use conditions from the list above — do not invent new condition strings
- If the criterion cannot be evaluated by any available condition, return empty rules and explain in summary
- Negative rules (bad signals) are valid — e.g. "no_email" with -5 if the user says they need email to reach out
- summary should explain the AI's interpretation, not just repeat what the user said`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (message.content[0] as any).text?.trim() || ''
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(jsonStr)

    if (!Array.isArray(parsed.rules)) throw new Error('Invalid response shape')

    const safe = parsed.rules
      .filter((r: any) => typeof r.condition === 'string' && typeof r.points === 'number')
      .map((r: any) => ({
        condition: r.condition,
        ...(r.value != null ? { value: Math.round(r.value) } : {}),
        points: Math.min(10, Math.max(-10, Math.round(r.points))),
        label: typeof r.label === 'string' ? r.label.slice(0, 60) : r.condition,
      }))

    return NextResponse.json({ rules: safe, summary: parsed.summary || '' })
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to interpret: ${err.message}` }, { status: 500 })
  }
}
