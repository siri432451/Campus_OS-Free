import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type Stats = {
  queuedNow: number
  today: { printed: number; cancelled: number; credits: number }
  allTime: { printed: number; credits: number }
}

const API = (import.meta.env.VITE_API_URL as string | undefined) || ''

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('campusos_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function OperatorDashboard() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/print/stats`, { headers: { ...authHeaders() } })
      if (res.status === 401) { navigate('/login'); return }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStats(await res.json())
      setError(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(`Failed to load stats: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    fetchStats()
    const t = setInterval(fetchStats, 30000)
    return () => clearInterval(t)
  }, [fetchStats])

  return (
    <div className="min-h-screen p-4 lg:p-8" style={{ background: '#F5F7FA' }}>
      <div className="max-w-5xl mx-auto">
        <div className="rounded-2xl p-6 mb-6 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1B4332 0%, #122400 100%)' }}>
          <div className="flex items-start justify-between mb-2">
            <div />
            <button onClick={logout}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border-0 cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
              Sign Out
            </button>
          </div>
          <div className="text-xs uppercase tracking-[0.18em] opacity-70 font-semibold">Print Operator</div>
          <div className="mt-1 text-2xl lg:text-3xl font-black">
            Good day{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </div>
          <div className="mt-1 text-sm opacity-80">College of Nursing Sciences, Osogbo</div>
          <div className="absolute right-6 top-6 text-5xl opacity-20">🖨️</div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl text-sm" style={{ background: '#FEE2E2', color: '#991B1B' }}>
            {error}
          </div>
        )}

        {stats && (
          <button
            onClick={() => navigate('/print-queue')}
            className="w-full bg-white rounded-2xl p-6 mb-6 text-left border-0 cursor-pointer hover:shadow-md transition-shadow"
            style={{ boxShadow: '0 2px 12px rgba(27,67,50,0.06)' }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#1B4332', opacity: 0.6 }}>
                  Pending in queue
                </div>
                <div className="mt-1 flex items-baseline gap-3">
                  <div className="text-5xl font-black" style={{ color: stats.queuedNow > 0 ? '#122400' : '#8A9BB0' }}>
                    {stats.queuedNow}
                  </div>
                  <div className="text-sm" style={{ color: '#1B4332', opacity: 0.7 }}>
                    {stats.queuedNow === 1 ? 'job waiting' : 'jobs waiting'}
                  </div>
                </div>
                <div className="mt-2 text-sm font-semibold" style={{ color: '#122400' }}>
                  {stats.queuedNow > 0 ? 'Open print queue \u2192' : 'No jobs to process right now'}
                </div>
              </div>
              <div className="text-6xl flex-shrink-0">📥</div>
            </div>
          </button>
        )}

        <div className="mb-6">
          <h2 className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: '#1B4332', opacity: 0.6 }}>
            Today
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Jobs printed" value={stats?.today.printed ?? '\u2014'} accent="#2D5F3F" loading={loading} />
            <StatCard label="Credits processed" value={stats?.today.credits ?? '\u2014'} accent="#122400" loading={loading} />
            <StatCard label="Cancelled" value={stats?.today.cancelled ?? '\u2014'} accent="#991B1B" loading={loading} />
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: '#1B4332', opacity: 0.6 }}>
            All time
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatCard label="Total jobs printed" value={stats?.allTime.printed ?? '\u2014'} accent="#2D5F3F" loading={loading} />
            <StatCard label="Total credits processed" value={stats?.allTime.credits ?? '\u2014'} accent="#122400" loading={loading} />
          </div>
        </div>

        <p className="text-xs text-center" style={{ color: '#1B4332', opacity: 0.55 }}>
          Stats refresh automatically every 30 seconds.
        </p>
      </div>
    </div>
  )
}

function StatCard({ label, value, accent, loading }: { label: string; value: number | string; accent: string; loading: boolean }) {
  return (
    <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 2px 12px rgba(27,67,50,0.06)' }}>
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#1B4332', opacity: 0.6 }}>
        {label}
      </div>
      <div className="mt-2 text-3xl font-black" style={{ color: loading ? '#E5E7EB' : accent }}>
        {loading ? '\u2014' : (typeof value === 'number' ? value.toLocaleString() : value)}
      </div>
    </div>
  )
}
