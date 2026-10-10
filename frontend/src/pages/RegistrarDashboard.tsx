import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { StatCardSkeleton } from '../components/Skeleton'
import { Folder, Megaphone, IdCard, Users, LogOut, Landmark, FileBarChart } from 'lucide-react'

interface DeptBlock { department: string; total: number; levels: { level: string; count: number }[] }
interface RegistrarStats {
  students: { total: number; active: number; departments: DeptBlock[] }
  staff: {
    total: number; active: number; lecturers: number; admins: number
    operators: number; registrars: number; hods: number
    lecturersByDepartment: { department: string; count: number }[]
  }
  engagement: { recentlyActive7d: number }
}
interface StaffRow {
  id: string; name: string; role: string; staffId?: string | null; email?: string | null
  department?: string | null; phone?: string | null; isHod: boolean; isActive: boolean
  photoUrl?: string | null; lastLogin?: string | null
}

const ROLE_LABEL: Record<string, string> = { LECTURER: 'Lecturer', REGISTRAR: 'Registrar' }

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function PulseDivider() {
  return (
    <svg viewBox="0 0 800 24" preserveAspectRatio="none" style={{ width: '100%', height: 20, display: 'block' }} aria-hidden="true">
      <polyline points="0,12 260,12 280,12 296,2 312,22 328,12 344,12 800,12" fill="none" stroke="#E7C687" strokeWidth="2.4" />
    </svg>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-mossline">
      <div className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-text2">{label}</div>
      <div className="font-display font-semibold leading-none text-field" style={{ fontSize: 30 }}>{value}</div>
    </div>
  )
}

function LinkTile({ Icon, label, onClick, danger }: { Icon: any; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className="bg-white rounded-2xl py-4 px-2 flex flex-col items-center gap-2.5 border border-mossline cursor-pointer transition-all hover:border-field hover:-translate-y-0.5 active:scale-95">
      <div className="w-10 h-10 rounded-xl bg-moss flex items-center justify-center">
        <Icon size={20} strokeWidth={1.75} className={danger ? 'text-red-700' : 'text-field'} />
      </div>
      <span className={`text-[11px] font-semibold text-center ${danger ? 'text-red-700' : 'text-ink'}`}>{label}</span>
    </button>
  )
}

