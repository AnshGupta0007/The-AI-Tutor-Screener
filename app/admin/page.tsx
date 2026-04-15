'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'

interface SessionRow {
  id: string
  candidate_name: string
  candidate_email: string
  status: string
  started_at: string | null
  ended_at: string | null
  created_at: string
  invite_code: string | null
  completion_pct: number | null
  percentile: number | null
  evaluations: Array<{ composite_score: number | null; recommendation: string | null }>
}

function formatDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt || !endedAt) return '—'
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Invited',      color: '#8B5CF6' },
  active:    { label: 'In Progress',  color: '#F59E0B' },
  completed: { label: 'Completed',    color: '#3B82F6' },
  evaluated: { label: 'Evaluated',    color: '#16A34A' },
  abandoned: { label: 'Abandoned',    color: '#DC2626' },
  accepted:  { label: 'Accepted',     color: '#15803D' },
  rejected:  { label: 'Rejected',     color: '#991B1B' },
}

const REC_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  strong_hire:    { label: 'Strong Hire',   bg: '#DCFCE7', text: '#15803D' },
  consider:       { label: 'Consider',      bg: '#FEF9C3', text: '#854D0E' },
  do_not_advance: { label: 'Do Not Advance', bg: '#FEE2E2', text: '#991B1B' },
}

