import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { Skeleton } from '../components/Skeleton'
import {
  ClipboardEdit, BookOpen, Upload, Megaphone, Bot, IdCard, LogOut, Presentation, ArrowRight,
} from 'lucide-react'

interface MeData {
  name: string; role: string; staffId?: string; department?: string
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

export default function LecturerDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [meData, setMeData] = useState<MeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.get<MeData>('/api/auth/me')
      .then(res => { if (!cancelled) setMeData(res.data) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const displayUser = meData ?? (user as MeData | null)

  const links = [
    { Icon: BookOpen, label: 'E-Library', path: '/library' },
    { Icon: Upload, label: 'Upload Resource', path: '/library/upload' },
    { Icon: Megaphone, label: 'Notices', path: '/announcements' },
    { Icon: Bot, label: 'AI Tutors', path: '/ai' },
    { Icon: IdCard, label: 'My ID', path: '/id' },
  ]

  return (
    <div className="bg-bg" style={{ minHeight: '100%' }}>

      {/* Hero panel */}
      <div style={{ background: 'linear-gradient(180deg,#1B4332,#122400)' }} className="px-4 pt-7 pb-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
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
                  <div className="text-[12px] font-plexmono uppercase tracking-widest" style={{ color: '#BFE0C8' }}>Faculty portal</div>
                  <h1 className="font-display font-semibold text-white leading-tight mt-1" style={{ fontSize: 32 }}>
                    {greeting()}, {displayUser?.name ?? 'Lecturer'}
                  </h1>
                  <p className="text-sm" style={{ color: '#CFE0D2' }}>
                    {displayUser?.staffId ?? ''} · {displayUser?.department ?? 'Nursing Science'}
                  </p>
                </>
              )}
            </div>
            <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold" style={{ background: '#C99A44', color: '#3d2b0f' }}>
              <Presentation size={14} strokeWidth={2} /> Lecturer
            </div>
          </div>

          <div className="mb-4"><PulseLine width={72} /></div>

          {/* Primary CTA — the lecturer's core daily task */}
          <button onClick={() => navigate('/lecturer/results')}
            className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-4 px-5 py-4 rounded-2xl border-0 cursor-pointer transition-all"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(231,198,135,0.4)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#E7C687' }}>
                <ClipboardEdit size={19} strokeWidth={1.75} color="#3d2b0f" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-white">Enter Results</div>
                <div className="text-xs" style={{ color: '#BFE0C8' }}>Class sheet, single, or bulk entry</div>
              </div>
            </div>
            <ArrowRight size={18} color="#E7C687" strokeWidth={2} className="flex-shrink-0" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-6 pb-24 lg:px-8 lg:pb-8 max-w-5xl mx-auto">
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
