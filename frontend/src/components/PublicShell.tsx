import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Stethoscope } from 'lucide-react'

/** Simple page frame for pages that need no login (transcript request, tracking, verification). */
export default function PublicShell({ title, subtitle, children }: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-bg">
      <div style={{ background: 'linear-gradient(180deg,#1B4332,#122400)' }} className="px-4 pt-6 pb-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            <Link to="/login" className="flex items-center gap-2 no-underline" style={{ color: '#fff' }}>
              <Stethoscope size={20} strokeWidth={1.8} />
              <span className="font-display font-semibold text-lg">CampusOS</span>
            </Link>
            <div className="flex gap-4 text-sm font-semibold">
              <Link to="/request-transcript" className="no-underline" style={{ color: '#CFE0D2' }}>Request</Link>
              <Link to="/track-transcript" className="no-underline" style={{ color: '#CFE0D2' }}>Track</Link>
            </div>
          </div>
          <h1 className="font-display font-semibold text-white mt-6 leading-tight" style={{ fontSize: 28 }}>{title}</h1>
          {subtitle && <p className="text-sm mt-1" style={{ color: '#CFE0D2' }}>{subtitle}</p>}
        </div>
      </div>
      <div className="px-4 -mt-5 pb-16">
        <div className="max-w-2xl mx-auto">{children}</div>
      </div>
    </div>
  )
}