function StaffDirectory({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<StaffRow[]>([])
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (q.trim()) p.set('q', q.trim())
      if (role) p.set('role', role)
      const res = await api.get<{ staff: StaffRow[] }>(`/api/registrar/staff?${p.toString()}`)
      setRows(res.data.staff || [])
    } catch { setRows([]) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(18,36,0,0.45)' }} onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg text-ink">Staff directory</h2>
          <button onClick={onClose} className="text-xl border-0 bg-transparent cursor-pointer text-text2">✕</button>
        </div>
        <div className="flex gap-2 mb-4">
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') load() }}
            placeholder="Name or staff ID" className="flex-1 px-3 py-2 rounded-xl text-sm border border-mossline outline-none text-ink" />
          <select value={role} onChange={e => setRole(e.target.value)} className="px-3 py-2 rounded-xl text-sm border border-mossline outline-none bg-white text-ink">
            <option value="">All staff</option>
            <option value="LECTURER">Lecturers</option>
            <option value="REGISTRAR">Registrars</option>
          </select>
          <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer bg-field">Go</button>
        </div>
        {loading && <div className="text-center py-8 text-sm text-text2">Loading…</div>}
        {!loading && (
          <>
            <p className="text-xs font-semibold mb-2 text-text2">{rows.length} staff</p>
            <div className="space-y-2">
              {rows.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-moss">
                  <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-sm overflow-hidden bg-field">
                    {s.photoUrl ? <img src={s.photoUrl} alt="" className="w-full h-full object-cover" /> : (s.name?.charAt(0) ?? '?')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate text-ink">
                      {s.name}{s.isHod && <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-goldbg" style={{ color: '#8a6218' }}>HOD</span>}
                    </div>
                    <div className="text-[11px] truncate text-text2 font-plexmono">
                      {ROLE_LABEL[s.role] ?? s.role}{s.staffId ? ` · ${s.staffId}` : ''}{s.department ? ` · ${s.department}` : ''}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${s.isActive ? 'bg-greenokbg text-greenok' : 'bg-red-100 text-red-800'}`}>
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
              {rows.length === 0 && <div className="text-center py-8 text-sm text-text2">No staff match.</div>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function RegistrarDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<RegistrarStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showStaff, setShowStaff] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.get<RegistrarStats>('/api/registrar/stats')
      .then(res => { if (!cancelled) setStats(res.data) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const goClass = (department: string, level: string) => {
    const p = new URLSearchParams()
    if (department && department !== 'Unspecified') p.set('department', department)
    if (level) p.set('level', level)
    navigate(`/registrar/students?${p.toString()}`)
  }

  const staffCards = stats ? [
    { label: 'Lecturers', value: String(stats.staff.lecturers) },
    { label: 'Admins', value: String(stats.staff.admins) },
    { label: 'Operators', value: String(stats.staff.operators) },
    { label: 'HODs', value: String(stats.staff.hods) },
  ] : []

  return (
    <div className="bg-bg" style={{ minHeight: '100%' }}>

      {/* Hero panel — solid, high-contrast anchor */}
      <div style={{ background: 'linear-gradient(180deg,#1B4332,#122400)' }} className="px-4 pt-7 pb-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <div className="text-[12px] font-plexmono uppercase tracking-widest" style={{ color: '#BFE0C8' }}>Registrar's office</div>
              <h1 className="font-display font-semibold text-white leading-tight mt-1" style={{ fontSize: 34 }}>
                {greeting()}, {user?.name?.split(' ')[0] ?? 'Registrar'}
              </h1>
              <p className="text-sm" style={{ color: '#CFE0D2' }}>
                {(user as unknown as { staffId?: string })?.staffId ?? ''} · Osun State College of Nursing Sciences
              </p>
            </div>
            <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold" style={{ background: '#C99A44', color: '#3d2b0f' }}>
              <Landmark size={14} strokeWidth={2} /> Registrar
            </div>
          </div>

          <PulseDivider />

          {loading ? (
            <div className="h-16 w-40 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.12)' }} />
          ) : (
            <>
              <div className="text-[13px] font-medium mb-1" style={{ color: '#BFE0C8' }}>Total enrolled students</div>
              <div className="font-display font-semibold text-white leading-none" style={{ fontSize: 60 }}>
                {stats?.students.total ?? 0}
              </div>
              <div className="flex gap-6 flex-wrap mt-3 text-sm font-medium" style={{ color: '#CFE0D2' }}>
                <span><b className="font-plexmono text-white" style={{ fontWeight: 600 }}>{stats?.students.active ?? 0}</b> active</span>
                <span><b className="font-plexmono text-white" style={{ fontWeight: 600 }}>{stats?.staff.lecturers ?? 0}</b> lecturers</span>
                <span><b className="font-plexmono text-white" style={{ fontWeight: 600 }}>{stats?.engagement.recentlyActive7d ?? 0}</b> active this week</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="px-4 pt-6 pb-24 lg:px-8 lg:pb-8 max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] font-bold uppercase tracking-wide text-field">Population by programme</p>
          <span className="text-[11px] text-text2">Tap a class to view it</span>
        </div>

        {loading && (
          <div className="grid grid-cols-5 gap-2.5 mb-6">
            {[0, 1, 2, 3, 4].map(i => <div key={i} className="bg-white rounded-2xl p-3 h-16 animate-pulse border border-mossline" />)}
          </div>
        )}

        {!loading && stats && stats.students.departments.length === 0 && (
          <div className="bg-white rounded-2xl p-5 mb-6 text-sm border border-mossline text-text2">No students are registered yet.</div>
        )}

        {!loading && stats && stats.students.departments.map(dept => (
          <div key={dept.department} className="mb-4 bg-white rounded-2xl border border-mossline p-4" style={{ borderLeftWidth: 5, borderLeftColor: '#1B4332' }}>
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => goClass(dept.department, '')} className="font-bold text-[15px] border-0 bg-transparent cursor-pointer p-0 text-ink">{dept.department}</button>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-moss text-field font-plexmono">{dept.total} total</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {dept.levels.map(lv => (
                <button key={lv.level} onClick={() => goClass(dept.department, lv.level)}
                  className="bg-moss rounded-xl p-3 text-center border border-mossline cursor-pointer transition-all hover:border-field hover:-translate-y-0.5 active:scale-95">
                  <div className="text-[10px] font-plexmono font-semibold uppercase tracking-wide mb-1 text-text2">{lv.level}</div>
                  <div className="font-display font-semibold text-field" style={{ fontSize: 24 }}>{lv.count}</div>
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between mb-3 mt-6">
          <p className="text-[13px] font-bold uppercase tracking-wide text-field">Staff</p>
          <button onClick={() => setShowStaff(true)} className="text-xs font-bold border-0 bg-transparent cursor-pointer text-field">View directory →</button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">{[0, 1, 2, 3].map(i => <StatCardSkeleton key={i} />)}</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {staffCards.map(c => <StatCard key={c.label} {...c} />)}
          </div>
        )}

        {!loading && stats && stats.staff.lecturersByDepartment.length > 0 && (
          <div className="bg-white rounded-2xl p-4 mb-6 border border-mossline">
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-2 text-text2">Lecturers by department</div>
            <div className="flex flex-wrap gap-2">
              {stats.staff.lecturersByDepartment.map(d => (
                <span key={d.department} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-moss text-field">
                  {d.department}: <b className="font-plexmono">{d.count}</b>
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="text-[13px] font-bold uppercase tracking-wide mb-3 mt-2 text-field">Quick access</p>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5">
          <LinkTile Icon={Folder} label="Student records" onClick={() => navigate('/registrar/students')} />
          <LinkTile Icon={Megaphone} label="Post notice" onClick={() => navigate('/announcements')} />
          <LinkTile Icon={IdCard} label="My ID" onClick={() => navigate('/id')} />
          <LinkTile Icon={LogOut} label="Sign out" onClick={logout} danger />
        </div>

        <div className="rounded-2xl mt-8 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          style={{ background: 'linear-gradient(135deg,#1B4332,#122400)', border: '1.5px solid #C99A44' }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileBarChart size={18} color="#E7C687" strokeWidth={1.75} />
              <h3 className="font-display font-semibold text-white" style={{ fontSize: 18 }}>Accreditation season</h3>
            </div>
            <p className="text-sm" style={{ color: '#CFE0D2' }}>Generate a full statistics report for the NMCN panel.</p>
          </div>
        </div>

        {error && <div className="mt-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm">Some data failed to load. Please refresh.</div>}
      </div>

      {showStaff && <StaffDirectory onClose={() => setShowStaff(false)} />}
    </div>
  )
}
