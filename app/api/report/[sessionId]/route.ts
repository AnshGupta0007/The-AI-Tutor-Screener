import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, getAuthClient } from '@/lib/supabase'
import { differenceInDays } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

    // Check if admin — verify Supabase Auth session via cookies
    const authClient = await getAuthClient()
    const { data: { user } } = await authClient.auth.getUser()
    const isAdmin = !!user

    const supabase = getServiceClient()

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Report not found.' }, { status: 404 })
    }

    if (isAdmin) {
      // Full admin report
      const { data: evaluation } = await supabase
        .from('evaluations')
        .select('*')
        .eq('session_id', sessionId)
        .single()

      const { data: messages } = await supabase
        .from('messages')
        .select('role, content, turn_number, confidence')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      // Check recording availability (within 30-day window)
      let recordingAvailable = false
      if (session.recording_path) {
        const endedAt = session.ended_at ? new Date(session.ended_at) : null
        if (endedAt && differenceInDays(new Date(), endedAt) <= 30) {
          recordingAvailable = true
        }
      }

      // Compute percentile rank among all evaluated sessions
      let percentile: number | null = null
      let totalEvaluated = 0
      if (evaluation?.composite_score != null) {
        const { data: allScores } = await supabase
          .from('evaluations')
          .select('composite_score')
          .not('composite_score', 'is', null)
        if (allScores && allScores.length > 0) {
          totalEvaluated = allScores.length
          const below = allScores.filter(e => e.composite_score < evaluation.composite_score).length
          percentile = Math.round((below / allScores.length) * 100)
        }
      }

      return NextResponse.json({
        session: {
          id: session.id,
          candidateName: session.candidate_name,
          candidateEmail: session.candidate_email,
          status: session.status,
          startedAt: session.started_at,
          endedAt: session.ended_at,
          createdAt: session.created_at,
          recordingPath: session.recording_path,
        },
        evaluation: evaluation
          ? {
              clarity: evaluation.clarity,
              teachingAbility: evaluation.teaching_ability,
              patience: evaluation.patience,
              warmth: evaluation.warmth,
              fluency: evaluation.fluency,
              compositeScore: evaluation.composite_score,
              recommendation: evaluation.recommendation,
              justifications: evaluation.justifications,
              excerpts: evaluation.key_excerpts,
              flags: evaluation.flags,
              summary: evaluation.justifications?.summary,
            }
          : null,
        transcript: (messages || []).map(m => ({
          role: m.role,
          content: m.content,
          turnNumber: m.turn_number,
          confidence: m.confidence,
        })),
        recordingAvailable,
        percentile,
        totalEvaluated,
      })
    } else {
      // Candidate view — no scores, no evaluation data
      const startedAt = session.started_at ? new Date(session.started_at) : null
      const endedAt = session.ended_at ? new Date(session.ended_at) : null
      let duration = 0
      if (startedAt && endedAt) {
        duration = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
      }

      const { data: messages } = await supabase
        .from('messages')
        .select('role')
        .eq('session_id', sessionId)

      const questionsAnswered = (messages || []).filter(m => m.role === 'user').length

      return NextResponse.json({
        session: {
          candidateName: session.candidate_name,
          date: session.ended_at || session.created_at,
          duration,
          questionsAnswered,
        },
        status: session.status,
        nextSteps:
          "You'll hear back from the Cuemath team in 2–3 business days. Thank you for your time.",
      })
    }
  } catch (err) {
    console.error('Report fetch error:', err)
    return NextResponse.json({ error: 'Could not load report.' }, { status: 500 })
  }
}
