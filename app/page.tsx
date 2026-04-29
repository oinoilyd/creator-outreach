'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'

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
  description: string
}

type SortCol = 'channelName' | 'avgViews' | 'email' | 'website' | 'linkedin' | 'instagram' | 'twitter' | 'tiktok'
type SortDir = 'asc' | 'desc'

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

function pickRandom(arr: string[], n: number): string[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

function parseSubscribers(s: string): number {
  if (!s) return 0
  const n = s.replace(/[^0-9.KkMmBb]/g, '')
  const num = parseFloat(n)
  if (s.match(/[Bb]/)) return num * 1e9
  if (s.match(/[Mm]/)) return num * 1e6
  if (s.match(/[Kk]/)) return num * 1e3
  return num || 0
}

function buildOutreachEmail(c: Creator): string {
  const firstName = c.channelName.split(/[\s,|–-]/)[0]
  const niche = c.description.slice(0, 100).replace(/\n/g, ' ').trim()
  const contentType = niche ? `your ${niche.split(' ').slice(0, 4).join(' ')} content` : 'your content'
  const subject = `Your YouTube channel`
  const body = `Hey ${firstName},

Came across your channel — really like what you're doing with ${contentType}.

I'm Ryan Gaynor. I work with YouTube creators on the full picture — video editing, channel growth, content strategy. Basically helping creators like you get more out of what they're already putting out.

Thought it could be worth a quick chat to see if there's anything I could help with on your end.

Either way, feel free to connect on LinkedIn: https://www.linkedin.com/in/ryan-gaynor-6bb934318/

Ryan`
  return `mailto:${c.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
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

function SortIndicator({ col, sortCol, sortDir }: { col: SortCol, sortCol: SortCol, sortDir: SortDir }) {
  if (col !== sortCol) return <span className="ml-1 text-gray-600">↕</span>
  return <span className="ml-1 text-blue-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

function sortCreators(list: Creator[], col: SortCol, dir: SortDir): Creator[] {
  return [...list].sort((a, b) => {
    let cmp = 0
    if (col === 'avgViews') cmp = a.avgViews - b.avgViews
    else if (col === 'channelName') cmp = a.channelName.localeCompare(b.channelName)
    else if (col === 'email') cmp = (b.email ? 1 : 0) - (a.email ? 1 : 0)
    else if (col === 'website') cmp = (b.website ? 1 : 0) - (a.website ? 1 : 0)
    else if (col === 'linkedin') cmp = (b.linkedin ? 1 : 0) - (a.linkedin ? 1 : 0)
    else if (col === 'instagram') cmp = (b.instagram ? 1 : 0) - (a.instagram ? 1 : 0)
    else if (col === 'twitter') cmp = (b.twitter ? 1 : 0) - (a.twitter ? 1 : 0)
    else if (col === 'tiktok') cmp = (b.tiktok ? 1 : 0) - (a.tiktok ? 1 : 0)
    return dir === 'asc' ? cmp : -cmp
  })
}

function CreatorTable({
  creators, favorites, onToggleFavorite, onRemoveFavorite, isFavTab, loading,
  sortCol, sortDir, onSort,
}: {
  creators: Creator[]
  favorites: Set<string>
  onToggleFavorite: (c: Creator) => void
  onRemoveFavorite?: (id: string) => void
  isFavTab: boolean
  loading?: boolean
  sortCol: SortCol
  sortDir: SortDir
  onSort: (col: SortCol) => void
}) {
  const sorted = useMemo(() => sortCreators(creators, sortCol, sortDir), [creators, sortCol, sortDir])

  if (sorted.length === 0 && !loading) {
    return <p className="text-gray-500 text-sm mt-4">{isFavTab ? 'No favorites yet — star creators from the Results tab.' : ''}</p>
  }

  const Th = ({ col, label }: { col: SortCol, label: string }) => (
    <th
      className="text-left px-4 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap"
      onClick={() => onSort(col)}
    >
      {label}<SortIndicator col={col} sortCol={sortCol} sortDir={sortDir} />
    </th>
  )

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-800 text-gray-300">
          <tr>
            <th className="px-4 py-3 w-8"></th>
            <Th col="channelName" label="Channel" />
            <Th col="avgViews" label="Avg Views" />
            <Th col="email" label="Email" />
            <Th col="website" label="Website" />
            <Th col="linkedin" label="LinkedIn" />
            <Th col="instagram" label="Instagram" />
            <Th col="twitter" label="Twitter/X" />
            <Th col="tiktok" label="TikTok" />
            {!isFavTab && <th className="text-left px-4 py-3">Found Via</th>}
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
                <a href={c.channelUrl} target="_blank" className="text-blue-400 hover:underline font-medium">{c.channelName}</a>
              </td>
              <td className="px-4 py-3">{c.avgViews.toLocaleString()}</td>
              <td className="px-4 py-3 text-xs">
                {c.email ? <a href={buildOutreachEmail(c)} className="text-green-400 hover:underline">{c.email}</a> : '—'}
              </td>
              <td className="px-4 py-3">
                {c.website ? <a href={c.website} target="_blank" className="text-blue-400 hover:underline">link</a> : '—'}
              </td>
              <td className="px-4 py-3">
                {c.linkedin ? <a href={c.linkedin} target="_blank" className="text-blue-400 hover:underline">link</a> : '—'}
              </td>
              <td className="px-4 py-3">
                {c.instagram ? <a href={c.instagram} target="_blank" className="text-blue-400 hover:underline">link</a> : '—'}
              </td>
              <td className="px-4 py-3">
                {c.twitter ? <a href={c.twitter} target="_blank" className="text-blue-400 hover:underline">link</a> : '—'}
              </td>
              <td className="px-4 py-3">
                {c.tiktok ? <a href={c.tiktok} target="_blank" className="text-blue-400 hover:underline">link</a> : '—'}
              </td>
              {!isFavTab && (
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${c.matchedVia === 'related' ? 'bg-gray-700 text-gray-300' : c.matchedVia === 'bio' ? 'bg-yellow-900 text-yellow-300' : 'bg-green-900 text-green-300'}`}>
                    {c.matchedVia || 'name'}
                  </span>
                </td>
              )}
              {isFavTab && (
                <td className="px-4 py-3">
                  <button onClick={() => onRemoveFavorite?.(c.channelId)} className="text-gray-600 hover:text-red-400 transition-colors">
                    <TrashIcon />
                  </button>
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
  const maxResults = 50
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('avgViews')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [activeTab, setActiveTab] = useState<'results' | 'favorites'>('results')
  const [favorites, setFavorites] = useState<Creator[]>([])
  const [favIds, setFavIds] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState<string[]>([])

  useEffect(() => {
    setSuggestions(pickRandom(ALL_OCCUPATIONS, 25))
    try {
      const stored = JSON.parse(localStorage.getItem('creator-favorites') || '[]')
      setFavorites(stored)
      setFavIds(new Set(stored.map((c: Creator) => c.channelId)))
    } catch { /* no stored favorites */ }
  }, [])

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

  function removeFavorite(id: string) {
    saveFavorites(favorites.filter(f => f.channelId !== id))
  }

  const runSearch = useCallback(async (kw: string) => {
    if (!kw.trim()) return
    setLoading(true)
    setCreators([])
    setActiveTab('results')
    setStatus('Searching YouTube...')
    try {
      const res = await fetch(`/api/search?keyword=${encodeURIComponent(kw)}&maxResults=${maxResults}`)
      const data = await res.json()
      if (data.error) { setStatus(`Error: ${data.error}`); return }
      setCreators(data.channels)
      const queryList = (data.expandedQueries as string[] || []).join(', ')
      setStatus(`Searched: ${queryList} — Found ${data.channels.length} creators. Enriching contact info...`)
      const enriched = [...data.channels]
      for (let i = 0; i < enriched.length; i++) {
        const c = enriched[i]
        setStatus(`Enriching ${i + 1} of ${enriched.length}: ${c.channelName}`)
        try {
          const params = new URLSearchParams({
            name: c.channelName, channelId: c.channelId,
            website: c.website || '', instagram: c.instagram || '',
            tiktok: c.tiktok || '', description: c.description || '',
          })
          const r = await fetch(`/api/enrich?${params}`)
          const extra = await r.json()
          enriched[i] = {
            ...c,
            email: c.email || extra.email || '',
            linkedin: c.linkedin || extra.linkedin || '',
            instagram: c.instagram || extra.instagram || '',
            twitter: c.twitter || extra.twitter || '',
            tiktok: c.tiktok || extra.tiktok || '',
            website: c.website || extra.website || '',
          }
          setCreators([...enriched])
        } catch { continue }
      }
      setStatus(`Done — ${enriched.length} creators found.`)
    } catch (err: any) {
      setStatus(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [maxResults])

  async function handleSearch() { await runSearch(keyword) }

  async function handleExport(list: Creator[]) {
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

  const currentList = activeTab === 'favorites' ? favorites : creators

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Creator Outreach</h1>
        <p className="text-gray-400 mb-6">Find YouTube creators with 0–200k avg views and their contact info</p>

        {/* Search bar */}
        <div className="flex gap-4 mb-4 flex-wrap">
          <input
            className="flex-1 min-w-64 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            placeholder="Search by topic or occupation (e.g. basketball, banking, fitness)"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} disabled={loading} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-2 rounded font-semibold">
            {loading ? 'Searching...' : 'Search'}
          </button>
          {currentList.length > 0 && (
            <button onClick={() => handleExport(currentList)} className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded font-semibold">
              Export Excel
            </button>
          )}
        </div>

        {/* Suggestions bar */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Suggested searches</span>
            <button
              onClick={() => setSuggestions(pickRandom(ALL_OCCUPATIONS, 25))}
              className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 border border-gray-700 rounded px-2 py-0.5 hover:border-gray-500 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => { setKeyword(s); runSearch(s) }}
                className="text-xs px-3 py-1.5 rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700 hover:border-gray-500 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-800">
          <button onClick={() => setActiveTab('results')} className={`px-5 py-2 text-sm font-medium rounded-t transition-colors ${activeTab === 'results' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            Results {creators.length > 0 && <span className="ml-1 text-xs text-gray-400">({creators.length})</span>}
          </button>
          <button onClick={() => setActiveTab('favorites')} className={`px-5 py-2 text-sm font-medium rounded-t transition-colors ${activeTab === 'favorites' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            Favorites {favorites.length > 0 && <span className="ml-1 text-xs text-yellow-400">({favorites.length})</span>}
          </button>
        </div>

        {status && activeTab === 'results' && <p className="text-sm text-gray-400 mb-4">{status}</p>}

        <CreatorTable
          creators={currentList}
          favorites={favIds}
          onToggleFavorite={toggleFavorite}
          onRemoveFavorite={removeFavorite}
          isFavTab={activeTab === 'favorites'}
          loading={loading}
          sortCol={sortCol}
          sortDir={sortDir}
          onSort={handleSort}
        />
      </div>
    </main>
  )
}
