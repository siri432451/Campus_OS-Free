import { useEffect, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API = (import.meta.env.VITE_API_URL as string | undefined) || ''
const ADMIN_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN']

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('campusos_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

type Stats = {
  users: {
    total: number
    students: number
    lecturers: number
    operators: number
    admins?: number
    superAdmins?: number
    schoolAdmins?: number
    verified: number
    unverified: number
    biodataCompleted: number
    nursingCount: number
    midwiferyCount: number
  }
  print: {
    queued: number
    printedToday: number
    printedTotal: number
    cancelledTotal: number
  }
  revenue?: {
    topupsToday: number
    topupsTotal: number
    totalToday: number   // in kobo
    totalTotal: number   // in kobo
  }
}

function formatNaira(kobo: number | undefined): string {
  if (kobo == null) return '₦0'
  const naira = Math.floor(kobo / 100)
  return '₦' + naira.toLocaleString()
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
      <div className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: '#8A9BB0' }}>
        {label}
      </div>
      <div className="font-black leading-none" style={{ fontSize: 36, color: accent || '#1B4332' }}>
        {value}
      </div>
    </div>
  )
}

export default function Admin() {
  const { user } = useAuth()

  // Hooks must run unconditionally — call them BEFORE any early return
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`${API}/api/admin/stats`, {
          headers: { ...authHeaders() },
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Request failed (${res.status})`)
        }
        const data = await res.json()
        if (!cancelled) setStats(data)
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load stats')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // ── Create student modal state ────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [form, setForm] = useState({ name: '', matricNo: '', level: 'ND1', department: 'Nursing Science', email: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createdUser, setCreatedUser] = useState<{ name: string; matricNo: string; defaultPassword: string; emailStatus: string } | null>(null)

  function resetCreateForm() {
    setForm({ name: '', matricNo: '', level: 'ND1', department: 'Nursing Science', email: '' })
    setCreateError(null)
    setCreatedUser(null)
  }

  async function submitCreate() {
    setCreateError(null)
    setCreating(true)
    try {
      const res = await fetch(`${API}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateError(data.error || 'Could not create student')
        return
      }
      setCreatedUser({
        name: data.user.name,
        matricNo: data.user.matricNo,
        defaultPassword: data.defaultPassword,
        emailStatus: data.emailStatus,
      })
      // Refresh stats in the background
      try {
        const r = await fetch(`${API}/api/admin/stats`, { headers: { ...authHeaders() } })
        if (r.ok) setStats(await r.json())
      } catch { /* non-fatal */ }
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setCreating(false)
    }
  }

  if (!user || !ADMIN_ROLES.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  const isSuper = user.role === 'SUPER_ADMIN'

  return (
    <div className="min-h-screen p-4 lg:p-8" style={{ background: '#F5F7FA' }}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#122400' }}>
              {isSuper ? 'Super Admin' : 'School Admin'}
            </p>
            <h1 className="text-3xl font-black" style={{ color: '#1B4332' }}>
              Admin Dashboard
            </h1>
            <div className="mt-2 h-1 w-16 rounded-full" style={{ background: '#D4A24C' }} />
            <p className="mt-3 text-sm" style={{ color: '#1B4332', opacity: 0.65 }}>
              Welcome, <strong>{user.name}</strong>. Read-only overview · live numbers.
            </p>
          </div>
          {!isSuper && (
          <button
            onClick={() => { resetCreateForm(); setShowCreateModal(true) }}
            className="px-4 py-2.5 rounded-xl font-bold text-sm text-white border-0 cursor-pointer"
            style={{ background: '#065F46' }}
          >
            + New Student
          </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b overflow-x-auto" style={{ borderColor: '#E5E7EB' }}>
          <Link to="/admin" className="px-4 py-2 text-sm font-bold border-b-2 whitespace-nowrap" style={{ color: '#122400', borderColor: '#122400' }}>Overview</Link>
          {!isSuper && <Link to="/admin/students" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Students</Link>}
          {!isSuper && <Link to="/admin/lecturers" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Lecturers</Link>}
          {!isSuper && <Link to="/admin/payments" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Payments</Link>}
          {!isSuper && <Link to="/admin/results" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Results</Link>}
          {isSuper && <Link to="/admin/health" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Health</Link>}
        </div>

        {loading && (
          <div className="bg-white rounded-2xl p-8 text-center" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
            <div className="text-sm" style={{ color: '#1B4332', opacity: 0.6 }}>Loading stats…</div>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl p-5 mb-6" style={{ background: '#FEE2E2', color: '#991B1B' }}>
            <div className="font-bold mb-1">Could not load stats</div>
            <div className="text-sm">{error}</div>
          </div>
        )}

        {stats && !loading && (
          <>
            <section className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#1B4332', opacity: 0.6 }}>
                People
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Total accounts" value={stats.users.total} />
                <StatCard label="Students"       value={stats.users.students} />
                <StatCard label="Lecturers"      value={stats.users.lecturers} />
                <StatCard label="Operators"      value={stats.users.operators} />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                <StatCard label="Biodata completed"  value={stats.users.biodataCompleted ?? 0} accent="#065F46" />
                <StatCard label="Nursing Science"    value={stats.users.nursingCount ?? 0} />
                <StatCard label="Midwifery"          value={stats.users.midwiferyCount ?? 0} />
              </div>
            </section>

            {isSuper && (
            <section className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#1B4332', opacity: 0.6 }}>
                Printing
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="In queue now"   value={stats.print.queued}        accent={stats.print.queued > 0 ? '#122400' : '#1B4332'} />
                <StatCard label="Printed today"  value={stats.print.printedToday}  accent="#065F46" />
                <StatCard label="Printed total"  value={stats.print.printedTotal}  accent="#065F46" />
                <StatCard label="Cancelled"      value={stats.print.cancelledTotal} accent="#991B1B" />
              </div>
            </section>
            )}

            {isSuper && stats.revenue && (
              <section className="mb-8">
                <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#1B4332', opacity: 0.6 }}>
                  Revenue (Super Admin only)
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard label="Top-ups today"  value={stats.revenue.topupsToday} />
                  <StatCard label="Top-ups total"  value={stats.revenue.topupsTotal} />
                  <StatCard label="Naira today"    value={formatNaira(stats.revenue.totalToday)} accent="#122400" />
                  <StatCard label="Naira total"    value={formatNaira(stats.revenue.totalTotal)} accent="#122400" />
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Create Student Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(27,67,50,0.55)' }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            {!createdUser ? (
              <>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-black text-lg" style={{ color: '#1B4332' }}>Create new student</h3>
                  <button
                    onClick={() => { if (!creating) { setShowCreateModal(false); resetCreateForm() } }}
                    disabled={creating}
                    className="text-2xl leading-none border-0 bg-transparent cursor-pointer"
                    style={{ color: '#1B4332', opacity: 0.5 }}
                  >×</button>
                </div>
                <p className="text-xs mb-4" style={{ color: '#1B4332', opacity: 0.65 }}>
                  Default password is <strong>Student123!</strong>. Student must change it and verify email on first login.
                </p>

                <label className="block mb-3">
                  <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Full name</div>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} disabled={creating}
                    placeholder="Adunola Bello"
                    className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E5E7EB' }} />
                </label>

                <label className="block mb-3">
                  <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Matric number</div>
                  <input type="text" value={form.matricNo} onChange={e => setForm({ ...form, matricNo: e.target.value })} disabled={creating}
                    placeholder="NSG/2026/001"
                    className="w-full px-3 py-2 rounded-lg border text-sm font-mono" style={{ borderColor: '#E5E7EB' }} />
                </label>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <label className="block">
                    <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Level</div>
                    <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} disabled={creating}
                      className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: '#E5E7EB' }}>
                      <option value="ND1">ND1</option>
                      <option value="ND2">ND2</option>
                      <option value="HND1">HND1</option>
                      <option value="HND2">HND2</option>
                    </select>
                  </label>

                  <label className="block">
                    <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Department</div>
                    <input type="text" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} disabled={creating}
                      className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E5E7EB' }} />
                  </label>
                </div>

                <label className="block mb-4">
                  <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Email</div>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} disabled={creating}
                    placeholder="adunola@example.com"
                    className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E5E7EB' }} />
                </label>

                {createError && (
                  <div className="mb-3 p-2 rounded text-sm" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                    {createError}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowCreateModal(false); resetCreateForm() }}
                    disabled={creating}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold border bg-white cursor-pointer disabled:opacity-50"
                    style={{ borderColor: '#E5E7EB', color: '#1B4332' }}
                  >Cancel</button>
                  <button
                    onClick={submitCreate}
                    disabled={creating || !form.name || !form.matricNo || !form.email}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white border-0 cursor-pointer disabled:opacity-50"
                    style={{ background: '#065F46' }}
                  >{creating ? 'Creating…' : 'Create student'}</button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">✓</div>
                  <h3 className="font-black text-lg" style={{ color: '#065F46' }}>Student created</h3>
                </div>
                <div className="rounded-xl p-4 mb-3" style={{ background: '#F5F7FA' }}>
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.6 }}>Name</div>
                  <div className="font-bold mb-3" style={{ color: '#1B4332' }}>{createdUser.name}</div>
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.6 }}>Matric (also their login)</div>
                  <div className="font-mono font-bold mb-3" style={{ color: '#1B4332' }}>{createdUser.matricNo}</div>
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.6 }}>Default password</div>
                  <div className="font-mono font-bold" style={{ color: '#1B4332' }}>{createdUser.defaultPassword}</div>
                </div>
                <div className="text-xs mb-4 p-2 rounded" style={{
                  background: createdUser.emailStatus === 'sent' ? '#D1FAE5' : '#FEF3C7',
                  color: createdUser.emailStatus === 'sent' ? '#065F46' : '#92400E',
                }}>
                  {createdUser.emailStatus === 'sent'
                    ? '✓ Welcome email sent. Student can verify their email after first login.'
                    : '⚠ Welcome email could not be delivered (Resend test-mode restriction). Please share the credentials with the student directly.'}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { resetCreateForm() }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold border bg-white cursor-pointer"
                    style={{ borderColor: '#E5E7EB', color: '#1B4332' }}
                  >Create another</button>
                  <button
                    onClick={() => { setShowCreateModal(false); resetCreateForm() }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white border-0 cursor-pointer"
                    style={{ background: '#122400' }}
                  >Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
