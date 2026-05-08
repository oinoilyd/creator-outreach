import { NextRequest, NextResponse } from 'next/server'
import { requireUser, rateLimit } from '@/lib/api-auth'
import { forbidIfNotAdmin } from '@/lib/admin'
import { verifyMany } from '@/lib/verifyEmail'

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const forbidden = forbidIfNotAdmin(auth)
  if (forbidden) return forbidden
  const limited = rateLimit(auth.id, 'admin-verify-email', 30)
  if (limited) return limited

  let body: { emails?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const emails = (body.emails || [])
    .filter(e => typeof e === 'string')
    .map(e => e.trim())
    .filter(Boolean)
    .slice(0, 100)

  if (emails.length === 0) {
    return NextResponse.json({ results: [] })
  }

  const results = await verifyMany(emails)
  return NextResponse.json({ results })
}
