import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { selectSessionQuestions, selectWarmUpQuestion } from '@/lib/questions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { candidateName, candidateEmail } = body

    if (!candidateName || typeof candidateName !== 'string' || candidateName.trim().length < 2) {
      return NextResponse.json({ error: 'A valid name is required.' }, { status: 400 })
    }

    const supabase = getServiceClient()

    // Create the session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        candidate_name: candidateName.trim(),
        candidate_email: candidateEmail?.trim() || null,
        status: 'pending',
      })
      .select()
      .single()

    if (sessionError || !session) {
      console.error('Session creation error:', sessionError)
      return NextResponse.json({ error: 'Could not start session. Please try again.' }, { status: 500 })
    }

    // Select questions for this session
    const coreQuestions = selectSessionQuestions(10)
    const warmUpQuestion = selectWarmUpQuestion()

    // Greeting text
    const firstName = candidateName.trim().split(' ')[0]
    const greetingText = `Hi ${firstName} — welcome, and thanks for making time for this. I'm an AI interviewer for Cuemath, and I'll be talking with you for about ten minutes today. This isn't a test about math — I'm just going to ask you some questions about your experience with students and your approach to teaching. There are no trick questions. Just talk to me naturally. I'll be listening. Are you ready to begin?`

    return NextResponse.json({
      sessionId: session.id,
      greetingText,
      warmUpQuestionId: warmUpQuestion.id,
      coreQuestionIds: coreQuestions.map(q => q.id),
    })
  } catch (err) {
    console.error('Session start error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
