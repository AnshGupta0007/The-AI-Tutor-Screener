'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Invalid email or password.')
        setLoading(false)
        return
      }

      router.push(next)
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Decorative blob */}
      <div aria-hidden style={{ position: 'fixed', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(67,56,202,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div className="w-full max-w-sm animate-slide-up">
        {/* Card */}
        <div
          className="rounded-3xl p-8"
          style={{ backgroundColor: 'var(--bg-surface)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-subtle)' }}
        >
          {/* Brand */}
          <div className="flex items-center gap-3 mb-7">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-extrabold"
              style={{ background: 'var(--gradient-brand)', boxShadow: 'var(--shadow-accent)' }}
            >
              C
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Cuemath</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                Admin
              </span>
            </div>
          </div>

          <h1 className="text-2xl font-extrabold mb-1" style={{ color: 'var(--text-primary)' }}>
            Sign in
          </h1>
          <p className="text-sm mb-7" style={{ color: 'var(--text-muted)' }}>
            Hiring team access only.
          </p>

          {/* Form */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold mb-1.5 tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>Email</label>
                <input
                  id="email" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@cuemath.com" autoComplete="email" required
                  className="w-full h-11 px-4 rounded-xl border text-sm outline-none transition-all"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(91,76,245,0.15)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-xs font-semibold mb-1.5 tracking-wide uppercase" style={{ color: 'var(--text-muted)' }}>Password</label>
                <input
                  id="password" type="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password" required
                  className="w-full h-11 px-4 rounded-xl border text-sm outline-none transition-all"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(91,76,245,0.15)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>

              {error && (
                <div className="px-4 py-2.5 rounded-xl text-sm flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', color: 'var(--danger)', border: '1px solid #FECACA' }}>
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" /></svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="btn-primary w-full h-11 text-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : 'Sign in →'}
              </button>
            </form>
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
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
