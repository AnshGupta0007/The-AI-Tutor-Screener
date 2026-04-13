import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const sessionId = body.sessionId

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'Missing sessionId.' }, { status: 400 })
    }

    const supabase = getServiceClient()

    // Only mark as abandoned if still in a non-terminal state
    const { data: session } = await supabase
      .from('sessions')
      .select('id, status')
      .eq('id', sessionId)
      .single()

    if (!session || !['pending', 'active'].includes(session.status)) {
      return NextResponse.json({ ok: true })
    }

    // Count how many candidate messages were saved to compute completion_pct
    const { count: messageCount } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('role', 'user')

    // Assume 10 core questions + 1 warm-up = 11 total possible user turns
    const totalExpected = 11
    const answered = messageCount ?? 0
    const completion_pct = answered > 0 ? Math.min(100, Math.round((answered / totalExpected) * 100)) : 0

    await supabase
      .from('sessions')
      .update({
        status: 'abandoned',
        ended_at: new Date().toISOString(),
        completion_pct: answered > 0 ? completion_pct : null,
      })
      .eq('id', sessionId)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Could not update session.' }, { status: 500 })
  }
}
