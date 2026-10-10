import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { Skeleton, StatCardSkeleton } from '../components/Skeleton'

// ── Types ─────────────────────────────────────────────────────
interface MeData {
  name: string
  role: string
  matricNo?: string
  staffId?: string
  level?: string
  department?: string
  emailVerified?: boolean
  printCredit?: { balance: number; accountNo: string; bankName: string }
}

interface WifiStatus { active: boolean }

interface ResultCourse { id: string; courseCode: string; grade: string; creditUnit: number }
interface ResultSemester { gpa: string; academicYear: string; semester: string; courses: ResultCourse[] }

interface AdminStats {
  users: { total: number; students: number; lecturers: number; operators: number; admins: number; verified: number; unverified: number; biodataCompleted: number }
  print: { queued: number; printedToday: number; printedTotal: number; cancelledTotal: number }
}

// ── Helpers ───────────────────────────────────────────────────
const LEVEL_LABEL: Record<string, string> = {
  ND1: 'ND1', ND2: 'ND2', ND3: 'ND3', HND1: 'HND1', HND2: 'HND2',
  L100: '100', L200: '200', L300: '300', L400: '400', L500: '500',
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN']

function greetingText() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function roleBadge(role: string) {
  if (role === 'STUDENT') return '🎓 Student'
  if (role === 'LECTURER') return '👨‍🏫 Lecturer'
  if (role === 'PRINT_OPERATOR') return '🖨️ Print Operator'
  if (role === 'SUPER_ADMIN') return '⚙️ Super Admin'
  if (role === 'SCHOOL_ADMIN') return '⚙️ School Admin'
  return 'User'
}

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 transition-shadow hover:shadow-md"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <div className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: '#8A9BB0' }}>{label}</div>
      <div className="font-black leading-none" style={{ fontSize: 32, color }}>{value}</div>
    </div>
  )
}

// ── Quick link tile ───────────────────────────────────────────
function LinkTile({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className="bg-white rounded-2xl py-4 px-2 flex flex-col items-center gap-2 border-0 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-95"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <span className="text-2xl">{icon}</span>
      <span className="text-[11px] font-bold text-center" style={{ color: danger ? '#991B1B' : '#1B4332' }}>{label}</span>
    </button>
  )
}

