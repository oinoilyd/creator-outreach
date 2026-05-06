import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { newMethodology, type MethodologyInput } from '@/lib/newMethodology'

const ADMIN_EMAIL = 'dmeehanj@gmail.com'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: MethodologyInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.channelId || !body.channelName) {
    return NextResponse.json({ error: 'channelId + channelName required' }, { status: 400 })
  }

  const result = await newMethodology(body)
  return NextResponse.json(result)
}
