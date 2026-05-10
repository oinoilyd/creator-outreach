import type { Creator, GuidanceRule, GuidanceEntry, GuidancePreset } from './types'
import { parseRelativeDays, parseSubscriberCount } from './format'

export const DEFAULT_GUIDANCE_WEIGHT = 10 // default pts weight for each new criterion

export function evaluateGuidanceRule(rule: GuidanceRule, c: Creator): boolean {
  // c.subscribers is a string and can come back as "10K", "1.2M", or
  // "550 subscribers" depending on the source. Number("10K") is NaN —
  // we MUST use parseSubscriberCount, not Number, or filters like
  // "Stays under 500K" silently fail for creators with abbreviated
  // counts. parseSubscriberCount returns null when truly unknown.
  const parsedSubs = parseSubscriberCount(c.subscribers)
  const subs = parsedSubs ?? 0
  const subsKnown = parsedSubs != null && parsedSubs > 0
  const platforms = [c.instagram, c.tiktok, c.twitter, c.linkedin, c.website].filter(Boolean).length
  switch (rule.condition) {
    case 'has_email':      return !!c.email
    case 'no_email':       return !c.email
    case 'has_instagram':  return !!c.instagram
    case 'has_tiktok':     return !!c.tiktok
    case 'has_twitter':    return !!c.twitter
    case 'has_website':    return !!c.website
    case 'has_linkedin':   return !!c.linkedin
    case 'multi_platform': return platforms >= 2
    case 'subs_gte':       return subs >= (rule.value ?? 0)
    case 'subs_lte':       return subsKnown && subs <= (rule.value ?? Infinity)
    case 'views_gte':      return c.avgViews >= (rule.value ?? 0)
    case 'views_lte':      return c.avgViews > 0 && c.avgViews <= (rule.value ?? Infinity)
    case 'posts_recent':   return parseRelativeDays(c.videoDates?.[0] || '') <= 30
    case 'has_product_mention': {
      const corpus = [
        c.description || '',
        c.channelName || '',
        ...(c.videoTitles || []),
      ].join(' ').toLowerCase()
      return /\b(course|courses|coaching|coach|program|programs|book|books|store|shop|merch|merchandise|product|products|membership|community|consulting|consultant|service|services|brand|sell|selling|offer|template|templates|mentorship|mentor|workshop|workshops|academy|masterclass|training|agency|studio|media|business|entrepreneur|founder|creator economy|digital product|online business|side hustle|passive income|build your|grow your business|ecommerce|e-commerce|dropship)\b/.test(corpus)
    }
    case 'has_english_description': {
      const corpus = [
        c.description || '',
        c.channelName || '',
        ...(c.videoTitles || []),
      ].join(' ')
      if (!corpus.trim() || corpus.trim().length < 10) return false
      const asciiRatio = corpus.split('').filter(ch => ch.charCodeAt(0) < 128).length / corpus.length
      return asciiRatio > 0.80
    }
    default: return false
  }
}

export function getGuidanceRuleEvidence(rule: GuidanceRule, c: Creator): string {
  switch (rule.condition) {
    case 'has_product_mention': {
      const keywords = ['course','courses','coaching','coach','program','programs','academy','masterclass',
        'workshop','workshops','mentorship','mentor','training','consulting','consultant','agency',
        'book','books','store','shop','merch','merchandise','product','products','membership',
        'service','services','brand','sell','selling','offer','template','templates',
        'business','entrepreneur','ecommerce','e-commerce','dropship','digital product',
        'passive income','side hustle','online business','grow your business','build your',
        'creator economy']
      const sources: { text: string; where: string }[] = [
        { text: (c.channelName || '').toLowerCase(), where: 'channel name' },
        ...(c.videoTitles || []).map(t => ({ text: t.toLowerCase(), where: 'video title' })),
        { text: (c.description || '').toLowerCase(), where: 'description' },
      ]
      for (const src of sources) {
        const hit = keywords.find(kw => src.text.includes(kw))
        if (hit) {
          const excerpt = src.where === 'channel name' ? c.channelName :
            src.where === 'description' ? (c.description || '').slice(0, 60) + '…' :
            (c.videoTitles || []).find(t => t.toLowerCase().includes(hit)) || ''
          return `"${hit}" found in ${src.where}${src.where !== 'channel name' ? ` — "${excerpt.slice(0, 50)}${excerpt.length > 50 ? '…' : ''}"` : ''}`
        }
      }
      return ''
    }
    case 'has_english_description': {
      const first = c.channelName || (c.videoTitles || [])[0] || ''
      return first ? `Content appears to be in English ("${first.slice(0, 40)}")` : 'Content appears to be in English'
    }
    case 'has_email':      return c.email ? `Email: ${c.email}` : ''
    case 'has_website':    return c.website ? c.website.replace(/^https?:\/\//, '') : ''
    case 'has_instagram':  return c.instagram ? c.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@') : ''
    case 'has_tiktok':     return c.tiktok ? c.tiktok.replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, '@') : ''
    case 'has_twitter':    return c.twitter ? c.twitter.replace(/^https?:\/\/(www\.)?(twitter|x)\.com\/@?/, '@') : ''
    case 'has_linkedin':   return c.linkedin ? 'LinkedIn profile found' : ''
    case 'multi_platform': {
      const active = [
        c.instagram && 'Instagram', c.tiktok && 'TikTok',
        c.twitter && 'X', c.linkedin && 'LinkedIn', c.website && 'Website',
      ].filter(Boolean)
      return active.length > 0 ? active.join(', ') : ''
    }
    case 'subs_gte':
    case 'subs_lte': {
      const s = parseSubscriberCount(c.subscribers) ?? 0
      return s > 0 ? `${(s / 1000).toFixed(s >= 1000000 ? 1 : 0)}${s >= 1000000 ? 'M' : 'K'} subscribers` : ''
    }
    case 'views_gte':
    case 'views_lte':
      return c.avgViews > 0 ? `~${c.avgViews.toLocaleString()} avg views` : ''
    case 'posts_recent':
      return c.videoDates?.[0] ? `Last post: ${c.videoDates[0]}` : ''
    default: return ''
  }
}

