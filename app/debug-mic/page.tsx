'use client'

import { useEffect, useRef, useState } from 'react'

export default function DebugMicPage() {
  const [log, setLog] = useState<string[]>([])
  const [rms, setRms] = useState(0)
  const [audioCtxState, setAudioCtxState] = useState('—')
  const [chunkCount, setChunkCount] = useState(0)
  const [lastChunkSize, setLastChunkSize] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [busy, setBusy] = useState(false)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const rafRef = useRef<number | null>(null)
  const chunksRef = useRef<Blob[]>([])

  function addLog(msg: string) {
    setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50))
  }

  async function startTest() {
    addLog('Requesting mic...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      addLog('✅ Mic granted. Tracks: ' + stream.getTracks().map(t => t.readyState).join(', '))

      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      addLog('AudioContext state: ' + ctx.state)
      setAudioCtxState(ctx.state)

      if (ctx.state === 'suspended') {
        addLog('AudioContext suspended — trying resume...')
        await ctx.resume()
        addLog('After resume: ' + ctx.state)
        setAudioCtxState(ctx.state)
      }

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      analyserRef.current = analyser
      ctx.createMediaStreamSource(stream).connect(analyser)
      addLog('Analyser connected. fftSize=' + analyser.fftSize)

      // Start amplitude loop
      const data = new Uint8Array(analyser.frequencyBinCount)
      function loop() {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const s = (data[i] - 128) / 128
          sum += s * s
        }
        const r = Math.sqrt(sum / data.length)
        setRms(r)
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)

      // Start MediaRecorder
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', ''].find(t => !t || MediaRecorder.isTypeSupported(t)) ?? ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      recorderRef.current = recorder
      chunksRef.current = []
      addLog('MediaRecorder mimeType: ' + recorder.mimeType)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
          setChunkCount(c => c + 1)
          setLastChunkSize(e.data.size)
          addLog(`Chunk #${chunksRef.current.length}: ${e.data.size} bytes (${e.data.size > 3000 ? '🗣 SPEECH' : '🔇 silence'})`)
        }
      }

      recorder.start(3000)
      addLog('Recording started (3s timeslice)')
    } catch (err) {
      addLog('❌ Error: ' + String(err))
    }
  }

  async function stopAndTranscribe() {
    setBusy(true)
    addLog('Stopping recorder...')
    const recorder = recorderRef.current
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    await new Promise<void>(resolve => {
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = () => resolve()
        recorder.stop()
      } else resolve()
    })

    addLog(`Collected ${chunksRef.current.length} chunks total`)

    if (chunksRef.current.length === 0) {
      addLog('❌ No audio chunks — nothing to transcribe')
      setBusy(false)
      return
    }

    const blob = new Blob(chunksRef.current, { type: recorderRef.current?.mimeType || 'audio/webm' })
    const mimeType = blob.type.split(';')[0]
    const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm'
    addLog(`Sending blob: ${blob.size} bytes, type=${mimeType}, ext=${ext}`)

    const fd = new FormData()
    fd.append('audio', new Blob([blob], { type: mimeType }), `audio.${ext}`)
    fd.append('sessionId', 'debug')
    fd.append('turnNumber', '0')
    fd.append('isFinal', 'false') // false = skip DB storage, just transcribe

    try {
      const res = await fetch('/api/speech/transcribe', { method: 'POST', body: fd })
      const data = await res.json()
      addLog(`Transcribe status: ${res.status}`)
      addLog(`Transcript: "${data.transcript || '(empty)'}"`)
      addLog(`Error: ${data.error || 'none'}`)
      setTranscript(data.transcript || '')
    } catch (err) {
      addLog('❌ Transcribe fetch error: ' + String(err))
    }
    setBusy(false)
  }

  function resumeCtx() {
    const ctx = audioCtxRef.current
    if (!ctx) { addLog('No AudioContext yet'); return }
    ctx.resume().then(() => {
      addLog('Resumed. State: ' + ctx.state)
      setAudioCtxState(ctx.state)
    })
  }

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      recorderRef.current?.stop()
      audioCtxRef.current?.close()
    }
  }, [])

  const rmsBar = Math.min(100, Math.round(rms * 1000))

  return (
    <div style={{ fontFamily: 'monospace', padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>🎤 Mic Debug</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={startTest} style={btnStyle('#2563eb')}>Start mic + recorder</button>
        <button onClick={stopAndTranscribe} disabled={busy} style={btnStyle('#16a34a')}>Stop + send to Whisper</button>
        <button onClick={resumeCtx} style={btnStyle('#d97706')}>Force resume AudioContext</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <Stat label="AudioContext state" value={audioCtxState} ok={audioCtxState === 'running'} />
        <Stat label="RMS amplitude" value={rms.toFixed(4)} ok={rms > 0.01} />
        <Stat label="Chunks received" value={String(chunkCount)} ok={chunkCount > 0} />
        <Stat label="Last chunk size" value={`${lastChunkSize} bytes`} ok={lastChunkSize > 3000} />
      </div>

      {/* RMS bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, marginBottom: 4, color: '#6b7280' }}>Live amplitude (speak now)</div>
        <div style={{ height: 16, background: '#e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${rmsBar}%`, background: rmsBar > 10 ? '#16a34a' : '#d1d5db', transition: 'width 0.05s' }} />
        </div>
      </div>

      {transcript && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#15803d', marginBottom: 4 }}>Transcript</div>
          <div style={{ fontSize: 14 }}>{transcript}</div>
        </div>
      )}

      <div style={{ background: '#111827', borderRadius: 8, padding: 12, maxHeight: 300, overflowY: 'auto' }}>
        {log.length === 0 && <div style={{ color: '#6b7280', fontSize: 13 }}>Press "Start mic + recorder" to begin</div>}
        {log.map((l, i) => (
          <div key={i} style={{ color: l.includes('❌') ? '#f87171' : l.includes('✅') ? '#4ade80' : '#e5e7eb', fontSize: 12, marginBottom: 2 }}>{l}</div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div style={{ background: ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${ok ? '#86efac' : '#fca5a5'}`, borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ fontSize: 11, color: '#6b7280' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: ok ? '#15803d' : '#dc2626' }}>{value}</div>
    </div>
  )
}

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }
}
