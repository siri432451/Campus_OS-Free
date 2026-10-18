import { useEffect, useState, useCallback } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { showToast } from '../components/Toast'
import PaymentSlip from '../components/PaymentSlip'

const API = (import.meta.env.VITE_API_URL as string | undefined) || ''
const ADMIN_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN']

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('campusos_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

type Submission = {
  id: string
  student_id: string
  student_name: string
  student_matric: string
  department: string | null
  level: string | null
  academic_year: string
  semester: string
  payment_categories: string[]
  receipt_url: string
  receipt_filename: string
  status: string
  admin_note: string | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  created_at: string
  student_photo?: string | null
}

function statusBadge(status: string) {
  if (status === 'APPROVED') return <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: '#065F46' }}>Approved</span>
  if (status === 'REJECTED') return <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: '#991B1B' }}>Rejected</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: '#D4A24C' }}>Pending</span>
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function AdminPayments() {
  const { user } = useAuth()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [reviewing, setReviewing] = useState<Submission | null>(null)
  const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED')
  const [adminNote, setAdminNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [viewingSlip, setViewingSlip] = useState<Submission | null>(null)

  const fetchSubmissions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search.trim()) params.set('search', search.trim())
      const res = await fetch(`${API}/api/payments/admin?${params}`, { headers: { ...authHeaders() } })
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      setSubmissions(json.submissions)
    } catch { showToast('Could not load payments', 'error') }
    finally { setLoading(false) }
  }, [statusFilter, search])

  useEffect(() => { fetchSubmissions() }, [fetchSubmissions])

  async function submitReview() {
    if (!reviewing) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/payments/${reviewing.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status: reviewStatus, adminNote }),
      })
      if (!res.ok) { showToast('Failed to save review', 'error'); return }
      showToast(`Payment ${reviewStatus.toLowerCase()}`, 'success')
      setReviewing(null)
      setAdminNote('')
      fetchSubmissions()
    } catch { showToast('Network error', 'error') }
    finally { setSaving(false) }
  }

  if (!user || !ADMIN_ROLES.includes(user.role)) return <Navigate to="/dashboard" replace />
  if (user.role === 'SUPER_ADMIN') return <Navigate to="/admin" replace />

  const pending = submissions.filter(s => s.status === 'PENDING').length

  return (
    <div className="min-h-screen p-4 lg:p-8" style={{ background: '#F5F7FA' }}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#122400' }}>
              {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Provost'}
            </p>
            <h1 className="text-3xl font-black" style={{ color: '#1B4332' }}>Payments</h1>
            <div className="mt-2 h-1 w-16 rounded-full" style={{ background: '#D4A24C' }} />
          </div>
          {pending > 0 && (
            <div className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: '#D4A24C' }}>
              {pending} pending review
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b overflow-x-auto" style={{ borderColor: '#E5E7EB' }}>
          <Link to="/admin" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Overview</Link>
          <Link to="/admin/students" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Students</Link>
          <Link to="/admin/lecturers" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Lecturers</Link>
          <Link to="/admin/payments" className="px-4 py-2 text-sm font-bold border-b-2 whitespace-nowrap" style={{ color: '#122400', borderColor: '#122400' }}>Payments</Link>
          <Link to="/admin/results" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Results</Link>
          <Link to="/admin/health" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Health</Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Status</div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: '#E5E7EB' }}>
                <option value="all">All</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </label>
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
          </div>
        </div>

        {/* List */}
        <div className="space-y-3">
          {loading && <div className="p-8 text-center text-sm bg-white rounded-2xl" style={{ color: '#1B4332', opacity: 0.6 }}>Loading...</div>}
          {!loading && submissions.length === 0 && (
            <div className="p-8 text-center bg-white rounded-2xl" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
              <div className="text-4xl mb-2">🧾</div>
              <p className="text-sm" style={{ color: '#8A9BB0' }}>No payment submissions found.</p>
            </div>
          )}
          {submissions.map(s => (
            <div key={s.id} className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-black text-base" style={{ color: '#1B4332' }}>{s.student_name}</div>
                  <div className="font-mono text-xs mt-0.5" style={{ color: '#8A9BB0' }}>{s.student_matric} {s.department && `· ${s.department}`} {s.level && `· ${s.level}`}</div>
                  <div className="text-xs mt-1" style={{ color: '#8A9BB0' }}>{s.academic_year} — {s.semester} · Submitted {formatDate(s.created_at)}</div>
                </div>
                {statusBadge(s.status)}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {s.payment_categories.map((cat: string) => (
                  <span key={cat} className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#E3EFE7', color: '#122400' }}>{cat}</span>
                ))}
              </div>
              {s.admin_note && (
                <div className="p-2 rounded-lg text-xs mb-3" style={{ background: s.status === 'REJECTED' ? '#FEE2E2' : '#D1FAE5', color: s.status === 'REJECTED' ? '#991B1B' : '#065F46' }}>
                  Note: {s.admin_note}
                  {s.reviewed_by_name && <span className="ml-2 opacity-70">— {s.reviewed_by_name}</span>}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <a href={`${API}${s.receipt_url}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border cursor-pointer"
                  style={{ borderColor: '#E5E7EB', color: '#1B4332' }}>
                  View Receipt
                </a>
                <a href={`${API}${s.receipt_url}`} download={s.receipt_filename}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border cursor-pointer"
                  style={{ borderColor: '#E5E7EB', color: '#1B4332' }}>
                  Download
                </a>
                {s.status === 'PENDING' && (
                  <button onClick={() => { setReviewing(s); setReviewStatus('APPROVED'); setAdminNote('') }}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg text-white border-0 cursor-pointer"
                    style={{ background: '#122400' }}>
                    Review
                  </button>
                )}
                {s.status === 'APPROVED' && (
                  <button onClick={() => setViewingSlip(s)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg text-white border-0 cursor-pointer"
                    style={{ background: '#1B4332' }}>
                    🖨️ Print Slip
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Review modal */}
      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(27,67,50,0.55)' }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-lg" style={{ color: '#1B4332' }}>Review Payment</h3>
              <button onClick={() => setReviewing(null)} className="text-2xl border-0 bg-transparent cursor-pointer" style={{ color: '#1B4332', opacity: 0.5 }}>x</button>
            </div>
            <div className="p-3 rounded-xl mb-4" style={{ background: '#F5F7FA' }}>
              <div className="font-bold text-sm" style={{ color: '#1B4332' }}>{reviewing.student_name}</div>
              <div className="text-xs mt-0.5" style={{ color: '#8A9BB0' }}>{reviewing.student_matric} · {reviewing.academic_year} {reviewing.semester}</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {reviewing.payment_categories.map((cat: string) => (
                  <span key={cat} className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#E3EFE7', color: '#122400' }}>{cat}</span>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#1B4332', opacity: 0.7 }}>Decision</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setReviewStatus('APPROVED')}
                  className="py-3 rounded-xl text-sm font-bold border-2 cursor-pointer transition-colors"
                  style={{ borderColor: reviewStatus === 'APPROVED' ? '#065F46' : '#E5E7EB', background: reviewStatus === 'APPROVED' ? '#D1FAE5' : 'white', color: '#065F46' }}>
                  Approve
                </button>
                <button onClick={() => setReviewStatus('REJECTED')}
                  className="py-3 rounded-xl text-sm font-bold border-2 cursor-pointer transition-colors"
                  style={{ borderColor: reviewStatus === 'REJECTED' ? '#991B1B' : '#E5E7EB', background: reviewStatus === 'REJECTED' ? '#FEE2E2' : 'white', color: '#991B1B' }}>
                  Reject
                </button>
              </div>
            </div>
            <label className="block mb-4">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Note to student (optional)</div>
              <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={3}
                placeholder="e.g. Receipt verified, payment confirmed"
                className="w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none" style={{ borderColor: '#E5E7EB' }} />
            </label>
            <div className="flex gap-2">
              <button onClick={() => setReviewing(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold border bg-white cursor-pointer" style={{ borderColor: '#E5E7EB', color: '#1B4332' }}>Cancel</button>
              <button onClick={submitReview} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white border-0 cursor-pointer disabled:opacity-50"
                style={{ background: reviewStatus === 'APPROVED' ? '#065F46' : '#991B1B' }}>
                {saving ? 'Saving...' : `Confirm ${reviewStatus === 'APPROVED' ? 'Approval' : 'Rejection'}`}
              </button>
            </div>
          </div>
        </div>
      )}
      {viewingSlip && <PaymentSlip submission={{...viewingSlip, student_photo: viewingSlip.student_photo ?? null}} onClose={() => setViewingSlip(null)} />}
    </div>
  )
}
