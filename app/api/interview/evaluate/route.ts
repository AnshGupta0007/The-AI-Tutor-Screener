import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getServiceClient } from '@/lib/supabase'
import { buildEvaluationPrompt } from '@/lib/prompts'
import type { EvaluationData } from '@/lib/types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function computeComposite(scores: {
  clarity: number
  teaching_ability: number
  patience: number
  warmth: number
  fluency: number
}): number {
  return (
    scores.clarity * 0.25 +
    scores.teaching_ability * 0.25 +
    scores.patience * 0.2 +
    scores.warmth * 0.2 +
    scores.fluency * 0.1
  )
}

function determineRecommendation(composite: number): string {
  if (composite >= 4.0) return 'strong_hire'
  if (composite >= 3.0) return 'consider'
  return 'do_not_advance'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, completionPct } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId.' }, { status: 400 })
    }

    // completionPct: 0–100, defaults to 100 (full interview)
    const pct = typeof completionPct === 'number' ? Math.max(0, Math.min(100, completionPct)) : 100

    const supabase = getServiceClient()

    // Validate session
    const { data: session } = await supabase
      .from('sessions')
      .select('id, status, candidate_name')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    // Mark session as completed
    await supabase
      .from('sessions')
      .update({ status: 'completed', ended_at: new Date().toISOString(), completion_pct: pct })
      .eq('id', sessionId)

    // Fetch all messages
    const { data: messages } = await supabase
      .from('messages')
      .select('role, content, turn_number, confidence')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages found for session.' }, { status: 400 })
    }

    // Assemble transcript
    const transcript = messages
      .filter(m => m.role !== 'system')
      .map(m => {
        const label = m.role === 'assistant' ? 'AI Interviewer' : 'Candidate'
        const confidenceNote =
          m.role === 'user' && m.confidence !== null && m.confidence < 0.6
            ? ' [low confidence transcription]'
            : ''
        return `${label}: ${m.content}${confidenceNote}`
      })
      .join('\n\n')

    // Call GPT-4o for evaluation
    const evalPrompt = buildEvaluationPrompt(transcript)

    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2048,
      messages: [{ role: 'user', content: evalPrompt }],
    })

    const rawResponse = gptResponse.choices[0]?.message?.content ?? ''

    // Parse JSON response
    let evalData: EvaluationData
    try {
      // Strip any markdown code blocks if present
      const cleaned = rawResponse.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim()
      evalData = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('Failed to parse evaluation JSON:', parseErr, rawResponse)
      return NextResponse.json(
        { error: 'Evaluation could not be processed. Please contact support.' },
        { status: 500 }
      )
    }

    // Validate and compute composite
    const scores = {
      clarity: evalData.clarity?.score ?? 3,
      teaching_ability: evalData.teaching_ability?.score ?? 3,
      patience: evalData.patience?.score ?? 3,
      warmth: evalData.warmth?.score ?? 3,
      fluency: evalData.fluency?.score ?? 3,
    }

    const rawComposite = computeComposite(scores)
    // Scale by completion pct for manual early exits; system/natural completions pass pct=100
    const composite = parseFloat((rawComposite * (pct / 100)).toFixed(2))
    const recommendation = determineRecommendation(composite)

    const justifications = {
      clarity: evalData.clarity?.justification ?? '',
      teaching_ability: evalData.teaching_ability?.justification ?? '',
      patience: evalData.patience?.justification ?? '',
      warmth: evalData.warmth?.justification ?? '',
      fluency: evalData.fluency?.justification ?? '',
      summary: evalData.summary ?? '',
    }

    const keyExcerpts = {
      clarity: evalData.clarity?.excerpts ?? [],
      teaching_ability: evalData.teaching_ability?.excerpts ?? [],
      patience: evalData.patience?.excerpts ?? [],
      warmth: evalData.warmth?.excerpts ?? [],
      fluency: evalData.fluency?.excerpts ?? [],
    }

    // Store evaluation
    const { data: evaluation, error: evalError } = await supabase
      .from('evaluations')
      .upsert({
        session_id: sessionId,
        clarity: scores.clarity,
        teaching_ability: scores.teaching_ability,
        patience: scores.patience,
        warmth: scores.warmth,
        fluency: scores.fluency,
        composite_score: parseFloat(composite.toFixed(2)),
        recommendation,
        justifications,
        flags: evalData.flags ?? [],
        key_excerpts: keyExcerpts,
        raw_eval_response: rawResponse,
      })
      .select()
      .single()

    if (evalError) {
      console.error('Evaluation storage error:', evalError)
    }

    // Mark session as evaluated
    await supabase
      .from('sessions')
      .update({ status: 'evaluated' })
      .eq('id', sessionId)

    return NextResponse.json({
      evaluationId: evaluation?.id,
      recommendation,
      compositeScore: parseFloat(composite.toFixed(2)),
    })
  } catch (err) {
    console.error('Evaluation error:', err)
    return NextResponse.json(
      { error: 'Something went wrong generating your report. Please contact support.' },
      { status: 500 }
    )
  }
}