export const GUIDANCE_PRESETS: GuidancePreset[] = [
  {
    label: 'Sells a product or course',
    description: 'Creator sells a course, coaching, or product — not just content',
    emoji: '🛒',
    entry: {
      text: 'A good lead has a product, course, or coaching program they sell',
      rules: [{ condition: 'has_product_mention', points: 8, label: 'Has product/course to sell' }],
      summary: 'Prioritizes creators who sell products, courses, or coaching — not just content.',
      weight: DEFAULT_GUIDANCE_WEIGHT,
    },
  },
  {
    label: 'Full business presence',
    description: 'Has a product AND a website — strong dual business signal',
    emoji: '🏢',
    entry: {
      text: 'They run a real business with both a product and a website, not just a YouTube channel',
      rules: [
        { condition: 'has_product_mention', points: 6, label: 'Has product/course to sell' },
        { condition: 'has_website', points: 5, label: 'Has business website' },
      ],
      summary: 'Strong signal for creators running a real business — product plus a website.',
      weight: DEFAULT_GUIDANCE_WEIGHT,
    },
  },
  {
    label: 'English-speaking audience',
    description: 'Content is in English — US, UK, AU, CA market',
    emoji: '🇺🇸',
    entry: {
      text: 'They target English-speaking audiences in the US, UK, or AU market',
      rules: [{ condition: 'has_english_description', points: 6, label: 'English-language content' }],
      summary: 'Favors creators whose content is in English, signaling US/UK/AU audiences.',
      weight: DEFAULT_GUIDANCE_WEIGHT,
    },
  },
  {
    label: 'Has a website',
    description: 'Business or personal site linked on their channel',
    emoji: '🌐',
    entry: {
      text: 'They have a website or business link on their channel',
      rules: [{ condition: 'has_website', points: 6, label: 'Has website or business link' }],
      summary: 'Favors creators with a website — strong signal of an established brand or business.',
      weight: DEFAULT_GUIDANCE_WEIGHT,
    },
  },
  {
    label: 'Has LinkedIn',
    description: 'LinkedIn profile — professional or B2B creator signal',
    emoji: '💼',
    entry: {
      text: 'They have a LinkedIn profile showing they are a professional',
      rules: [{ condition: 'has_linkedin', points: 5, label: 'Has LinkedIn profile' }],
      summary: 'Favors creators with LinkedIn — stronger for professional and B2B niches.',
      weight: DEFAULT_GUIDANCE_WEIGHT,
    },
  },
  {
    label: 'Active on Instagram',
    description: 'Has Instagram — useful for multi-channel outreach',
    emoji: '📸',
    entry: {
      text: 'I prefer creators who are also active on Instagram',
      rules: [{ condition: 'has_instagram', points: 5, label: 'Has Instagram presence' }],
      summary: 'Favors creators with Instagram — opens an additional outreach channel.',
      weight: DEFAULT_GUIDANCE_WEIGHT,
    },
  },
  {
    label: 'Active on TikTok',
    description: 'Has TikTok — cross-platform reach signal',
    emoji: '🎵',
    entry: {
      text: 'I prefer creators who also post on TikTok',
      rules: [{ condition: 'has_tiktok', points: 4, label: 'Has TikTok channel' }],
      summary: 'Favors creators with a TikTok presence — broader audience and more reach.',
      weight: DEFAULT_GUIDANCE_WEIGHT,
    },
  },
  {
    label: 'Multi-platform presence',
    description: 'Active on 2+ platforms beyond YouTube',
    emoji: '🔗',
    entry: {
      text: 'They should have a presence on multiple social platforms beyond YouTube',
      rules: [{ condition: 'multi_platform', points: 5, label: 'Active on 2+ platforms' }],
      summary: 'Favors creators active on multiple platforms — stronger brand and more reach.',
      weight: DEFAULT_GUIDANCE_WEIGHT,
    },
  },
  {
    label: 'Established creator',
    description: 'Over 10K subscribers — past the hobbyist stage',
    emoji: '⭐',
    entry: {
      text: 'I want creators who have at least 10K subscribers and are established',
      rules: [{ condition: 'subs_gte', value: 10000, points: 4, label: 'At least 10K subscribers' }],
      summary: 'Favors creators with 10K+ subscribers — past the early hobbyist phase.',
      weight: DEFAULT_GUIDANCE_WEIGHT,
    },
  },
  {
    label: 'Stays under 500K',
    description: 'Under 500K subs — approachable, responsive to outreach',
    emoji: '🎯',
    entry: {
      text: 'I prefer creators who have not yet blown up — under 500K subscribers',
      rules: [{ condition: 'subs_lte', value: 500000, points: 3, label: 'Under 500K subscribers' }],
      summary: 'Filters out mega-channels — smaller creators respond better to cold outreach.',
      weight: DEFAULT_GUIDANCE_WEIGHT,
    },
  },
  {
    label: 'Gets solid views',
    description: 'Averages 5K+ views per video — real audience engagement',
    emoji: '👀',
    entry: {
      text: 'I want creators who consistently get at least 5,000 views per video',
      rules: [{ condition: 'views_gte', value: 5000, points: 4, label: 'Averages 5K+ views/video' }],
      summary: 'Favors creators with real viewership — 5K+ average views per video.',
      weight: DEFAULT_GUIDANCE_WEIGHT,
    },
  },
  {
    label: 'Posted recently',
    description: 'Active creator — posted within the last 30 days',
    emoji: '📅',
    entry: {
      text: 'I want creators who are actively posting — within the last 30 days',
      rules: [{ condition: 'posts_recent', points: 6, label: 'Posted in last 30 days' }],
      summary: 'Favors creators who posted recently — a sign they are active and reachable.',
      weight: DEFAULT_GUIDANCE_WEIGHT,
    },
  },
  {
    label: 'Has email',
    description: 'Email found — ready to outreach directly',
    emoji: '📧',
    entry: {
      text: 'I only want creators I can email directly',
      rules: [{ condition: 'has_email', points: 8, label: 'Has email address' }],
      summary: 'Prioritizes creators with a discoverable email for direct outreach.',
      weight: DEFAULT_GUIDANCE_WEIGHT,
    },
  },
  {
    label: 'Micro influencer',
    description: 'Under 50K subs — high engagement, more responsive',
    emoji: '🌱',
    entry: {
      text: 'I prefer smaller micro influencers under 50K subscribers',
      rules: [{ condition: 'subs_lte', value: 50000, points: 5, label: 'Under 50K subscribers' }],
      summary: 'Targets micro influencers — typically higher engagement and more open to outreach.',
      weight: DEFAULT_GUIDANCE_WEIGHT,
    },
  },
  {
    label: 'High reach',
    description: 'Averages 100K+ views — proven large audience',
    emoji: '🚀',
    entry: {
      text: 'I want creators with high reach who average 100K+ views per video',
      rules: [{ condition: 'views_gte', value: 100000, points: 6, label: 'Averages 100K+ views' }],
      summary: 'Targets high-reach creators with proven large viewership per video.',
      weight: DEFAULT_GUIDANCE_WEIGHT,
    },
  },
  {
    label: 'Has X',
    description: 'Active on X — broader reach and engagement',
    emoji: '🐦',
    entry: {
      text: 'I prefer creators who also post on X',
      rules: [{ condition: 'has_twitter', points: 4, label: 'Has X presence' }],
      summary: 'Favors creators with an X account linked on their channel.',
      weight: DEFAULT_GUIDANCE_WEIGHT,
    },
  },
]

export function computeEntryRatio(entry: GuidanceEntry, c: Creator): number {
  let netFired = 0, maxPositive = 0
  for (const rule of entry.rules) {
    if (rule.points > 0) maxPositive += rule.points
    if (evaluateGuidanceRule(rule, c)) netFired += rule.points
  }
  return maxPositive > 0 ? Math.min(1, Math.max(0, netFired / maxPositive)) : 0
}

export function computeGuidanceScore(c: Creator, entries: GuidanceEntry[]): {
  fired: { ruleLabel: string; pts: number; entryId: string }[]
  missed: { ruleLabel: string; pts: number; entryId: string }[]
} {
  const fired: { ruleLabel: string; pts: number; entryId: string }[] = []
  const missed: { ruleLabel: string; pts: number; entryId: string }[] = []
  for (const entry of entries) {
    for (const rule of entry.rules) {
      if (evaluateGuidanceRule(rule, c)) {
        fired.push({ ruleLabel: rule.label, pts: rule.points, entryId: entry.id })
      } else {
        missed.push({ ruleLabel: rule.label, pts: rule.points, entryId: entry.id })
      }
    }
  }
  return { fired, missed }
}
