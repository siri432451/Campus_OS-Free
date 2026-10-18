import { useEffect, useState, useCallback } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API = (import.meta.env.VITE_API_URL as string | undefined) || ''
const ADMIN_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN']
const DEPARTMENTS = ['Nursing Science', 'Midwifery']

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('campusos_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

type Lecturer = {
  id: string
  name: string
  staffId: string | null
  email: string | null
  department: string | null
  phone: string | null
  photoUrl: string | null
  isActive: boolean
  isHod: boolean
  lastLogin: string | null
  createdAt: string
  emailVerifiedAt: string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <div className="text-xs uppercase tracking-wide" style={{ color: '#1B4332', opacity: 0.55 }}>{label}</div>
      <div className="text-sm font-semibold text-right" style={{ color: valueColor || '#1B4332' }}>{value}</div>
    </div>
  )
}

export default function AdminLecturers() {
  const { user } = useAuth()
  const [lecturers, setLecturers] = useState<Lecturer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')

  // View modal
  const [viewing, setViewing] = useState<Lecturer | null>(null)

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', staffId: '', email: '', department: 'Nursing Science', phone: '' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ name: string; staffId: string; defaultPassword: string } | null>(null)

  // Edit modal
  const [editing, setEditing] = useState<Lecturer | null>(null)
  const [editForm, setEditForm] = useState({ name: '', department: '', email: '', phone: '', isActive: true, isHod: false })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Reset password
  const [resetting, setResetting] = useState<string | null>(null)
  const [resetResult, setResetResult] = useState<string | null>(null)

  const fetchLecturers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (deptFilter !== 'all') params.set('department', deptFilter)
      const res = await fetch(`${API}/api/admin/lecturers?${params}`, { headers: { ...authHeaders() } })
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setLecturers(json.lecturers)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load lecturers')
    } finally {
      setLoading(false)
    }
  }, [search, deptFilter])

  useEffect(() => { fetchLecturers() }, [fetchLecturers])

  async function submitCreate() {
    setCreateError(null)
    setCreating(true)
    try {
      const res = await fetch(`${API}/api/admin/lecturers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(createForm),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error || 'Failed to create'); return }
      setCreated({ name: data.user.name, staffId: data.user.staffId, defaultPassword: data.defaultPassword })
      fetchLecturers()
    } catch { setCreateError('Network error') }
    finally { setCreating(false) }
  }

  async function submitEdit() {
    if (!editing) return
    setSaveError(null)
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/admin/lecturers/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error || 'Failed to save'); return }
      setEditing(null)
      fetchLecturers()
    } catch { setSaveError('Network error') }
    finally { setSaving(false) }
  }

  async function resetPassword(id: string) {
    setResetting(id)
    setResetResult(null)
    try {
      const res = await fetch(`${API}/api/admin/lecturers/${id}/reset-password`, {
        method: 'PATCH',
        headers: { ...authHeaders() },
      })
      const data = await res.json()
      if (!res.ok) { setResetResult('Failed to reset'); return }
      setResetResult(`Password reset to: ${data.defaultPassword}`)
    } catch { setResetResult('Network error') }
    finally { setResetting(null) }
  }

  if (!user || !ADMIN_ROLES.includes(user.role)) return <Navigate to="/dashboard" replace />
  if (user.role === 'SUPER_ADMIN') return <Navigate to="/admin" replace />

  return (
    <div className="min-h-screen p-4 lg:p-8" style={{ background: '#F5F7FA' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#122400' }}>
              {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Provost'}
            </p>
            <h1 className="text-3xl font-black" style={{ color: '#1B4332' }}>Lecturers</h1>
            <div className="mt-2 h-1 w-16 rounded-full" style={{ background: '#D4A24C' }} />
          </div>
          <button onClick={() => { setCreateForm({ name: '', staffId: '', email: '', department: 'Nursing Science', phone: '' }); setCreateError(null); setCreated(null); setShowCreate(true) }}
            className="px-4 py-2.5 rounded-xl font-bold text-sm text-white border-0 cursor-pointer" style={{ background: '#065F46' }}>
            + New Lecturer
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b" style={{ borderColor: '#E5E7EB' }}>
          <Link to="/admin" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent" style={{ color: '#1B4332', opacity: 0.6 }}>Overview</Link>
          <Link to="/admin/students" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent" style={{ color: '#1B4332', opacity: 0.6 }}>Students</Link>
          <Link to="/admin/lecturers" className="px-4 py-2 text-sm font-bold border-b-2" style={{ color: '#122400', borderColor: '#122400' }}>Lecturers</Link>
          <Link to="/admin/payments" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Payments</Link>
          <Link to="/admin/results" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Results</Link>
          <Link to="/admin/health" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Health</Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Department</div>
              <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: '#E5E7EB' }}>
                <option value="all">All depts</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="block col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Search name or staff ID</div>
              <div className="flex gap-2">
                <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput) }}
                  placeholder="e.g. Adeyemi or LECT001"
                  className="flex-1 px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E5E7EB' }} />
                <button onClick={() => setSearch(searchInput)} className="px-3 py-2 rounded-lg text-sm font-bold text-white border-0 cursor-pointer" style={{ background: '#122400' }}>Go</button>
              </div>
            </label>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
          {loading && <div className="p-8 text-center text-sm" style={{ color: '#1B4332', opacity: 0.6 }}>Loading...</div>}
          {error && !loading && <div className="p-5" style={{ background: '#FEE2E2', color: '#991B1B' }}>{error}</div>}
          {!loading && !error && lecturers.length === 0 && (
            <div className="p-8 text-center text-sm" style={{ color: '#1B4332', opacity: 0.6 }}>No lecturers found.</div>
          )}
          {!loading && lecturers.length > 0 && (
            <>
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#F5F7FA' }}>
                      <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: '#1B4332', opacity: 0.6 }}>Name</th>
                      <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: '#1B4332', opacity: 0.6 }}>Staff ID</th>
                      <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: '#1B4332', opacity: 0.6 }}>Department</th>
                      <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: '#1B4332', opacity: 0.6 }}>HOD</th>
                      <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: '#1B4332', opacity: 0.6 }}>Status</th>
                      <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: '#1B4332', opacity: 0.6 }}>Last login</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lecturers.map(l => (
                      <tr key={l.id} className="border-t" style={{ borderColor: '#F3F4F6' }}>
                        <td className="px-4 py-3 font-semibold" style={{ color: '#1B4332' }}>{l.name}</td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: '#1B4332' }}>{l.staffId || '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#1B4332', opacity: 0.7 }}>{l.department || '—'}</td>
                        <td className="px-4 py-3">
                          {l.isHod ? <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: '#D4A24C' }}>HOD</span> : <span style={{ color: '#8A9BB0' }}>—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {l.isActive ? <span style={{ color: '#065F46' }}>Active</span> : <span style={{ color: '#991B1B' }}>Inactive</span>}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#1B4332', opacity: 0.6 }}>{formatDate(l.lastLogin)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setViewing(l)} className="px-3 py-1.5 rounded-lg text-xs font-bold border-0 cursor-pointer text-white" style={{ background: '#122400' }}>View</button>
                            <button onClick={() => { setEditing(l); setEditForm({ name: l.name, department: l.department || '', email: l.email || '', phone: l.phone || '', isActive: l.isActive, isHod: l.isHod }); setSaveError(null) }}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold border-0 cursor-pointer text-white" style={{ background: '#1B4332' }}>Edit</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="lg:hidden divide-y" style={{ borderColor: '#F3F4F6' }}>
                {lecturers.map(l => (
                  <div key={l.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate" style={{ color: '#1B4332' }}>{l.name}</div>
                      <div className="font-mono text-xs mt-0.5" style={{ color: '#1B4332', opacity: 0.7 }}>{l.staffId}</div>
                      <div className="text-xs mt-1 flex items-center gap-2" style={{ color: '#1B4332', opacity: 0.6 }}>
                        {l.department || '—'}
                        {l.isHod && <span className="px-1.5 py-0.5 rounded text-xs font-bold text-white" style={{ background: '#D4A24C' }}>HOD</span>}
                        {!l.isActive && <span style={{ color: '#991B1B' }}>Inactive</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => setViewing(l)} className="px-2 py-1.5 rounded-lg text-xs font-bold border-0 cursor-pointer text-white" style={{ background: '#122400' }}>View</button>
                      <button onClick={() => { setEditing(l); setEditForm({ name: l.name, department: l.department || '', email: l.email || '', phone: l.phone || '', isActive: l.isActive, isHod: l.isHod }); setSaveError(null) }}
                        className="px-2 py-1.5 rounded-lg text-xs font-bold border-0 cursor-pointer text-white" style={{ background: '#1B4332' }}>Edit</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t text-xs" style={{ borderColor: '#F3F4F6', color: '#1B4332', opacity: 0.6 }}>
                {lecturers.length} lecturer{lecturers.length !== 1 ? 's' : ''}
              </div>
            </>
          )}
        </div>
      </div>

      {/* View modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(27,67,50,0.55)' }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#122400' }}>Lecturer profile</p>
                <h3 className="text-xl font-black" style={{ color: '#1B4332' }}>{viewing.name}</h3>
                <div className="font-mono text-xs mt-1" style={{ color: '#1B4332', opacity: 0.65 }}>{viewing.staffId}</div>
              </div>
              <button onClick={() => setViewing(null)} className="text-2xl leading-none border-0 bg-transparent cursor-pointer" style={{ color: '#1B4332', opacity: 0.5 }}>x</button>
            </div>
            <div className="space-y-3 text-sm">
              <Row label="Department" value={viewing.department || '—'} />
              <Row label="Email" value={viewing.email || 'Not set'} />
              <Row label="Phone" value={viewing.phone || 'Not set'} />
              <Row label="HOD" value={viewing.isHod ? 'Yes' : 'No'} valueColor={viewing.isHod ? '#D4A24C' : undefined} />
              <Row label="Status" value={viewing.isActive ? 'Active' : 'Inactive'} valueColor={viewing.isActive ? '#065F46' : '#991B1B'} />
              <Row label="Last login" value={formatDate(viewing.lastLogin)} />
              <Row label="Account created" value={formatDate(viewing.createdAt)} />
            </div>
            {resetResult && (
              <div className="mt-4 p-3 rounded-xl text-xs font-mono text-center" style={{ background: '#F5F7FA', color: '#1B4332' }}>{resetResult}</div>
            )}
            <div className="flex gap-2 mt-5">
              <button onClick={() => { resetPassword(viewing.id) }} disabled={resetting === viewing.id}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold border cursor-pointer disabled:opacity-50 bg-white"
                style={{ borderColor: '#E5E7EB', color: '#1B4332' }}>
                {resetting === viewing.id ? 'Resetting...' : 'Reset Password'}
              </button>
              <button onClick={() => { setViewing(null); setResetResult(null) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white border-0 cursor-pointer" style={{ background: '#122400' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(27,67,50,0.55)' }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-lg" style={{ color: '#1B4332' }}>Edit Lecturer</h3>
              <button onClick={() => setEditing(null)} className="text-2xl leading-none border-0 bg-transparent cursor-pointer" style={{ color: '#1B4332', opacity: 0.5 }}>x</button>
            </div>
            <label className="block mb-3">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Full name</div>
              <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E5E7EB' }} />
            </label>
            <label className="block mb-3">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Email</div>
              <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E5E7EB' }} />
            </label>
            <label className="block mb-3">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Department</div>
              <select value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: '#E5E7EB' }}>
                <option value="">None</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="block mb-3">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Phone</div>
              <input type="text" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E5E7EB' }} />
            </label>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })} />
                <span className="text-sm font-semibold" style={{ color: '#1B4332' }}>Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForm.isHod} onChange={e => setEditForm({ ...editForm, isHod: e.target.checked })} />
                <span className="text-sm font-semibold" style={{ color: '#D4A24C' }}>HOD</span>
              </label>
            </div>
            {saveError && <div className="mb-3 p-2 rounded text-sm" style={{ background: '#FEE2E2', color: '#991B1B' }}>{saveError}</div>}
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold border bg-white cursor-pointer" style={{ borderColor: '#E5E7EB', color: '#1B4332' }}>Cancel</button>
              <button onClick={submitEdit} disabled={saving || !editForm.name}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white border-0 cursor-pointer disabled:opacity-50" style={{ background: '#122400' }}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(27,67,50,0.55)' }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            {!created ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-lg" style={{ color: '#1B4332' }}>New Lecturer</h3>
                  <button onClick={() => setShowCreate(false)} disabled={creating} className="text-2xl leading-none border-0 bg-transparent cursor-pointer" style={{ color: '#1B4332', opacity: 0.5 }}>x</button>
                </div>
                <p className="text-xs mb-4" style={{ color: '#1B4332', opacity: 0.65 }}>A temporary password is generated for each lecturer and shown once after creation.</p>
                <label className="block mb-3">
                  <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Full name</div>
                  <input type="text" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} disabled={creating}
                    placeholder="Dr. Adeyemi Oladele" className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E5E7EB' }} />
                </label>
                <label className="block mb-3">
                  <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Staff ID</div>
                  <input type="text" value={createForm.staffId} onChange={e => setCreateForm({ ...createForm, staffId: e.target.value })} disabled={creating}
                    placeholder="LECT004" className="w-full px-3 py-2 rounded-lg border text-sm font-mono" style={{ borderColor: '#E5E7EB' }} />
                </label>
                <label className="block mb-3">
                  <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Email</div>
                  <input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} disabled={creating}
                    placeholder="adeyemi@example.com" className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E5E7EB' }} />
                </label>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <label className="block">
                    <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Department</div>
                    <select value={createForm.department} onChange={e => setCreateForm({ ...createForm, department: e.target.value })} disabled={creating}
                      className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: '#E5E7EB' }}>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Phone</div>
                    <input type="text" value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} disabled={creating}
                      placeholder="08012345678" className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E5E7EB' }} />
                  </label>
                </div>
                {createError && <div className="mb-3 p-2 rounded text-sm" style={{ background: '#FEE2E2', color: '#991B1B' }}>{createError}</div>}
                <div className="flex gap-2">
                  <button onClick={() => setShowCreate(false)} disabled={creating} className="flex-1 py-2.5 rounded-xl text-sm font-bold border bg-white cursor-pointer disabled:opacity-50" style={{ borderColor: '#E5E7EB', color: '#1B4332' }}>Cancel</button>
                  <button onClick={submitCreate} disabled={creating || !createForm.name || !createForm.staffId || !createForm.email}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white border-0 cursor-pointer disabled:opacity-50" style={{ background: '#065F46' }}>
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">✓</div>
                  <h3 className="font-black text-lg" style={{ color: '#065F46' }}>Lecturer created</h3>
                </div>
                <div className="rounded-xl p-4 mb-4" style={{ background: '#F5F7FA' }}>
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.6 }}>Name</div>
                  <div className="font-bold mb-3" style={{ color: '#1B4332' }}>{created.name}</div>
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.6 }}>Staff ID (login)</div>
                  <div className="font-mono font-bold mb-3" style={{ color: '#1B4332' }}>{created.staffId}</div>
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.6 }}>Default password</div>
                  <div className="font-mono font-bold" style={{ color: '#1B4332' }}>{created.defaultPassword}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setCreated(null); setCreateForm({ name: '', staffId: '', email: '', department: 'Nursing Science', phone: '' }) }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold border bg-white cursor-pointer" style={{ borderColor: '#E5E7EB', color: '#1B4332' }}>Create another</button>
                  <button onClick={() => { setShowCreate(false); setCreated(null) }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white border-0 cursor-pointer" style={{ background: '#122400' }}>Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
