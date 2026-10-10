import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { StatCardSkeleton } from '../components/Skeleton'
import {
  Settings, Users, UserCog, CheckCircle2, CreditCard, Megaphone,
  BookOpen, HeartPulse, LogOut, ShieldCheck,
} from 'lucide-react'

interface AdminStats {
  users: {
    total: number; students: number; lecturers: number; operators: number; admins: number
    verified: number; unverified: number; biodataCompleted: number; nursingCount: number; midwiferyCount: number
  }
  print: { queued: number; printedToday: number; printedTotal: number; cancelledTotal: number }
  revenue?: { topupsToday: number; totalTodayKobo: number; topupsTotal: number; totalTotalKobo: number }
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function PulseLine({ width = 64 }: { width?: number }) {
  return (
    <svg viewBox="0 0 200 14" style={{ width, height: 10 }} aria-hidden="true">
      <polyline points="0,7 68,7 74,7 78,1 82,13 86,7 92,7 200,7" fill="none" stroke="#E7C687" strokeWidth="1.8" />
    </svg>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-mossline">
      <div className="text-[11px] font-plexmono font-semibold uppercase tracking-wide mb-1" style={{ color: '#8A9BB0' }}>{label}</div>
      <div className="font-display font-semibold text-field" style={{ fontSize: 26 }}>{value}</div>
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

function formatNaira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const isSuper = user?.role === 'SUPER_ADMIN'

  useEffect(() => {
    let cancelled = false
    api.get<AdminStats>('/api/admin/stats')
      .then(res => { if (!cancelled) setStats(res.data) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const supportCards = stats ? [
    { label: 'Lecturers', value: String(stats.users.lecturers) },
    { label: 'Verified', value: String(stats.users.verified) },
    { label: 'Print Queue', value: String(stats.print.queued) },
  ] : []

  const links = [
    { Icon: Settings, label: 'Admin Panel', path: '/admin' },
    { Icon: Users, label: 'Students', path: '/admin/students' },
    { Icon: UserCog, label: 'Lecturers', path: '/admin/lecturers' },
    { Icon: CheckCircle2, label: 'Approve Results', path: '/admin/results' },
    { Icon: CreditCard, label: 'Payments', path: '/admin/payments' },
    { Icon: Megaphone, label: 'Notices', path: '/announcements' },
    { Icon: BookOpen, label: 'E-Library', path: '/library' },
    { Icon: HeartPulse, label: 'Site Health', path: '/admin/health' },
  ]

  return (
    <div className="bg-bg" style={{ minHeight: '100%' }}>

      {/* Hero panel */}
      <div style={{ background: 'linear-gradient(180deg,#1B4332,#122400)' }} className="px-4 pt-7 pb-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <div className="text-[12px] font-plexmono uppercase tracking-widest" style={{ color: '#BFE0C8' }}>Administration</div>
              <h1 className="font-display font-semibold text-white leading-tight mt-1" style={{ fontSize: 32 }}>
                {greeting()}, {user?.name ?? 'Admin'}
              </h1>
              <p className="text-sm" style={{ color: '#CFE0D2' }}>
                {(user as unknown as { staffId?: string })?.staffId ?? ''} · {isSuper ? 'Super Admin' : 'School Admin'} · Osun State College of Nursing Sciences
              </p>
            </div>
            <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold" style={{ background: '#C99A44', color: '#3d2b0f' }}>
              <ShieldCheck size={14} strokeWidth={2} /> {isSuper ? 'Super Admin' : 'Admin'}
            </div>
          </div>

          <div className="mb-3"><PulseLine width={72} /></div>

          {loading ? (
            <div className="h-14 w-32 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.12)' }} />
          ) : (
            <>
              <div className="text-[13px] font-medium mb-1" style={{ color: '#BFE0C8' }}>Total students</div>
              <div className="font-display font-semibold text-white leading-none" style={{ fontSize: 54 }}>{stats?.users.students ?? 0}</div>
              <div className="flex gap-6 flex-wrap mt-3 text-sm font-medium" style={{ color: '#CFE0D2' }}>
                <span><b className="font-plexmono text-white" style={{ fontWeight: 600 }}>{stats?.users.total ?? 0}</b> total users</span>
                <span><b className="font-plexmono text-white" style={{ fontWeight: 600 }}>{stats?.users.nursingCount ?? 0}</b> nursing</span>
                <span><b className="font-plexmono text-white" style={{ fontWeight: 600 }}>{stats?.users.midwiferyCount ?? 0}</b> midwifery</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="px-4 pt-6 pb-24 lg:px-8 lg:pb-8 max-w-5xl mx-auto">

        {isSuper && stats?.revenue && (
          <div className="rounded-2xl p-5 mb-6 border" style={{ background: 'linear-gradient(135deg,#1B4332,#122400)', borderColor: '#C99A44' }}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.65)' }}>Print Credit Revenue Today</p>
                <p className="font-display font-semibold text-white" style={{ fontSize: 30 }}>{formatNaira(stats.revenue.totalTodayKobo)}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{stats.revenue.topupsToday} top-ups today</p>
              </div>
              <div className="text-right">
                <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.65)' }}>All-time</p>
                <p className="font-display font-semibold text-white" style={{ fontSize: 22 }}>{formatNaira(stats.revenue.totalTotalKobo)}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{stats.revenue.topupsTotal} total top-ups</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-6">
          {loading ? [0, 1, 2].map(i => <StatCardSkeleton key={i} />) : supportCards.map(c => <StatCard key={c.label} {...c} />)}
        </div>

        <p className="text-[13px] font-bold uppercase tracking-wide mb-3 text-field">Quick access</p>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5">
          {links.map(l => <LinkTile key={l.label} Icon={l.Icon} label={l.label} onClick={() => navigate(l.path)} />)}
          <LinkTile Icon={LogOut} label="Sign Out" onClick={logout} danger />
        </div>

        {error && <div className="mt-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm">Some data failed to load. Please refresh.</div>}
      </div>
    </div>
  )
}