interface InviteResult {
  code: string
  emailSent: boolean
  candidateEmail: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [signingOut, setSigningOut] = useState(false)
  const [search, setSearch] = useState('')
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected' | 'evaluated'>('all')
  const [pctMin, setPctMin] = useState(0)
  const [pctMax, setPctMax] = useState(100)
  const [stats, setStats] = useState<{
    total: number; completed: number; evaluated: number;
    avgScore: number | null; passRate: number | null; recentCount: number;
    recommendations: { strong_hire: number; consider: number; do_not_advance: number }
  } | null>(null)

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null)

  useEffect(() => {
    loadSessions(page)
    loadStats()
  }, [page])

  async function loadStats() {
    try {
      const res = await fetch('/api/admin/stats')
      if (res.ok) setStats(await res.json())
    } catch { /* non-critical */ }
  }

  async function loadSessions(p: number, q?: string) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p) })
      const term = q ?? search
      if (term.trim()) params.set('search', term.trim())
      const res = await fetch(`/api/admin/sessions?${params}`)
      if (res.status === 401) { router.push('/admin/login?next=/admin'); return }
      if (!res.ok) { setError('Could not load sessions.'); setLoading(false); return }
      const data = await res.json()
      setSessions(data.sessions)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch {
      setError('Could not load sessions.')
    }
    setLoading(false)
  }

  async function handleMarkAbandoned(sessionId: string) {
    await fetch('/api/session/abandon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    loadSessions(page)
  }

  async function handleEvaluate(sessionId: string) {
    setEvaluatingId(sessionId)
    try {
      const res = await fetch('/api/admin/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Could not evaluate session.')
      }
      loadSessions(page)
    } finally {
      setEvaluatingId(null)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')
    setInviteLoading(true)
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateName: inviteName.trim(), candidateEmail: inviteEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setInviteError(data.error || 'Could not create invite.'); setInviteLoading(false); return }
      setInviteResult({ code: data.code, emailSent: data.emailSent, candidateEmail: inviteEmail.trim() })
      loadSessions(1)
    } catch {
      setInviteError('Something went wrong. Please try again.')
    }
    setInviteLoading(false)
  }

  function closeInviteModal() {
    setShowInviteModal(false)
    setInviteName('')
    setInviteEmail('')
    setInviteError('')
    setInviteResult(null)
  }

  const filtered = sessions
    .filter(s => {
      if (statusFilter === 'pending') return s.status === 'pending'
      if (statusFilter === 'accepted') return s.status === 'accepted'
      if (statusFilter === 'rejected') return s.status === 'rejected'
      if (statusFilter === 'evaluated') return s.status === 'evaluated' || s.status === 'completed'
      return true
    })
    .filter(s => {
      if (pctMin === 0 && pctMax === 100) return true
      if (s.percentile == null) return false
      return s.percentile >= pctMin && s.percentile <= pctMax
    })
    .sort((a, b) => {
      const sa = a.evaluations?.[0]?.composite_score ?? -1
      const sb = b.evaluations?.[0]?.composite_score ?? -1
      return sb - sa
    })

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <header
        className="border-b px-4 md:px-8 py-3.5 flex items-center justify-between"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-xs)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
            style={{ background: 'var(--gradient-brand)' }}
          >
            C
          </div>
          <div>
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Cuemath</span>
            <span className="ml-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>Admin</span>
          </div>
          {total > 0 && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
            >
              {total} total
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInviteModal(true)}
            className="text-xs px-4 py-2 rounded-xl font-semibold text-white transition-all"
            style={{ background: 'var(--gradient-brand)', boxShadow: 'var(--shadow-accent)' }}
          >
            + Invite Candidate
          </button>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="text-xs px-3 py-2 rounded-xl border transition-all"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}
          >
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        {/* Analytics bar */}
        {stats && stats.evaluated > 0 && (
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 rounded-2xl p-4"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="text-center">
              <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>Avg Score</p>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {stats.avgScore != null ? stats.avgScore.toFixed(2) : '—'}
                <span className="text-xs font-normal ml-0.5" style={{ color: 'var(--text-muted)' }}>/5</span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>Pass Rate</p>
              <p className="text-xl font-bold" style={{ color: stats.passRate != null && stats.passRate >= 50 ? 'var(--success)' : 'var(--danger)' }}>
                {stats.passRate != null ? `${stats.passRate}%` : '—'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>Evaluated</p>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats.evaluated}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>This Week</p>
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats.recentCount}</p>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="mb-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Interview Pipeline
            </h1>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); loadSessions(1, e.target.value) }}
              placeholder="Search by name or email..."
              className="h-9 px-3 rounded-lg border text-sm outline-none w-56"
              style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {([
              { key: 'all',       label: 'All' },
              { key: 'pending',   label: 'Pending' },
              { key: 'evaluated', label: 'Awaiting Decision' },
              { key: 'accepted',  label: 'Selected' },
              { key: 'rejected',  label: 'Rejected' },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-all"
                style={{
                  backgroundColor: statusFilter === f.key ? 'var(--accent)' : 'var(--bg-surface)',
                  color: statusFilter === f.key ? 'white' : 'var(--text-muted)',
                  borderColor: statusFilter === f.key ? 'var(--accent)' : 'var(--border-subtle)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Percentile range slider — only shown when 2+ evaluated candidates exist */}
          {sessions.filter(s => s.percentile != null).length >= 2 && (
            <div
              className="px-4 py-3 rounded-xl"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Percentile Range</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>
                    {pctMin}% – {pctMax}%
                  </span>
                  {(pctMin > 0 || pctMax < 100) && (
                    <button onClick={() => { setPctMin(0); setPctMax(100) }} className="text-xs" style={{ color: 'var(--text-muted)' }}>Reset</button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs w-8 shrink-0 text-right" style={{ color: 'var(--text-subtle)' }}>0%</span>
                <div className="flex-1 flex flex-col gap-1.5">
                  <input type="range" min={0} max={100} step={5} value={pctMin}
                    onChange={e => setPctMin(Math.min(Number(e.target.value), pctMax - 5))}
                    className="w-full cursor-pointer" style={{ accentColor: 'var(--accent)' }} />
                  <input type="range" min={0} max={100} step={5} value={pctMax}
                    onChange={e => setPctMax(Math.max(Number(e.target.value), pctMin + 5))}
                    className="w-full cursor-pointer" style={{ accentColor: '#8B5CF6' }} />
                </div>
                <span className="text-xs w-8 shrink-0" style={{ color: 'var(--text-subtle)' }}>100%</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#FEF2F2', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin h-7 w-7" style={{ color: 'var(--accent)' }} viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              {search ? 'No matching interviews found.' : 'No interviews yet. Invite a candidate to get started.'}
            </p>
            {!search && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="text-sm px-4 py-2 rounded-lg font-medium text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                + Invite Candidate
              </button>
            )}
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Candidate', 'Date', 'Status', 'Duration', 'Score', 'Percentile', 'Recommendation', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const eval0 = s.evaluations?.[0]
                  const statusStyle = STATUS_STYLES[s.status] || STATUS_STYLES.pending
                  const recStyle = eval0?.recommendation ? REC_STYLES[eval0.recommendation] : null

                  return (
                    <tr
                      key={s.id}
                      style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {s.candidate_name || '—'}
                        </div>
                        {s.candidate_email && (
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.candidate_email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                        {formatDate(s.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ color: statusStyle.color, backgroundColor: statusStyle.color + '15' }}
                        >
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                        {formatDuration(s.started_at, s.ended_at)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: eval0?.composite_score != null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {eval0?.composite_score != null ? (
                          <span style={{ color: eval0.composite_score >= 4 ? 'var(--success)' : eval0.composite_score >= 3 ? 'var(--warning)' : 'var(--danger)' }}>
                            {eval0.composite_score.toFixed(2)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {s.percentile != null ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>
                            Top {s.percentile === 100 ? 1 : 100 - s.percentile}%
                          </span>
                        ) : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {recStyle ? (
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: recStyle.bg, color: recStyle.text }}
                          >
                            {recStyle.label}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {(s.status === 'evaluated' || s.status === 'completed' || s.status === 'accepted' || s.status === 'rejected') ? (
                          <a href={`/admin/report/${s.id}`} className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
                            View report →
                          </a>
                        ) : s.status === 'abandoned' ? (
                          // completion_pct < 27% ≈ fewer than 3 answers out of 11
                          s.completion_pct != null && s.completion_pct < 27 ? (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }} title="Fewer than 3 answers recorded — not enough to evaluate">
                              Too few answers
                            </span>
                          ) : (
                            <button
                              onClick={() => handleEvaluate(s.id)}
                              disabled={evaluatingId === s.id}
                              className="text-xs font-medium"
                              style={{ color: 'var(--accent)', opacity: evaluatingId === s.id ? 0.5 : 1 }}
                            >
                              {evaluatingId === s.id ? 'Evaluating...' : 'Evaluate →'}
                            </button>
                          )
                        ) : s.status === 'active' ? (
                          <button
                            onClick={() => handleMarkAbandoned(s.id)}
                            className="text-xs font-medium"
                            style={{ color: 'var(--danger)' }}
                          >
                            Mark abandoned
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-sm border disabled:opacity-40"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              ← Previous
            </button>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-sm border disabled:opacity-40"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) closeInviteModal() }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-xl"
            style={{ backgroundColor: 'var(--bg-surface)' }}
          >
            {!inviteResult ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Invite Candidate
                  </h2>
                  <button onClick={closeInviteModal} style={{ color: 'var(--text-muted)' }}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleInvite}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                      Candidate name
                    </label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={e => setInviteName(e.target.value)}
                      placeholder="Full name"
                      className="w-full h-11 px-4 rounded-xl border text-sm outline-none"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                      required
                      minLength={2}
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                      Candidate email
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="candidate@example.com"
                      className="w-full h-11 px-4 rounded-xl border text-sm outline-none"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                      required
                    />
                  </div>

                  {inviteError && (
                    <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#FEF2F2', color: 'var(--danger)' }}>
                      {inviteError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={closeInviteModal}
                      className="flex-1 h-11 rounded-xl text-sm border font-medium"
                      style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={inviteLoading || inviteName.trim().length < 2 || !inviteEmail.includes('@')}
                      className="flex-1 h-11 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      {inviteLoading ? 'Sending...' : 'Send Invite'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="text-center py-2">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: '#DCFCE7' }}
                  >
                    <svg className="w-6 h-6" style={{ color: '#16A34A' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                    Invite created!
                  </h2>
                  <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                    {inviteResult.emailSent
                      ? `Email sent to ${inviteResult.candidateEmail}`
                      : `Share this code with ${inviteResult.candidateEmail}`}
                  </p>

                  {/* Code display */}
                  <div
                    className="rounded-2xl p-6 mb-4"
                    style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
                  >
                    <p className="text-xs mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>ACCESS CODE</p>
                    <p
                      className="text-5xl font-bold tracking-[0.2em]"
                      style={{ color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {inviteResult.code}
                    </p>
                  </div>

                  {!inviteResult.emailSent && (
                    <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
                      (Add RESEND_API_KEY to .env.local to send emails automatically)
                    </p>
                  )}

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inviteResult!.code)
                    }}
                    className="w-full h-10 rounded-xl text-sm font-medium border mb-3"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                  >
                    Copy code
                  </button>
                  <button
                    onClick={closeInviteModal}
                    className="w-full h-10 rounded-xl text-sm font-semibold text-white"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
