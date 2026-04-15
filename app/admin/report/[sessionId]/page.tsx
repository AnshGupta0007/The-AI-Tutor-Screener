'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatDate, formatDuration } from '@/lib/utils'
import { FLAG_INFO } from '@/lib/types'
import type { ConversationMessage } from '@/lib/types'
import RadarChart from './components/RadarChart'
import type { RadarDimension } from './components/RadarChart'

interface AdminReportData {
  session: {
    id: string
    candidateName: string
    candidateEmail: string
    status: string
    startedAt: string
    endedAt: string
    createdAt: string
    recordingPath: string | null
  }
  evaluation: {
    clarity: number
    teachingAbility: number
    patience: number
    warmth: number
    fluency: number
    compositeScore: number
    recommendation: string
    justifications: Record<string, string>
    excerpts: Record<string, string[]>
    flags: string[]
    summary: string
  } | null
  transcript: ConversationMessage[]
  recordingAvailable: boolean
  percentile: number | null
  totalEvaluated: number
}

const DIMENSIONS = [
  { key: 'clarity', label: 'Communication Clarity', weight: '25%' },
  { key: 'teachingAbility', label: 'Ability to Simplify', weight: '25%' },
  { key: 'patience', label: 'Patience', weight: '20%' },
  { key: 'warmth', label: 'Warmth', weight: '20%' },
  { key: 'fluency', label: 'English Fluency', weight: '10%' },
] as const

const RECOMMENDATION_STYLES: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  strong_hire: { label: 'Strong Hire', bg: '#DCFCE7', text: '#15803D', icon: '✅' },
  consider: { label: 'Consider', bg: '#FEF9C3', text: '#854D0E', icon: '🟡' },
  do_not_advance: { label: 'Do Not Advance', bg: '#FEE2E2', text: '#991B1B', icon: '❌' },
}

const FILLERS = ['um', 'uh', 'like', 'you know', 'basically', 'right', 'actually', 'literally']
function analyzeSpeech(transcript: ConversationMessage[]) {
  const userMsgs = transcript.filter(m => m.role === 'user')
  if (!userMsgs.length) return null
  const allText = userMsgs.map(m => m.content.toLowerCase()).join(' ')
  const words = allText.split(/\s+/).filter(Boolean)
  const fillerCount = FILLERS.reduce((acc, f) => {
    return acc + (allText.match(new RegExp(`\\b${f.replace(' ', '\\s+')}\\b`, 'g')) || []).length
  }, 0)
  const avgWords = Math.round(words.length / userMsgs.length)
  const fillerRate = words.length > 0 ? +((fillerCount / words.length) * 100).toFixed(1) : 0
  return { totalWords: words.length, avgWordsPerResponse: avgWords, fillerCount, fillerRate, responses: userMsgs.length }
}

