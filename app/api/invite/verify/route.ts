import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { selectSessionQuestions, selectWarmUpQuestion } from '@/lib/questions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, code } = body

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required.' }, { status: 400 })
    }

    const supabase = getServiceClient()

    // Find session matching email + code
    const { data: session } = await supabase
      .from('sessions')
      .select('id, candidate_name, candidate_email, invite_code, invite_expires_at, status')
      .eq('candidate_email', email.trim().toLowerCase())
      .eq('invite_code', code.trim())
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Invalid email or code. Please check and try again.' }, { status: 400 })
    }

    // Check expiry
    if (session.invite_expires_at && new Date(session.invite_expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invite has expired. Please contact the hiring team.' }, { status: 400 })
    }

    // Check if already used (completed/active/evaluated)
    if (['active', 'completed', 'evaluated'].includes(session.status)) {
      return NextResponse.json({ error: 'This invite has already been used.' }, { status: 400 })
    }

    // Select questions
    const coreQuestions = selectSessionQuestions(10)
    const warmUpQuestion = selectWarmUpQuestion()

    const firstName = session.candidate_name.split(' ')[0]
    const greetingText = `Hi ${firstName} — welcome, and thanks for making time for this. I'm an AI interviewer for Cuemath, and I'll be talking with you for about ten minutes today. This isn't a test about math — I'm just going to ask you some questions about your experience with students and your approach to teaching. There are no trick questions. Just talk to me naturally. I'll be listening. Are you ready to begin?`

    return NextResponse.json({
      sessionId: session.id,
      candidateName: session.candidate_name,
      greetingText,
      warmUpQuestionId: warmUpQuestion.id,
      coreQuestionIds: coreQuestions.map((q: { id: string }) => q.id),
    })
  } catch (err) {
    console.error('Invite verify error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
