import { NextRequest, NextResponse } from 'next/server'
import { requireUser, rateLimit } from '@/lib/api-auth'
import { forbidIfNotAdmin } from '@/lib/admin'
import { educatedAssumption, type AssumptionInput } from '@/lib/educatedAssumption'

export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth
  const forbidden = forbidIfNotAdmin(auth)
  if (forbidden) return forbidden

  // Rate limit even admin routes — DOS / runaway-script protection
  const limited = rateLimit(auth.id, 'admin-educated-assumption', 50)
  if (limited) return limited

  let body: AssumptionInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.channelId || !body.channelName) {
    return NextResponse.json({ error: 'channelId + channelName required' }, { status: 400 })
  }

  const result = await educatedAssumption(body)
  return NextResponse.json(result)
}
