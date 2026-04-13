import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, getAuthClient } from '@/lib/supabase'
import { differenceInDays } from '@/lib/utils'

const SIGNED_URL_TTL = 3600 // 1 hour

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Admin-only
    const authClient = await getAuthClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { sessionId } = await params
    const supabase = getServiceClient()

    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .select('id, candidate_name, ended_at, recording_path')
      .eq('id', sessionId)
      .single()


    if (!session || !session.recording_path) {
      return NextResponse.json({ error: 'Recording not available.' }, { status: 404 })
    }

    // Enforce 30-day retention
    const endedAt = session.ended_at ? new Date(session.ended_at) : null
    if (!endedAt || differenceInDays(new Date(), endedAt) > 30) {
      return NextResponse.json({ error: 'Recording expired (30-day retention).' }, { status: 410 })
    }

    const candidateName = (session.candidate_name || 'candidate')
      .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const dateStr = endedAt.toISOString().split('T')[0]

    // Try two possible folder paths:
    //   1. New format (after fix): bucket root → {sessionId}/turn_X.wav
    //   2. Old format (before fix): nested  → recordings/{sessionId}/turn_X.wav
    // Both store recording_path as 'recordings/{sessionId}/' in the DB.
    const candidatePaths = [
      sessionId,                    // new: files at {sessionId}/ in bucket
      `recordings/${sessionId}`,    // old: files at recordings/{sessionId}/ in bucket
    ]

    let audioFiles: Array<{ name: string }> = []
    let resolvedFolder = ''

    for (const folderPath of candidatePaths) {
      const { data: files, error: listErr } = await supabase.storage
        .from('recordings')
        .list(folderPath, { sortBy: { column: 'name', order: 'asc' } })

      if (!listErr && files && files.length > 0) {
        const valid = files.filter(f => f.name && f.id) // id is null for folders, set for real files
        if (valid.length > 0) {
          audioFiles = valid
          resolvedFolder = folderPath
          break
        }
      }
    }

    if (audioFiles.length === 0) {
      return NextResponse.json({ error: 'No recording files found.' }, { status: 404 })
    }

    // Bulk-sign all URLs in one API call (much faster than one-by-one)
    const paths = audioFiles.map(f => `${resolvedFolder}/${f.name}`)
    const { data: signedList, error: bulkSignErr } = await supabase.storage
      .from('recordings')
      .createSignedUrls(paths, SIGNED_URL_TTL)

    if (bulkSignErr || !signedList || signedList.length === 0) {
      return NextResponse.json({ error: 'Could not generate recording URLs.' }, { status: 500 })
    }

    const turns: Array<{ turn: number; url: string; filename: string }> = []

    for (const item of signedList) {
      if (!item.signedUrl) continue
      const fname = item.path?.split('/').pop() ?? ''
      const turnMatch = fname.match(/turn_(\d+)/)
      const turnNumber = turnMatch ? parseInt(turnMatch[1], 10) : 0
      turns.push({
        turn: turnNumber,
        url: item.signedUrl,
        filename: `${candidateName}-${dateStr}-turn${turnNumber}-${fname}`,
      })
    }

    // Sort by turn number
    turns.sort((a, b) => a.turn - b.turn)

    if (turns.length === 0) {
      return NextResponse.json({ error: 'Could not generate recording URLs.' }, { status: 500 })
    }

    return NextResponse.json({ turns, expiresIn: SIGNED_URL_TTL })
  } catch (err) {
    console.error('[recording] route error:', err)
    return NextResponse.json({ error: 'Recording not available.' }, { status: 500 })
  }
}
