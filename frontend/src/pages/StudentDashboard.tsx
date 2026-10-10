import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { Skeleton, StatCardSkeleton } from '../components/Skeleton'
import {
  GraduationCap, BookOpen, BarChart3, IdCard, Printer, CreditCard, Megaphone,
  Bot, Layers, Gamepad2, FileQuestion, Camera, LogOut, Wifi, Mail,
} from 'lucide-react'

interface MeData {
  name: string; role: string; matricNo?: string; level?: string; department?: string
  emailVerified?: boolean; printCredit?: { balance: number; accountNo: string; bankName: string }
}
interface WifiStatus { active: boolean }
interface ResultCourse { id: string; courseCode: string; grade: string; creditUnit: number }
interface ResultSemester { gpa: string; academicYear: string; semester: string; courses: ResultCourse[] }

const LEVEL_LABEL: Record<string, string> = { ND1: 'ND1', ND2: 'ND2', ND3: 'ND3', HND1: 'HND1', HND2: 'HND2' }

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function PulseLine({ width = 64, light = true }: { width?: number; light?: boolean }) {
  return (
    <svg viewBox="0 0 200 14" style={{ width, height: 10 }} aria-hidden="true">
      <polyline points="0,7 68,7 74,7 78,1 82,13 86,7 92,7 200,7" fill="none"
        stroke={light ? '#E7C687' : '#C99A44'} strokeWidth="1.8" />
    </svg>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-plexmono font-semibold uppercase tracking-wide mb-1" style={{ color: '#8A9BB0' }}>{label}</div>
      <div className="font-display font-semibold text-ink" style={{ fontSize: 22 }}>{value}</div>
    </div>
  )
}

