import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, getAuthClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authClient = await getAuthClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const supabase = getServiceClient()

    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = 20
    const offset = (page - 1) * limit
    const searchParam = url.searchParams.get('search') || ''

    // Auto-abandon sessions stuck in 'active' for more than 90 minutes
    const staleThreshold = new Date(Date.now() - 90 * 60 * 1000).toISOString()
    await supabase
      .from('sessions')
      .update({ status: 'abandoned', ended_at: new Date().toISOString() })
      .eq('status', 'active')
      .lt('started_at', staleThreshold)

    // Fetch sessions (no join)
    let query = supabase
      .from('sessions')
      .select('id, candidate_name, candidate_email, status, started_at, ended_at, created_at, invite_code, completion_pct', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (searchParam) {
      query = query.or(`candidate_name.ilike.%${searchParam}%,candidate_email.ilike.%${searchParam}%`)
    }

    const { data: sessions, error, count } = await query
    if (error) {
      return NextResponse.json({ error: 'Could not load sessions.' }, { status: 500 })
    }

    const sessionIds = (sessions || []).map(s => s.id)

    // Fetch evaluations separately for these sessions
    const { data: evaluations } = sessionIds.length > 0
      ? await supabase
          .from('evaluations')
          .select('session_id, composite_score, recommendation')
          .in('session_id', sessionIds)
      : { data: [] }

    // Fetch ALL scores for percentile computation
    const { data: allScores } = await supabase
      .from('evaluations')
      .select('composite_score')
      .not('composite_score', 'is', null)

    const scores = (allScores || []).map(e => e.composite_score as number)
    const totalEvaluated = scores.length

    // Build eval map
    const evalMap: Record<string, { composite_score: number | null; recommendation: string | null }> = {}
    for (const e of (evaluations || [])) {
      evalMap[e.session_id] = { composite_score: e.composite_score, recommendation: e.recommendation }
    }

    // Merge + compute percentile
    const merged = (sessions || []).map(s => {
      const ev = evalMap[s.id] ?? null
      let percentile: number | null = null
      if (ev?.composite_score != null && totalEvaluated > 1) {
        const below = scores.filter(x => x < ev.composite_score!).length
        percentile = Math.round((below / (totalEvaluated - 1)) * 100)
      }
      return {
        ...s,
        evaluations: ev ? [ev] : [],
        percentile,
      }
    })

    return NextResponse.json({
      sessions: merged,
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (err) {
    console.error('Admin sessions error:', err)
    return NextResponse.json({ error: 'Could not load sessions.' }, { status: 500 })
  }
}
