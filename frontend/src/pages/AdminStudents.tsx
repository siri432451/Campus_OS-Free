import { useEffect, useState, useCallback } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API = (import.meta.env.VITE_API_URL as string | undefined) || ''
const ADMIN_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN']

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('campusos_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

type Student = {
  id: string
  name: string
  matricNo: string | null
  email: string | null
  level: string | null
  department: string | null
  phone: string | null
  photoUrl: string | null
  isActive: boolean
  lastLogin: string | null
  createdAt: string
  emailVerifiedAt: string | null
  emailVerified: boolean
  middleName?: string | null
  dateOfBirth?: string | null
  gender?: string | null
  maritalStatus?: string | null
  hometown?: string | null
  localGovernment?: string | null
  stateOfOrigin?: string | null
  nationality?: string | null
  contactAddress?: string | null
  residentialAddress?: string | null
  bloodGroup?: string | null
  genotype?: string | null
  biodataCompletedAt?: string | null
}

type StudentsResponse = {
  students: Student[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const DEPARTMENTS = ['Nursing Science', 'Midwifery']
const LEVELS = ['ND1', 'ND2', 'HND1', 'HND2']

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

function StudentModal({ student, onClose }: { student: Student; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(27,67,50,0.55)' }}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: '#122400' }}>Student profile</p>
            <h3 className="text-xl font-black" style={{ color: '#1B4332' }}>{student.name}</h3>
            <div className="font-mono text-xs mt-1" style={{ color: '#1B4332', opacity: 0.65 }}>{student.matricNo || '—'}</div>
          </div>
          <button onClick={onClose} className="text-2xl leading-none border-0 bg-transparent cursor-pointer" style={{ color: '#1B4332', opacity: 0.5 }}>x</button>
        </div>
        {student.photoUrl && <img src={student.photoUrl} alt={student.name} className="w-24 h-24 rounded-2xl mb-3 object-cover" />}
        <div className="space-y-3 text-sm">
          <Row label="Level" value={student.level || '—'} />
          <Row label="Department" value={student.department || '—'} />
          <Row label="Email" value={student.email || 'Not set'} />
          <Row label="Email verified" value={student.emailVerified ? 'Verified' : 'Not yet'} valueColor={student.emailVerified ? '#065F46' : '#92400E'} />
          <Row label="Phone" value={student.phone || 'Not set'} />
          <Row label="Account active" value={student.isActive ? 'Yes' : 'No'} valueColor={student.isActive ? '#065F46' : '#991B1B'} />
          <Row label="Last login" value={formatDate(student.lastLogin)} />
          <Row label="Account created" value={formatDate(student.createdAt)} />
        </div>
        {student.biodataCompletedAt ? (
          <div className="mt-5">
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#122400' }}>Biodata</div>
            <div className="space-y-3 text-sm">
              <Row label="Middle name" value={student.middleName || '—'} />
              <Row label="Date of birth" value={formatDate(student.dateOfBirth || null)} />
              <Row label="Gender" value={student.gender || '—'} />
              <Row label="Marital status" value={student.maritalStatus || '—'} />
              <Row label="Hometown" value={student.hometown || '—'} />
              <Row label="Local government" value={student.localGovernment || '—'} />
              <Row label="State of origin" value={student.stateOfOrigin || '—'} />
              <Row label="Nationality" value={student.nationality || '—'} />
              <Row label="Contact address" value={student.contactAddress || '—'} />
              <Row label="Residential address" value={student.residentialAddress || '—'} />
              <Row label="Blood group" value={student.bloodGroup || '—'} />
              <Row label="Genotype" value={student.genotype || '—'} />
            </div>
          </div>
        ) : (
          <div className="mt-5 p-3 rounded-xl text-xs text-center" style={{ background: '#FEF3C7', color: '#92400E' }}>
            Student has not completed biodata onboarding yet.
          </div>
        )}
        <button onClick={onClose} className="w-full mt-5 py-2.5 rounded-xl text-sm font-bold text-white border-0 cursor-pointer" style={{ background: '#122400' }}>Close</button>
      </div>
    </div>
  )
}

function GroupsView({ onViewStudent }: { onViewStudent: (s: Student) => void }) {
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`${API}/api/admin/students?pageSize=1000`, { headers: { ...authHeaders() } })
        if (!res.ok) throw new Error('Failed to load')
        const json: StudentsResponse = await res.json()
        setAllStudents(json.students)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Could not load students')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function toggleGroup(key: string) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) return <div className="p-8 text-center text-sm" style={{ color: '#1B4332', opacity: 0.6 }}>Loading groups...</div>
  if (error) return <div className="p-5 rounded-2xl" style={{ background: '#FEE2E2', color: '#991B1B' }}>{error}</div>

  const ungrouped = allStudents.filter(s => !DEPARTMENTS.includes(s.department || ''))

  return (
    <div className="space-y-6">
      <div className="text-sm font-semibold" style={{ color: '#1B4332', opacity: 0.6 }}>
        {allStudents.length} student{allStudents.length !== 1 ? 's' : ''} across all departments
      </div>

      {DEPARTMENTS.map(dept => {
        const deptStudents = allStudents.filter(s => s.department === dept)
        return (
          <div key={dept} className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#1B4332,#122400)' }}>
              <div>
                <h2 className="font-black text-lg text-white">{dept}</h2>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>{deptStudents.length} student{deptStudents.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
              {LEVELS.map(level => {
                const groupStudents = deptStudents.filter(s => s.level === level)
                const key = `${dept}-${level}`
                const isOpen = expanded[key]
                return (
                  <div key={level}>
                    <button onClick={() => toggleGroup(key)} className="w-full px-6 py-4 flex items-center justify-between border-0 bg-transparent cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-full text-xs font-black text-white" style={{ background: '#122400' }}>{level}</span>
                        <span className="text-sm font-semibold" style={{ color: '#1B4332' }}>{groupStudents.length} student{groupStudents.length !== 1 ? 's' : ''}</span>
                      </div>
                      <span className="text-xs" style={{ color: '#8A9BB0' }}>{isOpen ? 'Hide' : 'Show'}</span>
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-4">
                        {groupStudents.length === 0 ? (
                          <div className="text-center py-6 text-sm" style={{ color: '#8A9BB0' }}>No students in this group yet.</div>
                        ) : (
                          <div className="space-y-2">
                            {groupStudents.map(s => (
                              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#F5F7FA' }}>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-sm truncate" style={{ color: '#1B4332' }}>{s.name}</div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="font-mono text-xs" style={{ color: '#8A9BB0' }}>{s.matricNo || '—'}</span>
                                    {s.emailVerified
                                      ? <span className="text-xs font-bold" style={{ color: '#065F46' }}>verified</span>
                                      : <span className="text-xs" style={{ color: '#92400E' }}>unverified</span>}
                                  </div>
                                </div>
                                <button onClick={() => onViewStudent(s)} className="ml-3 px-3 py-1.5 rounded-lg text-xs font-bold text-white border-0 cursor-pointer flex-shrink-0" style={{ background: '#122400' }}>View</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {ungrouped.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
          <button onClick={() => toggleGroup('ungrouped')} className="w-full px-6 py-4 flex items-center justify-between border-0 bg-transparent cursor-pointer hover:bg-gray-50">
            <span className="text-sm font-bold" style={{ color: '#92400E' }}>Ungrouped ({ungrouped.length})</span>
            <span className="text-xs" style={{ color: '#8A9BB0' }}>{expanded['ungrouped'] ? 'Hide' : 'Show'}</span>
          </button>
          {expanded['ungrouped'] && (
            <div className="px-6 pb-4 space-y-2">
              {ungrouped.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#FEF3C7' }}>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm" style={{ color: '#1B4332' }}>{s.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#92400E' }}>Dept: {s.department || 'none'} / Level: {s.level || 'none'}</div>
                  </div>
                  <button onClick={() => onViewStudent(s)} className="ml-3 px-3 py-1.5 rounded-lg text-xs font-bold text-white border-0 cursor-pointer" style={{ background: '#122400' }}>View</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminStudents() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'list' | 'groups'>('list')
  const [level, setLevel] = useState<string>('all')
  const [department, setDepartment] = useState<string>('all')
  const [active, setActive] = useState<string>('all')
  const [verified, setVerified] = useState<string>('all')
  const [search, setSearch] = useState<string>('')
  const [searchInput, setSearchInput] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const [data, setData] = useState<StudentsResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Student | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<any>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (level !== 'all') params.set('level', level)
      if (department !== 'all') params.set('department', department)
      if (active !== 'all') params.set('active', active)
      if (verified !== 'all') params.set('verified', verified)
      if (search.trim()) params.set('search', search.trim())
      params.set('page', String(page))
      params.set('pageSize', '20')
      const res = await fetch(`${API}/api/admin/students?${params.toString()}`, { headers: { ...authHeaders() } })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }
      setData(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load students')
    } finally {
      setLoading(false)
    }
  }, [level, department, active, verified, search, page])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  function applySearch() { setSearch(searchInput); setPage(1) }
  function clearAllFilters() {
    setLevel('all'); setDepartment('all'); setActive('all'); setVerified('all')
    setSearch(''); setSearchInput(''); setPage(1)
  }

  if (!user || !ADMIN_ROLES.includes(user.role)) return <Navigate to="/dashboard" replace />
  if (user.role === 'SUPER_ADMIN') return <Navigate to="/admin" replace />

  return (
    <div className="min-h-screen p-4 lg:p-8" style={{ background: '#F5F7FA' }}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#122400' }}>
            {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'School Admin'}
          </p>
          <h1 className="text-3xl font-black" style={{ color: '#1B4332' }}>Students</h1>
          <div className="mt-2 h-1 w-16 rounded-full" style={{ background: '#D4A24C' }} />
        </div>

        <div className="flex gap-2 mb-6 border-b" style={{ borderColor: '#E5E7EB' }}>
          <Link to="/admin" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent" style={{ color: '#1B4332', opacity: 0.6 }}>Overview</Link>
          <button onClick={() => setActiveTab('list')} className="px-4 py-2 text-sm font-bold border-b-2 border-0 bg-transparent cursor-pointer"
            style={{ color: activeTab === 'list' ? '#122400' : '#1B4332', borderColor: activeTab === 'list' ? '#122400' : 'transparent', opacity: activeTab === 'list' ? 1 : 0.6 }}>
            Students
          </button>
          <button onClick={() => setActiveTab('groups')} className="px-4 py-2 text-sm font-bold border-b-2 border-0 bg-transparent cursor-pointer"
            style={{ color: activeTab === 'groups' ? '#122400' : '#1B4332', borderColor: activeTab === 'groups' ? '#122400' : 'transparent', opacity: activeTab === 'groups' ? 1 : 0.6 }}>
            Groups
          </button>
          <Link to="/admin/lecturers" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent" style={{ color: '#1B4332', opacity: 0.6 }}>Lecturers</Link>
          <Link to="/admin/payments" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Payments</Link>
          <Link to="/admin/results" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Results</Link>
          <Link to="/admin/health" className="px-4 py-2 text-sm font-semibold border-b-2 border-transparent whitespace-nowrap" style={{ color: '#1B4332', opacity: 0.6 }}>Health</Link>
        </div>

        {activeTab === 'groups' && <GroupsView onViewStudent={setViewing} />}

        {activeTab === 'list' && (
          <>
            <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-3">
                <label className="block">
                  <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Department</div>
                  <select value={department} onChange={e => { setDepartment(e.target.value); setPage(1) }} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: '#E5E7EB' }}>
                    <option value="all">All depts</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
                <label className="block">
                  <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Level</div>
                  <select value={level} onChange={e => { setLevel(e.target.value); setPage(1) }} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: '#E5E7EB' }}>
                    <option value="all">All levels</option>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </label>
                <label className="block">
                  <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Active</div>
                  <select value={active} onChange={e => { setActive(e.target.value); setPage(1) }} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: '#E5E7EB' }}>
                    <option value="all">All</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </label>
                <label className="block">
                  <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Verified</div>
                  <select value={verified} onChange={e => { setVerified(e.target.value); setPage(1) }} className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={{ borderColor: '#E5E7EB' }}>
                    <option value="all">All</option>
                    <option value="true">Verified</option>
                    <option value="false">Not yet</option>
                  </select>
                </label>
                <label className="block col-span-2">
                  <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>Search name or matric</div>
                  <div className="flex gap-2">
                    <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') applySearch() }}
                      placeholder="e.g. Bello or NSG/2022" className="flex-1 px-3 py-2 rounded-lg border text-sm" style={{ borderColor: '#E5E7EB' }} />
                    <button onClick={applySearch} className="px-3 py-2 rounded-lg text-sm font-bold text-white border-0 cursor-pointer" style={{ background: '#122400' }}>Go</button>
                  </div>
                </label>
              </div>
              <button onClick={clearAllFilters} className="text-xs underline cursor-pointer border-0 bg-transparent" style={{ color: '#1B4332', opacity: 0.6 }}>Reset filters</button>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
              {loading && <div className="p-8 text-center text-sm" style={{ color: '#1B4332', opacity: 0.6 }}>Loading...</div>}
              {error && !loading && <div className="p-5" style={{ background: '#FEE2E2', color: '#991B1B' }}>{error}</div>}
              {data && !loading && data.students.length === 0 && (
                <div className="p-8 text-center text-sm" style={{ color: '#1B4332', opacity: 0.6 }}>No students match these filters.</div>
              )}
              {data && !loading && data.students.length > 0 && (
                <>
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: '#F5F7FA' }}>
                          <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: '#1B4332', opacity: 0.6 }}>Name</th>
                          <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: '#1B4332', opacity: 0.6 }}>Matric</th>
                          <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: '#1B4332', opacity: 0.6 }}>Dept</th>
                          <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: '#1B4332', opacity: 0.6 }}>Level</th>
                          <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: '#1B4332', opacity: 0.6 }}>Verified</th>
                          <th className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: '#1B4332', opacity: 0.6 }}>Last login</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.students.map(s => (
                          <tr key={s.id} className="border-t" style={{ borderColor: '#F3F4F6' }}>
                            <td className="px-4 py-3 font-semibold" style={{ color: '#1B4332' }}>{s.name}</td>
                            <td className="px-4 py-3 font-mono text-xs" style={{ color: '#1B4332' }}>{s.matricNo || '—'}</td>
                            <td className="px-4 py-3 text-xs" style={{ color: '#1B4332', opacity: 0.7 }}>{s.department || '—'}</td>
                            <td className="px-4 py-3">{s.level || '—'}</td>
                            <td className="px-4 py-3">{s.emailVerified ? <span style={{ color: '#065F46' }}>verified</span> : <span style={{ color: '#92400E' }}>no</span>}</td>
                            <td className="px-4 py-3 text-xs" style={{ color: '#1B4332', opacity: 0.6 }}>{formatDate(s.lastLogin)}</td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => setViewing(s)} className="px-3 py-1.5 rounded-lg text-xs font-bold border-0 cursor-pointer text-white" style={{ background: '#122400' }}>View</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="lg:hidden divide-y" style={{ borderColor: '#F3F4F6' }}>
                    {data.students.map(s => (
                      <div key={s.id} className="p-4 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold truncate" style={{ color: '#1B4332' }}>{s.name}</div>
                          <div className="font-mono text-xs mt-0.5" style={{ color: '#1B4332', opacity: 0.7 }}>{s.matricNo}</div>
                          <div className="text-xs mt-1" style={{ color: '#1B4332', opacity: 0.6 }}>{s.department || '—'} / {s.level || '—'} / {s.emailVerified ? 'verified' : 'not verified'}</div>
                        </div>
                        <button onClick={() => setViewing(s)} className="px-3 py-1.5 rounded-lg text-xs font-bold border-0 cursor-pointer text-white flex-shrink-0" style={{ background: '#122400' }}>View</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: '#F3F4F6' }}>
                    <div className="text-xs" style={{ color: '#1B4332', opacity: 0.6 }}>
                      {data.total} student{data.total === 1 ? '' : 's'}{data.totalPages > 1 && <> / page {data.page} of {data.totalPages}</>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={data.page <= 1} className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-white cursor-pointer disabled:opacity-30" style={{ borderColor: '#E5E7EB', color: '#1B4332' }}>Prev</button>
                      <button onClick={() => setPage(p => p + 1)} disabled={data.page >= data.totalPages} className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-white cursor-pointer disabled:opacity-30" style={{ borderColor: '#E5E7EB', color: '#1B4332' }}>Next</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(27,67,50,0.55)' }}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ boxShadow: '0 24px 64px rgba(27,67,50,0.2)' }}>
            <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: '#E5E7EB' }}>
              <div>
                <h2 className="text-xl font-black" style={{ color: '#1B4332' }}>📥 Bulk Import Students</h2>
                <p className="text-xs mt-1" style={{ color: '#8A9BB0' }}>Upload a CSV file to create multiple student accounts at once</p>
              </div>
              <button onClick={() => setShowImport(false)} className="text-2xl border-0 bg-transparent cursor-pointer" style={{ color: '#8A9BB0' }}>✕</button>
            </div>
            <div className="p-6">
              {!importResult ? (
                <>
                  <div className="mb-4 p-4 rounded-xl" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                    <div className="text-xs font-bold mb-2" style={{ color: '#065F46' }}>📋 CSV Format — Required columns:</div>
                    <code className="text-xs" style={{ color: '#065F46' }}>name, matric_no, department, level, email, phone, gender</code>
                    <div className="text-xs mt-2" style={{ color: '#065F46' }}>Department: Nursing Science or Midwifery · Level: ND1, ND2, HND1, HND2</div>
                    <button onClick={() => {
                      const csv = 'name,matric_no,department,level,email,phone,gender\nAdunola Bello,NSG/2025/001,Nursing Science,ND1,adunola@example.com,08012345678,Female\nBlessing Obi,MID/2025/001,Midwifery,ND1,blessing@example.com,08087654321,Female'
                      const blob = new Blob([csv], { type: 'text/csv' })
                      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'students_template.csv'; a.click()
                    }} className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold border-0 cursor-pointer text-white" style={{ background: '#065F46' }}>
                      Download Template
                    </button>
                  </div>
                  <label className="block mb-4 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer" style={{ borderColor: importFile ? '#065F46' : '#E5E7EB', background: importFile ? '#F0FDF4' : '#F9FAFB' }}>
                    <input type="file" accept=".csv" className="hidden" onChange={async e => {
                      const f = e.target.files?.[0]; if (!f) return
                      setImportFile(f); setImportLoading(true); setImportPreview(null)
                      const fd = new FormData(); fd.append('file', f)
                      try {
                        const res = await fetch(`${API}/api/admin/bulk-import/preview`, { method: 'POST', headers: authHeaders(), body: fd })
                        const json = await res.json()
                        setImportPreview(json)
                      } catch { setImportPreview({ error: 'Could not parse CSV' }) }
                      setImportLoading(false)
                    }} />
                    {importFile ? (
                      <div><div className="text-2xl mb-2">✅</div><div className="text-sm font-bold" style={{ color: '#065F46' }}>{importFile.name}</div><div className="text-xs mt-1" style={{ color: '#8A9BB0' }}>Click to change file</div></div>
                    ) : (
                      <div><div className="text-3xl mb-2">📂</div><div className="text-sm font-semibold" style={{ color: '#1B4332' }}>Click to select CSV file</div><div className="text-xs mt-1" style={{ color: '#8A9BB0' }}>Maximum 100 students per import</div></div>
                    )}
                  </label>
                  {importLoading && <div className="text-center py-4 text-sm" style={{ color: '#8A9BB0' }}>Parsing CSV...</div>}
                  {importPreview && !importPreview.error && (
                    <div className="mb-4">
                      <div className="flex gap-4 mb-3">
                        <div className="flex-1 p-3 rounded-xl text-center" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                          <div className="text-xl font-black" style={{ color: '#065F46' }}>{importPreview.valid}</div>
                          <div className="text-xs" style={{ color: '#065F46' }}>Valid</div>
                        </div>
                        <div className="flex-1 p-3 rounded-xl text-center" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                          <div className="text-xl font-black" style={{ color: '#991B1B' }}>{importPreview.invalid}</div>
                          <div className="text-xs" style={{ color: '#991B1B' }}>Invalid</div>
                        </div>
                        <div className="flex-1 p-3 rounded-xl text-center" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                          <div className="text-xl font-black" style={{ color: '#1B4332' }}>{importPreview.total}</div>
                          <div className="text-xs" style={{ color: '#1B4332' }}>Total</div>
                        </div>
                      </div>
                      <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#E5E7EB' }}>
                        <table className="w-full text-xs">
                          <thead style={{ background: '#F9FAFB' }}>
                            <tr>{['Name','Matric No','Dept','Level','OK'].map(h => <th key={h} className="px-3 py-2 text-left font-bold" style={{ color: '#1B4332' }}>{h}</th>)}</tr>
                          </thead>
                          <tbody>
                            {importPreview.preview.slice(0,10).map((r: any, i: number) => (
                              <tr key={i} style={{ background: r.valid ? '#fff' : '#FEF2F2', borderTop: '1px solid #F3F4F6' }}>
                                <td className="px-3 py-2">{r.name || '—'}</td>
                                <td className="px-3 py-2 font-mono">{r.matric_no || '—'}</td>
                                <td className="px-3 py-2">{r.department || '—'}</td>
                                <td className="px-3 py-2">{r.level || '—'}</td>
                                <td className="px-3 py-2">{r.valid ? '✅' : '❌'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {importPreview.preview.length > 10 && <div className="px-3 py-2 text-xs text-center" style={{ color: '#8A9BB0', background: '#F9FAFB' }}>...and {importPreview.preview.length - 10} more rows</div>}
                      </div>
                      <div className="mt-3 p-3 rounded-xl text-xs" style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
                        Default password for all imported students: <strong>Student123!</strong>
                      </div>
                    </div>
                  )}
                  {importPreview?.error && <div className="p-3 rounded-xl text-sm mb-4" style={{ background: '#FEF2F2', color: '#991B1B' }}>❌ {importPreview.error}</div>}
                  <div className="flex gap-3">
                    <button onClick={() => setShowImport(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold border cursor-pointer bg-white" style={{ borderColor: '#E5E7EB', color: '#1B4332' }}>Cancel</button>
                    <button disabled={!importPreview?.valid || importLoading}
                      onClick={async () => {
                        if (!importFile) return; setImportLoading(true)
                        const fd = new FormData(); fd.append('file', importFile)
                        try {
                          const res = await fetch(`${API}/api/admin/bulk-import/confirm`, { method: 'POST', headers: authHeaders(), body: fd })
                          const json = await res.json(); setImportResult(json)
                        } catch { setImportResult({ error: 'Import failed' }) }
                        setImportLoading(false)
                      }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white border-0 cursor-pointer disabled:opacity-50"
                      style={{ background: '#065F46' }}>
                      {importLoading ? 'Importing...' : `Import ${importPreview?.valid || 0} Students`}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  {importResult.error ? (
                    <div><div className="text-4xl mb-3">❌</div><div className="font-bold mb-2" style={{ color: '#991B1B' }}>Import Failed</div><div className="text-sm" style={{ color: '#8A9BB0' }}>{importResult.error}</div></div>
                  ) : (
                    <div>
                      <div className="text-4xl mb-3">🎉</div>
                      <div className="text-xl font-black mb-4" style={{ color: '#065F46' }}>Import Complete!</div>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="p-3 rounded-xl" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                          <div className="text-2xl font-black" style={{ color: '#065F46' }}>{importResult.created}</div>
                          <div className="text-xs" style={{ color: '#065F46' }}>Created</div>
                        </div>
                        <div className="p-3 rounded-xl" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                          <div className="text-2xl font-black" style={{ color: '#92400E' }}>{importResult.skipped}</div>
                          <div className="text-xs" style={{ color: '#92400E' }}>Skipped</div>
                        </div>
                        <div className="p-3 rounded-xl" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                          <div className="text-2xl font-black" style={{ color: '#1B4332' }}>{importResult.total}</div>
                          <div className="text-xs" style={{ color: '#1B4332' }}>Total</div>
                        </div>
                      </div>
                      {importResult.errors?.length > 0 && (
                        <div className="text-left p-3 rounded-xl mb-4 text-xs" style={{ background: '#FEF2F2', color: '#991B1B' }}>
                          {importResult.errors.map((e: string, i: number) => <div key={i}>• {e}</div>)}
                        </div>
                      )}
                    </div>
                  )}
                  <button onClick={() => { setShowImport(false); window.location.reload() }} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white border-0 cursor-pointer" style={{ background: '#1B4332' }}>Done</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {viewing && <StudentModal student={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
