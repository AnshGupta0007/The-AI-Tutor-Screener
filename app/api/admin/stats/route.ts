import { NextResponse } from 'next/server'
import { getServiceClient, getAuthClient } from '@/lib/supabase'

export async function GET() {
  try {
    const authClient = await getAuthClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const supabase = getServiceClient()

    // Status counts
    const { data: statusRows } = await supabase
      .from('sessions')
      .select('status')

    const counts: Record<string, number> = {}
    for (const row of (statusRows || [])) {
      counts[row.status] = (counts[row.status] || 0) + 1
    }

    // Evaluation aggregates
    const { data: evalRows } = await supabase
      .from('evaluations')
      .select('composite_score, recommendation')

    let totalScore = 0
    let scoredCount = 0
    const recCounts: Record<string, number> = { strong_hire: 0, consider: 0, do_not_advance: 0 }

    for (const row of (evalRows || [])) {
      if (row.composite_score != null) {
        totalScore += row.composite_score
        scoredCount++
      }
      if (row.recommendation && recCounts[row.recommendation] !== undefined) {
        recCounts[row.recommendation]++
      }
    }

    const avgScore = scoredCount > 0 ? Math.round((totalScore / scoredCount) * 100) / 100 : null
    const passCount = recCounts.strong_hire + recCounts.consider
    const passRate = scoredCount > 0 ? Math.round((passCount / scoredCount) * 100) : null

    // Sessions created in last 7 days
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count: recentCount } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)

    return NextResponse.json({
      total: statusRows?.length ?? 0,
      completed: (counts.completed ?? 0) + (counts.evaluated ?? 0) + (counts.accepted ?? 0) + (counts.rejected ?? 0),
      evaluated: scoredCount,
      avgScore,
      passRate,
      recentCount: recentCount ?? 0,
      recommendations: recCounts,
    })
  } catch (err) {
    console.error('[stats]', err)
    return NextResponse.json({ error: 'Could not load stats.' }, { status: 500 })
  }
}
