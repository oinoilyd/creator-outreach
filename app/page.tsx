'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'

interface Creator {
  channelId: string
  channelName: string
  channelUrl: string
  avgViews: number
  subscribers: string
  email: string
  website: string
  linkedin: string
  twitter: string
  instagram: string
  tiktok: string
  company: string
  matchedVia: string
  videoTitles: string[]
  videoDates: string[]
  description: string
  enriching?: boolean
}

type SortCol = 'channelName' | 'avgViews' | 'subscribers' | 'lastPosted' | 'email' | 'website' | 'linkedin' | 'instagram' | 'twitter' | 'tiktok' | 'fitScore'
type SortDir = 'asc' | 'desc'
type ColId = 'avgViews' | 'subscribers' | 'lastPosted' | 'email' | 'linkedin' | 'website' | 'instagram' | 'twitter' | 'tiktok' | 'fitScore'
type ActiveTab = 'results' | 'favorites' | 'outreach'

interface OutreachEntry {
  id: string
  channelId: string
  channelName: string
  channelUrl: string
  description: string
  email: string
  product: string
  reachedOut: boolean
  medium: 'Email' | 'LinkedIn' | 'Other' | ''
  mediumOther: string
  headerUsed: string
  status: 'Open' | 'Rejected' | 'Successful' | 'No Response' | ''
  addedAt: number
  // optional fields
  notes: string
  followUpDate: string
  dateReachedOut: string
  touchpoints: string
  responseDate: string
  subscribers: string
  avgViews: number
  fitScore: number
  linkedin: string
  contentNiche: string
  phone: string
  dealValue: string
  contractSent: boolean
  meetingScheduled: string
}

interface OutreachColDef {
  id: keyof OutreachEntry
  label: string
  defaultVisible: boolean
  defaultWidth: number
}

interface OutreachColConfig extends OutreachColDef {
  visible: boolean
  width: number
}

const ALL_OUTREACH_COLS: OutreachColDef[] = [
  { id: 'channelName',     label: 'Channel',           defaultVisible: true,  defaultWidth: 160 },
  { id: 'channelUrl',      label: 'YT',                defaultVisible: true,  defaultWidth: 42  },
  { id: 'email',           label: 'Email',             defaultVisible: true,  defaultWidth: 190 },
  { id: 'description',     label: 'Description',       defaultVisible: true,  defaultWidth: 230 },
  { id: 'product',         label: 'Product',           defaultVisible: true,  defaultWidth: 160 },
  { id: 'reachedOut',      label: 'Reached Out',       defaultVisible: true,  defaultWidth: 96  },
  { id: 'medium',          label: 'Medium',            defaultVisible: true,  defaultWidth: 170 },
  { id: 'headerUsed',      label: 'Subject Line',      defaultVisible: true,  defaultWidth: 210 },
  { id: 'status',          label: 'Status',            defaultVisible: true,  defaultWidth: 130 },
  { id: 'notes',           label: 'Notes',             defaultVisible: false, defaultWidth: 220 },
  { id: 'followUpDate',    label: 'Follow Up Date',    defaultVisible: false, defaultWidth: 140 },
  { id: 'dateReachedOut',  label: 'Date Reached Out',  defaultVisible: false, defaultWidth: 145 },
  { id: 'touchpoints',     label: '# Touchpoints',     defaultVisible: false, defaultWidth: 110 },
  { id: 'responseDate',    label: 'Response Date',     defaultVisible: false, defaultWidth: 140 },
  { id: 'subscribers',     label: 'Subscribers',       defaultVisible: false, defaultWidth: 110 },
  { id: 'avgViews',        label: 'Avg Views',         defaultVisible: false, defaultWidth: 110 },
  { id: 'fitScore',        label: 'Fit Score',         defaultVisible: false, defaultWidth: 100 },
  { id: 'linkedin',        label: 'LinkedIn',          defaultVisible: false, defaultWidth: 100 },
  { id: 'contentNiche',    label: 'Content Niche',     defaultVisible: false, defaultWidth: 130 },
  { id: 'phone',           label: 'Phone',             defaultVisible: false, defaultWidth: 130 },
  { id: 'dealValue',       label: 'Deal Value',        defaultVisible: false, defaultWidth: 110 },
  { id: 'contractSent',    label: 'Contract Sent',     defaultVisible: false, defaultWidth: 110 },
  { id: 'meetingScheduled',label: 'Meeting Scheduled', defaultVisible: false, defaultWidth: 150 },
]

const DEFAULT_OUTREACH_COLS: OutreachColConfig[] = ALL_OUTREACH_COLS.map(c => ({ ...c, visible: c.defaultVisible, width: c.defaultWidth }))

interface ColConfig {
  id: ColId
  label: string
  visible: boolean
}

const DEFAULT_COLS: ColConfig[] = [
  { id: 'fitScore',    label: 'Fit Score',   visible: true  },
  { id: 'avgViews',    label: 'Avg Views',   visible: true  },
  { id: 'subscribers', label: 'Subscribers', visible: true  },
  { id: 'lastPosted',  label: 'Last Posted', visible: true  },
  { id: 'email',       label: 'Email',       visible: true  },
  { id: 'linkedin',    label: 'LinkedIn',    visible: true  },
  { id: 'website',     label: 'Website',     visible: false },
  { id: 'instagram',   label: 'Instagram',   visible: false },
  { id: 'twitter',     label: 'Twitter/X',   visible: false },
  { id: 'tiktok',      label: 'TikTok',      visible: false },
]

const COL_SORT: Partial<Record<ColId, SortCol>> = {
  fitScore: 'fitScore', avgViews: 'avgViews', subscribers: 'subscribers', lastPosted: 'lastPosted',
  email: 'email', linkedin: 'linkedin', website: 'website',
  instagram: 'instagram', twitter: 'twitter', tiktok: 'tiktok',
}

