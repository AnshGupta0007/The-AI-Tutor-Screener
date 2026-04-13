'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const ADMIN_STEPS = [
  { n: '01', title: 'Sign in', body: 'Use the email + password created in Supabase Auth.' },
  { n: '02', title: 'Invite candidate', body: 'Click "+ Invite Candidate", enter their name & email. Copy the 6-digit code.' },
  { n: '03', title: 'Share the link', body: 'Send the candidate to your app URL (/) with the code. They do the interview there.' },
  { n: '04', title: 'Review & decide', body: 'Once done, open their report → see radar chart, scores, transcript → Accept or Reject.' },
]

function TutorialModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(13,13,26,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-3xl overflow-hidden animate-slide-up"
        style={{ backgroundColor: 'var(--bg-surface)', boxShadow: 'var(--shadow-lg)' }}
      >
        {/* Header */}
        <div style={{ background: 'var(--gradient-brand)', padding: '20px 24px' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.65)' }}>Admin Guide</p>
              <h2 className="text-lg font-extrabold text-white">How to use the admin panel</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Steps */}
        <div className="p-6 space-y-4">
          {ADMIN_STEPS.map((s, i) => (
            <div key={s.n} className="flex gap-4">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0"
                style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
              >
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>{s.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{s.body}</p>
              </div>
            </div>
          ))}

          {/* Key routes */}
          <div className="rounded-xl p-4 mt-2" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Key URLs</p>
            {[
              ['/admin', 'Dashboard — all candidates'],
              ['/admin/report/[id]', 'Full report for one session'],
              ['/', 'Candidate interview entry point'],
            ].map(([path, desc]) => (
              <div key={path} className="flex items-baseline gap-2 mb-1.5 last:mb-0">
                <code className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>{path}</code>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pb-6">
          <button onClick={onClose} className="btn-primary w-full h-11 text-sm">Got it</button>
        </div>
      </div>
    </div>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/admin'

  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [showTutorial, setShowTutorial] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid email or password.'); setLoading(false); return }
      router.push(next); router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div aria-hidden style={{ position: 'fixed', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,76,245,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}

      <div className="w-full max-w-sm animate-slide-up">
        <div className="rounded-3xl p-8" style={{ backgroundColor: 'var(--bg-surface)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-subtle)' }}>

          {/* Brand + tutorial trigger */}
          <div className="flex items-center justify-between mb-7">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-extrabold" style={{ background: 'var(--gradient-brand)', boxShadow: 'var(--shadow-accent)' }}>C</div>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Cuemath</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>Admin</span>
              </div>
            </div>
            <button
              onClick={() => setShowTutorial(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)', backgroundColor: 'var(--bg-primary)' }}
              title="How to use"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              How it works
            </button>
          </div>

          <h1 className="text-2xl font-extrabold mb-1" style={{ color: 'var(--text-primary)' }}>Sign in</h1>
          <p className="text-sm mb-7" style={{ color: 'var(--text-muted)' }}>Hiring team access only.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@cuemath.com" autoComplete="email" required
                className="w-full h-11 px-4 rounded-xl border text-sm outline-none transition-all"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(91,76,245,0.15)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password" required
                className="w-full h-11 px-4 rounded-xl border text-sm outline-none transition-all"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(91,76,245,0.15)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            {error && (
              <div className="px-4 py-2.5 rounded-xl text-sm flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', color: 'var(--danger)', border: '1px solid #FECACA' }}>
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !email || !password} className="btn-primary w-full h-11 text-sm">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Signing in...
                </span>
              ) : 'Sign in →'}
            </button>
          </form>

          {/* Switcher */}
          <div className="mt-5 pt-5 border-t flex items-center justify-center gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Are you a candidate?</span>
            <Link href="/" className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
              Go to interview entry →
            </Link>
          </div>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--text-subtle)' }}>
          Admin accounts are managed by your Cuemath IT administrator.
        </p>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
