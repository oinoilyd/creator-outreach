import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.AI_Score_Key })

interface ScoreWeights {
  recency: number
  views: number
  reachability: number
  relevance: number
  quality: number
}

const CATEGORY_DESCRIPTIONS = {
  recency:      'How recently the creator posted (0 = ignore, 50 = critical)',
  views:        'Average view count sweet spot — favors 10K–50K range',
  reachability: 'Whether email and/or LinkedIn are available for outreach',
  relevance:    'How well the channel content matches the search topic',
  quality:      'Views-to-subscriber engagement ratio (audience loyalty)',
}

export async function POST(req: NextRequest) {
  const { weights, narrative } = await req.json() as { weights: ScoreWeights; narrative: string }

  if (!narrative?.trim()) {
    return NextResponse.json({ error: 'No narrative provided' }, { status: 400 })
  }

  const currentWeightsText = Object.entries(weights)
    .map(([k, v]) => `  ${k}: ${v} — ${CATEGORY_DESCRIPTIONS[k as keyof ScoreWeights]}`)
    .join('\n')

  const prompt = `You are helping tune a YouTube creator fit-score system for a creator outreach tool. The user does outreach to YouTube creators to pitch them on a content/growth service.

The scoring system has 5 categories. Each has a weight between 0 and 50. The weights are auto-normalized so they always sum to 100 points total. Higher weight = more important to the final score.

Current weights:
${currentWeightsText}

The user has written this guidance about what makes a good lead for them:
"${narrative}"

Based on their guidance, suggest updated weights that better reflect their priorities. Return ONLY a valid JSON object with this exact shape — no explanation, no markdown, no extra text:
{
  "weights": {
    "recency": <number 0-50>,
    "views": <number 0-50>,
    "reachability": <number 0-50>,
    "relevance": <number 0-50>,
    "quality": <number 0-50>
  },
  "summary": "<one sentence explaining the key changes you made and why>"
}

Rules:
- Keep each weight between 0 and 50
- Only change weights that the user's guidance clearly implies should change
- If the user mentions something not covered by the 5 categories, note it in the summary but don't distort other weights to compensate
- The summary must be plain English, under 25 words`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (message.content[0] as any).text?.trim() || ''

    // Strip markdown fences if present
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(jsonStr)

    if (!parsed.weights || typeof parsed.weights !== 'object') {
      throw new Error('Invalid response shape')
    }

    // Clamp all values to 0–50
    const safe: ScoreWeights = {
      recency:      Math.min(50, Math.max(0, Math.round(parsed.weights.recency      ?? weights.recency))),
      views:        Math.min(50, Math.max(0, Math.round(parsed.weights.views        ?? weights.views))),
      reachability: Math.min(50, Math.max(0, Math.round(parsed.weights.reachability ?? weights.reachability))),
      relevance:    Math.min(50, Math.max(0, Math.round(parsed.weights.relevance    ?? weights.relevance))),
      quality:      Math.min(50, Math.max(0, Math.round(parsed.weights.quality      ?? weights.quality))),
    }

    return NextResponse.json({ weights: safe, summary: parsed.summary || '' })
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to interpret: ${err.message}` }, { status: 500 })
  }
}