function LinkTile({ Icon, label, onClick, danger }: { Icon: any; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className="bg-white rounded-2xl py-4 px-2 flex flex-col items-center gap-2.5 border border-mossline cursor-pointer transition-all hover:border-field hover:-translate-y-0.5 active:scale-95">
      <div className="w-10 h-10 rounded-xl bg-moss flex items-center justify-center">
        <Icon size={19} strokeWidth={1.75} className={danger ? 'text-red-700' : 'text-field'} />
      </div>
      <span className={`text-[11px] font-semibold text-center ${danger ? 'text-red-700' : 'text-ink'}`}>{label}</span>
    </button>
  )
}

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [meData, setMeData] = useState<MeData | null>(null)
  const [wifiActive, setWifiActive] = useState(false)
  const [semesters, setSemesters] = useState<ResultSemester[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const [meRes, wifiRes] = await Promise.allSettled([
          api.get<MeData>('/api/auth/me'),
          api.get<WifiStatus>('/api/wifi/status'),
        ]) as PromiseSettledResult<{ data: any }>[]
        if (cancelled) return
        if (meRes.status === 'fulfilled') setMeData(meRes.value.data)
        if (wifiRes.status === 'fulfilled') setWifiActive(wifiRes.value.data.active)

        const res = await api.get<ResultSemester[]>('/api/results/my')
        if (!cancelled && Array.isArray(res.data)) setSemesters(res.data)
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
  const allCourses = semesters.flatMap(s => s.courses)
  const totalCredits = allCourses.reduce((sum, c) => sum + (c.creditUnit ?? 0), 0)
  const totalCourses = allCourses.length
  const latestGpa = semesters.length > 0 ? semesters[0].gpa : null

  const showVerifyBanner = displayUser && displayUser.emailVerified === false

  const links = [
    { Icon: BookOpen, label: 'E-Library', path: '/library' },
    { Icon: BarChart3, label: 'Results', path: '/results' },
    { Icon: IdCard, label: 'My ID', path: '/id' },
    { Icon: Printer, label: 'Print', path: '/wallet' },
    { Icon: CreditCard, label: 'Payment', path: '/payment' },
    { Icon: Megaphone, label: 'Notices', path: '/announcements' },
    { Icon: Bot, label: 'AI Tutors', path: '/ai' },
    { Icon: Layers, label: 'Flashcards', path: '/flashcards' },
    { Icon: Gamepad2, label: 'Clinical Sim', path: '/simulation' },
    { Icon: FileQuestion, label: 'Past Questions', path: '/past-questions' },
    { Icon: Camera, label: 'Snap & Study', path: '/study-snap' },
  ]

  return (
    <div className="bg-bg" style={{ minHeight: '100%' }}>

      {/* Hero panel */}
      <div style={{ background: 'linear-gradient(180deg,#1B4332,#122400)' }} className="px-4 pt-7 pb-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {showVerifyBanner && (
            <button onClick={() => navigate('/onboarding/email')}
              className="w-full text-left px-4 py-3 mb-4 rounded-xl border-0 cursor-pointer flex items-center gap-3"
              style={{ background: 'rgba(231,198,135,0.15)', border: '1px solid rgba(231,198,135,0.35)' }}>
              <Mail size={18} color="#E7C687" strokeWidth={1.75} className="flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">Please verify your email</div>
                <div className="text-xs" style={{ color: 'rgba(245,247,250,0.65)' }}>You'll need it to recover your account and receive notices.</div>
              </div>
              <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#E7C687' }}>Verify →</span>
            </button>
          )}

          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              {loading ? (
                <>
                  <Skeleton className="h-4 w-28 mb-2" style={{ background: 'rgba(255,255,255,0.2)' }} />
                  <Skeleton className="h-7 w-48 mb-2" style={{ background: 'rgba(255,255,255,0.15)' }} />
                  <Skeleton className="h-3 w-36" style={{ background: 'rgba(255,255,255,0.1)' }} />
                </>
              ) : (
                <>
                  <div className="text-[12px] font-plexmono uppercase tracking-widest" style={{ color: '#BFE0C8' }}>Student portal</div>
                  <h1 className="font-display font-semibold text-white leading-tight mt-1" style={{ fontSize: 32 }}>
                    {greeting()}, {displayUser?.name ?? 'Student'}
                  </h1>
                  <p className="text-sm" style={{ color: '#CFE0D2' }}>
                    {displayUser?.matricNo ?? ''} · {displayUser?.department ?? 'Nursing Science'}
                    {displayUser?.level ? ` · ${LEVEL_LABEL[displayUser.level] ?? displayUser.level}` : ''}
                  </p>
                </>
              )}
            </div>
            <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold" style={{ background: '#C99A44', color: '#3d2b0f' }}>
              <GraduationCap size={14} strokeWidth={2} /> Student
            </div>
          </div>

          <div className="mb-2.5"><PulseLine width={72} /></div>

          {loading ? (
            <div className="h-11 w-32 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.12)' }} />
          ) : latestGpa ? (
            <>
              <div className="text-[13px] font-medium mb-0.5" style={{ color: '#BFE0C8' }}>Latest GPA</div>
              <div className="font-display font-semibold text-white leading-none" style={{ fontSize: 48 }}>{latestGpa}</div>
              <div className="flex gap-6 flex-wrap mt-2.5 text-sm font-medium" style={{ color: '#CFE0D2' }}>
                <span><b className="font-plexmono text-white" style={{ fontWeight: 600 }}>{LEVEL_LABEL[displayUser?.level ?? ''] ?? '—'}</b> level</span>
                <span><b className="font-plexmono text-white" style={{ fontWeight: 600 }}>{totalCredits > 0 ? totalCredits : '—'}</b> credits</span>
                <span><b className="font-plexmono text-white" style={{ fontWeight: 600 }}>{totalCourses > 0 ? totalCourses : '—'}</b> courses</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2.5 py-1">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <GraduationCap size={17} strokeWidth={1.75} color="#E7C687" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white leading-tight">No results published yet</div>
                <div className="text-xs" style={{ color: '#BFE0C8' }}>
                  {LEVEL_LABEL[displayUser?.level ?? ''] ?? 'Your'} level · check back after your first results are released
                </div>
              </div>
            </div>
          )}

          <button onClick={() => navigate('/wifi')}
            className="mt-3.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-0 cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.1)' }}>
            <Wifi size={14} color={wifiActive ? '#8FBBA0' : '#E7C687'} strokeWidth={1.75} />
            <span className="text-xs font-medium" style={{ color: 'rgba(245,247,250,0.8)' }}>
              Campus Wi-Fi · {wifiActive ? 'Active Session' : 'No Active Session'}
            </span>
          </button>
        </div>
      </div>

      <div className="px-4 pt-6 pb-24 lg:px-8 lg:pb-8 max-w-5xl mx-auto">

        {/* Print wallet */}
        <div className="rounded-2xl p-5 flex justify-between items-center mb-6 border"
          style={{ background: 'linear-gradient(135deg,#1B4332,#122400)', borderColor: '#C99A44' }}>
          <div>
            <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.65)' }}>Print Wallet</p>
            <p className="font-display font-semibold text-white" style={{ fontSize: 26 }}>₦{balance.toLocaleString()}</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>≈ {balance} pages left</p>
          </div>
          <button onClick={() => navigate('/wallet')}
            className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold border-0 cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}>
            Top Up →
          </button>
        </div>

        {/* Supporting stats */}
        <div className="bg-white rounded-2xl p-4 mb-6 border border-mossline grid grid-cols-3 gap-4">
          {loading ? [0, 1, 2].map(i => <StatCardSkeleton key={i} />) : (
            <>
              <MiniStat label="Level" value={LEVEL_LABEL[displayUser?.level ?? ''] ?? '—'} />
              <MiniStat label="Credits" value={totalCredits > 0 ? String(totalCredits) : '—'} />
              <MiniStat label="Courses" value={totalCourses > 0 ? String(totalCourses) : '—'} />
            </>
          )}
        </div>

        <p className="text-[13px] font-bold uppercase tracking-wide mb-3 text-field">Quick access</p>
        <div className="grid grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
          {links.map(l => <LinkTile key={l.label} Icon={l.Icon} label={l.label} onClick={() => navigate(l.path)} />)}
          <LinkTile Icon={LogOut} label="Sign Out" onClick={logout} danger />
        </div>

        {error && <div className="mt-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm">Some data failed to load. Please refresh.</div>}
      </div>
    </div>
  )
}
