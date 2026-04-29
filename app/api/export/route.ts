import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  const { channels } = await req.json()

  const rows = channels.map((c: any) => ({
    'Channel Name': c.channelName,
    'YouTube URL': c.channelUrl,
    'Avg Views': c.avgViews,
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
