'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  stream: MediaStream
  candidateName: string
  onReady: () => void
}

const BAR_COUNT = 14

export default function MicCheckScreen({ stream, candidateName, onReady }: Props) {
  const animFrameRef = useRef<number | null>(null)
  const [level, setLevel] = useState(0)   // 0–100
  const [hasSpoken, setHasSpoken] = useState(false)

  const firstName = candidateName.split(' ')[0]

  useEffect(() => {
    let ctx: AudioContext | null = null
    let hasSpokenLocal = false

    async function setup() {
      try {
        ctx = new AudioContext()
        await ctx.resume()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.55
        source.connect(analyser)

        const data = new Uint8Array(analyser.frequencyBinCount)

        function tick() {
          analyser.getByteFrequencyData(data)
          let sum = 0
          for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
          const rms = Math.sqrt(sum / data.length)
          const pct = Math.min(100, (rms / 45) * 100)
          const rounded = Math.round(pct)
          setLevel(rounded)
          if (rounded > 12 && !hasSpokenLocal) {
            hasSpokenLocal = true
            setHasSpoken(true)
          }
          animFrameRef.current = requestAnimationFrame(tick)
        }

        animFrameRef.current = requestAnimationFrame(tick)
      } catch {
        // AudioContext failed — just show static meter and let user proceed
      }
    }

    setup()

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (ctx) ctx.close().catch(() => {})
    }
  }, [stream])

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="w-full max-w-sm text-center">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
            style={{ background: 'var(--gradient-brand)' }}
          >
            C
          </div>
        </div>

        <h1 className="text-2xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          Quick mic check, {firstName}
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
          Say a few words to confirm your microphone is working before we begin.
        </p>

        {/* Volume meter card */}
        <div
          className="rounded-2xl px-6 pt-6 pb-5 mb-6"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          {/* Bars */}
          <div className="flex items-end justify-center gap-1.5 mb-4" style={{ height: 56 }}>
            {Array.from({ length: BAR_COUNT }).map((_, i) => {
              const threshold = ((i + 1) / BAR_COUNT) * 100
              const active = level >= threshold
              const barHeight = 16 + ((i + 1) / BAR_COUNT) * 40
              const color = active
                ? level > 75 ? '#EF4444' : level > 25 ? '#22C55E' : 'var(--accent)'
                : 'var(--border-subtle)'
              return (
                <div
                  key={i}
                  className="w-2.5 rounded-full"
                  style={{
                    height: barHeight,
                    backgroundColor: color,
                    transition: 'background-color 60ms ease',
                  }}
                />
              )
            })}
          </div>

          {/* Status */}
          <div className="flex items-center justify-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: hasSpoken ? '#22C55E' : '#9CA3AF' }}
            />
            <p className="text-xs font-medium" style={{ color: hasSpoken ? '#16A34A' : 'var(--text-muted)' }}>
              {hasSpoken ? 'Mic detected — you\'re good to go' : 'Waiting for your voice...'}
            </p>
          </div>
        </div>

        {/* Tips */}
        <div
          className="rounded-xl px-4 py-3 mb-6 text-left"
          style={{ backgroundColor: 'var(--bg-ai-message)', border: '1px solid #C7D2FE' }}
        >
          <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--accent)' }}>
            Before you start
          </p>
          <ul className="space-y-1">
            {[
              'Find a quiet place — background noise affects transcription',
              'Speak at a normal conversational pace',
              'The interview is about 10 minutes',
            ].map(tip => (
              <li key={tip} className="text-xs flex gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--accent)', flexShrink: 0 }}>·</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={onReady}
          className="w-full h-12 rounded-xl font-semibold text-white text-sm"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {hasSpoken ? "Mic sounds good — start interview" : "Start interview"}
        </button>
      </div>
    </div>
  )
}
