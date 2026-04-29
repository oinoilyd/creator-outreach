'use client'

import { useState, useMemo } from 'react'

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
}

export default function Home() {
  const [keyword, setKeyword] = useState('')
  const [maxResults, setMaxResults] = useState(20)
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [sortOrder, setSortOrder] = useState<'relevance' | 'high' | 'low'>('relevance')

  const sorted = useMemo(() => {
    if (sortOrder === 'high') return [...creators].sort((a, b) => b.avgViews - a.avgViews)
    if (sortOrder === 'low') return [...creators].sort((a, b) => a.avgViews - b.avgViews)
    return creators
  }, [creators, sortOrder])

  async function handleSearch() {
    if (!keyword.trim()) return
    setLoading(true)
    setCreators([])
    setStatus('Searching YouTube...')

    try {
      const res = await fetch(`/api/search?keyword=${encodeURIComponent(keyword)}&maxResults=${maxResults}`)
      const data = await res.json()

      if (data.error) {
        setStatus(`Error: ${data.error}`)
        return
      }

      setCreators(data.channels)
      setStatus(`Found ${data.channels.length} creators. Enriching contact info...`)

      const enriched = [...data.channels]
      for (let i = 0; i < enriched.length; i++) {
        const c = enriched[i]
        setStatus(`Enriching ${i + 1} of ${enriched.length}: ${c.channelName}`)
        try {
          const params = new URLSearchParams({
            name: c.channelName,
            website: c.website || '',
            instagram: c.instagram || '',
            tiktok: c.tiktok || '',
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
          }
          setCreators([...enriched])
        } catch {
          continue
        }
      }

      setStatus(`Done — ${enriched.length} creators found.`)
    } catch (err: any) {
      setStatus(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleExport() {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels: sorted }),
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'creators.xlsx'
    a.click()
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Creator Outreach</h1>
        <p className="text-gray-400 mb-8">Find YouTube creators with 0–200k avg views and their contact info</p>

        <div className="flex gap-4 mb-6 flex-wrap">
          <input
            className="flex-1 min-w-64 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            placeholder="Enter niche or keyword (e.g. fitness coach, sports, personal finance)"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <select
            className="bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none"
            value={maxResults}
            onChange={e => setMaxResults(parseInt(e.target.value))}
          >
            <option value={10}>10 results</option>
            <option value={20}>20 results</option>
            <option value={50}>50 results</option>
          </select>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-2 rounded font-semibold"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
          {creators.length > 0 && (
            <button
              onClick={handleExport}
              className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded font-semibold"
            >
              Export Excel
            </button>
          )}
        </div>

        {creators.length > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-gray-400">Sort by avg views:</span>
            <button
              onClick={() => setSortOrder('relevance')}
              className={`text-sm px-3 py-1 rounded ${sortOrder === 'relevance' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              Relevance
            </button>
            <button
              onClick={() => setSortOrder('high')}
              className={`text-sm px-3 py-1 rounded ${sortOrder === 'high' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              High → Low
            </button>
            <button
              onClick={() => setSortOrder('low')}
              className={`text-sm px-3 py-1 rounded ${sortOrder === 'low' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              Low → High
            </button>
            <span className="text-sm text-gray-500 ml-auto">{creators.length} creators</span>
          </div>
        )}

        {status && (
          <p className="text-sm text-gray-400 mb-4">{status}</p>
        )}

        {sorted.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-gray-300">
                <tr>
                  <th className="text-left px-4 py-3">Channel</th>
                  <th className="text-left px-4 py-3">Avg Views</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Website</th>
                  <th className="text-left px-4 py-3">LinkedIn</th>
                  <th className="text-left px-4 py-3">Instagram</th>
                  <th className="text-left px-4 py-3">Twitter/X</th>
                  <th className="text-left px-4 py-3">TikTok</th>
                  <th className="text-left px-4 py-3">Found Via</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c, i) => (
                  <tr key={c.channelId} className={i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-950'}>
                    <td className="px-4 py-3">
                      <a href={c.channelUrl} target="_blank" className="text-blue-400 hover:underline">
                        {c.channelName}
                      </a>
                    </td>
                    <td className="px-4 py-3">{c.avgViews.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs">{c.email || '—'}</td>
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
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        c.matchedVia === 'related' ? 'bg-gray-700 text-gray-300' :
                        c.matchedVia === 'bio' ? 'bg-yellow-900 text-yellow-300' :
                        'bg-green-900 text-green-300'
                      }`}>
                        {c.matchedVia || 'name'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
