import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { showToast } from '../components/Toast'
import PaymentSlip from '../components/PaymentSlip'

const API = (import.meta.env.VITE_API_URL as string | undefined) || ''
const PAYMENT_CATEGORIES = ['School Fees', 'Acceptance Fee', 'Exam Levy', 'Lab Fee', 'Caution Fee']
const ACADEMIC_YEARS = ['2024/2025', '2025/2026', '2026/2027']
const SEMESTERS = ['First Semester', 'Second Semester']

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('campusos_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

type Submission = {
  id: string
  academic_year: string
  semester: string
  payment_categories: string[]
  receipt_url: string
  receipt_filename: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  admin_note: string | null
  student_photo?: string | null
  student_name?: string
  student_matric?: string
  department?: string | null
  level?: string | null
  reviewed_at: string | null
  created_at: string
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

export default function Payment() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [academicYear, setAcademicYear] = useState('2025/2026')
  const [semester, setSemester] = useState('First Semester')
  const [categories, setCategories] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [viewingSlip, setViewingSlip] = useState<Submission | null>(null)

  async function loadHistory() {
    setLoadingHistory(true)
    try {
      const res = await fetch(`${API}/api/payments/my`, { headers: { ...authHeaders() } })
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      setSubmissions(json.submissions)
      // Auto-show slip for first approved submission not yet seen
      const approved = json.submissions.find((s: Submission) => s.status === 'APPROVED')
      if (approved) {
        const seenKey = `slip_seen_${approved.id}`
        if (!localStorage.getItem(seenKey)) {
          localStorage.setItem(seenKey, '1')
          setViewingSlip(approved)
        }
      }
    } catch { showToast('Could not load payment history', 'error') }
    finally { setLoadingHistory(false) }
  }

  useEffect(() => { loadHistory() }, [])

  function toggleCategory(cat: string) {
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])
  }

  async function submitPayment() {
    if (!file || categories.length === 0) return
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('receipt', file)
      fd.append('academicYear', academicYear)
      fd.append('semester', semester)
      fd.append('categories', JSON.stringify(categories))
      const res = await fetch(`${API}/api/payments/submit`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Submission failed', 'error'); return }
      showToast('Receipt submitted successfully', 'success')
      setShowForm(false)
      setFile(null)
      setCategories([])
      loadHistory()
    } catch { showToast('Network error', 'error') }
    finally { setSubmitting(false) }
  }

  const isStudent = user?.role === 'STUDENT'

  return (
    <div className="min-h-screen p-4 lg:p-8" style={{ background: '#F5F7FA' }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#122400' }}>Tuition</p>
            <h1 className="text-3xl font-black" style={{ color: '#1B4332' }}>Payment</h1>
            <div className="mt-2 h-1 w-16 rounded-full" style={{ background: '#D4A24C' }} />
          </div>
          <button onClick={() => navigate('/dashboard')}
            className="flex-shrink-0 px-3 py-2 rounded-xl text-sm font-bold border-0 cursor-pointer"
            style={{ background: '#E3EFE7', color: '#1B4332' }}>
            ← Home
          </button>
        </div>

        {/* Submit new button */}
        {isStudent && (
          <div className="mb-6">
            {!showForm ? (
              <button onClick={() => setShowForm(true)}
                className="w-full py-4 rounded-2xl font-bold text-white border-0 cursor-pointer text-sm"
                style={{ background: 'linear-gradient(135deg,#1B4332,#122400)' }}>
                + Submit Payment Receipt
              </button>
            ) : (
              <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.08)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-black text-lg" style={{ color: '#1B4332' }}>New Payment Receipt</h2>
                  <button onClick={() => setShowForm(false)} className="text-2xl border-0 bg-transparent cursor-pointer" style={{ color: '#1B4332', opacity: 0.4 }}>x</button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <label className="block">
                    <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Academic Year</div>
                    <select value={academicYear} onChange={e => setAcademicYear(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: '#E5E7EB' }}>
                      {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Semester</div>
                    <select value={semester} onChange={e => setSemester(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: '#E5E7EB' }}>
                      {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                </div>

                <div className="mb-4">
                  <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#1B4332', opacity: 0.7 }}>Payment is for</div>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_CATEGORIES.map(cat => (
                      <label key={cat} className="flex items-center gap-2 p-3 rounded-xl cursor-pointer border transition-colors"
                        style={{ borderColor: categories.includes(cat) ? '#122400' : '#E5E7EB', background: categories.includes(cat) ? '#F3EEFF' : 'white' }}>
                        <input type="checkbox" checked={categories.includes(cat)} onChange={() => toggleCategory(cat)} className="accent-purple-600" />
                        <span className="text-sm font-medium" style={{ color: '#1B4332' }}>{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mb-5">
                  <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#1B4332', opacity: 0.7 }}>Upload Receipt</div>
                  <label className="block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors"
                    style={{ borderColor: file ? '#122400' : '#E5E7EB', background: file ? '#F3EEFF' : 'white' }}>
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                    {file ? (
                      <div>
                        <div className="text-2xl mb-1">{file.name.endsWith('.pdf') ? 'PDF' : 'IMG'}</div>
                        <div className="text-sm font-semibold" style={{ color: '#122400' }}>{file.name}</div>
                        <div className="text-xs mt-1" style={{ color: '#8A9BB0' }}>{(file.size / 1024).toFixed(0)} KB</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-2xl mb-1">📎</div>
                        <div className="text-sm font-semibold" style={{ color: '#1B4332' }}>Tap to upload receipt</div>
                        <div className="text-xs mt-1" style={{ color: '#8A9BB0' }}>JPG, PNG or PDF — max 5MB</div>
                      </div>
                    )}
                  </label>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowForm(false)} disabled={submitting}
                    className="flex-1 py-3 rounded-xl text-sm font-bold border bg-white cursor-pointer disabled:opacity-50"
                    style={{ borderColor: '#E5E7EB', color: '#1B4332' }}>Cancel</button>
                  <button onClick={submitPayment} disabled={submitting || !file || categories.length === 0}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white border-0 cursor-pointer disabled:opacity-50"
                    style={{ background: '#122400' }}>
                    {submitting ? 'Submitting...' : 'Submit Receipt'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: '#1B4332', opacity: 0.6 }}>
            Submission History
          </h2>
          {loadingHistory && <div className="p-6 text-center text-sm" style={{ color: '#1B4332', opacity: 0.6 }}>Loading...</div>}
          {!loadingHistory && submissions.length === 0 && (
            <div className="bg-white rounded-2xl p-8 text-center" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
              <div className="text-4xl mb-2">🧾</div>
              <p className="text-sm" style={{ color: '#8A9BB0' }}>No receipts submitted yet.</p>
            </div>
          )}
          <div className="space-y-3">
            {submissions.map(s => (
              <div key={s.id} className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-black text-sm" style={{ color: '#1B4332' }}>{s.academic_year} — {s.semester}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#8A9BB0' }}>Submitted {formatDate(s.created_at)}</div>
                  </div>
                  {statusBadge(s.status)}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {s.payment_categories.map(cat => (
                    <span key={cat} className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#E3EFE7', color: '#122400' }}>{cat}</span>
                  ))}
                </div>
                {s.admin_note && (
                  <div className="p-2 rounded-lg text-xs mb-3" style={{ background: s.status === 'REJECTED' ? '#FEE2E2' : '#D1FAE5', color: s.status === 'REJECTED' ? '#991B1B' : '#065F46' }}>
                    Admin note: {s.admin_note}
                  </div>
                )}
                <a href={`${API}${s.receipt_url}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                  style={{ background: '#F5F7FA', color: '#122400' }}>
                  View Receipt
                </a>
                {s.status === 'APPROVED' && (
                  <button onClick={() => setViewingSlip(s)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border-0 cursor-pointer text-white"
                    style={{ background: '#1B4332' }}>
                    🖨️ Print Exam Slip
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    {viewingSlip && (
      <PaymentSlip
        submission={{
          ...viewingSlip,
          student_name: user?.name || '',
          student_matric: user?.matricNo || '',
          student_photo: user?.photoUrl || null,
          department: user?.department || null,
          level: user?.level || null,
          reviewed_by_name: null,
        }}
        onClose={() => setViewingSlip(null)}
      />
    )}
    </div>
  )
}