// ── Greeting banner (shared, role-aware subtitle) ─────────────
function Banner({ user, subtitle, wifi, loading, showWifi }: {
  user: MeData | null; subtitle: string; wifi: boolean; loading: boolean; showWifi: boolean
}) {
  return (
    <div className="rounded-3xl mb-6 p-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #1B4332, #122400)' }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          {loading
            ? <>
                <Skeleton className="h-4 w-28 mb-2" style={{ background: 'rgba(255,255,255,0.2)' }} />
                <Skeleton className="h-7 w-48 mb-2" style={{ background: 'rgba(255,255,255,0.15)' }} />
                <Skeleton className="h-3 w-36" style={{ background: 'rgba(255,255,255,0.1)' }} />
              </>
            : <>
                <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.65)' }}>{greetingText()} 👋</p>
                <h1 className="font-black text-2xl text-white leading-tight mb-1">{user?.name}</h1>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{subtitle}</p>
              </>
          }
          {showWifi && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.12)' }}>
              <span className="text-sm">📶</span>
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Campus Wi-Fi · {wifi ? 'Active Session' : 'No Active Session'}
              </span>
              <div className="w-2 h-2 rounded-full" style={{ background: wifi ? '#4ade80' : '#fbbf24' }} />
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          <div className="px-3 py-1.5 rounded-full text-xs font-bold"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
            {roleBadge(user?.role ?? '')}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [meData, setMeData] = useState<MeData | null>(null)
  const [wifiActive, setWifiActive] = useState(false)
  const [semesters, setSemesters] = useState<ResultSemester[]>([])
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const role = (meData ?? user)?.role ?? 'STUDENT'
  const isStudent = role === 'STUDENT'
  const isLecturer = role === 'LECTURER'
  const isAdmin = ADMIN_ROLES.includes(role)
  const isOperator = role === 'PRINT_OPERATOR'

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        // Always fetch me + wifi
        const calls: Promise<unknown>[] = [
          api.get<MeData>('/api/auth/me'),
          api.get<WifiStatus>('/api/wifi/status'),
        ]
        const [meRes, wifiRes] = await Promise.allSettled(calls) as PromiseSettledResult<{ data: any }>[]
        if (cancelled) return
        let r = 'STUDENT'
        if (meRes.status === 'fulfilled') { setMeData(meRes.value.data); r = meRes.value.data.role }
        if (wifiRes.status === 'fulfilled') setWifiActive(wifiRes.value.data.active)

        // Role-specific second fetch
        if (r === 'STUDENT') {
          const res = await api.get<ResultSemester[]>('/api/results/my')
          if (!cancelled && Array.isArray(res.data)) setSemesters(res.data)
        } else if (ADMIN_ROLES.includes(r)) {
          const res = await api.get<AdminStats>('/api/admin/stats')
          if (!cancelled) setAdminStats(res.data)
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const displayUser = meData ?? (user as MeData | null)
  const balance = meData?.printCredit?.balance ?? 0

  // ── Compute REAL student stats from results (no more hardcoded 48) ──
  const allCourses = semesters.flatMap(s => s.courses)
  const totalCredits = allCourses.reduce((sum, c) => sum + (c.creditUnit ?? 0), 0)
  const totalCourses = allCourses.length
  const latestGpa = semesters.length > 0 ? semesters[0].gpa : null

  // ════════════════════════════════════════════════════════════
  // STUDENT VIEW
  // ════════════════════════════════════════════════════════════
  const studentStats = [
    { label: 'GPA', value: latestGpa ?? '—', color: '#27AE60' },
    { label: 'Level', value: LEVEL_LABEL[displayUser?.level ?? ''] ?? '—', color: '#122400' },
    { label: 'Credits', value: totalCredits > 0 ? String(totalCredits) : '—', color: '#E67E22' },
    { label: 'Courses', value: totalCourses > 0 ? String(totalCourses) : '—', color: '#1B4332' },
  ]

  const studentLinks = [
    { icon: '📚', label: 'E-Library', path: '/library' },
    { icon: '📊', label: 'Results', path: '/results' },
    { icon: '🪪', label: 'My ID', path: '/id' },
    { icon: '🖨️', label: 'Print', path: '/wallet' },
    { icon: '💳', label: 'Payment', path: '/payment' },
    { icon: '📢', label: 'Notices', path: '/announcements' },
    { icon: '🤖', label: 'AI Tutors', path: '/ai' },
    { icon: '🃏', label: 'Flashcards', path: '/flashcards' },
    { icon: '🎮', label: 'Clinical Sim', path: '/simulation' },
    { icon: '📝', label: 'Past Questions', path: '/past-questions' },
    { icon: '📸', label: 'Snap & Study', path: '/study-snap' },
  ]

  // ════════════════════════════════════════════════════════════
  // LECTURER VIEW
  // ════════════════════════════════════════════════════════════
  const lecturerLinks = [
    { icon: '📝', label: 'Enter Results', path: '/lecturer/results' },
    { icon: '📚', label: 'E-Library', path: '/library' },
    { icon: '📤', label: 'Upload Resource', path: '/library/upload' },
    { icon: '📢', label: 'Notices', path: '/announcements' },
    { icon: '🤖', label: 'AI Tutors', path: '/ai' },
    { icon: '🪪', label: 'My ID', path: '/id' },
  ]

  // ════════════════════════════════════════════════════════════
  // ADMIN VIEW
  // ════════════════════════════════════════════════════════════
  const adminStatCards = adminStats ? [
    { label: 'Students', value: String(adminStats.users.students), color: '#1B4332' },
    { label: 'Lecturers', value: String(adminStats.users.lecturers), color: '#122400' },
    { label: 'Print Queue', value: String(adminStats.print.queued), color: '#E67E22' },
    { label: 'Verified', value: String(adminStats.users.verified), color: '#27AE60' },
  ] : []

  const adminLinks = [
    { icon: '⚙️', label: 'Admin Panel', path: '/admin' },
    { icon: '👥', label: 'Students', path: '/admin/students' },
    { icon: '👨‍🏫', label: 'Lecturers', path: '/admin/lecturers' },
    { icon: '✅', label: 'Approve Results', path: '/admin/results' },
    { icon: '💳', label: 'Payments', path: '/admin/payments' },
    { icon: '📢', label: 'Notices', path: '/announcements' },
    { icon: '📚', label: 'E-Library', path: '/library' },
    { icon: '🩺', label: 'Site Health', path: '/site-health' },
  ]

  // Pick the active set
  const links = isAdmin ? adminLinks : isLecturer ? lecturerLinks : isOperator
    ? [{ icon: '📥', label: 'Print Queue', path: '/print-queue' }, { icon: '🪪', label: 'My ID', path: '/id' }]
    : studentLinks

  const subtitle = isAdmin
    ? `${displayUser?.staffId ?? ''} · Administrator`
    : isLecturer
      ? `${displayUser?.staffId ?? ''} · Lecturer · ${displayUser?.department ?? 'Nursing Science'}`
      : isOperator
        ? `${displayUser?.staffId ?? ''} · Print Operator`
        : `${displayUser?.matricNo ?? ''} · ${displayUser?.department ?? 'Nursing Science'}${displayUser?.level ? ` · ${LEVEL_LABEL[displayUser.level] ?? displayUser.level}` : ''}`

  // ── Verify-email banner ──
  const showVerifyBanner = isStudent && displayUser && displayUser.emailVerified === false
  const VerifyBanner = showVerifyBanner ? (
    <button onClick={() => navigate('/onboarding/email')}
      className="w-full text-left px-4 py-3 mb-3 lg:mb-4 rounded-xl border-0 cursor-pointer flex items-center justify-between gap-3"
      style={{ background: '#FEF3C7', color: '#92400E' }}>
      <div className="flex items-center gap-3">
        <span style={{ fontSize: 20 }}>✉️</span>
        <div>
          <div className="text-sm font-bold">Please verify your email</div>
          <div className="text-xs opacity-80">You'll need it to recover your account and receive notices.</div>
        </div>
      </div>
      <span className="text-sm font-bold">Verify →</span>
    </button>
  ) : null

  // ── Shared sections ──
  const StatsGrid = (cards: { label: string; value: string; color: string }[]) => (
    <div className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-4 gap-3 lg:gap-4 2xl:gap-5 mb-6">
      {loading ? [0,1,2,3].map(i => <StatCardSkeleton key={i} />) : cards.map(s => <StatCard key={s.label} {...s} />)}
    </div>
  )

  const QuickAccess = (
    <>
      <p className="text-[11px] lg:text-sm font-bold uppercase tracking-wider mb-3 lg:mb-4" style={{ color: '#1B4332' }}>Quick Access</p>
      <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 lg:gap-3 2xl:gap-4 mb-6">
        {links.map(l => <LinkTile key={l.label} icon={l.icon} label={l.label} onClick={() => navigate(l.path)} />)}
        <LinkTile icon="🚪" label="Sign Out" onClick={logout} danger />
      </div>
    </>
  )

  // Print wallet only for students
  const PrintWallet = isStudent ? (
    <div className="rounded-2xl p-5 flex justify-between items-center mb-5"
      style={{ background: 'linear-gradient(135deg,#1B4332,#122400)' }}>
      <div>
        <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.65)' }}>Print Wallet</p>
        <p className="font-black text-2xl text-white">₦{balance.toLocaleString()}</p>
        <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>≈ {balance} pages left</p>
      </div>
      <button onClick={() => navigate('/wallet')}
        className="px-4 py-2.5 rounded-xl text-white text-sm font-bold border-0 cursor-pointer"
        style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}>
        Top Up →
      </button>
    </div>
  ) : null

  // ── Mobile ──
  const Mobile = (
    <div className="h-full overflow-y-auto pb-20 px-4 pt-4" style={{ background: '#F5F7FA' }}>
      {VerifyBanner}
      <Banner user={displayUser} subtitle={subtitle} wifi={wifiActive} loading={loading} showWifi={isStudent} />
      {(isStudent || isAdmin) && StatsGrid(isAdmin ? adminStatCards : studentStats)}
      {QuickAccess}
      {PrintWallet}
      {error && <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm">Some data failed to load. Please refresh.</div>}
    </div>
  )

  // ── Desktop ──
  const Desktop = (
    <div className="p-6 xl:p-8 2xl:p-10 max-w-5xl xl:max-w-6xl 2xl:max-w-[1600px] mx-auto">
      {showVerifyBanner && <div className="mb-4">{VerifyBanner}</div>}
      <Banner user={displayUser} subtitle={subtitle} wifi={wifiActive} loading={loading} showWifi={isStudent} />
      {(isStudent || isAdmin) && StatsGrid(isAdmin ? adminStatCards : studentStats)}
      <div className={isStudent ? 'grid grid-cols-1 xl:grid-cols-3 gap-6' : ''}>
        <div className={isStudent ? 'xl:col-span-2' : ''}>
          {QuickAccess}
        </div>
        {isStudent && (
          <div>
            <p className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#1B4332' }}>Print Wallet</p>
            <div className="rounded-2xl p-5 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg,#1B4332,#122400)', boxShadow: '0 4px 20px rgba(27,67,50,0.3)' }}>
              <div className="relative z-10">
                <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Available Balance</p>
                <p className="font-black text-3xl text-white mb-1">₦{balance.toLocaleString()}</p>
                <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>≈ {balance} pages remaining</p>
                <button onClick={() => navigate('/wallet')}
                  className="w-full py-2.5 rounded-xl text-white text-sm font-bold border-0 cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}>
                  Manage Wallet →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {error && <div className="mt-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm">Some data failed to load. Please refresh.</div>}
    </div>
  )

  return (
    <>
      <div className="lg:hidden h-full">{Mobile}</div>
      <div className="hidden lg:block">{Desktop}</div>
    </>
  )
}
