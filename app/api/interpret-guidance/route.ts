import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.AI_Score_Key })

const CONDITIONS_DOC = `
Available condition types (use exact string for "condition"):
- "has_email"       → creator has an email address found                     (no value needed)
- "no_email"        → creator has no email address                           (no value needed)
- "has_instagram"   → creator has an Instagram link                          (no value needed)
- "has_tiktok"      → creator has a TikTok link                              (no value needed)
- "has_website"     → creator has a personal website                         (no value needed)
- "has_linkedin"    → creator has a LinkedIn profile                         (no value needed)
- "multi_platform"  → creator is on 2+ social platforms (insta/tiktok/etc)  (no value needed)
- "subs_gte"        → subscriber count ≥ value  (e.g. value: 10000)
- "subs_lte"        → subscriber count ≤ value  (e.g. value: 500000)
- "views_gte"       → average views ≥ value     (e.g. value: 5000)
- "views_lte"       → average views ≤ value     (e.g. value: 100000)
- "posts_recent"    → most recent post was within the last 30 days           (no value needed)
`

export async function POST(req: NextRequest) {
  const { text } = await req.json() as { text: string }

  if (!text?.trim()) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }

  const prompt = `You are helping configure a YouTube creator fit-score system for a creator outreach tool.

The user has submitted a piece of guidance describing what makes a good or bad lead for them. Your job is to convert it into a list of scoring rules.

${CONDITIONS_DOC}

Each rule has:
- "condition": one of the condition strings above (exact)
- "value": a number (only for subs_gte, subs_lte, views_gte, views_lte — omit for others)
- "points": integer between -10 and +10. Positive = good signal, negative = bad signal.
- "label": a short human-readable description of the rule (under 8 words)

User guidance: "${text}"

Return ONLY valid JSON with this exact shape — no explanation, no markdown:
{
  "rules": [
    { "condition": "has_instagram", "points": 5, "label": "Has Instagram presence" },
    ...
  ],
  "summary": "<one sentence summarizing what this guidance does, under 20 words>"
}

Rules:
- Extract 1–4 rules from the guidance
- If the guidance doesn't clearly map to any condition, return an empty rules array and explain in summary
- Keep points proportional — minor preferences ±2–3, strong preferences ±5–8, deal-breakers ±9–10
- Never invent conditions not in the list above`

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

    // Validate and clamp rules
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
