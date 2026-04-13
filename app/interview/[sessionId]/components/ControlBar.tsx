'use client'

import { useEffect, useState } from 'react'

interface ControlBarProps {
  isAiSpeaking: boolean
  isMicActive: boolean
  canRepeat: boolean
  repeatUsed: number
  onDoneAnswering: () => void
  onRepeatQuestion: () => void
}

export default function ControlBar({
  isAiSpeaking,
  isMicActive,
  canRepeat,
  repeatUsed,
  onDoneAnswering,
  onRepeatQuestion,
}: ControlBarProps) {
  const [showDoneButton, setShowDoneButton] = useState(false)
  const [pressing, setPressing] = useState(false)

  useEffect(() => {
    if (isMicActive) {
      const t = setTimeout(() => setShowDoneButton(true), 3000)
      return () => clearTimeout(t)
    } else {
      setShowDoneButton(false)
    }
  }, [isMicActive])

  return (
    <div
      className="border-t px-4 md:px-6 flex flex-col items-center"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
        paddingTop: 20,
        paddingBottom: 28,
        gap: 14,
      }}
    >
      {/* Status label */}
      <div className="h-6 flex items-center">
        {isAiSpeaking ? (
          <div className="flex items-center gap-2 animate-fade-in">
            <span
              className="w-2 h-2 rounded-full speaking-dot"
              style={{ backgroundColor: 'var(--accent-speaking)' }}
            />
            <span className="text-xs font-semibold" style={{ color: 'var(--accent-speaking)', letterSpacing: '0.02em' }}>
              AI is speaking
            </span>
          </div>
        ) : isMicActive && !showDoneButton ? (
          <p className="text-xs animate-fade-in" style={{ color: 'var(--text-muted)' }}>
            Listening — speak your answer...
          </p>
        ) : isAiSpeaking ? null : (
          <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
            Microphone activates when the AI finishes.
          </p>
        )}
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-5">
        {/* Mic button */}
        <div className="relative flex items-center justify-center">
          {/* Pulse ring */}
          {isMicActive && !isAiSpeaking && (
            <span
              className="absolute rounded-full"
              style={{
                width: 80, height: 80,
                background: 'var(--gradient-brand)',
                opacity: 0,
                animation: 'ring-expand 1.6s ease-out infinite',
              }}
            />
          )}

          <button
            disabled={isAiSpeaking}
            aria-label={isMicActive ? 'Microphone active' : 'Microphone inactive'}
            className="relative rounded-full flex items-center justify-center transition-all"
            style={{
              width: 68, height: 68,
              background: isMicActive && !isAiSpeaking
                ? 'var(--gradient-brand)'
                : 'var(--border-subtle)',
              boxShadow: isMicActive && !isAiSpeaking ? 'var(--shadow-accent)' : 'none',
              cursor: 'default',
              opacity: isAiSpeaking ? 0.45 : 1,
              transition: 'all 0.3s ease',
            }}
          >
            <svg
              className="w-6 h-6"
              style={{ color: isMicActive && !isAiSpeaking ? 'white' : 'var(--text-muted)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </button>
        </div>

        {/* Done Answering */}
        {showDoneButton && isMicActive && !isAiSpeaking && (
          <button
            onClick={() => { setPressing(false); onDoneAnswering() }}
            onMouseDown={() => setPressing(true)}
            onMouseUp={() => setPressing(false)}
            onMouseLeave={() => setPressing(false)}
            className="animate-fade-in flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold transition-all"
            style={{
              background: pressing ? '#15803D' : 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)',
              color: 'white',
              boxShadow: pressing ? '0 1px 3px rgba(0,0,0,0.2)' : 'var(--shadow-green)',
              transform: pressing ? 'scale(0.97)' : 'scale(1)',
              border: 'none',
              letterSpacing: '0.01em',
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Done answering
          </button>
        )}
      </div>

      {/* Repeat question */}
      {canRepeat && !isAiSpeaking && (
        <button
          onClick={onRepeatQuestion}
          disabled={repeatUsed >= 2}
          className="flex items-center gap-1.5 text-xs transition-all"
          style={{
            color: repeatUsed >= 2 ? 'var(--text-subtle)' : 'var(--accent)',
            opacity: repeatUsed >= 2 ? 0.5 : 1,
            cursor: repeatUsed >= 2 ? 'not-allowed' : 'pointer',
            textDecoration: repeatUsed < 2 ? 'underline' : 'none',
            textDecorationColor: 'rgba(67,56,202,0.3)',
            textUnderlineOffset: 3,
          }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Repeat question
          {repeatUsed > 0 && repeatUsed < 2 && (
            <span style={{ color: 'var(--text-muted)' }}>· {repeatUsed}/2 used</span>
          )}
        </button>
      )}
    </div>
  )
}
