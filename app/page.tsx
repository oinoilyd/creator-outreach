'use client'

import { useState, useMemo, useEffect } from 'react'

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

function buildOutreachEmail(c: Creator): string {
  const firstName = c.channelName.split(/[\s,|–-]/)[0]
  const topic = c.videoTitles[0] || c.description.slice(0, 80)
  const videoRef = c.videoTitles[0] ? `I came across your video "${c.videoTitles[0]}" and it immediately stood out to me.` : `I came across your channel and your content really caught my attention.`
  const niche = c.description.slice(0, 120).replace(/\n/g, ' ').trim()

  const subject = `Quick question about growing ${c.channelName} on YouTube`
  const body = `Hi ${firstName},

${videoRef}

I'm Ryan Gaynor — I help YouTube creators like you turn great content into channels that actually grow. Whether it's tightening edits, improving retention, or building a consistent publishing system, I work directly with creators to make their videos perform better.

Based on what I've seen from your channel${niche ? ` — ${niche.slice(0, 80)}... —` : ','} I think there's a real opportunity to get your content in front of a much bigger audience.

I'd love to offer you a free 15-minute channel audit with no strings attached. I'll walk through exactly what I'd do to grow your channel and you can decide if it's worth exploring further.

Would you be open to a quick call this week?

Best,
Ryan Gaynor
YouTube Growth & Editing Services`

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

function CreatorTable({
  creators,
  favorites,
  onToggleFavorite,
  onRemoveFavorite,
  isFavTab,
  sortOrder,
  loading,
}: {
  creators: Creator[]
  favorites: Set<string>
  onToggleFavorite: (c: Creator) => void
  onRemoveFavorite?: (id: string) => void
  isFavTab: boolean
  sortOrder: 'high' | 'low'
  loading?: boolean
}) {
  const sorted = useMemo(() => {
    if (sortOrder === 'high') return [...creators].sort((a, b) => b.avgViews - a.avgViews)
    return [...creators].sort((a, b) => a.avgViews - b.avgViews)
  }, [creators, sortOrder])

  if (sorted.length === 0 && !loading) return <p className="text-gray-500 text-sm mt-4">{isFavTab ? 'No favorites yet — star creators from the Results tab.' : ''}</p>

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-800 text-gray-300">
          <tr>
            <th className="px-4 py-3 w-8"></th>
            <th className="text-left px-4 py-3">Channel</th>
            <th className="text-left px-4 py-3">Avg Views</th>
            <th className="text-left px-4 py-3">Email</th>
            <th className="text-left px-4 py-3">Website</th>
            <th className="text-left px-4 py-3">LinkedIn</th>
            <th className="text-left px-4 py-3">Instagram</th>
            <th className="text-left px-4 py-3">Twitter/X</th>
            <th className="text-left px-4 py-3">TikTok</th>
            {!isFavTab && <th className="text-left px-4 py-3">Found Via</th>}
            {isFavTab && <th className="px-4 py-3 w-8"></th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((c, i) => (
            <tr key={c.channelId} className={i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-950'}>
              <td className="px-4 py-3">
                <button
                  onClick={() => onToggleFavorite(c)}
                  className={`transition-colors ${favorites.has(c.channelId) ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-400'}`}
                >
                  <StarIcon filled={favorites.has(c.channelId)} />
                </button>
              </td>
              <td className="px-4 py-3">
                <a href={c.channelUrl} target="_blank" className="text-blue-400 hover:underline font-medium">{c.channelName}</a>
              </td>
              <td className="px-4 py-3">{c.avgViews.toLocaleString()}</td>
              <td className="px-4 py-3 text-xs">
                {c.email
                  ? <a href={buildOutreachEmail(c)} className="text-green-400 hover:underline">{c.email}</a>
                  : '—'}
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
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    c.matchedVia === 'related' ? 'bg-gray-700 text-gray-300' :
                    c.matchedVia === 'bio' ? 'bg-yellow-900 text-yellow-300' :
                    'bg-green-900 text-green-300'
                  }`}>{c.matchedVia || 'name'}</span>
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
  const [sortOrder, setSortOrder] = useState<'high' | 'low'>('high')
  const [activeTab, setActiveTab] = useState<'results' | 'favorites'>('results')
  const [favorites, setFavorites] = useState<Creator[]>([])
  const [favIds, setFavIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('creator-favorites') || '[]')
      setFavorites(stored)
      setFavIds(new Set(stored.map((c: Creator) => c.channelId)))
    } catch { /* no stored favorites */ }
  }, [])

  function saveFavorites(updated: Creator[]) {
    setFavorites(updated)
    setFavIds(new Set(updated.map(c => c.channelId)))
    localStorage.setItem('creator-favorites', JSON.stringify(updated))
  }

  function toggleFavorite(c: Creator) {
    if (favIds.has(c.channelId)) {
      saveFavorites(favorites.filter(f => f.channelId !== c.channelId))
    } else {
      saveFavorites([...favorites, c])
    }
  }

  function removeFavorite(id: string) {
    saveFavorites(favorites.filter(f => f.channelId !== id))
  }

  async function handleSearch() {
    if (!keyword.trim()) return
    setLoading(true)
    setCreators([])
    setActiveTab('results')
    setStatus('Searching YouTube...')

    try {
      const res = await fetch(`/api/search?keyword=${encodeURIComponent(keyword)}&maxResults=${maxResults}`)
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
            name: c.channelName,
            channelId: c.channelId,
            website: c.website || '',
            instagram: c.instagram || '',
            tiktok: c.tiktok || '',
            description: (c as any).description || '',
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
  }

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
        <p className="text-gray-400 mb-8">Find YouTube creators with 0–200k avg views and their contact info</p>

        <div className="flex gap-4 mb-6 flex-wrap">
          <input
            className="flex-1 min-w-64 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            placeholder="Enter niche or keyword (e.g. fitness, sports, personal finance)"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-2 rounded font-semibold"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
          {currentList.length > 0 && (
            <button
              onClick={() => handleExport(currentList)}
              className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded font-semibold"
            >
              Export Excel
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('results')}
            className={`px-5 py-2 text-sm font-medium rounded-t transition-colors ${activeTab === 'results' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Results {creators.length > 0 && <span className="ml-1 text-xs text-gray-400">({creators.length})</span>}
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`px-5 py-2 text-sm font-medium rounded-t transition-colors ${activeTab === 'favorites' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Favorites {favorites.length > 0 && <span className="ml-1 text-xs text-yellow-400">({favorites.length})</span>}
          </button>
        </div>

        {/* Sort toggle */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setSortOrder(s => s === 'high' ? 'low' : 'high')}
            className="text-sm px-4 py-1.5 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 flex items-center gap-2 border border-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {sortOrder === 'high'
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9M3 12h5m10 4l-4-4m0 0l-4 4m4-4v12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9M3 12h5m10-8l-4 4m0 0l-4-4m4 4V4" />
              }
            </svg>
            Avg Views: {sortOrder === 'high' ? 'High → Low' : 'Low → High'}
          </button>
        </div>

        {status && activeTab === 'results' && (
          <p className="text-sm text-gray-400 mb-4">{status}</p>
        )}

        <CreatorTable
          creators={currentList}
          favorites={favIds}
          onToggleFavorite={toggleFavorite}
          onRemoveFavorite={removeFavorite}
          isFavTab={activeTab === 'favorites'}
          sortOrder={sortOrder}
          loading={loading}
        />
      </div>
    </main>
  )
}
