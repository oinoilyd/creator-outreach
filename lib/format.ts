import type { Creator, UserProfile } from './types'

export const ALL_OCCUPATIONS = [
  'fitness coach', 'personal trainer', 'nutritionist', 'life coach', 'business coach',
  'real estate agent', 'mortgage broker', 'financial advisor', 'stock trader', 'accountant',
  'basketball coach', 'soccer coach', 'golf instructor', 'tennis coach', 'swimming coach',
  'yoga instructor', 'CrossFit trainer', 'boxing coach', 'martial arts instructor', 'sports agent',
  'software developer', 'UX designer', 'product manager', 'data scientist', 'cybersecurity expert',
  'startup founder', 'venture capitalist', 'marketing consultant', 'SEO expert', 'copywriter',
  'photographer', 'videographer', 'graphic designer', 'music producer', 'podcast host',
  'social media manager', 'brand strategist', 'PR consultant', 'content creator', 'influencer',
  'lawyer', 'tax advisor', 'insurance agent', 'HR consultant', 'executive recruiter',
  'chef', 'baker', 'restaurant owner', 'food blogger', 'meal prep coach',
  'physical therapist', 'chiropractor', 'acupuncturist', 'wellness coach', 'mental health coach',
  'math tutor', 'language teacher', 'coding instructor', 'SAT prep tutor', 'homeschool educator',
  'interior designer', 'architect', 'contractor', 'electrician', 'plumber',
  'travel blogger', 'digital nomad', 'tour guide', 'travel agent', 'adventure coach',
  'crypto trader', 'blockchain developer', 'NFT artist', 'DeFi expert', 'web3 founder',
  'sales trainer', 'executive coach', 'career coach', 'public speaking coach', 'mindset coach',
  'divorce lawyer', 'immigration attorney', 'estate planner', 'financial planner', 'wealth manager',
]

export const VIEW_PRESETS = [
  { label: '0 – 10K', min: 0, max: 10000 },
  { label: '10K – 50K', min: 10000, max: 50000 },
  { label: '50K – 200K', min: 50000, max: 200000 },
  { label: '200K – 1M', min: 200_000, max: 1_000_000 },
  { label: '1M – 5M', min: 1_000_000, max: 5_000_000 },
  { label: '5M+', min: 5_000_000, max: 0 },
  { label: '0 – 500K', min: 0, max: 500_000 },
  { label: 'Any', min: 0, max: 0 },
]

export const SUBSCRIBER_PRESETS = [
  { label: '< 1K', min: 0, max: 1_000 },
  { label: '1K – 10K', min: 1_000, max: 10_000 },
  { label: '10K – 100K', min: 10_000, max: 100_000 },
  { label: '100K – 500K', min: 100_000, max: 500_000 },
  { label: '500K – 1M', min: 500_000, max: 1_000_000 },
  { label: '1M – 5M', min: 1_000_000, max: 5_000_000 },
  { label: '5M – 10M', min: 5_000_000, max: 10_000_000 },
  { label: '10M+', min: 10_000_000, max: 0 },
  { label: 'Any', min: 0, max: 0 },
]

// Niche → occupation buckets. Lets users add a whole category of related
// search keywords in one click instead of picking them one-by-one.
// Keep occupations only from ALL_OCCUPATIONS so chip-mode stays consistent.
export const NICHE_BUCKETS: { id: string; label: string; emoji: string; occupations: string[] }[] = [
  {
    id: 'fitness_health',
    label: 'Fitness & Health',
    emoji: '💪',
    occupations: [
      'fitness coach', 'personal trainer', 'nutritionist', 'yoga instructor',
      'CrossFit trainer', 'boxing coach', 'martial arts instructor',
      'physical therapist', 'chiropractor', 'acupuncturist', 'wellness coach',
      'mental health coach',
    ],
  },
  {
    id: 'finance_wealth',
    label: 'Finance & Wealth',
    emoji: '💰',
    occupations: [
      'financial advisor', 'stock trader', 'accountant', 'tax advisor',
      'insurance agent', 'financial planner', 'wealth manager', 'estate planner',
      'crypto trader', 'blockchain developer', 'NFT artist', 'DeFi expert',
      'web3 founder',
    ],
  },
  {
    id: 'real_estate',
    label: 'Real Estate',
    emoji: '🏡',
    occupations: ['real estate agent', 'mortgage broker', 'estate planner'],
  },
  {
    id: 'tech_startups',
    label: 'Tech & Startups',
    emoji: '💻',
    occupations: [
      'software developer', 'UX designer', 'product manager', 'data scientist',
      'cybersecurity expert', 'startup founder', 'venture capitalist',
      'coding instructor',
    ],
  },
  {
    id: 'coaching',
    label: 'Coaching & Self-Improvement',
    emoji: '🎯',
    occupations: [
      'life coach', 'business coach', 'sales trainer', 'executive coach',
      'career coach', 'public speaking coach', 'mindset coach',
    ],
  },
  {
    id: 'sports',
    label: 'Sports',
    emoji: '🏀',
    occupations: [
      'basketball coach', 'soccer coach', 'golf instructor', 'tennis coach',
      'swimming coach', 'sports agent',
    ],
  },
  {
    id: 'creative_media',
    label: 'Creative & Media',
    emoji: '🎬',
    occupations: [
      'photographer', 'videographer', 'graphic designer', 'music producer',
      'podcast host', 'social media manager', 'brand strategist', 'PR consultant',
      'content creator', 'influencer', 'copywriter', 'marketing consultant',
      'SEO expert',
    ],
  },
  {
    id: 'legal',
    label: 'Legal',
    emoji: '⚖️',
    occupations: ['lawyer', 'divorce lawyer', 'immigration attorney'],
  },
  {
    id: 'education',
    label: 'Education',
    emoji: '🎓',
    occupations: [
      'math tutor', 'language teacher', 'coding instructor', 'SAT prep tutor',
      'homeschool educator',
    ],
  },
  {
    id: 'food',
    label: 'Food & Hospitality',
    emoji: '🍽️',
    occupations: ['chef', 'baker', 'restaurant owner', 'food blogger', 'meal prep coach'],
  },
  {
    id: 'home_building',
    label: 'Home & Building',
    emoji: '🛠️',
    occupations: ['interior designer', 'architect', 'contractor', 'electrician', 'plumber'],
  },
  {
    id: 'travel',
    label: 'Travel & Lifestyle',
    emoji: '✈️',
    occupations: ['travel blogger', 'digital nomad', 'tour guide', 'travel agent', 'adventure coach'],
  },
  {
    id: 'hr_recruiting',
    label: 'HR & Recruiting',
    emoji: '🧑‍💼',
    occupations: ['HR consultant', 'executive recruiter'],
  },
]