function computeFitScore(c: Creator): number {
  let score = 0

  // Recency (30 pts)
  const days = parseRelativeDays(c.videoDates?.[0] || '')
  if (days === Infinity) score += 10
  else if (days <= 7)   score += 30
  else if (days <= 30)  score += 22
  else if (days <= 60)  score += 14
  else if (days <= 90)  score += 7

  // View range sweet spot (25 pts)
  const v = c.avgViews
  if      (v >= 10000  && v < 50000)  score += 25
  else if (v >= 1000   && v < 10000)  score += 20
  else if (v >= 50000  && v < 100000) score += 18
  else if (v >= 100000 && v < 500000) score += 10
  else if (v >= 500000)               score += 3
  else if (v > 0)                     score += 5

  // Reachability (20 pts)
  if (c.email)    score += 15
  if (c.linkedin) score += 5

  // Keyword relevance (15 pts) — matchedVia set by search route
  if (c.matchedVia === 'name') score += 10
  else                         score += 2
  if (c.videoTitles?.length > 0) score += 5

  // Audience quality: views-to-subscriber ratio (10 pts)
  const subs = Number(c.subscribers)
  if (subs > 0 && !isNaN(subs)) {
    const ratio = c.avgViews / subs
    if      (ratio >= 0.10) score += 10
    else if (ratio >= 0.05) score += 7
    else if (ratio >= 0.02) score += 4
    else                    score += 1
  } else {
    score += 5
  }

  // Large team penalty — 750k+ subs means established operation, unlikely to need help
  if (subs >= 750000) score -= 20
  else if (subs >= 500000) score -= 10

  return Math.min(100, Math.max(0, score))
}

function fitScoreMeta(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'Strong Fit',   color: 'text-green-400' }
  if (score >= 50) return { label: 'Possible Fit', color: 'text-yellow-400' }
  if (score >= 25) return { label: 'Weak Fit',     color: 'text-orange-400' }
  return              { label: 'Poor Fit',      color: 'text-red-400' }
}

function renderCell(id: ColId, c: Creator): React.ReactNode {
  switch (id) {
    case 'fitScore': {
      const score = computeFitScore(c)
      const { label, color } = fitScoreMeta(score)
      return (
        <td key={id} className="px-4 py-3 whitespace-nowrap">
          <span className={`font-bold ${color}`}>{score}</span>
          <span className={`ml-1.5 text-xs ${color} opacity-70`}>{label}</span>
        </td>
      )
    }
    case 'avgViews':    return <td key={id} className="px-4 py-3">{c.avgViews.toLocaleString()}</td>
    case 'subscribers': return <td key={id} className="px-4 py-3 text-gray-300">{formatSubscribers(c.subscribers)}</td>
    case 'lastPosted':  return (
      <td key={id} className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
        {c.videoDates?.[0] ? <><div>{c.videoDates[0]}</div>{c.videoDates[1] && <div className="text-gray-600">{c.videoDates[1]}</div>}</> : <span className="text-gray-700">—</span>}
      </td>
    )
    case 'email': return (
      <td key={id} className="px-4 py-3 text-xs">
        {c.email ? <a href={buildOutreachEmail(c)} className="text-green-400 hover:underline">{c.email}</a>
          : c.enriching ? <span className="flex items-center gap-1 text-gray-500"><Spinner />looking...</span> : '—'}
      </td>
    )
    case 'linkedin':  return <td key={id} className="px-4 py-3">{c.linkedin  ? <a href={c.linkedin}  target="_blank" className="text-blue-400 hover:underline">link</a> : '—'}</td>
    case 'website':   return <td key={id} className="px-4 py-3">{c.website   ? <a href={c.website}   target="_blank" className="text-blue-400 hover:underline">link</a> : '—'}</td>
    case 'instagram': return <td key={id} className="px-4 py-3">{c.instagram ? <a href={c.instagram} target="_blank" className="text-blue-400 hover:underline">link</a> : '—'}</td>
    case 'twitter':   return <td key={id} className="px-4 py-3">{c.twitter   ? <a href={c.twitter}   target="_blank" className="text-blue-400 hover:underline">link</a> : '—'}</td>
    case 'tiktok':    return <td key={id} className="px-4 py-3">{c.tiktok    ? <a href={c.tiktok}    target="_blank" className="text-blue-400 hover:underline">link</a> : '—'}</td>
  }
}

const ALL_OCCUPATIONS = [
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

const VIEW_PRESETS = [
  { label: '0 – 10K', min: 0, max: 10000 },
  { label: '10K – 50K', min: 10000, max: 50000 },
  { label: '50K – 200K', min: 50000, max: 200000 },
  { label: '0 – 200K', min: 0, max: 200000 },
  { label: '0 – 500K', min: 0, max: 500000 },
]

function pickRandom(arr: string[], n: number): string[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n)
}

function formatSubscribers(s: string): string {
  if (!s) return '—'
  const n = Number(s)
  if (isNaN(n)) return s  // already a formatted string, show as-is
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return n.toLocaleString()
}

