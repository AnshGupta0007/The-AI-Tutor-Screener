'use client'

import { useEffect, useRef } from 'react'
import type { ConversationMessage } from '@/lib/types'

interface TranscriptPanelProps {
  messages: ConversationMessage[]
  currentPartialTranscript: string
  isAiSpeaking: boolean
  showSilenceDots: boolean
}

export default function TranscriptPanel({
  messages,
  currentPartialTranscript,
  isAiSpeaking,
  showSilenceDots,
}: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentPartialTranscript, showSilenceDots])

  if (messages.length === 0 && !currentPartialTranscript) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center transcript-scroll overflow-y-auto p-6 gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--gradient-brand)' }}
        >
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          Your conversation will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 transcript-scroll overflow-y-auto px-4 md:px-8 py-6 space-y-5">
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}

      {/* Partial/streaming candidate transcript */}
      {currentPartialTranscript && !isAiSpeaking && (
        <div className="flex justify-end animate-fade-in">
          <div style={{ maxWidth: '72%' }}>
            <p className="text-xs mb-1.5 text-right font-medium" style={{ color: 'var(--text-muted)' }}>
              You
            </p>
            <div
              className="px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed"
              style={{ backgroundColor: 'var(--bg-candidate-message)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-xs)' }}
            >
              {currentPartialTranscript}
              <span
                className="inline-block w-0.5 h-4 ml-0.5 align-middle animate-pulse rounded-full"
                style={{ backgroundColor: 'var(--accent)' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Silence dots */}
      {showSilenceDots && (
        <div className="flex justify-end">
          <div
            className="flex gap-1.5 items-center px-5 py-3.5 rounded-2xl rounded-tr-sm"
            style={{ backgroundColor: 'var(--bg-candidate-message)', boxShadow: 'var(--shadow-xs)' }}
          >
            <span className="w-2 h-2 rounded-full dot-1" style={{ backgroundColor: 'var(--text-muted)' }} />
            <span className="w-2 h-2 rounded-full dot-2" style={{ backgroundColor: 'var(--text-muted)' }} />
            <span className="w-2 h-2 rounded-full dot-3" style={{ backgroundColor: 'var(--text-muted)' }} />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isAI = message.role === 'assistant'

  if (isAI) {
    return (
      <div className="flex gap-3 animate-fade-in">
        {/* AI Avatar */}
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-5"
          style={{ background: 'var(--gradient-brand)' }}
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="white">
            <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 14a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 14a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.616a1 1 0 01.894-1.79l1.599.8L9 3.323V3a1 1 0 011-1z" />
          </svg>
        </div>
        <div style={{ maxWidth: '76%' }}>
          <p className="text-xs mb-1.5 font-semibold" style={{ color: 'var(--accent)', letterSpacing: '0.02em' }}>
            Cuemath AI
          </p>
          <div
            className="px-4 py-3.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
            style={{
              backgroundColor: 'var(--bg-ai-message)',
              color: 'var(--text-primary)',
              boxShadow: '0 1px 4px rgba(67,56,202,0.08)',
              borderLeft: '3px solid var(--accent)',
            }}
          >
            {message.content}
          </div>
        </div>
      </div>
    )
  }

  // Candidate message
  const hasLowConfidence = message.role === 'user' && message.confidence != null && message.confidence < 0.6

  return (
    <div className="flex justify-end animate-fade-in">
      <div style={{ maxWidth: '72%' }}>
        <p className="text-xs mb-1.5 text-right font-medium" style={{ color: 'var(--text-muted)' }}>
          You
        </p>
        <div
          className="px-4 py-3.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed"
          style={{
            backgroundColor: 'var(--bg-candidate-message)',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-xs)',
            borderRight: '3px solid #22C55E',
          }}
        >
          {message.content}
          {hasLowConfidence && (
            <span
              className="ml-1.5 text-xs italic px-1.5 py-0.5 rounded-md"
              style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}
            >
              unclear audio
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
