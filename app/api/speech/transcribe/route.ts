import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getServiceClient } from '@/lib/supabase'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioBlob = formData.get('audio') as Blob | null
    const sessionId = formData.get('sessionId') as string | null
    const turnNumberStr = formData.get('turnNumber') as string | null
    const isFinalStr = formData.get('isFinal') as string | null

    if (!audioBlob || !sessionId) {
      return NextResponse.json({ error: 'Missing audio or sessionId.' }, { status: 400 })
    }

    const turnNumber = turnNumberStr ? parseInt(turnNumberStr, 10) : 0
    const isFinal = isFinalStr === 'true'

    // Allow 'debug' sessionId to bypass DB check (used by /debug-mic test page)
    const isDebug = sessionId === 'debug'
    const supabase = isDebug ? null : getServiceClient()

    if (!isDebug) {
      const { data: session } = await supabase!
        .from('sessions')
        .select('id, status')
        .eq('id', sessionId)
        .single()

      if (!session) {
        return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
      }
    }

    // Normalize MIME type — strip codec suffix that Whisper rejects
    // e.g. 'audio/webm;codecs=opus' → 'audio/webm'
    const rawMime = audioBlob.type || 'audio/webm'
    const mimeType = rawMime.split(';')[0].trim()
    const ext = mimeType.includes('mp4') ? 'm4a'
      : mimeType.includes('ogg') ? 'ogg'
      : mimeType.includes('wav') ? 'wav'
      : 'webm'
    const audioFile = new File([audioBlob], `audio.${ext}`, { type: mimeType })

    // Save audio to Supabase Storage BEFORE transcription — ensures recording is persisted
    // even if Whisper fails. Only on final chunk, skip for debug sessions.
    if (!isDebug && isFinal && audioBlob.size > 500) {
      try {
        const arrayBuffer = await audioBlob.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        // Path within the 'recordings' bucket — do NOT repeat the bucket name as prefix
        const storagePath = `${sessionId}/turn_${turnNumber}.${ext}`

        const { error: uploadError } = await supabase!.storage
          .from('recordings')
          .upload(storagePath, buffer, {
            contentType: mimeType,
            upsert: true,
          })

        if (uploadError) {
          console.error('Storage upload error:', uploadError.message, '| path:', storagePath, '| size:', buffer.length)
        } else {
          const { error: dbErr } = await supabase!
            .from('sessions')
            .update({ recording_path: `recordings/${sessionId}/` })
            .eq('id', sessionId)
          if (dbErr) console.error('recording_path update error:', dbErr.message)
          else console.log('Recording saved:', storagePath, 'size:', buffer.length)
        }
      } catch (storageErr) {
        console.error('Storage upload exception:', storageErr)
      }
    }

    let transcript = ''
    let confidence = 1.0
    let detectedLanguage = 'en'

    try {
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'verbose_json',
        language: 'en',
      })

      transcript = transcription.text || ''
      detectedLanguage = (transcription as unknown as { language?: string }).language || 'en'

      // Estimate confidence from avg log probability if available
      const verboseResult = transcription as unknown as {
        segments?: Array<{ avg_logprob: number }>
      }
      if (verboseResult.segments && verboseResult.segments.length > 0) {
        const avgLogProb =
          verboseResult.segments.reduce((sum, s) => sum + s.avg_logprob, 0) /
          verboseResult.segments.length
        confidence = Math.max(0, Math.min(1, Math.exp(avgLogProb) + 0.5))
      }
    } catch (whisperErr) {
      console.error('Whisper transcription error:', whisperErr)
      return NextResponse.json(
        { transcript: '', confidence: 0, isFinal, error: 'Transcription failed.' },
        { status: 200 }
      )
    }

    return NextResponse.json({
      transcript,
      confidence,
      detectedLanguage,
      isFinal,
    })
  } catch (err) {
    console.error('Transcribe route error:', err)
    return NextResponse.json(
      { transcript: '', confidence: 0, isFinal: false, error: 'Internal error.' },
      { status: 500 }
    )
  }
}
