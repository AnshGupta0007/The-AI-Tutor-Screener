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

export default function CandidateReportPage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const [session, setSession] = useState<SessionInfo | null>(null)

  useEffect(() => {
    fetch(`/api/report/${sessionId}`, { cache: 'no-store' })
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

        {/* Hero */}
        <div className="text-center mb-8 animate-slide-up">
          <div className="relative inline-flex mb-5">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)' }}
            >
              <svg className="w-9 h-9" style={{ color: '#15803D' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="absolute inset-0 rounded-full" style={{ border: '2px solid #22C55E', opacity: 0.3 }} />
          </div>

          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {firstName ? `Well done, ${firstName}!` : 'Interview complete!'}
          </h1>
          <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)', maxWidth: 340, margin: '0 auto' }}>
            Your screening has been successfully submitted.
          </p>
        </div>

        {/* What's next card */}
        <div
          className="rounded-2xl overflow-hidden mb-4"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>What happens next</p>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {[
              {
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.5-1.57.393" />
                  </svg>
                ),
                title: 'AI evaluation underway',
                body: 'Your responses are being scored across 5 teaching dimensions by our AI system.',
              },
              {
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                ),
                title: 'Human review',
                body: 'The Cuemath hiring team will review the AI report before making a decision.',
              },
              {
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                ),
                title: 'You'll hear from us',
                body: 'Expect an email from the Cuemath team within 2–3 business days with your outcome.',
              },
            ].map((step, i, arr) => (
              <div
                key={step.title}
                className="flex items-start gap-4 px-5 py-4"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
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
              {session.questionsAnswered > 0 && (
                <div>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Responses</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{session.questionsAnswered}</p>
                </div>
              )}
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
