'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = [
  {
    n: '01',
    title: 'Mic access',
    body: 'We need your microphone — the entire interview is voice-based.',
  },
  {
    n: '02',
    title: '~10 min call',
    body: '5–6 questions about how you work with students.',
  },
  {
    n: '03',
    title: 'AI evaluates',
    body: 'Our AI scores your responses across 5 soft-skill dimensions.',
  },
  {
    n: '04',
    title: 'Email outcome',
    body: 'You hear back from the Cuemath team within 2–3 business days.',
  },
]

/* ── Reusable field ─────────────────────────────────── */
function Field({
  label, id, children,
}: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label
        htmlFor={id}
        className="block text-xs font-bold mb-2 uppercase tracking-widest"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

/* ── Input base styles ──────────────────────────────── */
const inputBase: React.CSSProperties = {
  width: '100%',
  height: 48,
  padding: '0 16px',
  borderRadius: 12,
  border: '1.5px solid var(--border-subtle)',
  backgroundColor: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  fontSize: 15,
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

function focusOn(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'var(--accent)'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(91,76,245,0.15)'
}
function focusOff(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = 'var(--border-subtle)'
  e.currentTarget.style.boxShadow = 'none'
}

export default function LandingPage() {
  const router = useRouter()

  const [email, setEmail]         = useState('')
  const [code, setCode]           = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  const [verified, setVerified]           = useState(false)
  const [candidateName, setCandidateName] = useState('')
  const [sessionData, setSessionData] = useState<{
    sessionId: string; greetingText: string; warmUpQuestionId: string; coreQuestionIds: string[]
  } | null>(null)
  const [starting, setStarting] = useState(false)

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setVerifyError('')
    setVerifying(true)
    try {
      const res = await fetch('/api/invite/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setVerifyError(data.error || 'Verification failed. Please try again.')
        setVerifying(false)
        return
      }
      setCandidateName(data.candidateName)
      setSessionData({
        sessionId: data.sessionId,
        greetingText: data.greetingText,
        warmUpQuestionId: data.warmUpQuestionId,
        coreQuestionIds: data.coreQuestionIds,
      })
      setVerified(true)
    } catch {
      setVerifyError('Connection error. Please try again.')
    }
    setVerifying(false)
  }

  function handleStart(e: React.FormEvent) {
    e.preventDefault()
    if (!sessionData || candidateName.trim().length < 2) return
    setStarting(true)
    localStorage.setItem('cuemath_session', JSON.stringify({
      sessionId: sessionData.sessionId,
      candidateName: candidateName.trim(),
      greetingText: sessionData.greetingText,
      warmUpQuestionId: sessionData.warmUpQuestionId,
      coreQuestionIds: sessionData.coreQuestionIds,
      phase: 'greeting',
      questionsAsked: [],
      turnNumber: 0,
      conversationHistory: [],
      consecutiveSkips: 0,
      savedAt: new Date().toISOString(),
    }))
    router.push(`/interview/${sessionData.sessionId}`)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Background orbs */}
      <div aria-hidden style={{
        position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0,
      }}>
        <div style={{
          position: 'absolute', top: '-15%', right: '-10%',
          width: 480, height: 480, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(91,76,245,0.10) 0%, transparent 65%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-12%', left: '-8%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 65%)',
        }} />
      </div>

      <div className="w-full max-w-[420px] animate-slide-up" style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Brand bar ─────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6 px-1">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-extrabold"
            style={{ background: 'var(--gradient-brand)', boxShadow: 'var(--shadow-accent)' }}
          >
            C
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Cuemath</span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
            >
              AI Screener
            </span>
          </div>
        </div>

        {/* ── Card ──────────────────────────────────── */}
        <div
          className="rounded-3xl p-8"
          style={{
            backgroundColor: 'var(--bg-surface)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {!verified ? (
            <>
              {/* Heading */}
              <div className="mb-7">
                <h1
                  className="text-2xl font-extrabold mb-2 leading-tight"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Start your interview
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Use the email and code from your Cuemath invite.
                </p>
              </div>

              <form onSubmit={handleVerify}>
                <Field label="Email address" id="email">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    style={inputBase}
                    onFocus={focusOn}
                    onBlur={focusOff}
                  />
                </Field>

                <Field label="6-digit access code" id="code">
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    style={{
                      ...inputBase,
                      height: 60,
                      fontSize: 28,
                      fontWeight: 700,
                      letterSpacing: '0.35em',
                      textAlign: 'center',
                      borderColor: code.length === 6 ? 'var(--accent)' : 'var(--border-subtle)',
                      boxShadow: code.length === 6 ? '0 0 0 3px rgba(91,76,245,0.15)' : 'none',
                    }}
                    onFocus={focusOn}
                    onBlur={e => {
                      if (code.length !== 6) focusOff(e)
                    }}
                  />
                </Field>

                {verifyError && (
                  <div
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-5"
                    style={{ backgroundColor: '#FEF2F2', color: 'var(--danger)', border: '1px solid #FECACA' }}
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    {verifyError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={email.trim().length < 5 || code.length !== 6 || verifying}
                  className="btn-primary w-full h-12 text-sm"
                >
                  {verifying ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Verifying...
                    </span>
                  ) : 'Verify & continue →'}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Verified state */}
              <div className="mb-7">
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-4"
                  style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Identity verified
                </div>
                <h1
                  className="text-2xl font-extrabold mb-2 leading-tight"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {"Ready to talk teaching?"}
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  A 10-minute voice conversation about how you work with students. No preparation needed.
                </p>
              </div>

              <form onSubmit={handleStart}>
                <Field label="Your full name" id="name">
                  <input
                    id="name"
                    type="text"
                    value={candidateName}
                    onChange={e => setCandidateName(e.target.value)}
                    placeholder="As it should appear on your report"
                    autoComplete="name"
                    style={inputBase}
                    onFocus={focusOn}
                    onBlur={focusOff}
                  />
                </Field>

                <button
                  type="submit"
                  disabled={candidateName.trim().length < 2 || starting}
                  className="btn-primary w-full h-12 text-sm"
                >
                  {starting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Setting up your session...
                    </span>
                  ) : 'Start my interview →'}
                </button>
              </form>
            </>
          )}
        </div>

        {/* ── Steps ─────────────────────────────────── */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {STEPS.map(step => (
            <div
              key={step.n}
              className="rounded-2xl p-4"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="text-xs font-extrabold"
                  style={{ color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {step.n}
                </span>
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  {step.title}
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>

        <p
          className="text-center text-xs mt-5"
          style={{ color: 'var(--text-subtle)' }}
        >
          Microphone required · Responses recorded · Reviewed by Cuemath
        </p>
      </div>
    </div>
  )
}
