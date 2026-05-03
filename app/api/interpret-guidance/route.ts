import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.AI_Score_Key })

const CONDITIONS_DOC = `
Available condition types — use the EXACT string for "condition":

BUSINESS / PRODUCT SIGNALS  ← use these for "has a product", "business account", "sells something", "entrepreneur"
  "has_product_mention"    → checks channel name, video titles, and description for: course, coaching, program, book, store, shop, merch, product, membership, consulting, service, brand, academy, masterclass, agency, business, entrepreneur, workshop, digital product, ecommerce, mentor, training. Works even before full data is loaded.
  "has_website"            → creator has a personal/business website link on their channel

AUDIENCE / LANGUAGE SIGNALS  ← use these for "American audience", "English-speaking", "US market"
  "has_english_description"→ channel name, video titles, and description are primarily in English (>80% ASCII). Good signal for US/UK/AU/CA creators.

CONTACT / REACHABILITY  ← use these for "reachable", "has contact info", "can email them"
  "has_email"              → creator has an email address found
  "no_email"               → creator has no email address
  "has_linkedin"           → creator has a LinkedIn profile

SOCIAL PRESENCE  ← use these for "active on social", "has Instagram", "cross-platform"
  "has_instagram"          → creator has an Instagram link
  "has_tiktok"             → creator has a TikTok link
  "multi_platform"         → creator is active on 2+ platforms (Instagram, TikTok, Twitter, LinkedIn, website)

CHANNEL SIZE  ← use these for "small channel", "large channel", "micro influencer", "established creator"
  "subs_gte"               → subscriber count ≥ value  (e.g. { condition: "subs_gte", value: 10000 })
  "subs_lte"               → subscriber count ≤ value  (e.g. { condition: "subs_lte", value: 500000 })

CONTENT PERFORMANCE  ← use these for "gets views", "viral", "consistent views", "low engagement"
  "views_gte"              → average views per video ≥ value
  "views_lte"              → average views per video ≤ value
  "posts_recent"           → posted within the last 30 days (active creator)
`

export async function POST(req: NextRequest) {
  const { text } = await req.json() as { text: string }

  if (!text?.trim()) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }

  const prompt = `You are building scoring rules for a YouTube creator outreach tool. A user described what makes a great lead. Convert it into evaluatable scoring rules.

${CONDITIONS_DOC}

Rule format:
- "condition": exact string from the list above
- "value": number ONLY for subs_gte, subs_lte, views_gte, views_lte (omit for everything else)
- "points": -10 to +10. Positive = good signal. ±2–3 = mild, ±5–7 = strong, ±8–10 = must-have/deal-breaker.
- "label": under 8 words describing what the rule checks (e.g. "Has product or course to sell")

User's criterion: "${text}"

Mapping guide for common phrases:
- "has a product", "sells something", "business", "entrepreneur", "course creator" → use "has_product_mention" with high points (7–9)
- "business account", "brand channel", "company" → use "has_product_mention" + "has_website"
- "American audience", "US market", "English speaking" → use "has_english_description"
- "reachable", "can contact them" → use "has_email"
- "active on social", "social presence" → use "multi_platform" or "has_instagram"
- "consistent", "active creator" → use "posts_recent"
- "small creator", "micro influencer" → use "subs_lte" with appropriate value
- "established", "decent following" → use "subs_gte" with appropriate value

Return ONLY valid JSON, no markdown:
{
  "rules": [
    { "condition": "has_product_mention", "points": 8, "label": "Has product or course to sell" }
  ],
  "summary": "<one plain-English sentence under 20 words explaining what this criterion targets>"
}

Rules:
- Extract 1–4 rules maximum
- Use "has_product_mention" for ANY mention of business/product/selling — it's the most reliable condition for that concept
- If the criterion clearly can't map to any available condition, return empty rules and explain in summary`

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
