import { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ── Bottom Navigation ─────────────────────────────────────────
export function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const tabs = [
    { path: '/dashboard', icon: '⊞', label: 'Home' },
    { path: '/flashcards', icon: '🃏', label: 'Learn' },
    { path: '/simulation', icon: '🎮', label: 'Sim' },
    { path: '/ai', icon: '🤖', label: 'AI' },
    { path: '/wallet', icon: '🖨️', label: 'Print' },
  ]

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex pb-3 pt-2 z-50"
      style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.08)' }}>
      {tabs.map(t => {
        const active = location.pathname === t.path
        return (
          <button key={t.path} onClick={() => navigate(t.path)}
            className="flex-1 flex flex-col items-center gap-1 border-none bg-transparent cursor-pointer">
            <span className="text-xl">{t.icon}</span>
            <span className="text-[10px] font-semibold"
              style={{ color: active ? '#122400' : '#8A9BB0' }}>
              {t.label}
            </span>
            {active && <div className="w-1 h-1 rounded-full bg-purple" />}
          </button>
        )
      })}
    </div>
  )
}

// ── Phone Shell ───────────────────────────────────────────────
export default function PhoneShell({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  const noNavRoutes = ['/', '/login']
  const showNav = user && !noNavRoutes.includes(location.pathname)

  return (
    <div className="min-h-screen flex items-center justify-center p-5"
      style={{ background: '#0D1117', backgroundImage: 'radial-gradient(ellipse at 50% 30%, #1a1040 0%, #0D1117 70%)' }}>
      
      {/* Quick nav for desktop demo */}
      {user && (
        <div className="fixed left-5 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-[1000]">
          {[
            ['dashboard','🏠'],['library','📚'],['results','📊'],
            ['id','🪪'],['wallet','🖨️'],['announcements','📢'],
            ['ai','🤖'],['flashcards','🃏'],['simulation','🎮']
          ].map(([path, icon]) => (
            <a key={path} href={`/${path}`}
              className="px-2 py-1 rounded-lg text-xs font-semibold text-white transition-all"
              style={{
                background: location.pathname === `/${path}` ? '#122400' : 'rgba(255,255,255,0.1)',
                fontSize: 11
              }}>
              {icon} {path}
            </a>
          ))}
        </div>
      )}

      {/* Phone frame */}
      <div className="phone-shadow overflow-hidden relative bg-white"
        style={{ width: 390, height: 844, borderRadius: 44 }}>
        <div className="absolute inset-0 overflow-hidden">
          {children}
        </div>
        {showNav && <BottomNav />}
      </div>
    </div>
  )
}