export function pickRandom(arr: string[], n: number): string[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
}

export function formatSubscribers(s: string): string {
  if (!s) return '—'
  const n = Number(s)
  if (isNaN(n)) return s
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return n.toLocaleString()
}

// Parse subscriber strings like "10K", "1.2M", "550 subscribers" → number.
// Returns null when the input is empty or unparseable so callers can decide
// how to treat unknowns.
export function parseSubscriberCount(s: string): number | null {
  if (!s) return null
  const cleaned = String(s).replace(/,/g, '').trim().toLowerCase()
  if (!cleaned) return null
  // Try plain number first.
  const plain = Number(cleaned)
  if (!isNaN(plain)) return plain
  const match = cleaned.match(/([\d.]+)\s*([kmb])?/)
  if (!match) return null
  const n = parseFloat(match[1])
  if (isNaN(n)) return null
  const suffix = match[2]
  if (suffix === 'k') return Math.round(n * 1_000)
  if (suffix === 'm') return Math.round(n * 1_000_000)
  if (suffix === 'b') return Math.round(n * 1_000_000_000)
  return Math.round(n)
}

export function parseRelativeDays(text: string): number {
  if (!text) return Infinity
  const t = text.toLowerCase()
  const n = parseInt(t) || 1
  if (t.includes('second') || t.includes('minute') || t.includes('hour') || t.includes('just now') || t.includes('today')) return 0
  if (t.includes('day')) return n
  if (t.includes('week')) return n * 7
  if (t.includes('month')) return n * 30
  if (t.includes('year')) return n * 365
  return Infinity
}

export function buildOutreachEmail(c: Creator, profile?: UserProfile | null): string {
  const recipientFirst = c.channelName.split(/[\s,|–-]/)[0]

  let contentRef = 'your content'
  if (c.videoTitles && c.videoTitles.length > 0) {
    contentRef = `"${c.videoTitles[0]}"`
  } else {
    const niche = c.description.replace(/\n/g, ' ').trim().slice(0, 120)
    const clean = niche.replace(/https?:\/\/\S+/g, '').trim()
    if (clean.length > 10) contentRef = `your ${clean.split(' ').slice(0, 5).join(' ')} content`
  }

  const senderFull = (profile?.fullName || '').trim()
  const senderFirst = senderFull.split(/\s+/)[0] || 'me'
  const pitch = (profile?.pitchLine || '').trim()
  const linkedin = (profile?.linkedinUrl || '').trim()

  const subject = `loved ${contentRef.startsWith('"') ? contentRef : 'your content'} — quick question`

  const lines: string[] = [
    `Hey ${recipientFirst},`,
    ``,
    `Came across your channel and watched ${contentRef} — good stuff.`,
    ``,
    senderFull
      ? `I'm ${senderFull}.${pitch ? ' ' + pitch : ''}`
      : pitch || `Quick reach-out from a fan of your work.`,
    ``,
    `Worth a quick chat to see if there's anything I could help with?`,
    ``,
  ]
  if (linkedin) {
    lines.push(`Feel free to connect on LinkedIn too: ${linkedin}`)
    lines.push(``)
  }
  lines.push(senderFirst)

  const body = lines.join('\n')
  return `mailto:${c.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
