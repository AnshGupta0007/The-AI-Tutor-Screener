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

type AppStatus = 'pending' | 'active' | 'completed' | 'evaluated' | 'abandoned' | 'accepted' | 'rejected'

function getStatusStep(status: AppStatus): 0 | 1 | 2 {
  if (status === 'accepted' || status === 'rejected') return 2
  if (status === 'evaluated' || status === 'completed') return 1
  return 0
}

const STATUS_STEPS = [
  {
    key: 'submitted',
    label: 'Screening submitted',
    body: 'Your voice responses have been recorded and saved securely.',
  },
  {
    key: 'review',
    label: 'Under review',
    body: 'Our AI is evaluating your responses. The hiring team will review the report.',
  },
  {
    key: 'decision',
    label: 'Decision sent',
    body: 'The hiring team has reached a decision and an email has been sent to you.',
  },
]

export default function CandidateReportPage() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [status, setStatus] = useState<AppStatus>('completed')

  useEffect(() => {
    async function fetchStatus() {
      try {
        const r = await fetch(`/api/report/${sessionId}`)
        if (!r.ok) return
        const data = await r.json()
        if (data?.session) setSession(data.session)
        if (data?.status) setStatus(data.status as AppStatus)
      } catch { /* silent */ }
    }

    fetchStatus()

    // Poll every 10s until decision is sent
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`/api/report/${sessionId}`)
        if (!r.ok) return
        const data = await r.json()
        if (data?.status) {
          setStatus(data.status as AppStatus)
          if (data.status === 'accepted' || data.status === 'rejected') {
            clearInterval(interval)
          }
        }
      } catch { /* silent */ }
    }, 10_000)

    return () => clearInterval(interval)
  }, [sessionId])

  const firstName = session?.candidateName?.split(' ')[0] ?? ''
  const currentStep = getStatusStep(status)

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
        <div className="text-center mb-10 animate-slide-up">
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
            Your screening is complete. Track its progress below.
          </p>
        </div>

        {/* Status tracker */}
        <div
          className="rounded-2xl overflow-hidden mb-4"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Application status
              </p>
              {currentStep < 2 && (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-subtle)' }}>
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: 'var(--accent)', animation: 'speaking-pulse 2s ease-in-out infinite' }}
                  />
                  Live
                </span>
              )}
            </div>
          </div>

          <div className="p-5 space-y-0">
            {STATUS_STEPS.map((step, i) => {
              const done = i < currentStep
              const active = i === currentStep
              const future = i > currentStep
              const isLast = i === STATUS_STEPS.length - 1

              const dotColor = done ? '#16A34A' : active ? 'var(--accent)' : 'var(--border-medium)'
              const labelColor = future ? 'var(--text-subtle)' : 'var(--text-primary)'
              const bodyColor = future ? 'var(--text-subtle)' : 'var(--text-muted)'

              return (
                <div key={step.key} className="flex gap-4">
                  {/* Dot + line */}
                  <div className="flex flex-col items-center" style={{ width: 24 }}>
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: done ? '#DCFCE7' : active ? 'var(--accent-light)' : 'var(--bg-primary)', border: `2px solid ${dotColor}` }}
                    >
                      {done ? (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="#16A34A" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : active ? (
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
                      ) : null}
                    </div>
                    {!isLast && (
                      <div
                        className="w-0.5 flex-1 my-1"
                        style={{ backgroundColor: done ? '#BBF7D0' : 'var(--border-subtle)', minHeight: 24 }}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="pb-5" style={{ paddingBottom: isLast ? 0 : 20 }}>
                    <p className="text-sm font-semibold mb-0.5" style={{ color: labelColor }}>{step.label}</p>
                    <p className="text-xs leading-relaxed" style={{ color: bodyColor }}>{step.body}</p>
                    {active && step.key === 'review' && (
                      <div
                        className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
                      >
                        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Processing
                      </div>
                    )}
                    {active && step.key === 'decision' && (
                      <div
                        className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ backgroundColor: status === 'accepted' ? '#DCFCE7' : '#FEE2E2', color: status === 'accepted' ? '#15803D' : '#991B1B' }}
                      >
                        {status === 'accepted' ? '🎉 You've been shortlisted!' : 'Decision sent — check your email'}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
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
          {currentStep < 2 ? 'This page updates automatically. You can keep it open.' : 'Check your email for details. Good luck!'}
        </p>
      </div>
    </div>
  )
}