function parseRelativeDays(text: string): number {
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

function buildOutreachEmail(c: Creator): string {
  const firstName = c.channelName.split(/[\s,|–-]/)[0]

  // Build a content reference from video titles first, fall back to description
  let contentRef = 'your content'
  if (c.videoTitles && c.videoTitles.length > 0) {
    contentRef = `"${c.videoTitles[0]}"`
  } else {
    const niche = c.description.replace(/\n/g, ' ').trim().slice(0, 120)
    const clean = niche.replace(/https?:\/\/\S+/g, '').trim()
    if (clean.length > 10) contentRef = `your ${clean.split(' ').slice(0, 5).join(' ')} content`
  }

  const subject = `loved ${contentRef.startsWith('"') ? contentRef : 'your content'} — quick question`
  const body = `Hey ${firstName},

Came across your channel and watched ${contentRef} — good stuff.

I'm Ryan Gaynor. I work with YouTube creators on the full picture — editing, growth strategy, content direction. Basically helping people like you get more out of what you're already putting out.

Worth a quick chat to see if there's anything I could help with?

Feel free to connect on LinkedIn too: https://www.linkedin.com/in/ryan-gaynor-6bb934318/

Ryan`
  return `mailto:${c.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

// priority: email=3, linkedin only=2, enriching=1, nothing=0
function contactPriority(c: Creator): number {
  if (c.email) return 3
  if (c.linkedin) return 2
  if (c.enriching) return 1
  return 0
}

function sortCreators(list: Creator[], col: SortCol, dir: SortDir): Creator[] {
  return [...list].sort((a, b) => {
    if (col === 'email') {
      const pri = contactPriority(b) - contactPriority(a)
      if (pri !== 0) return pri
      return a.channelName.localeCompare(b.channelName)
    }
    let cmp = 0
    if (col === 'fitScore') cmp = computeFitScore(a) - computeFitScore(b)
    else if (col === 'avgViews') cmp = a.avgViews - b.avgViews
    else if (col === 'channelName') cmp = a.channelName.localeCompare(b.channelName)
    else if (col === 'subscribers') cmp = (Number(a.subscribers) || 0) - (Number(b.subscribers) || 0)
    else if (col === 'lastPosted') {
      const da = parseRelativeDays(a.videoDates?.[0] || '')
      const db = parseRelativeDays(b.videoDates?.[0] || '')
      // push missing dates to bottom regardless of sort direction
      if (da === Infinity && db === Infinity) cmp = 0
      else if (da === Infinity) return 1
      else if (db === Infinity) return -1
      else cmp = da - db
    }
    else if (col === 'website') cmp = (b.website ? 1 : 0) - (a.website ? 1 : 0)
    else if (col === 'linkedin') {
      const pri = contactPriority(b) - contactPriority(a)
      if (pri !== 0) return pri
      return a.channelName.localeCompare(b.channelName)
    }
    else if (col === 'instagram') cmp = (b.instagram ? 1 : 0) - (a.instagram ? 1 : 0)
    else if (col === 'twitter') cmp = (b.twitter ? 1 : 0) - (a.twitter ? 1 : 0)
    else if (col === 'tiktok') cmp = (b.tiktok ? 1 : 0) - (a.tiktok ? 1 : 0)
    return dir === 'asc' ? cmp : -cmp
  })
}

function PlusCircleIcon({ added }: { added: boolean }) {
  return added ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v8M8 12h8" />
    </svg>
  )
}

function AutoTextarea({ value, onChange, placeholder, className }: {
  value: string, onChange: (v: string) => void, placeholder?: string, className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function resize() {
    if (!ref.current) return
    ref.current.style.height = 'auto'
    ref.current.style.height = ref.current.scrollHeight + 'px'
  }

  useEffect(() => { resize() }, [value])

  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(() => resize())
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={ev => onChange(ev.target.value)}
      placeholder={placeholder}
      className={`resize-none overflow-hidden w-full bg-transparent focus:outline-none focus:bg-gray-800 rounded px-1 text-xs leading-snug ${className ?? ''}`}
      style={{ minHeight: '22px' }}
    />
  )
}

function renderOutreachCell(col: OutreachColConfig, e: OutreachEntry, onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void): React.ReactNode {
  const id = col.id
  switch (id) {
    case 'channelName':
      return <AutoTextarea value={e.channelName} onChange={v => onUpdate(e.id, 'channelName', v)} className="text-blue-400 font-medium" />
    case 'channelUrl':
      return (
        <a href={e.channelUrl} target="_blank" className="mt-0.5 block">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-red-500">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 3.993L9 16z"/>
          </svg>
        </a>
      )
    case 'email':
      return (
        <div className="flex flex-col gap-1">
          {e.email && <a href={buildOutreachEmail({ channelName: e.channelName, email: e.email, videoTitles: [], description: e.description } as unknown as Creator)} className="text-green-400 hover:underline text-xs break-all">{e.email}</a>}
          <AutoTextarea value={e.email} onChange={v => onUpdate(e.id, 'email', v)} placeholder="Add email..." className={e.email ? 'text-gray-600' : 'text-gray-400'} />
        </div>
      )
    case 'description':
      return <AutoTextarea value={e.description} onChange={v => onUpdate(e.id, 'description', v)} placeholder="—" className="text-gray-400" />
    case 'product':
      return <AutoTextarea value={e.product} onChange={v => onUpdate(e.id, 'product', v)} placeholder="Add product..." className="text-gray-200" />
    case 'reachedOut':
      return <input type="checkbox" checked={e.reachedOut} onChange={ev => onUpdate(e.id, 'reachedOut', ev.target.checked)} className="w-4 h-4 rounded accent-purple-500 cursor-pointer mt-0.5" />
    case 'medium':
      return (
        <div className="flex flex-col gap-1">
          <select value={e.medium} onChange={ev => onUpdate(e.id, 'medium', ev.target.value)} className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500 w-full">
            <option value="">—</option>
            <option value="Email">Email</option>
            <option value="LinkedIn">LinkedIn</option>
            <option value="Other">Other</option>
          </select>
          {e.medium === 'Other' && <AutoTextarea value={e.mediumOther} onChange={v => onUpdate(e.id, 'mediumOther', v)} placeholder="specify..." className="text-gray-200" />}
        </div>
      )
    case 'headerUsed':
      return <AutoTextarea value={e.headerUsed} onChange={v => onUpdate(e.id, 'headerUsed', v)} placeholder="Subject line used..." className="text-gray-200" />
    case 'status':
      return (
        <select value={e.status} onChange={ev => onUpdate(e.id, 'status', ev.target.value)}
          className={`w-full rounded px-2 py-0.5 text-xs focus:outline-none border ${e.status === 'Successful' ? 'bg-green-900 border-green-700 text-green-300' : e.status === 'Open' ? 'bg-blue-900 border-blue-700 text-blue-300' : e.status === 'Rejected' ? 'bg-red-900 border-red-700 text-red-300' : e.status === 'No Response' ? 'bg-gray-800 border-gray-600 text-gray-400' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
          <option value="">—</option>
          <option value="Open">Open</option>
          <option value="No Response">No Response</option>
          <option value="Successful">Successful</option>
          <option value="Rejected">Rejected</option>
        </select>
      )
    case 'notes':
      return <AutoTextarea value={e.notes || ''} onChange={v => onUpdate(e.id, 'notes', v)} placeholder="Notes..." className="text-gray-300" />
    case 'followUpDate':
    case 'dateReachedOut':
    case 'responseDate':
    case 'meetingScheduled':
      return <input type="date" value={(e[id] as string) || ''} onChange={ev => onUpdate(e.id, id, ev.target.value)} className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500 w-full" />
    case 'touchpoints':
      return <input type="number" min={0} value={e.touchpoints || ''} onChange={ev => onUpdate(e.id, 'touchpoints', ev.target.value)} placeholder="0" className="w-full bg-transparent text-gray-200 focus:outline-none focus:bg-gray-800 rounded px-1 text-xs" />
    case 'subscribers':
      return <span className="text-xs text-gray-400">{formatSubscribers(e.subscribers || '')}</span>
    case 'avgViews':
      return <span className="text-xs text-gray-400">{e.avgViews ? e.avgViews.toLocaleString() : '—'}</span>
    case 'fitScore': {
      const { label, color } = fitScoreMeta(e.fitScore || 0)
      return <span className={`text-xs font-bold ${color}`}>{e.fitScore || 0} <span className="font-normal opacity-70">{label}</span></span>
    }
    case 'linkedin':
      return e.linkedin ? <a href={e.linkedin} target="_blank" className="text-blue-400 hover:underline text-xs">link</a> : <AutoTextarea value={e.linkedin || ''} onChange={v => onUpdate(e.id, 'linkedin', v)} placeholder="Add URL..." className="text-gray-400" />
    case 'contentNiche':
      return <AutoTextarea value={e.contentNiche || ''} onChange={v => onUpdate(e.id, 'contentNiche', v)} placeholder="e.g. golf, finance..." className="text-gray-200" />
    case 'phone':
      return <AutoTextarea value={e.phone || ''} onChange={v => onUpdate(e.id, 'phone', v)} placeholder="Add phone..." className="text-gray-200" />
    case 'dealValue':
      return <AutoTextarea value={e.dealValue || ''} onChange={v => onUpdate(e.id, 'dealValue', v)} placeholder="$..." className="text-gray-200" />
    case 'contractSent':
      return <input type="checkbox" checked={!!e.contractSent} onChange={ev => onUpdate(e.id, 'contractSent', ev.target.checked)} className="w-4 h-4 rounded accent-blue-500 cursor-pointer mt-0.5" />
    default:
      return null
  }
}

