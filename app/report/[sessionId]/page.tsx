'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatDate, formatDuration } from '@/lib/utils'

interface SessionInfo {
  candidateName: string
  date: string
  duration: number
  questionsAnswered: number
}

const NEXT_STEPS = [
  {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    title: 'AI evaluation',
    body: 'Our AI is reviewing your responses and generating a structured report for the team.',
  },
  {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Email decision',
    body: 'You will receive an outcome email within 2–3 business days.',
  },
  {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Next steps',
    body: 'Shortlisted candidates will be invited to a follow-up call with the Cuemath team.',
  },
]

export default function CandidateReportPage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const [session, setSession] = useState<SessionInfo | null>(null)

  useEffect(() => {
    fetch(`/api/report/${sessionId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.session) setSession(data.session) })
      .catch(() => {})
  }, [sessionId])

  const firstName = session?.candidateName?.split(' ')[0] ?? ''

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <header
        className="border-b px-4 md:px-8 py-3 flex items-center gap-2.5"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
          style={{ background: 'var(--gradient-brand)' }}
        >
          C
        </div>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Cuemath AI Screener
        </span>
      </header>

      <div className="max-w-lg mx-auto px-4 py-14">
        {/* Success hero */}
        <div className="text-center mb-10 animate-slide-up">
          {/* Animated checkmark */}
          <div className="relative inline-flex mb-5">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)' }}
            >
              <svg className="w-9 h-9" style={{ color: '#15803D' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            {/* Outer ring */}
            <div
              className="absolute inset-0 rounded-full"
              style={{ border: '2px solid #22C55E', opacity: 0.3 }}
            />
          </div>

          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {firstName ? `Well done, ${firstName}!` : 'Interview complete!'}
          </h1>
          <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)', maxWidth: 340, margin: '0 auto' }}>
            Your responses have been recorded. Our team will be in touch.
          </p>
        </div>

        {/* What happens next */}
        <div
          className="rounded-2xl overflow-hidden mb-4"
          style={{ border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
        >
          {/* Section header */}
          <div
            className="px-5 py-3 border-b"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              What happens next
            </p>
          </div>

          {/* Steps */}
          <div style={{ backgroundColor: 'var(--bg-surface)' }}>
            {NEXT_STEPS.map((step, i) => (
              <div
                key={step.title}
                className="flex items-start gap-4 px-5 py-4"
                style={{ borderBottom: i < NEXT_STEPS.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
                >
                  {step.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{step.title}</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Session stats */}
        {session && (
          <div
            className="rounded-2xl px-5 py-4"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)' }}
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
              Session summary
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Date</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{formatDate(session.date)}</p>
              </div>
              {session.duration > 0 && (
                <div>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Duration</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{formatDuration(session.duration)}</p>
                </div>
              )}
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Questions</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{session.questionsAnswered}</p>
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-xs mt-8" style={{ color: 'var(--text-subtle)' }}>
          You can close this tab. Good luck!
        </p>
      </div>
    </div>
  )
}