function ScoreBar({ score, label, weight }: { score: number; label: string; weight: string }) {
  const pct = (score / 5) * 100
  const color = score >= 4 ? 'var(--success)' : score >= 3 ? 'var(--accent-speaking)' : 'var(--danger)'
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {label}
          <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>— {weight}</span>
        </span>
        <span className="text-sm font-semibold" style={{ color }}>{score.toFixed(1)}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-subtle)' }}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export default function AdminReportPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const [report, setReport] = useState<AdminReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [turns, setTurns] = useState<Array<{ turn: number; url: string; filename: string }>>([])
  const [audioLoading, setAudioLoading] = useState(false)
  const [downloadingTurn, setDownloadingTurn] = useState<number | null>(null)
  const [decisionLoading, setDecisionLoading] = useState<'accept' | 'reject' | null>(null)
  const [decisionSent, setDecisionSent] = useState<'accept' | 'reject' | null>(null)
  const [generatingMerged, setGeneratingMerged] = useState(false)
  const [mergeProgress, setMergeProgress] = useState('')

  useEffect(() => {
    async function loadReport() {
      try {
        const res = await fetch(`/api/report/${sessionId}?admin=true`)
        if (res.status === 401) {
          router.push(`/admin/login?next=/admin/report/${sessionId}`)
          return
        }
        if (res.status === 404) { setError('Report not found.'); setLoading(false); return }
        if (!res.ok) { setError('Could not load report.'); setLoading(false); return }
        const data = await res.json()
        setReport(data)
        setLoading(false)
      } catch {
        setError('Could not load report.')
        setLoading(false)
      }
    }
    loadReport()
  }, [sessionId, router])

  async function handleSignOut() {
    setSigningOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  async function handleDecision(decision: 'accept' | 'reject') {
    if (decisionLoading || decisionSent) return
    setDecisionLoading(decision)
    try {
      const res = await fetch('/api/admin/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, decision }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Could not send decision.')
      } else {
        setDecisionSent(decision)
        setReport(prev => prev ? { ...prev, session: { ...prev.session, status: decision === 'accept' ? 'accepted' : 'rejected' } } : prev)
      }
    } finally {
      setDecisionLoading(null)
    }
  }

  function handleDownloadTranscript() {
    if (!report) return
    const { session, evaluation, transcript } = report

    const lines: string[] = []

    // ── Header ────────────────────────────────────────────
    lines.push('CUEMATH AI TUTOR SCREENER — INTERVIEW TRANSCRIPT')
    lines.push('='.repeat(60))
    lines.push('')
    lines.push(`Candidate : ${session.candidateName}`)
    if (session.candidateEmail) lines.push(`Email     : ${session.candidateEmail}`)
    lines.push(`Date      : ${new Date(session.endedAt || session.createdAt).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}`)
    if (session.startedAt && session.endedAt) {
      const secs = Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
      const m = Math.floor(secs / 60), s = secs % 60
      lines.push(`Duration  : ${m}m ${s}s`)
    }

    // ── Evaluation summary ────────────────────────────────
    if (evaluation) {
      lines.push('')
      lines.push('─'.repeat(60))
      lines.push('EVALUATION SUMMARY')
      lines.push('─'.repeat(60))
      lines.push(`Composite Score  : ${evaluation.compositeScore.toFixed(2)} / 5.0`)
      lines.push(`Recommendation   : ${evaluation.recommendation.replace(/_/g, ' ').toUpperCase()}`)
      lines.push('')
      const dimLabels: Record<string, string> = {
        clarity: 'Communication Clarity (25%)',
        teachingAbility: 'Ability to Simplify    (25%)',
        patience: 'Patience               (20%)',
        warmth: 'Warmth                 (20%)',
        fluency: 'English Fluency        (10%)',
      }
      for (const [k, label] of Object.entries(dimLabels)) {
        const score = k === 'teachingAbility' ? evaluation.teachingAbility : (evaluation as Record<string, unknown>)[k] as number
        lines.push(`  ${label} : ${score?.toFixed(1) ?? 'N/A'}`)
      }
      if (evaluation.flags?.length) {
        lines.push('')
        lines.push(`Flags : ${evaluation.flags.join(', ')}`)
      }
      if (evaluation.summary) {
        lines.push('')
        lines.push('Summary:')
        lines.push(evaluation.summary)
      }
    }

    // ── Transcript ────────────────────────────────────────
    lines.push('')
    lines.push('─'.repeat(60))
    lines.push('FULL TRANSCRIPT')
    lines.push('─'.repeat(60))
    lines.push('')

    for (const msg of transcript.filter(m => m.role !== 'system')) {
      const speaker = msg.role === 'assistant' ? 'AI INTERVIEWER' : 'CANDIDATE'
      const turnTag = ''
      const confTag = msg.role === 'user' && msg.confidence != null && msg.confidence < 0.6 ? ' [low confidence]' : ''
      lines.push(`${speaker}${turnTag}${confTag}`)
      lines.push(msg.content)
      lines.push('')
    }

    lines.push('─'.repeat(60))
    lines.push(`Generated by Cuemath AI Screener · ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}`)

    const scoreColor = (s: number) => s >= 4 ? '#16A34A' : s >= 3 ? '#D97706' : '#DC2626'
    const recStyle: Record<string, { bg: string; text: string }> = {
      strong_hire:    { bg: '#DCFCE7', text: '#15803D' },
      consider:       { bg: '#FEF9C3', text: '#854D0E' },
      do_not_advance: { bg: '#FEE2E2', text: '#991B1B' },
    }
    const rs = evaluation ? (recStyle[evaluation.recommendation] ?? { bg: '#F3F4F6', text: '#374151' }) : null
    const dimList = [
      { label: 'Communication Clarity', weight: '25%', score: evaluation?.clarity },
      { label: 'Ability to Simplify',   weight: '25%', score: evaluation?.teachingAbility },
      { label: 'Patience',              weight: '20%', score: evaluation?.patience },
      { label: 'Warmth',                weight: '20%', score: evaluation?.warmth },
      { label: 'English Fluency',       weight: '10%', score: evaluation?.fluency },
    ]

    const transcriptHtml = transcript
      .filter(m => m.role !== 'system')
      .map(m => {
        const isAI = m.role === 'assistant'
        const lowConf = !isAI && m.confidence != null && m.confidence < 0.6
        return `
          <div style="margin-bottom:16px;">
            <div style="font-size:11px;font-weight:700;color:${isAI ? '#5B4CF5' : '#059669'};
              text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">
              ${isAI ? 'AI Interviewer' : 'Candidate'}
              ${lowConf ? '<span style="color:#D97706;font-size:10px;"> · unclear audio</span>' : ''}
            </div>
            <div style="font-size:13px;line-height:1.6;color:#1a1a2e;
              background:${isAI ? '#EEEBFF' : '#F0FDF4'};
              border-left:3px solid ${isAI ? '#5B4CF5' : '#22C55E'};
              padding:10px 14px;border-radius:0 8px 8px 0;">
              ${m.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </div>
          </div>`
      }).join('')

    const scoreRows = dimList.map(d => {
      const s = d.score ?? 0
      const pct = (s / 5) * 100
      const c = scoreColor(s)
      return `
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#1a1a2e;">${d.label}</td>
          <td style="padding:8px 12px;font-size:11px;color:#6b7280;">${d.weight}</td>
          <td style="padding:8px 0;width:140px;">
            <div style="background:#E5E7EB;border-radius:4px;height:8px;overflow:hidden;">
              <div style="width:${pct}%;background:${c};height:100%;border-radius:4px;"></div>
            </div>
          </td>
          <td style="padding:8px 0 8px 12px;font-size:13px;font-weight:700;color:${c};text-align:right;">${s.toFixed(1)}</td>
        </tr>`
    }).join('')

    const justHtml = dimList.map(d => {
      const jKey = d.label === 'Ability to Simplify' ? 'teaching_ability'
        : d.label === 'Communication Clarity' ? 'clarity'
        : d.label.toLowerCase()
      const just = evaluation?.justifications?.[jKey]
      const excs = evaluation?.excerpts?.[jKey] ?? []
      if (!just) return ''
      return `
        <div style="margin-bottom:18px;page-break-inside:avoid;">
          <div style="font-size:12px;font-weight:700;color:#1a1a2e;margin-bottom:4px;">
            ${d.label} <span style="color:#6b7280;font-weight:400;">${d.weight}</span>
            <span style="float:right;color:${scoreColor(d.score ?? 0)};font-weight:800;">${(d.score ?? 0).toFixed(1)}</span>
          </div>
          <p style="font-size:12.5px;color:#374151;line-height:1.6;margin:0 0 8px;">${just}</p>
          ${excs.map(e => `<blockquote style="margin:4px 0;padding:4px 10px;border-left:3px solid #C7D2FE;
            font-size:12px;color:#6b7280;font-style:italic;">"${e.replace(/</g,'&lt;')}"</blockquote>`).join('')}
        </div>`
    }).join('')

    const date = new Date(session.endedAt || session.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Cuemath Report — ${session.candidateName}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',system-ui,sans-serif;color:#1a1a2e;background:#fff;font-size:13px;}
      @page{margin:28mm 22mm;size:A4}
      @media print{.pagebreak{page-break-before:always}}
    </style></head><body>

    <!-- Header bar -->
    <div style="background:linear-gradient(135deg,#5B4CF5,#8B5CF6);padding:22px 28px;border-radius:0 0 12px 12px;margin-bottom:28px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.2);
            display:flex;align-items:center;justify-content:center;
            font-weight:900;font-size:16px;color:#fff;">C</div>
          <div>
            <div style="color:#fff;font-weight:700;font-size:15px;">Cuemath AI Screener</div>
            <div style="color:rgba(255,255,255,.7);font-size:11px;">Evaluation Report</div>
          </div>
        </div>
        <div style="color:rgba(255,255,255,.85);font-size:11px;text-align:right;">
          ${date}<br>${session.candidateEmail ?? ''}
        </div>
      </div>
    </div>

    <div style="padding:0 4px;">

    <!-- Candidate + recommendation -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
      <div>
        <h1 style="font-size:22px;font-weight:800;color:#0D0D1A;">${session.candidateName}</h1>
        ${evaluation ? `<div style="margin-top:10px;">
          <span style="background:${rs?.bg};color:${rs?.text};padding:4px 12px;border-radius:20px;
            font-size:12px;font-weight:700;">
            ${(evaluation.recommendation ?? '').replace(/_/g,' ').toUpperCase()}
          </span>
        </div>` : ''}
      </div>
      ${evaluation ? `<div style="text-align:right;">
        <div style="font-size:36px;font-weight:900;color:#0D0D1A;">${evaluation.compositeScore.toFixed(2)}</div>
        <div style="font-size:12px;color:#6b7280;">out of 5.0</div>
      </div>` : ''}
    </div>

    ${evaluation?.summary ? `
    <!-- Summary -->
    <div style="background:#F5F3FF;border-left:4px solid #5B4CF5;padding:14px 18px;border-radius:0 10px 10px 0;margin-bottom:24px;">
      <div style="font-size:10px;font-weight:700;color:#5B4CF5;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">Hiring Manager Summary</div>
      <p style="font-size:13px;color:#1a1a2e;line-height:1.65;">${evaluation.summary}</p>
    </div>` : ''}

    <!-- Score table -->
    ${evaluation ? `
    <div style="margin-bottom:28px;">
      <div style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px;">Dimension Scores</div>
      <table style="width:100%;border-collapse:collapse;">${scoreRows}</table>
    </div>` : ''}

    <!-- Per-dimension justifications -->
    ${evaluation ? `
    <div style="margin-bottom:28px;">
      <div style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:.1em;text-transform:uppercase;margin-bottom:14px;">Dimension Analysis</div>
      ${justHtml}
    </div>` : ''}

    ${evaluation?.flags?.length ? `
    <div style="margin-bottom:28px;">
      <div style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px;">Behavioural Flags</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${evaluation.flags.map(f => `<span style="background:#F3F4F6;color:#374151;
          padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;">${f}</span>`).join('')}
      </div>
    </div>` : ''}

    <!-- Transcript -->
    <div class="pagebreak" style="margin-bottom:20px;">
      <div style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:.1em;text-transform:uppercase;margin-bottom:16px;">Full Interview Transcript</div>
      ${transcriptHtml}
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #E5E7EB;padding-top:12px;margin-top:8px;
      font-size:10px;color:#9CA3AF;display:flex;justify-content:space-between;">
      <span>Cuemath AI Tutor Screener</span>
      <span>Generated ${new Date().toLocaleDateString('en-IN',{dateStyle:'long'})}</span>
    </div>

    </div>
    <script>window.onload=()=>{window.print()}<\/script>
    </body></html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  async function loadTurnAudio() {
    if (!report?.recordingAvailable || audioLoading || turns.length > 0) return
    setAudioLoading(true)
    try {
      const res = await fetch(`/api/recording/${sessionId}`)
      if (!res.ok) { alert('Recording not available.'); setAudioLoading(false); return }
      const data = await res.json()
      setTurns(data.turns || [])
    } catch {
      alert('Could not load recordings.')
    }
    setAudioLoading(false)
  }

  async function handleDownloadTurn(turn: { url: string; filename: string }, turnIndex: number) {
    setDownloadingTurn(turnIndex)
    try {
      // Fetch the blob first — <a download> doesn't work for cross-origin signed URLs
      const res = await fetch(turn.url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = turn.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch {
      alert('Could not download recording.')
    }
    setDownloadingTurn(null)
  }

  async function handleDownloadAll() {
    for (let i = 0; i < turns.length; i++) {
      await handleDownloadTurn(turns[i], i)
      await new Promise(r => setTimeout(r, 500))
    }
  }

  function encodeWav(buffer: AudioBuffer): Blob {
    const numCh = 1 // mono
    const sr = buffer.sampleRate
    const numSamples = buffer.length
    const byteLen = 44 + numSamples * numCh * 2
    const ab = new ArrayBuffer(byteLen)
    const v = new DataView(ab)
    const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
    w(0, 'RIFF'); v.setUint32(4, byteLen - 8, true); w(8, 'WAVE')
    w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true)
    v.setUint16(22, numCh, true); v.setUint32(24, sr, true)
    v.setUint32(28, sr * numCh * 2, true); v.setUint16(32, numCh * 2, true); v.setUint16(34, 16, true)
    w(36, 'data'); v.setUint32(40, numSamples * numCh * 2, true)
    const ch = buffer.getChannelData(0)
    let off = 44
    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]))
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
      off += 2
    }
    return new Blob([ab], { type: 'audio/wav' })
  }

  async function generateMergedAudio() {
    if (generatingMerged) return

    // Ensure turn audio is loaded first
    let loadedTurns = turns
    if (loadedTurns.length === 0 && report?.recordingAvailable) {
      setMergeProgress('Loading recordings...')
      try {
        const res = await fetch(`/api/recording/${sessionId}`)
        if (res.ok) {
          const data = await res.json()
          loadedTurns = data.turns || []
          setTurns(loadedTurns)
        }
      } catch { /* continue without candidate audio */ }
    }

    setGeneratingMerged(true)
    setMergeProgress('Starting...')

    try {
      const tempCtx = new AudioContext()
      const messages = (report?.transcript || []).filter(m => m.role !== 'system')
      const decoded: AudioBuffer[] = []
      let aiCount = 0
      let candidateCount = 0

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i]

        if (msg.role === 'assistant') {
          aiCount++
          setMergeProgress(`Synthesizing AI question ${aiCount}...`)
          try {
            const res = await fetch('/api/speech/synthesize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: msg.content }),
            })
            const data = await res.json()
            if (data.audioData) {
              const base64 = data.audioData.includes(',') ? data.audioData.split(',')[1] : data.audioData
              const binary = atob(base64)
              const bytes = new Uint8Array(binary.length)
              for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j)
              const buf = await tempCtx.decodeAudioData(bytes.buffer.slice(0))
              decoded.push(buf)
            }
          } catch { /* skip this message if synthesis fails */ }

        } else if (msg.role === 'user') {
          candidateCount++
          setMergeProgress(`Fetching candidate answer ${candidateCount}...`)
          const turnNum = msg.turnNumber
          const turn = loadedTurns.find(t => t.turn === turnNum)
          if (turn) {
            try {
              const res = await fetch(turn.url)
              const arrayBuf = await res.arrayBuffer()
              const buf = await tempCtx.decodeAudioData(arrayBuf)
              decoded.push(buf)
            } catch { /* skip undecodable audio */ }
          }
        }
      }

      if (decoded.length === 0) {
        alert('No audio segments could be generated. Make sure ElevenLabs is configured and recordings are loaded.')
        setGeneratingMerged(false)
        setMergeProgress('')
        return
      }

      setMergeProgress('Merging audio...')

      // Render all buffers in sequence via OfflineAudioContext (handles sample rate differences)
      const OUTPUT_SR = 44100
      const totalDuration = decoded.reduce((s, b) => s + b.duration, 0)
      const offCtx = new OfflineAudioContext(1, Math.ceil(totalDuration * OUTPUT_SR) + OUTPUT_SR, OUTPUT_SR)

      let startTime = 0
      for (const buf of decoded) {
        const src = offCtx.createBufferSource()
        src.buffer = buf
        src.connect(offCtx.destination)
        src.start(startTime)
        startTime += buf.duration
      }

      const rendered = await offCtx.startRendering()
      tempCtx.close()

      setMergeProgress('Encoding WAV...')
      const wavBlob = encodeWav(rendered)
      const url = URL.createObjectURL(wavBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${(report?.session.candidateName || 'interview').toLowerCase().replace(/\s+/g, '-')}-full-interview.wav`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setMergeProgress('Done!')
      setTimeout(() => setMergeProgress(''), 3000)
    } catch (err) {
      console.error('Merge error:', err)
      alert('Could not generate merged audio.')
      setMergeProgress('')
    }
    setGeneratingMerged(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <svg className="animate-spin h-7 w-7" style={{ color: 'var(--accent)' }} viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{error || 'Something went wrong.'}</p>
      </div>
    )
  }

  const { session, evaluation, transcript, recordingAvailable } = report
  const rec = evaluation ? RECOMMENDATION_STYLES[evaluation.recommendation] : null
  const duration = session.startedAt && session.endedAt
    ? Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
    : 0

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <header
        className="border-b px-4 md:px-8 py-3 flex items-center justify-between"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
            style={{ background: 'var(--gradient-brand)' }}
          >
            C
          </div>
          <div>
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Cuemath</span>
            <span className="ml-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>Evaluation Report</span>
          </div>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button
            onClick={() => window.print()}
            className="text-xs px-3 py-1.5 rounded-lg border transition-all"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}
          >
            Print / PDF
          </button>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="text-xs px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}
          >
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </header>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          header { border-bottom: 1px solid #E5E7EB !important; }
          body { background: white !important; }
          button { display: none !important; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-6">
        {/* Candidate + Recommendation */}
        <div
          className="rounded-2xl p-6"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                {session.candidateName}
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {session.candidateEmail && `${session.candidateEmail} · `}
                {formatDate(session.endedAt || session.createdAt)}
                {duration > 0 && ` · ${formatDuration(duration)}`}
              </p>
            </div>
            {rec && evaluation && (
              <div className="flex flex-col items-start md:items-end gap-2">
                <div
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: rec.bg, color: rec.text }}
                >
                  <span>{rec.icon}</span>
                  <span>{rec.label}</span>
                </div>
                <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {evaluation.compositeScore.toFixed(2)}
                  <span className="text-base font-normal ml-1" style={{ color: 'var(--text-muted)' }}>/5.0</span>
                </div>
                {report.percentile !== null && report.totalEvaluated >= 2 && (
                  <div
                    className="text-xs font-semibold px-3 py-1 rounded-full"
                    style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
                  >
                    Better than {report.percentile}% of {report.totalEvaluated} candidates
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {evaluation ? (
          <>
            {/* Radar + Score bars */}
            {(() => {
              const radarDims: RadarDimension[] = DIMENSIONS.map(({ key, label, weight }) => {
                const score = (key === 'teachingAbility'
                  ? evaluation.teachingAbility
                  : evaluation[key as keyof typeof evaluation] as number) || 0
                const scoreColor = score >= 4 ? '#16A34A' : score >= 3 ? '#F59E0B' : '#DC2626'
                return {
                  key,
                  label,
                  shortLabel: key === 'teachingAbility' ? 'Teaching' : key === 'fluency' ? 'Fluency' : label.split(' ')[0],
                  score,
                  weight,
                  color: scoreColor,
                }
              })
              return (
                <div
                  className="rounded-2xl p-6"
                  style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                >
                  <h2 className="text-xs font-semibold tracking-widest mb-5" style={{ color: 'var(--text-muted)' }}>
                    DIMENSION SCORES
                  </h2>
                  <div className="flex flex-col md:flex-row gap-8 items-center">
                    {/* Radar chart */}
                    <div style={{ flex: '0 0 auto', width: '100%', maxWidth: 280 }}>
                      <RadarChart dimensions={radarDims} compositeScore={evaluation.compositeScore} />
                    </div>
                    {/* Score bars */}
                    <div style={{ flex: 1, width: '100%' }}>
                      {DIMENSIONS.map(({ key, label, weight }) => {
                        const score = key === 'teachingAbility'
                          ? evaluation.teachingAbility
                          : evaluation[key as keyof typeof evaluation] as number
                        return <ScoreBar key={key} score={score || 0} label={label} weight={weight} />
                      })}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Per-dimension justifications */}
            <div className="space-y-4">
              {DIMENSIONS.map(({ key, label }) => {
                const score = key === 'teachingAbility'
                  ? evaluation.teachingAbility
                  : evaluation[key as keyof typeof evaluation] as number
                const justKey = key === 'teachingAbility' ? 'teaching_ability' : key
                const justification = evaluation.justifications?.[justKey] || ''
                const excerpts = evaluation.excerpts?.[justKey] || []
                const color = score >= 4 ? 'var(--success)' : score >= 3 ? 'var(--accent-speaking)' : 'var(--danger)'

                return (
                  <div
                    key={key}
                    className="rounded-2xl p-5"
                    style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</h3>
                      <span
                        className="text-sm font-bold px-2 py-0.5 rounded"
                        style={{ backgroundColor: color + '20', color }}
                      >
                        {score?.toFixed(1)}
                      </span>
                    </div>
                    {justification && (
                      <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-primary)' }}>
                        {justification}
                      </p>
                    )}
                    {excerpts.length > 0 && (
                      <div className="space-y-2">
                        {excerpts.map((excerpt, i) => (
                          <blockquote
                            key={i}
                            className="pl-3 py-1 text-sm leading-relaxed italic"
                            style={{
                              borderLeft: `3px solid ${color}`,
                              color: 'var(--text-muted)',
                            }}
                          >
                            &ldquo;{excerpt}&rdquo;
                          </blockquote>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Flags — always shown */}
            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              <h2 className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                QUALITATIVE FLAGS
              </h2>
              {evaluation.flags && evaluation.flags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {evaluation.flags.map(flag => {
                    const info = FLAG_INFO[flag]
                    if (!info) return null
                    const styles = {
                      red: { bg: '#FEE2E2', text: '#991B1B' },
                      yellow: { bg: '#FEF9C3', text: '#854D0E' },
                      green: { bg: '#DCFCE7', text: '#15803D' },
                    }[info.severity]
                    return (
                      <span
                        key={flag}
                        className="px-3 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: styles.bg, color: styles.text }}
                      >
                        {info.severity === 'red' ? '🔴' : info.severity === 'yellow' ? '🟡' : '🟢'} {info.label}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No flags raised.</p>
              )}
            </div>

            {/* Speech Signals */}
            {(() => {
              const sp = analyzeSpeech(transcript)
              if (!sp) return null
              const fillerRisk = sp.fillerRate > 8 ? { label: 'High', color: 'var(--danger)', bg: '#FEE2E2' }
                : sp.fillerRate > 4 ? { label: 'Moderate', color: 'var(--warning)', bg: '#FEF9C3' }
                : { label: 'Low', color: 'var(--success)', bg: '#DCFCE7' }
              const paceLabel = sp.avgWordsPerResponse > 120 ? 'Detailed' : sp.avgWordsPerResponse > 60 ? 'Balanced' : 'Concise'
              return (
                <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <h2 className="text-xs font-semibold tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>SPEECH SIGNALS</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Total Words', value: sp.totalWords.toLocaleString(), sub: `across ${sp.responses} answers` },
                      { label: 'Avg per Answer', value: `${sp.avgWordsPerResponse}`, sub: paceLabel },
                      { label: 'Filler Words', value: sp.fillerCount.toString(), sub: `${sp.fillerRate}% of speech` },
                      { label: 'Filler Risk', value: fillerRisk.label, sub: '< 4% is ideal', valueBg: fillerRisk.bg, valueColor: fillerRisk.color },
                    ].map(stat => (
                      <div key={stat.label} className="rounded-xl p-3.5" style={{ backgroundColor: 'var(--bg-primary)' }}>
                        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                        <p className="text-xl font-bold mb-0.5" style={{ color: stat.valueColor ?? 'var(--text-primary)' }}>
                          {stat.value}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{stat.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Summary */}
            {evaluation.summary && (
              <div
                className="rounded-2xl p-5"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
              >
                <h2 className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                  SUMMARY
                </h2>
                <p className="text-base leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                  {evaluation.summary}
                </p>
              </div>
            )}
          </>
        ) : (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Evaluation is still processing. Please refresh in a moment.
            </p>
          </div>
        )}

        {/* Accept / Reject decision */}
        {evaluation && (
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            <h2 className="text-xs font-semibold tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
              HIRING DECISION
            </h2>
            {decisionSent ? (
              <div
                className="flex items-center gap-2 text-sm font-medium px-4 py-3 rounded-xl"
                style={{
                  backgroundColor: decisionSent === 'accept' ? '#DCFCE7' : '#FEE2E2',
                  color: decisionSent === 'accept' ? '#15803D' : '#991B1B',
                }}
              >
                {decisionSent === 'accept' ? '✓ Accepted — email sent to candidate' : '✗ Rejected — email sent to candidate'}
              </div>
            ) : session.status === 'accepted' ? (
              <div className="flex items-center gap-2 text-sm font-medium px-4 py-3 rounded-xl" style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}>
                ✓ Previously accepted
              </div>
            ) : session.status === 'rejected' ? (
              <div className="flex items-center gap-2 text-sm font-medium px-4 py-3 rounded-xl" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>
                ✗ Previously rejected
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => handleDecision('accept')}
                  disabled={!!decisionLoading}
                  className="flex-1 h-11 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: '#16A34A' }}
                >
                  {decisionLoading === 'accept' ? 'Sending...' : '✓ Accept — Send offer email'}
                </button>
                <button
                  onClick={() => handleDecision('reject')}
                  disabled={!!decisionLoading}
                  className="flex-1 h-11 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: '#DC2626' }}
                >
                  {decisionLoading === 'reject' ? 'Sending...' : '✗ Reject — Send rejection email'}
                </button>
              </div>
            )}
            {!session.candidateEmail && (
              <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                No email on file — status will be updated but no email will be sent.
              </p>
            )}
          </div>
        )}

        {/* Session Recording */}
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                Session Recordings
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {recordingAvailable
                  ? 'Candidate audio per turn — available for 30 days'
                  : 'Recording not available (expired or not captured).'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {recordingAvailable && turns.length === 0 && (
                <button
                  onClick={loadTurnAudio}
                  disabled={audioLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--accent)', opacity: audioLoading ? 0.5 : 1 }}
                >
                  {audioLoading ? 'Loading...' : '▶ Load recordings'}
                </button>
              )}
              {recordingAvailable && (
                <button
                  onClick={generateMergedAudio}
                  disabled={generatingMerged}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                  style={{ backgroundColor: generatingMerged ? '#6b7280' : 'var(--accent)', opacity: generatingMerged ? 0.8 : 1 }}
                >
                  {generatingMerged ? (mergeProgress || 'Generating...') : '⬇ Full interview audio'}
                </button>
              )}
              {turns.length > 0 && (
                <button
                  onClick={handleDownloadAll}
                  disabled={downloadingTurn !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                >
                  {downloadingTurn !== null ? 'Downloading...' : '↓ Download all turns'}
                </button>
              )}
            </div>
          </div>

          {turns.length > 0 && (
            <div className="space-y-2">
              {turns.map((t) => (
                <div
                  key={t.turn}
                  className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
                >
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Turn {t.turn + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium"
                      style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                    >
                      ▶ Play
                    </a>
                    <button
                      onClick={() => handleDownloadTurn(t, t.turn)}
                      disabled={downloadingTurn === t.turn}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium border"
                      style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                    >
                      {downloadingTurn === t.turn ? '...' : '↓'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Full transcript */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setTranscriptOpen(v => !v)}
              className="flex items-center gap-2 text-sm font-semibold"
              style={{ color: 'var(--accent)' }}
            >
              <svg
                className="w-4 h-4 transition-transform"
                style={{ transform: transcriptOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              Full Interview Transcript
              <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                ({transcript.filter(m => m.role !== 'system').length} messages)
              </span>
            </button>

            <button
              onClick={handleDownloadTranscript}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all no-print"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)', backgroundColor: 'var(--accent-light)' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF
            </button>
          </div>

          {transcriptOpen && transcript.length > 0 && (
            <div
              className="rounded-2xl p-5 space-y-4"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              {transcript.filter(m => m.role !== 'system').map((msg, i) => {
                const isAI = msg.role === 'assistant'
                return (
                  <div key={i} className={`flex ${isAI ? 'justify-start' : 'justify-end'}`}>
                    <div className="max-w-[85%] w-full">
                      <p
                        className={`text-xs mb-1 ${isAI ? '' : 'text-right'}`}
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {isAI ? 'Cuemath AI' : 'Candidate'}
                      </p>
                      <div
                        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${isAI ? 'rounded-tl-sm' : 'rounded-tr-sm'}`}
                        style={{
                          backgroundColor: isAI ? 'var(--bg-ai-message)' : 'var(--bg-candidate-message)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {msg.content}
                        {msg.role === 'user' && msg.confidence != null && msg.confidence < 0.6 && (
                          <span className="ml-1 text-xs italic" style={{ color: 'var(--text-muted)' }}>
                            [low confidence]
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
