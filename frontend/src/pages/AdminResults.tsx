import { useEffect, useState, useCallback } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { showToast } from '../components/Toast'

const API = (import.meta.env.VITE_API_URL as string | undefined) || ''
const ADMIN_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN']

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('campusos_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

type Result = {
  id: string
  courseCode: string
  courseName: string
  semester: string
  academicYear: string
  score: number
  grade: string
  creditUnit: number
  isPublished: boolean
  approvedAt: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  createdAt: string
  student: { id: string; name: string; matricNo: string | null; department: string | null; level: string | null }
  lecturer: { id: string; name: string; staffId: string | null } | null
}

function gradeBadge(grade: string) {
  const colors: Record<string, string> = { A: '#065F46', B: '#1D4ED8', C: '#B45309', D: '#C2410C', E: '#C2410C', F: '#DC2626' }
  return <span className="px-2 py-0.5 rounded-full text-xs font-black text-white" style={{ background: colors[grade] || '#8A9BB0' }}>{grade}</span>
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminResults() {
  const { user } = useAuth()
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rejecting, setRejecting] = useState<Result | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchResults = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('status', statusFilter)
      if (search.trim()) params.set('search', search.trim())
      if (courseFilter.trim()) params.set('course', courseFilter.trim())
      const res = await fetch(`${API}/api/results/admin/pending?${params}`, { headers: { ...authHeaders() } })
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      setResults(json.results)
      setSelected(new Set())
    } catch { showToast('Could not load results', 'error') }
    finally { setLoading(false) }
  }, [statusFilter, search, courseFilter])

  useEffect(() => { fetchResults() }, [fetchResults])

  async function approveOne(id: string) {
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/results/${id}/approve`, { method: 'PATCH', headers: { ...authHeaders() } })
      if (!res.ok) { showToast('Failed to approve', 'error'); return }
      showToast('Result approved', 'success')
      fetchResults()
    } catch { showToast('Network error', 'error') }
    finally { setSaving(false) }
  }

  async function approveSelected() {
    if (selected.size === 0) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/results/admin/batch-approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ ids: Array.from(selected) }),
      })
      if (!res.ok) { showToast('Batch approve failed', 'error'); return }
      const data = await res.json()
      showToast(`${data.approved} results approved`, 'success')
      fetchResults()
    } catch { showToast('Network error', 'error') }
    finally { setSaving(false) }
  }

  async function submitReject() {
    if (!rejecting) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/results/${rejecting.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ reason: rejectReason }),
      })
      if (!res.ok) { showToast('Failed to reject', 'error'); return }
      showToast('Result rejected', 'success')
      setRejecting(null)
      setRejectReason('')
      fetchResults()
    } catch { showToast('Network error', 'error') }
    finally { setSaving(false) }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === results.length) setSelected(new Set())
    else setSelected(new Set(results.map(r => r.id)))
  }

  if (!user || !ADMIN_ROLES.includes(user.role)) return <Navigate to="/dashboard" replace />
  if (user.role === 'SUPER_ADMIN') return <Navigate to="/admin" replace />

  const pending = results.filter(r => !r.isPublished && !r.rejectedAt).length

  return (
    <div className="min-h-screen p-4 lg:p-8" style={{ background: '#F5F7FA' }}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#122400' }}>
              {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'School Admin'}
            </p>
            <h1 className="text-3xl font-black" style={{ color: '#1B4332' }}>Results</h1>
            <div className="mt-2 h-1 w-16 rounded-full" style={{ background: '#D4A24C' }} />
          </div>
          {statusFilter === 'pending' && selected.size > 0 && (
            <button onClick={approveSelected} disabled={saving}
              className="px-4 py-2.5 rounded-xl font-bold text-sm text-white border-0 cursor-pointer disabled:opacity-50"
              style={{ background: '#065F46' }}>
              Approve {selected.size} selected
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b overflow-x-auto" style={{ borderColor: '#E5E7EB' }}>
          <Link to="/admin" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Overview</Link>
          <Link to="/admin/students" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Students</Link>
          <Link to="/admin/lecturers" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Lecturers</Link>
          <Link to="/admin/payments" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Payments</Link>
          <Link to="/admin/results" className="px-4 py-2 text-sm font-bold border-b-2 whitespace-nowrap" style={{ color: '#122400', borderColor: '#122400' }}>Results</Link>
          <Link to="/admin/health" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Health</Link>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 mb-4">
          {['pending', 'approved', 'rejected'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-4 py-2 rounded-xl text-sm font-bold border-0 cursor-pointer capitalize"
              style={{ background: statusFilter === s ? '#122400' : 'white', color: statusFilter === s ? 'white' : '#1B4332', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              {s}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Search student</div>
              <div className="flex gap-2">
                <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput) }}
                  placeholder="Name or matric"
                  className="flex-1 px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E5E7EB' }} />
                <button onClick={() => setSearch(searchInput)}
                  className="px-3 py-2 rounded-lg text-sm font-bold text-white border-0 cursor-pointer" style={{ background: '#122400' }}>Go</button>
              </div>
            </label>
            <label className="block col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Filter by course</div>
              <input type="text" value={courseFilter} onChange={e => setCourseFilter(e.target.value)}
                placeholder="e.g. Anatomy"
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E5E7EB' }} />
            </label>
          </div>
        </div>

        {/* Select all bar */}
        {statusFilter === 'pending' && results.length > 0 && (
          <div className="flex items-center gap-3 mb-3 px-2">
            <input type="checkbox" checked={selected.size === results.length && results.length > 0}
              onChange={toggleAll} className="accent-purple-600 w-4 h-4" />
            <span className="text-xs font-semibold" style={{ color: '#1B4332', opacity: 0.7 }}>
              {selected.size === 0 ? 'Select all' : `${selected.size} of ${results.length} selected`}
            </span>
          </div>
        )}

        {/* Results list */}
        {loading && <div className="p-8 text-center text-sm bg-white rounded-2xl" style={{ color: '#1B4332', opacity: 0.6 }}>Loading...</div>}
        {!loading && results.length === 0 && (
          <div className="p-8 text-center bg-white rounded-2xl" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
            <div className="text-4xl mb-2">📋</div>
            <p className="text-sm" style={{ color: '#8A9BB0' }}>No {statusFilter} results found.</p>
          </div>
        )}

        <div className="space-y-3">
          {results.map(r => (
            <div key={r.id} className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)', borderLeft: selected.has(r.id) ? '3px solid #122400' : '3px solid transparent' }}>
              <div className="flex items-start gap-3">
                {statusFilter === 'pending' && (
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)}
                    className="accent-purple-600 w-4 h-4 mt-1 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="font-black text-base" style={{ color: '#1B4332' }}>{r.student.name}</div>
                      <div className="font-mono text-xs mt-0.5" style={{ color: '#8A9BB0' }}>
                        {r.student.matricNo} {r.student.department && `· ${r.student.department}`} {r.student.level && `· ${r.student.level}`}
                      </div>
                    </div>
                    {gradeBadge(r.grade)}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="text-sm font-semibold" style={{ color: '#122400' }}>{r.courseName}</span>
                    <span className="text-xs" style={{ color: '#8A9BB0' }}>{r.courseCode}</span>
                    <span className="text-xs font-bold" style={{ color: '#1B4332' }}>{r.score}/100</span>
                    <span className="text-xs" style={{ color: '#8A9BB0' }}>{r.academicYear} · {r.semester}</span>
                  </div>
                  {r.lecturer && <div className="text-xs mb-2" style={{ color: '#8A9BB0' }}>Entered by: {r.lecturer.name}</div>}
                  {r.approvedAt && <div className="text-xs font-semibold" style={{ color: '#065F46' }}>Approved: {formatDate(r.approvedAt)}</div>}
                  {r.rejectedAt && (
                    <div>
                      <div className="text-xs font-semibold" style={{ color: '#991B1B' }}>Rejected: {formatDate(r.rejectedAt)}</div>
                      {r.rejectionReason && <div className="text-xs mt-0.5" style={{ color: '#991B1B' }}>Reason: {r.rejectionReason}</div>}
                    </div>
                  )}
                </div>
              </div>
              {statusFilter === 'pending' && (
                <div className="flex gap-2 mt-3 pt-3 border-t" style={{ borderColor: '#F3F4F6' }}>
                  <button onClick={() => approveOne(r.id)} disabled={saving}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white border-0 cursor-pointer disabled:opacity-50"
                    style={{ background: '#065F46' }}>Approve</button>
                  <button onClick={() => { setRejecting(r); setRejectReason('') }}
                    className="px-4 py-2 rounded-xl text-xs font-bold border-0 cursor-pointer"
                    style={{ background: '#FEE2E2', color: '#991B1B' }}>Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Reject modal */}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(27,67,50,0.55)' }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 className="font-black text-lg mb-1" style={{ color: '#1B4332' }}>Reject Result</h3>
            <p className="text-xs mb-4" style={{ color: '#8A9BB0' }}>{rejecting.student.name} · {rejecting.courseName}</p>
            <label className="block mb-4">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Reason (optional)</div>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
                placeholder="e.g. Score appears incorrect, please recheck"
                className="w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none" style={{ borderColor: '#E5E7EB' }} />
            </label>
            <div className="flex gap-2">
              <button onClick={() => setRejecting(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold border bg-white cursor-pointer" style={{ borderColor: '#E5E7EB', color: '#1B4332' }}>Cancel</button>
              <button onClick={submitReject} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white border-0 cursor-pointer disabled:opacity-50"
                style={{ background: '#991B1B' }}>
                {saving ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
