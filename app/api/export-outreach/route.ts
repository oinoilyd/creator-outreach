import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  const { entries } = await req.json()

  const rows = entries.map((e: any) => ({
    'Channel Name': e.channelName,
    'YouTube URL': e.channelUrl,
    'Email': e.email || '',
    'Description': e.description || '',
    'Product': e.product || '',
    'Reached Out': e.reachedOut ? 'Yes' : 'No',
    'Medium': e.medium === 'Other' ? (e.mediumOther || 'Other') : (e.medium || ''),
    'Subject Line': e.headerUsed || '',
    'Status': e.status || '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Outreach')

  ws['!cols'] = [
    { wch: 28 }, { wch: 40 }, { wch: 32 }, { wch: 50 },
    { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 40 },
    { wch: 16 },
  ]

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="outreach.xlsx"',
    },
  })
}
