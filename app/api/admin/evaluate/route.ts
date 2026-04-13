import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, getAuthClient } from '@/lib/supabase'

// Admin-triggered evaluation for abandoned/stuck sessions
export async function POST(request: NextRequest) {
  try {
    const authClient = await getAuthClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { sessionId } = await request.json()
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId.' }, { status: 400 })
    }

    const supabase = getServiceClient()

    // Verify session exists and has messages worth evaluating
    const { data: session } = await supabase
      .from('sessions')
      .select('id, status, completion_pct')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    if (session.status === 'evaluated') {
      return NextResponse.json({ error: 'Session already evaluated.' }, { status: 400 })
    }

    const { count: messageCount } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('role', 'user')

    const MIN_ANSWERS_TO_EVALUATE = 3

    if (!messageCount || messageCount < MIN_ANSWERS_TO_EVALUATE) {
      return NextResponse.json({
        error: `Not enough responses to evaluate. At least ${MIN_ANSWERS_TO_EVALUATE} answers are needed (this session has ${messageCount ?? 0}).`,
      }, { status: 400 })
    }

    // Compute completion pct from actual messages (11 total expected: 1 warm-up + 10 core)
    const completionPct = session.completion_pct ?? Math.min(100, Math.round((messageCount / 11) * 100))

    // Delegate to the evaluate endpoint
    const origin = request.nextUrl.origin
    const evalRes = await fetch(`${origin}/api/interview/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, completionPct }),
    })

    if (!evalRes.ok) {
      const err = await evalRes.json().catch(() => ({}))
      return NextResponse.json({ error: err.error || 'Evaluation failed.' }, { status: 500 })
    }

    const result = await evalRes.json()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('Admin evaluate error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
