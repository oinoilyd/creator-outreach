import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyMany } from '@/lib/verifyEmail'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

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
