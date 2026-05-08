import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { requireUser, rateLimit } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth

  // XLSX generation is CPU-bound. Cap to 20 exports/hr per user to
  // prevent DOS via repeated large export calls.
  const limited = rateLimit(auth.id, 'export', 20)
  if (limited) return limited

  const { channels } = await req.json()
  // Defensive cap on payload size — prevents pathological inputs
  // (e.g. user paste of 100k channels) from blowing memory.
  const safeChannels = Array.isArray(channels) ? channels.slice(0, 5000) : []

  const rows = safeChannels.map((c: any) => ({
    'Channel Name': c.channelName,
    'YouTube URL': c.channelUrl,
    'Avg Views': c.avgViews,
    'Last Posted': c.videoDates?.[0] || '',
    'Prev Posted': c.videoDates?.[1] || '',
    'Subscribers': c.subscribers,
    'Email': c.email || '',
    'Website': c.website || '',
    'LinkedIn': c.linkedin || '',
    'Twitter/X': c.twitter || '',
    'Instagram': c.instagram || '',
    'TikTok': c.tiktok || '',
    'Company': c.company || '',
    'Notes': '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Creators')

  const colWidths = [
    { wch: 30 }, { wch: 40 }, { wch: 12 }, { wch: 14 },
    { wch: 30 }, { wch: 35 }, { wch: 40 }, { wch: 35 },
    { wch: 35 }, { wch: 35 }, { wch: 25 }, { wch: 20 },
  ]
  ws['!cols'] = colWidths

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="creators.xlsx"',
    },
  })
}
