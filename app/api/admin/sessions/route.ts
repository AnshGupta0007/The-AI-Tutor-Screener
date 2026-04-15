import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, getAuthClient } from '@/lib/supabase'

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

    // Auto-abandon sessions stuck in 'active' for more than 90 minutes
    const staleThreshold = new Date(Date.now() - 90 * 60 * 1000).toISOString()
    await supabase
      .from('sessions')
      .update({ status: 'abandoned', ended_at: new Date().toISOString() })
      .eq('status', 'active')
      .lt('started_at', staleThreshold)

    const searchParam = url.searchParams.get('search') || ''

    let query = supabase
      .from('sessions')
      .select(`
        id,
        candidate_name,
        candidate_email,
        status,
        started_at,
        ended_at,
        created_at,
        invite_code,
        completion_pct,
        evaluations ( composite_score, recommendation )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (searchParam) {
      query = query.or(`candidate_name.ilike.%${searchParam}%,candidate_email.ilike.%${searchParam}%`)
    }

    const { data: sessions, error, count } = await query

    if (error) {
      return NextResponse.json({ error: 'Could not load sessions.' }, { status: 500 })
    }

    // Compute percentile for each evaluated session
    const { data: allScores } = await supabase
      .from('evaluations')
      .select('composite_score')
      .not('composite_score', 'is', null)

    const scores = (allScores || []).map(e => e.composite_score as number)
    const others = scores.length - 1

    const sessionsWithPercentile = (sessions || []).map(s => {
      const score = (s.evaluations as Array<{ composite_score: number | null; recommendation: string | null }>)?.[0]?.composite_score
      let percentile: number | null = null
      if (score != null && others > 0) {
        const below = scores.filter(x => x < score).length
        percentile = Math.round((below / others) * 100)
      }
      return { ...s, percentile }
    })

    return NextResponse.json({
      sessions: sessionsWithPercentile,
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (err) {
    console.error('Admin sessions error:', err)
    return NextResponse.json({ error: 'Could not load sessions.' }, { status: 500 })
  }
}
