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

// Niche → occupation buckets. Each niche fans out into a multi-keyword
// YouTube search (capped at 30 occupations server-side), so cast wide
// here. The point of clicking a niche is to find every kind of creator
// in that space, not just the ones already in ALL_OCCUPATIONS.
export const NICHE_BUCKETS: { id: string; label: string; emoji: string; occupations: string[] }[] = [
  {
    id: 'fitness_health',
    label: 'Fitness & Health',
    emoji: '💪',
    occupations: [
      'fitness coach', 'personal trainer', 'online fitness coach', 'fitness influencer',
      'yoga instructor', 'pilates instructor', 'CrossFit coach', 'powerlifting coach',
      'strength coach', 'bodybuilding coach', 'calisthenics coach', 'mobility coach',
      'boxing coach', 'martial arts instructor', 'jiu jitsu coach', 'MMA coach',
      'running coach', 'triathlon coach', 'marathon coach', 'cycling coach',
      'nutritionist', 'dietitian', 'wellness coach', 'health coach',
      'physical therapist', 'chiropractor', 'mental health coach', 'weight loss coach',
    ],
  },
  {
    id: 'finance_wealth',
    label: 'Finance & Wealth',
    emoji: '💰',
    occupations: [
      'financial advisor', 'financial planner', 'wealth manager', 'money coach',
      'financial educator', 'personal finance educator', 'FIRE blogger',
      'stock trader', 'day trader', 'options trader', 'value investor', 'dividend investor',
      'crypto trader', 'crypto educator', 'web3 founder', 'DeFi expert', 'NFT artist',
      'investment banker', 'hedge fund manager', 'portfolio manager',
      'accountant', 'CPA', 'tax advisor', 'tax preparer',
      'insurance agent', 'mortgage broker', 'real estate investor',
      'angel investor', 'venture capitalist', 'estate planner',
    ],
  },
  {
    id: 'real_estate',
    label: 'Real Estate',
    emoji: '🏡',
    occupations: [
      'real estate agent', 'real estate broker', 'real estate investor',
      'real estate coach', 'real estate educator', 'real estate developer',
      'commercial real estate agent', 'luxury real estate agent',
      'mortgage broker', 'mortgage lender', 'home loan officer',
      'property manager', 'house flipper', 'real estate wholesaler',
      'real estate photographer', 'real estate appraiser', 'home inspector',
      'real estate attorney', 'BiggerPockets investor', 'short term rental coach',
      'Airbnb host', 'syndication expert', 'real estate content creator',
    ],
  },
  {
    id: 'tech_startups',
    label: 'Tech & Startups',
    emoji: '💻',
    occupations: [
      'software engineer', 'full stack developer', 'frontend developer', 'backend developer',
      'mobile developer', 'iOS developer', 'Android developer',
      'devops engineer', 'data engineer', 'data scientist', 'machine learning engineer',
      'AI engineer', 'AI founder', 'AI researcher',
      'product manager', 'UX designer', 'UI designer', 'product designer',
      'startup founder', 'SaaS founder', 'indie hacker', 'solopreneur',
      'developer advocate', 'tech YouTuber', 'coding YouTuber', 'coding bootcamp instructor',
      'cybersecurity expert', 'ethical hacker', 'web3 founder', 'blockchain developer',
    ],
  },
  {
    id: 'coaching',
    label: 'Coaching & Self-Improvement',
    emoji: '🎯',
    occupations: [
      'life coach', 'business coach', 'executive coach', 'leadership coach',
      'career coach', 'sales coach', 'sales trainer', 'mindset coach',
      'productivity coach', 'time management coach', 'habit coach', 'performance coach',
      'mental performance coach', 'public speaking coach', 'communication coach',
      'negotiation coach', 'confidence coach', 'motivational speaker',
      'dating coach', 'relationship coach', 'marriage counselor',
      'mindfulness coach', 'meditation teacher', 'breathwork coach',
      'manifestation coach', 'spiritual coach', 'NLP practitioner',
      'transformational coach',
    ],
  },
  {
    id: 'sports',
    label: 'Sports',
    emoji: '🏀',
    occupations: [
      'basketball coach', 'basketball trainer', 'football coach', 'football trainer',
      'soccer coach', 'soccer trainer', 'baseball coach', 'baseball trainer',
      'hockey coach', 'volleyball coach', 'rugby coach', 'lacrosse coach',
      'cricket coach', 'golf instructor', 'tennis coach', 'swimming coach',
      'sports agent', 'athletic recruiter', 'college recruiting coach',
      'sports analyst', 'sports commentator', 'sports content creator',
      'sports broadcaster', 'sports nutritionist', 'sports performance coach',
      'sports psychologist', 'NIL specialist',
    ],
  },
  {
    id: 'creative_media',
    label: 'Creative & Media',
    emoji: '🎬',
    occupations: [
      'photographer', 'wedding photographer', 'portrait photographer',
      'commercial photographer', 'videographer', 'cinematographer', 'filmmaker',
      'film director', 'film producer', 'video editor', 'motion designer',
      'graphic designer', 'brand designer', 'logo designer', 'illustrator',
      'music producer', 'audio engineer', 'sound designer',
      'podcast host', 'podcast producer', 'voiceover artist',
      'content creator', 'influencer', 'YouTuber', 'TikToker',
      'social media manager', 'brand strategist', 'PR consultant',
      'copywriter', 'marketing consultant', 'SEO expert',
    ],
  },
  {
    id: 'legal',
    label: 'Legal',
    emoji: '⚖️',
    occupations: [
      'lawyer', 'attorney', 'divorce lawyer', 'family lawyer',
      'immigration attorney', 'criminal defense lawyer', 'personal injury lawyer',
      'corporate lawyer', 'business lawyer', 'real estate attorney',
      'estate planning attorney', 'tax lawyer', 'employment lawyer',
      'civil rights lawyer', 'intellectual property lawyer', 'patent attorney',
      'contract lawyer', 'workers compensation lawyer', 'bankruptcy lawyer',
      'DUI lawyer', 'paralegal', 'legal consultant', 'legal recruiter',
      'law professor', 'legal content creator', 'legal educator',
    ],
  },
  {
    id: 'education',
    label: 'Education',
    emoji: '🎓',
    occupations: [
      'teacher', 'online teacher', 'professor', 'tutor', 'online tutor',
      'math tutor', 'English tutor', 'language teacher', 'ESL teacher',
      'language coach', 'polyglot', 'science teacher', 'biology teacher',
      'chemistry teacher', 'physics teacher', 'history teacher',
      'computer science teacher', 'coding instructor', 'programming teacher',
      'SAT prep tutor', 'ACT prep tutor', 'GRE prep tutor', 'GMAT prep tutor',
      'LSAT prep tutor', 'MCAT prep tutor', 'test prep coach',
      'college admissions consultant', 'homeschool educator',
      'curriculum designer', 'edtech founder', 'study skills coach',
    ],
  },
  {
    id: 'food',
    label: 'Food & Hospitality',
    emoji: '🍽️',
    occupations: [
      'chef', 'executive chef', 'pastry chef', 'sushi chef',
      'baker', 'sourdough baker', 'pastry baker',
      'restaurant owner', 'restaurateur', 'food entrepreneur',
      'food blogger', 'food YouTuber', 'recipe developer', 'cookbook author',
      'food photographer', 'food stylist', 'food critic',
      'sommelier', 'wine expert', 'mixologist', 'bartender',
      'barista', 'coffee roaster', 'meal prep coach', 'nutrition chef',
      'plant based chef', 'vegan chef', 'keto chef',
      'cooking show host', 'culinary instructor', 'food influencer',
    ],
  },
  {
    id: 'home_building',
    label: 'Home & Building',
    emoji: '🛠️',
    occupations: [
      'interior designer', 'home designer', 'kitchen designer',
      'architect', 'residential architect', 'landscape architect',
      'contractor', 'general contractor', 'home builder', 'remodeler',
      'electrician', 'plumber', 'HVAC technician', 'carpenter', 'woodworker',
      'painter', 'roofer', 'flooring installer', 'tiler', 'mason', 'handyman',
      'home renovator', 'DIY YouTuber', 'home improvement expert',
      'home stager', 'professional organizer', 'smart home expert',
      'garden designer', 'landscape designer', 'urban farmer',
    ],
  },
  {
    id: 'travel',
    label: 'Travel & Lifestyle',
    emoji: '✈️',
    occupations: [
      'travel blogger', 'travel YouTuber', 'travel influencer', 'travel vlogger',
      'travel photographer', 'travel writer', 'travel agent', 'travel consultant',
      'travel planner', 'tour guide', 'tour operator', 'expedition leader',
      'adventure photographer', 'adventure traveler', 'digital nomad', 'expat',
      'slow traveler', 'luxury travel expert', 'budget travel expert',
      'family travel blogger', 'solo travel blogger', 'RV traveler',
      'van life YouTuber', 'travel hacker', 'points and miles expert',
      'hotel reviewer', 'cruise expert', 'backpacker', 'world traveler',
    ],
  },
  {
    id: 'hr_recruiting',
    label: 'HR & Recruiting',
    emoji: '🧑‍💼',
    occupations: [
      'HR consultant', 'HR director', 'HR business partner', 'HR manager',
      'talent acquisition specialist', 'talent acquisition manager',
      'recruiter', 'executive recruiter', 'technical recruiter', 'headhunter',
      'sourcer', 'recruiting coach', 'career coach', 'resume writer',
      'interview coach', 'LinkedIn coach', 'personal branding coach',
      'people operations', 'employee experience manager', 'DEI consultant',
      'compensation specialist', 'benefits specialist',
      'training and development manager', 'learning and development specialist',
      'organizational development consultant',
    ],
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

/**
 * Substitute {name} / {channel} / {content} placeholders in a
 * user-provided subject template. Case-insensitive; missing values
 * collapse to empty string so the template doesn't show literal
 * "{name}" if the parser couldn't pick out a recipient first name.
 *
 * Trailing whitespace / dangling separators that result from empty
 * substitutions are cleaned up so a template like "hey {name}, quick
 * question" with no name gracefully becomes "hey, quick question".
 */
export function applySubjectPlaceholders(
  template: string,
  ctx: { name?: string; channel?: string; content?: string },
): string {
  let out = template
    .replace(/\{name\}/gi, ctx.name || '')
    .replace(/\{channel\}/gi, ctx.channel || '')
    .replace(/\{content\}/gi, ctx.content || '')
  // Collapse multi-space, trim leading punctuation/space artifacts
  // that empty substitutions can leave behind.
  out = out.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim()
  // If the template was just placeholder + punctuation and everything
  // collapsed away, fall back gracefully — caller treats empty as
  // "no template, use default."
  return out
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

  // Subject — user template wins if set, with placeholder substitution.
  // Empty/whitespace-only template falls back to the default phrasing
  // so existing users see no behavior change until they set a template.
  const subjectTemplate = (profile?.subjectTemplate || '').trim()
  const userSubject = subjectTemplate
    ? applySubjectPlaceholders(subjectTemplate, {
        name: recipientFirst,
        channel: c.channelName,
        content: contentRef.replace(/^"|"$/g, ''),
      })
    : ''
  const subject = userSubject ||
    `loved ${contentRef.startsWith('"') ? contentRef : 'your content'} — quick question`

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
  return composeUrl(profile?.mailClient ?? 'default', c.email, subject, body)
}

// Builds a compose URL for whichever mail client the user picked. Each
// provider has its own web-compose endpoint that pre-fills to/subject/
// body — except Apple-style mailto: which opens the OS default.
export function composeUrl(client: 'default' | 'gmail' | 'outlook' | 'yahoo', to: string, subject: string, body: string): string {
  const t = encodeURIComponent(to)
  const s = encodeURIComponent(subject)
  const b = encodeURIComponent(body)
  switch (client) {
    case 'gmail':
      // Gmail web compose. fs=1 forces a fresh compose window even if
      // the user has multiple Gmail accounts logged in.
      return `https://mail.google.com/mail/?view=cm&fs=1&to=${t}&su=${s}&body=${b}`
    case 'outlook':
      return `https://outlook.office.com/mail/deeplink/compose?to=${t}&subject=${s}&body=${b}`
    case 'yahoo':
      return `https://compose.mail.yahoo.com/?to=${t}&subject=${s}&body=${b}`
    default:
      return `mailto:${to}?subject=${s}&body=${b}`
  }
}
