import { useEffect, useState, useCallback } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API = (import.meta.env.VITE_API_URL as string | undefined) || ''

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('campusos_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function fmt(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB'
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(0) + ' MB'
  return (bytes / 1024).toFixed(0) + ' KB'
}

function pct(used: number, total: number): number {
  return total > 0 ? Math.round((used / total) * 100) : 0
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#E5E7EB' }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
      <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#8A9BB0' }}>{label}</div>
      <div className="font-black text-2xl" style={{ color: '#1B4332' }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: '#8A9BB0' }}>{sub}</div>}
    </div>
  )
}

type HealthData = {
  timestamp: string
  uptime: string
  load: { load1: number; load5: number; load15: number }
  memory: { total: number; used: number; free: number }
  disk: { total: number; used: number; available: number }
  processes: Array<{ id: number; name: string; status: string; cpu: number; memory: number; restarts: number; uptime: number | null }>
  services: { nginx: string; docker: string; postgres: string }
}

function statusDot(status: string) {
  const ok = status === 'active' || status === 'online' || status === 'running'
  return <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: ok ? '#065F46' : '#991B1B' }} />
}

export default function SiteHealth() {
  const { user } = useAuth()
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/health`, { headers: { ...authHeaders() } })
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setData(json)
      setLastRefresh(new Date())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load health data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchHealth() }, [fetchHealth])

  if (!user || user.role !== 'SUPER_ADMIN') return <Navigate to="/dashboard" replace />

  const memPct = data ? pct(data.memory.used, data.memory.total) : 0
  const diskPct = data ? pct(data.disk.used, data.disk.total) : 0
  const memColor = memPct > 85 ? '#991B1B' : memPct > 65 ? '#D4A24C' : '#065F46'
  const diskColor = diskPct > 85 ? '#991B1B' : diskPct > 65 ? '#D4A24C' : '#065F46'

  return (
    <div className="min-h-screen p-4 lg:p-8" style={{ background: '#F5F7FA' }}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#122400' }}>Super Admin</p>
            <h1 className="text-3xl font-black" style={{ color: '#1B4332' }}>Site Health</h1>
            <div className="mt-2 h-1 w-16 rounded-full" style={{ background: '#D4A24C' }} />
            {lastRefresh && <p className="mt-2 text-xs" style={{ color: '#8A9BB0' }}>Last refreshed: {lastRefresh.toLocaleTimeString()}</p>}
          </div>
          <button onClick={fetchHealth} disabled={loading}
            className="px-4 py-2.5 rounded-xl font-bold text-sm text-white border-0 cursor-pointer disabled:opacity-50"
            style={{ background: '#122400' }}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Admin tabs */}
        <div className="flex gap-2 mb-6 border-b overflow-x-auto" style={{ borderColor: '#E5E7EB' }}>
          <Link to="/admin" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Overview</Link>
          <Link to="/admin/students" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Students</Link>
          <Link to="/admin/lecturers" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Lecturers</Link>
          <Link to="/admin/payments" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Payments</Link>
          <Link to="/admin/results" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Results</Link>
          <Link to="/admin/health" className="px-4 py-2 text-sm font-bold border-b-2 whitespace-nowrap" style={{ color: '#122400', borderColor: '#122400' }}>Health</Link>
        </div>

        {error && <div className="p-4 rounded-2xl mb-4" style={{ background: '#FEE2E2', color: '#991B1B' }}>{error}</div>}

        {loading && !data && (
          <div className="p-8 text-center bg-white rounded-2xl" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
            <div className="text-sm" style={{ color: '#1B4332', opacity: 0.6 }}>Loading health data...</div>
          </div>
        )}

        {data && (
          <>
            {/* Services */}
            <section className="mb-6">
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#1B4332', opacity: 0.6 }}>Services</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {Object.entries(data.services).map(([name, status]) => (
                  <div key={name} className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
                    <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#8A9BB0' }}>{name}</div>
                    <div className="flex items-center text-sm font-bold" style={{ color: (status === 'active' || status === 'running') ? '#065F46' : '#991B1B' }}>
                      {statusDot(status)}{status}
                    </div>
                  </div>
                ))}
                <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
                  <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#8A9BB0' }}>Uptime</div>
                  <div className="text-sm font-bold" style={{ color: '#065F46' }}>{data.uptime}</div>
                </div>
              </div>
            </section>

            {/* Resources */}
            <section className="mb-6">
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#1B4332', opacity: 0.6 }}>Resources</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#8A9BB0' }}>Memory</div>
                    <div className="text-sm font-black" style={{ color: memColor }}>{memPct}%</div>
                  </div>
                  <Bar value={memPct} color={memColor} />
                  <div className="flex justify-between mt-2 text-xs" style={{ color: '#8A9BB0' }}>
                    <span>Used: {fmt(data.memory.used)}</span>
                    <span>Total: {fmt(data.memory.total)}</span>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#8A9BB0' }}>Disk (/)</div>
                    <div className="text-sm font-black" style={{ color: diskColor }}>{diskPct}%</div>
                  </div>
                  <Bar value={diskPct} color={diskColor} />
                  <div className="flex justify-between mt-2 text-xs" style={{ color: '#8A9BB0' }}>
                    <span>Used: {fmt(data.disk.used)}</span>
                    <span>Total: {fmt(data.disk.total)}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Load average */}
            <section className="mb-6">
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#1B4332', opacity: 0.6 }}>Load Average</h2>
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="1 min" value={data.load.load1.toFixed(2)} />
                <StatCard label="5 min" value={data.load.load5.toFixed(2)} />
                <StatCard label="15 min" value={data.load.load15.toFixed(2)} />
              </div>
            </section>

            {/* PM2 Processes */}
            <section className="mb-6">
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#1B4332', opacity: 0.6 }}>Processes (PM2)</h2>
              <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#F5F7FA' }}>
                      <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: '#8A9BB0' }}>Name</th>
                      <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: '#8A9BB0' }}>Status</th>
                      <th className="text-right px-4 py-3 text-xs uppercase tracking-wider" style={{ color: '#8A9BB0' }}>CPU</th>
                      <th className="text-right px-4 py-3 text-xs uppercase tracking-wider" style={{ color: '#8A9BB0' }}>Memory</th>
                      <th className="text-right px-4 py-3 text-xs uppercase tracking-wider" style={{ color: '#8A9BB0' }}>Restarts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.processes.map(p => (
                      <tr key={p.id} className="border-t" style={{ borderColor: '#F3F4F6' }}>
                        <td className="px-4 py-3 font-semibold" style={{ color: '#1B4332' }}>{p.name}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center text-xs font-bold" style={{ color: p.status === 'online' ? '#065F46' : '#991B1B' }}>
                            {statusDot(p.status)}{p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs" style={{ color: '#1B4332' }}>{p.cpu}%</td>
                        <td className="px-4 py-3 text-right text-xs" style={{ color: '#1B4332' }}>{fmt(p.memory)}</td>
                        <td className="px-4 py-3 text-right text-xs" style={{ color: p.restarts > 10 ? '#991B1B' : '#1B4332' }}>{p.restarts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