function OutreachTab({ entries, colConfig, onUpdate, onRemove, onOpenCustomize }: {
  entries: OutreachEntry[]
  colConfig: OutreachColConfig[]
  onUpdate: (id: string, field: keyof OutreachEntry, value: any) => void
  onRemove: (id: string) => void
  onOpenCustomize: () => void
}) {
  const visibleCols = colConfig.filter(c => c.visible)
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(colConfig.map(c => [c.id, c.width]))
  )
  // sync widths when colConfig changes (new cols added)
  useEffect(() => {
    setWidths(prev => {
      const next = { ...prev }
      colConfig.forEach(c => { if (!(c.id in next)) next[c.id as string] = c.width })
      return next
    })
  }, [colConfig])

  const resizing = useRef<{ id: string; startX: number; startW: number } | null>(null)

  function startResize(e: React.MouseEvent, colId: string) {
    e.preventDefault()
    resizing.current = { id: colId, startX: e.clientX, startW: widths[colId] ?? 120 }
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return
      const { id, startX, startW } = resizing.current
      setWidths(prev => ({ ...prev, [id]: Math.max(40, startW + ev.clientX - startX) }))
    }
    const onUp = () => { resizing.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const totalWidth = visibleCols.reduce((sum, c) => sum + (widths[c.id as string] ?? c.defaultWidth), 0) + 36

  if (entries.length === 0) {
    return (
      <div className="mt-4">
        <div className="flex justify-end mb-3">
          <button onClick={onOpenCustomize} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded px-3 py-1.5 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Customize Columns
          </button>
        </div>
        <p className="text-gray-500 text-sm">No outreach entries yet — click the <span className="text-purple-400">+</span> icon on any creator to add them.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={onOpenCustomize} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded px-3 py-1.5 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Customize Columns
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="table-fixed text-sm border-collapse" style={{ width: totalWidth }}>
          <thead className="bg-gray-800 text-gray-300">
            <tr>
              {visibleCols.map(col => (
                <th key={col.id as string} style={{ width: widths[col.id as string] ?? col.defaultWidth }} className="relative text-left px-3 py-3 select-none font-medium">
                  <span className="truncate block">{col.label}</span>
                  <div onMouseDown={e => startResize(e, col.id as string)} className="absolute right-0 top-0 h-full w-2 cursor-col-resize group flex items-center justify-center">
                    <div className="w-px h-4 bg-gray-600 group-hover:bg-blue-400 transition-colors" />
                  </div>
                </th>
              ))}
              <th style={{ width: 36 }} className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.id} className={i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-950'}>
                {visibleCols.map(col => (
                  <td key={col.id as string} className="px-3 py-2 align-top" style={{ width: widths[col.id as string] ?? col.defaultWidth }}>
                    {renderOutreachCell(col, e, onUpdate)}
                  </td>
                ))}
                <td className="px-3 py-2 align-top" style={{ width: 36 }}>
                  <button onClick={() => onRemove(e.id)} className="text-gray-700 hover:text-red-400 transition-colors"><TrashIcon /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}

function SortIndicator({ col, sortCol, sortDir }: { col: SortCol, sortCol: SortCol, sortDir: SortDir }) {
  if (col !== sortCol) return <span className="ml-1 text-gray-600">↕</span>
  return <span className="ml-1 text-blue-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

function CreatorTable({ creators, favorites, outreachIds, onToggleFavorite, onRemoveFavorite, onAddToOutreach, isFavTab, loading, sortCol, sortDir, onSort, colConfig }: {
  creators: Creator[], favorites: Set<string>, outreachIds: Set<string>
  onToggleFavorite: (c: Creator) => void
  onRemoveFavorite?: (id: string) => void
  onAddToOutreach: (c: Creator) => void
  isFavTab: boolean, loading?: boolean
  sortCol: SortCol, sortDir: SortDir, onSort: (col: SortCol) => void
  colConfig: ColConfig[]
}) {
  const sorted = useMemo(() => sortCreators(creators, sortCol, sortDir), [creators, sortCol, sortDir])
  const visibleCols = colConfig.filter(c => c.visible)

  if (sorted.length === 0 && !loading) {
    return <p className="text-gray-500 text-sm mt-4">{isFavTab ? 'No favorites yet — star creators from the Results tab.' : ''}</p>
  }

  const Th = ({ col, label }: { col: SortCol, label: string }) => (
    <th className="text-left px-4 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap" onClick={() => onSort(col)}>
      {label}<SortIndicator col={col} sortCol={sortCol} sortDir={sortDir} />
    </th>
  )

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-800 text-gray-300">
          <tr>
            <th className="px-4 py-3 w-8"></th>
            <th className="px-4 py-3 w-8"></th>
            <Th col="channelName" label="Channel" />
            {visibleCols.map(col => {
              const sc = COL_SORT[col.id]
              return sc
                ? <Th key={col.id} col={sc} label={col.label} />
                : <th key={col.id} className="text-left px-4 py-3 whitespace-nowrap">{col.label}</th>
            })}
            {isFavTab && <th className="px-4 py-3 w-8"></th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((c, i) => (
            <tr key={c.channelId} className={i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-950'}>
              <td className="px-4 py-3">
                <button onClick={() => onToggleFavorite(c)} className={`transition-colors ${favorites.has(c.channelId) ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-400'}`}>
                  <StarIcon filled={favorites.has(c.channelId)} />
                </button>
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => onAddToOutreach(c)}
                  title={outreachIds.has(c.channelId) ? 'Remove from Outreach' : 'Add to Outreach'}
                  className={`transition-colors ${outreachIds.has(c.channelId) ? 'text-purple-400' : 'text-gray-600 hover:text-purple-400'}`}
                >
                  <PlusCircleIcon added={outreachIds.has(c.channelId)} />
                </button>
              </td>
              <td className="px-4 py-3"><a href={c.channelUrl} target="_blank" className="text-blue-400 hover:underline font-medium">{c.channelName}</a></td>
              {visibleCols.map(col => renderCell(col.id, c))}
              {isFavTab && (
                <td className="px-4 py-3">
                  <button onClick={() => onRemoveFavorite?.(c.channelId)} className="text-gray-600 hover:text-red-400 transition-colors"><TrashIcon /></button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Home() {
  const [keyword, setKeyword] = useState('')
  const maxResults = 100
  const [minViews, setMinViews] = useState(0)
  const [maxViews, setMaxViews] = useState(200000)
  const [maxAgeDays, setMaxAgeDays] = useState<number>(Infinity)
  const [showFilter, setShowFilter] = useState(false)
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(false)
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0 })
  const [elapsed, setElapsed] = useState(0)
  const [status, setStatus] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('fitScore')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [activeTab, setActiveTab] = useState<ActiveTab>('results')
  const [favorites, setFavorites] = useState<Creator[]>([])
  const [favIds, setFavIds] = useState<Set<string>>(new Set())
  const [outreach, setOutreach] = useState<OutreachEntry[]>([])
  const [outreachIds, setOutreachIds] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [emailOnly, setEmailOnly] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [colConfig, setColConfig] = useState<ColConfig[]>(DEFAULT_COLS)
  const [showCustomize, setShowCustomize] = useState(false)
  const [draftCols, setDraftCols] = useState<ColConfig[]>(DEFAULT_COLS)
  const [outreachColConfig, setOutreachColConfig] = useState<OutreachColConfig[]>(DEFAULT_OUTREACH_COLS)
  const [showOutreachCustomize, setShowOutreachCustomize] = useState(false)
  const [draftOutreachCols, setDraftOutreachCols] = useState<OutreachColConfig[]>(DEFAULT_OUTREACH_COLS)

  // search version ref — prevents stale searches from overwriting newer ones
  const searchVersion = useRef(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setSuggestions(pickRandom(ALL_OCCUPATIONS, 25))
    try {
      const stored = JSON.parse(localStorage.getItem('creator-favorites') || '[]')
      setFavorites(stored)
      setFavIds(new Set(stored.map((c: Creator) => c.channelId)))
    } catch { /* no stored favorites */ }
    try {
      const storedOutreach = JSON.parse(localStorage.getItem('creator-outreach') || '[]')
      setOutreach(storedOutreach)
      setOutreachIds(new Set(storedOutreach.map((e: OutreachEntry) => e.channelId)))
    } catch { /* no stored outreach */ }
    try {
      const storedOutreachCols = JSON.parse(localStorage.getItem('outreach-col-config') || 'null')
      if (storedOutreachCols) {
        // merge stored config with any new columns added since last save
        const merged = ALL_OUTREACH_COLS.map(def => {
          const stored = storedOutreachCols.find((s: OutreachColConfig) => s.id === def.id)
          return stored ? { ...def, visible: stored.visible, width: stored.width } : { ...def, visible: def.defaultVisible, width: def.defaultWidth }
        })
        setOutreachColConfig(merged)
        setDraftOutreachCols(merged)
      }
    } catch { /* no stored outreach cols */ }
  }, [])

  // elapsed timer while loading
  useEffect(() => {
    if (loading) {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [loading])

  function handleSort(col: SortCol) {
    if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  function saveFavorites(updated: Creator[]) {
    setFavorites(updated)
    setFavIds(new Set(updated.map(c => c.channelId)))
    localStorage.setItem('creator-favorites', JSON.stringify(updated))
  }

  function toggleFavorite(c: Creator) {
    if (favIds.has(c.channelId)) saveFavorites(favorites.filter(f => f.channelId !== c.channelId))
    else saveFavorites([...favorites, c])
  }

  function saveOutreach(updated: OutreachEntry[]) {
    setOutreach(updated)
    setOutreachIds(new Set(updated.map(e => e.channelId)))
    localStorage.setItem('creator-outreach', JSON.stringify(updated))
  }

  function addToOutreach(c: Creator) {
    if (outreachIds.has(c.channelId)) {
      removeOutreachEntry(outreach.find(e => e.channelId === c.channelId)?.id || '')
      return
    }
    const entry: OutreachEntry = {
      id: `${c.channelId}-${Date.now()}`,
      channelId: c.channelId,
      channelName: c.channelName,
      channelUrl: c.channelUrl,
      description: c.description || '',
      email: c.email || '',
      product: '',
      reachedOut: false,
      medium: '',
      mediumOther: '',
      headerUsed: '',
      status: '',
      addedAt: Date.now(),
      notes: '',
      followUpDate: '',
      dateReachedOut: '',
      touchpoints: '',
      responseDate: '',
      subscribers: c.subscribers || '',
      avgViews: c.avgViews || 0,
      fitScore: computeFitScore(c),
      linkedin: c.linkedin || '',
      contentNiche: '',
      phone: '',
      dealValue: '',
      contractSent: false,
      meetingScheduled: '',
    }
    saveOutreach([...outreach, entry])
  }

  function updateOutreachEntry(id: string, field: keyof OutreachEntry, value: any) {
    saveOutreach(outreach.map(e => e.id === id ? { ...e, [field]: value } : e))
  }

  function removeOutreachEntry(id: string) {
    saveOutreach(outreach.filter(e => e.id !== id))
  }

  function removeFavorite(id: string) {
    saveFavorites(favorites.filter(f => f.channelId !== id))
  }

  const runSearch = useCallback(async (kw: string) => {
    if (!kw.trim()) return
    const version = ++searchVersion.current
    setLoading(true)
    setCreators([])
    setEnrichProgress({ current: 0, total: 0 })
    setActiveTab('results')
    setStatus('Searching YouTube...')

    try {
      const res = await fetch(`/api/search?keyword=${encodeURIComponent(kw)}&maxResults=${maxResults}&minViews=${minViews}&maxViews=${maxViews}`)
      const data = await res.json()
      if (version !== searchVersion.current) return  // superseded by newer search
      if (data.error) { setStatus(`Error: ${data.error}`); return }

      const enriched = (data.channels as Creator[]).map(c => ({ ...c, enriching: true }))
      setCreators([...enriched])
      setEnrichProgress({ current: 0, total: enriched.length })
      setStatus(`Found ${enriched.length} creators. Enriching contact info...`)

      const BATCH = 10
      for (let i = 0; i < enriched.length; i += BATCH) {
        if (version !== searchVersion.current) return
        const batchIndices = Array.from({ length: Math.min(BATCH, enriched.length - i) }, (_, k) => i + k)
        await Promise.all(batchIndices.map(async (idx) => {
          const c = enriched[idx]
          try {
            const params = new URLSearchParams({
              name: c.channelName, channelId: c.channelId,
              website: c.website || '', instagram: c.instagram || '',
              tiktok: c.tiktok || '', description: c.description || '',
            })
            const r = await fetch(`/api/enrich?${params}`)
            const extra = await r.json()
            enriched[idx] = {
              ...c, enriching: false,
              email: c.email || extra.email || '',
              subscribers: c.subscribers || extra.subscribers || '',
              videoDates: (extra.videoDates?.length ? extra.videoDates : c.videoDates) || [],
              avgViews: (extra.avgViews != null && !isNaN(extra.avgViews)) ? extra.avgViews : c.avgViews,
              linkedin: c.linkedin || extra.linkedin || '',
              instagram: c.instagram || extra.instagram || '',
              twitter: c.twitter || extra.twitter || '',
              tiktok: c.tiktok || extra.tiktok || '',
              website: c.website || extra.website || '',
            }
          } catch {
            enriched[idx] = { ...c, enriching: false }
          }
        }))
        if (version === searchVersion.current) {
          setEnrichProgress({ current: Math.min(i + BATCH, enriched.length), total: enriched.length })
          setCreators([...enriched])
        }
      }
      if (version === searchVersion.current) setStatus(`Done — ${enriched.length} creators found.`)
    } catch (err: any) {
      if (version === searchVersion.current) setStatus(`Error: ${err.message}`)
    } finally {
      if (version === searchVersion.current) setLoading(false)
    }
  }, [minViews, maxViews, maxResults])

  async function handleSearch() { await runSearch(keyword) }

  async function handleExportExcel(list: Creator[]) {
    setShowExport(false)
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels: list }),
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = activeTab === 'favorites' ? 'favorites.xlsx' : 'creators.xlsx'
    a.click()
  }

  function handleExportCSV(list: Creator[]) {
    setShowExport(false)
    const headers = ['Channel Name', 'YouTube URL', 'Avg Views', 'Subscribers', 'Last Posted', 'Email', 'LinkedIn', 'Website', 'Instagram', 'Twitter/X', 'TikTok']
    const rows = list.map(c => [
      c.channelName, c.channelUrl, c.avgViews, formatSubscribers(c.subscribers),
      c.videoDates?.[0] || '', c.email, c.linkedin, c.website, c.instagram, c.twitter, c.tiktok,
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = activeTab === 'favorites' ? 'favorites.csv' : 'creators.csv'
    a.click()
  }

  async function handleExportOutreachExcel() {
    setShowExport(false)
    const res = await fetch('/api/export-outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: outreach }),
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'outreach.xlsx'
    a.click()
  }

  function handleExportOutreachCSV() {
    setShowExport(false)
    const headers = ['Channel Name', 'YT', 'Email', 'Description', 'Product', 'Reached Out', 'Medium', 'Subject Line', 'Status']
    const rows = outreach.map(e => [
      e.channelName, e.channelUrl, e.email, e.description, e.product,
      e.reachedOut ? 'Yes' : 'No',
      e.medium === 'Other' ? e.mediumOther : e.medium,
      e.headerUsed,
      e.status || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'outreach.csv'
    a.click()
  }

  const baseList = activeTab === 'favorites' ? favorites : creators
  const currentList = baseList
    .filter(c => c.avgViews >= minViews && c.avgViews <= maxViews)
    .filter(c => maxAgeDays === Infinity || parseRelativeDays(c.videoDates?.[0] || '') <= maxAgeDays)
    .filter(c => !emailOnly || !!c.email)
  const progressPct = enrichProgress.total > 0 ? Math.round((enrichProgress.current / enrichProgress.total) * 100) : 0

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className={activeTab === 'outreach' ? 'w-full px-2' : 'max-w-7xl mx-auto'}>
        <h1 className="text-3xl font-bold mb-2">Creator Outreach</h1>
        <p className="text-gray-400 mb-6">Find YouTube creators and their contact info</p>

        {/* Search bar */}
        <div className="flex gap-3 mb-2 flex-wrap">
          <input
            className="flex-1 min-w-64 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            placeholder="Search by topic or occupation (e.g. basketball, banking, fitness)"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          {/* Filter icon */}
          <button
            onClick={() => setShowFilter(v => !v)}
            title="View range filter"
            className={`px-3 py-2 rounded border transition-colors ${showFilter ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
          </button>
          <button onClick={handleSearch} disabled={loading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-2 rounded font-semibold">
            {loading ? 'Searching...' : 'Search'}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowExport(v => !v)}
              disabled={activeTab === 'outreach' ? outreach.length === 0 : currentList.length === 0}
              className="bg-green-700 hover:bg-green-600 disabled:opacity-30 disabled:cursor-not-allowed px-4 py-2 rounded font-semibold text-sm flex items-center gap-1.5"
            >
              Export
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showExport && (
              <div className="absolute right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded shadow-lg z-10">
                {activeTab === 'outreach' ? <>
                  <button onClick={handleExportOutreachExcel} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700 flex items-center gap-2">
                    📊 Excel (.xlsx)
                  </button>
                  <button onClick={handleExportOutreachCSV} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700 flex items-center gap-2">
                    📄 CSV (Google Sheets)
                  </button>
                </> : <>
                  <button onClick={() => handleExportExcel(currentList)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700 flex items-center gap-2">
                    📊 Excel (.xlsx)
                  </button>
                  <button onClick={() => handleExportCSV(currentList)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700 flex items-center gap-2">
                    📄 CSV (Google Sheets)
                  </button>
                </>}
              </div>
            )}
          </div>
        </div>

        {/* Filter panel — hidden by default */}
        {showFilter && (
          <div className="flex flex-col gap-3 mb-3 p-3 bg-gray-900 rounded-lg border border-gray-700">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-gray-400 w-20 shrink-0">Avg views:</span>
              <input type="number" min={0} value={minViews}
                onChange={e => setMinViews(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-28 bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Min" />
              <span className="text-gray-600 text-xs">to</span>
              <input type="number" min={0} value={maxViews}
                onChange={e => setMaxViews(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-28 bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Max" />
              <span className="text-gray-600 text-xs">|</span>
              {VIEW_PRESETS.map(p => (
                <button key={p.label} onClick={() => { setMinViews(p.min); setMaxViews(p.max) }}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${minViews === p.min && maxViews === p.max ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap border-t border-gray-800 pt-3">
              <span className="text-xs text-gray-400 w-20 shrink-0">Last posted:</span>
              {[
                { label: 'Last 7 days', days: 7 },
                { label: 'Last 30 days', days: 30 },
                { label: 'Last 90 days', days: 90 },
                { label: 'Last 6 months', days: 180 },
                { label: 'Any time', days: Infinity },
              ].map(p => (
                <button key={p.label} onClick={() => setMaxAgeDays(p.days)}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${maxAgeDays === p.days ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap border-t border-gray-800 pt-3">
              <span className="text-xs text-gray-400 w-20 shrink-0">Show only:</span>
              <button
                onClick={() => setEmailOnly(v => !v)}
                className={`text-xs px-3 py-1 rounded border transition-colors ${emailOnly ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'}`}
              >
                Has email
              </button>
            </div>
          </div>
        )}

        {/* Loading progress */}
        {loading && (
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-1.5">
              <Spinner />
              <span className="text-sm text-gray-300">
                {enrichProgress.total === 0
                  ? 'Searching YouTube...'
                  : `Enriching ${enrichProgress.current} / ${enrichProgress.total} creators`}
              </span>
              <span className="text-xs text-gray-500 ml-auto">{elapsed}s elapsed</span>
            </div>
            {enrichProgress.total > 0 && (
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}
          </div>
        )}

        {!loading && status && <p className="text-xs text-gray-500 mb-4">{status}</p>}

        {/* Suggestions bar */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setShowSuggestions(v => !v)} className="text-xs text-gray-500 hover:text-gray-300 uppercase tracking-wide flex items-center gap-1 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-3 h-3 transition-transform ${showSuggestions ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Suggested searches
            </button>
            {showSuggestions && (
              <button onClick={() => setSuggestions(pickRandom(ALL_OCCUPATIONS, 25))} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 border border-gray-700 rounded px-2 py-0.5 hover:border-gray-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            )}
          </div>
          {showSuggestions && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button key={s} onClick={() => { setKeyword(s); runSearch(s) }}
                  className="text-xs px-3 py-1.5 rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700 hover:border-gray-500 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs + Customize */}
        <div className="flex items-center mb-4 border-b border-gray-800">
          <div className="flex gap-1">
            <button onClick={() => setActiveTab('results')} className={`px-5 py-2 text-sm font-medium rounded-t transition-colors ${activeTab === 'results' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              Results {creators.length > 0 && <span className="ml-1 text-xs text-gray-400">({creators.length})</span>}
            </button>
            <button onClick={() => setActiveTab('favorites')} className={`px-5 py-2 text-sm font-medium rounded-t transition-colors ${activeTab === 'favorites' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              Favorites {favorites.length > 0 && <span className="ml-1 text-xs text-yellow-400">({favorites.length})</span>}
            </button>
            <button onClick={() => setActiveTab('outreach')} className={`px-5 py-2 text-sm font-medium rounded-t transition-colors ${activeTab === 'outreach' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              Outreach {outreach.length > 0 && <span className="ml-1 text-xs text-purple-400">({outreach.length})</span>}
            </button>
          </div>
          <button
            onClick={() => { setDraftCols(colConfig); setShowCustomize(true) }}
            className={`ml-auto flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded px-3 py-1.5 transition-colors mb-1 ${activeTab === 'outreach' ? 'invisible' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Customize
          </button>
        </div>

        {/* Customize drawer */}
        {showCustomize && (
          <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/50" onClick={() => setShowCustomize(false)} />
            <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col h-full">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                <h2 className="font-semibold text-white">Customize Columns</h2>
                <button onClick={() => setShowCustomize(false)} className="text-gray-400 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-500 px-5 pt-3 pb-1">Channel is always shown first.</p>
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
                {draftCols.map((col, idx) => (
                  <div key={col.id} className="flex items-center gap-3 py-2 px-3 rounded hover:bg-gray-800 group">
                    <input
                      type="checkbox" checked={col.visible}
                      onChange={() => setDraftCols(d => d.map((c, i) => i === idx ? { ...c, visible: !c.visible } : c))}
                      className="w-4 h-4 rounded accent-blue-500"
                    />
                    <span className="flex-1 text-sm text-gray-200">{col.label}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        disabled={idx === 0}
                        onClick={() => setDraftCols(d => { const n = [...d]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n })}
                        className="text-gray-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed px-1"
                      >↑</button>
                      <button
                        disabled={idx === draftCols.length - 1}
                        onClick={() => setDraftCols(d => { const n = [...d]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n })}
                        className="text-gray-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed px-1"
                      >↓</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-4 border-t border-gray-800 flex gap-3">
                <button
                  onClick={() => setDraftCols(DEFAULT_COLS)}
                  className="flex-1 px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded hover:border-gray-500 hover:text-white transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={() => { setColConfig(draftCols); setShowCustomize(false) }}
                  className="flex-1 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {showOutreachCustomize && (
          <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/50" onClick={() => setShowOutreachCustomize(false)} />
            <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col h-full">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                <h2 className="font-semibold text-white">Outreach Columns</h2>
                <button onClick={() => setShowOutreachCustomize(false)} className="text-gray-400 hover:text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <p className="text-xs text-gray-500 px-5 pt-3 pb-1">Toggle columns on/off and drag to reorder.</p>
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
                {draftOutreachCols.map((col, idx) => (
                  <div key={col.id as string} className="flex items-center gap-3 py-2 px-3 rounded hover:bg-gray-800 group">
                    <input type="checkbox" checked={col.visible}
                      onChange={() => setDraftOutreachCols(d => d.map((c, i) => i === idx ? { ...c, visible: !c.visible } : c))}
                      className="w-4 h-4 rounded accent-purple-500"
                    />
                    <span className="flex-1 text-sm text-gray-200">{col.label}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button disabled={idx === 0} onClick={() => setDraftOutreachCols(d => { const n = [...d]; [n[idx-1], n[idx]] = [n[idx], n[idx-1]]; return n })} className="text-gray-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed px-1">↑</button>
                      <button disabled={idx === draftOutreachCols.length - 1} onClick={() => setDraftOutreachCols(d => { const n = [...d]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; return n })} className="text-gray-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed px-1">↓</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-4 border-t border-gray-800 flex gap-3">
                <button onClick={() => setDraftOutreachCols(DEFAULT_OUTREACH_COLS)} className="flex-1 px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded hover:border-gray-500 hover:text-white transition-colors">Reset</button>
                <button onClick={() => {
                  setOutreachColConfig(draftOutreachCols)
                  localStorage.setItem('outreach-col-config', JSON.stringify(draftOutreachCols))
                  setShowOutreachCustomize(false)
                }} className="flex-1 px-4 py-2 text-sm font-semibold bg-purple-600 hover:bg-purple-700 rounded transition-colors">Save</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'outreach' ? (
          <OutreachTab
            entries={outreach}
            colConfig={outreachColConfig}
            onUpdate={updateOutreachEntry}
            onRemove={removeOutreachEntry}
            onOpenCustomize={() => { setDraftOutreachCols(outreachColConfig); setShowOutreachCustomize(true) }}
          />
        ) : (
          <CreatorTable
            creators={currentList} favorites={favIds} outreachIds={outreachIds}
            onToggleFavorite={toggleFavorite} onRemoveFavorite={removeFavorite}
            onAddToOutreach={addToOutreach}
            isFavTab={activeTab === 'favorites'} loading={loading}
            sortCol={sortCol} sortDir={sortDir} onSort={handleSort}
            colConfig={colConfig}
          />
        )}
      </div>
    </main>
  )
}
