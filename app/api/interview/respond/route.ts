import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getServiceClient } from '@/lib/supabase'
import { buildInterviewerSystemPrompt } from '@/lib/prompts'
import type { ConversationMessage, InterviewPhase, NextAction, RubricDimension } from '@/lib/types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function generateTTS(text: string): Promise<string | null> {
  const voiceId = process.env.ELEVENLABS_VOICE_ID
  const apiKey = process.env.ELEVENLABS_API_KEY

  if (!voiceId || !apiKey) return null

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    )

    if (!response.ok) return null

    const audioBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(audioBuffer).toString('base64')
    return `data:audio/mpeg;base64,${base64}`
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      sessionId,
      turnTranscript,
      conversationHistory,
      phase,
      questionsAsked,
      remainingQuestions,
      candidateName,
      nextAction: requestedNextAction,
    } = body as {
      sessionId: string
      turnTranscript: string
      conversationHistory: ConversationMessage[]
      phase: InterviewPhase
      questionsAsked: string[]
      remainingQuestions: Partial<Record<RubricDimension, string[]>>
      candidateName: string
      nextAction: string
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId.' }, { status: 400 })
    }

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

    // Mark session as active on first turn
    if (session.status === 'pending') {
      await supabase
        .from('sessions')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', sessionId)
    }

    // Store incoming candidate message if we have one
    if (turnTranscript && turnTranscript.trim()) {
      const turnNumber = conversationHistory.filter(m => m.role === 'user').length + 1
      await supabase.from('messages').insert({
        session_id: sessionId,
        role: 'user',
        content: turnTranscript.trim(),
        turn_number: turnNumber,
      })
    }

    // Determine next action
    const currentPhase: InterviewPhase = phase || 'core'
    const nextAction = requestedNextAction || 'acknowledge_and_ask'

    // Build system prompt
    const systemPrompt = buildInterviewerSystemPrompt(
      conversationHistory,
      remainingQuestions,
      currentPhase,
      nextAction,
      candidateName || session.candidate_name || 'there'
    )

    // Build messages for Claude
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

    // Add conversation history
    for (const msg of conversationHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    // Add the current candidate response as context if present
    if (turnTranscript && turnTranscript.trim()) {
      messages.push({ role: 'user', content: turnTranscript.trim() })
    }

    // Ensure we have at least one user message for Claude
    if (messages.length === 0) {
      messages.push({ role: 'user', content: '(Interview is beginning — please say your greeting)' })
    }

    // Call GPT-4o
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 512,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    })

    const responseText = gptResponse.choices[0]?.message?.content ?? ''

    if (!responseText) {
      return NextResponse.json(
        { error: "I'm having a moment — give me a second." },
        { status: 500 }
      )
    }

    // Determine new phase
    let newPhase: InterviewPhase = currentPhase
    if (
      currentPhase === 'core' &&
      Object.keys(remainingQuestions).length === 0
    ) {
      newPhase = 'closing'
    }

    // Determine next action for the client
    let outNextAction: NextAction = 'acknowledge_and_ask'
    if (newPhase === 'closing') {
      outNextAction = 'close'
    }

    // Store AI response
    const turnNumber = conversationHistory.filter(m => m.role === 'assistant').length + 1
    await supabase.from('messages').insert({
      session_id: sessionId,
      role: 'assistant',
      content: responseText,
      turn_number: turnNumber,
    })

    // Generate TTS audio
    const audioData = await generateTTS(responseText)

    return NextResponse.json({
      responseText,
      audioData,
      nextAction: outNextAction,
      phase: newPhase,
    })
  } catch (err) {
    console.error('Interview respond error:', err)
    return NextResponse.json(
      { error: "I'm having a moment — give me a second." },
      { status: 500 }
    )
  }
}
