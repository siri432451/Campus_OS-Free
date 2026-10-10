import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Stethoscope, BookOpen, Bot, Layers } from 'lucide-react'

// ── Shared pulse-line signature ────────────────────────────────
function PulseLine({ width = 64 }: { width?: number }) {
  return (
    <svg viewBox="0 0 200 14" style={{ width, height: 10 }} aria-hidden="true">
      <polyline points="0,7 68,7 74,7 78,1 82,13 86,7 92,7 200,7" fill="none" stroke="#E7C687" strokeWidth="1.8" />
    </svg>
  )
}

function BrandMark() {
  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-2">
        <Stethoscope size={26} strokeWidth={1.75} color="#F5F7FA" />
        <span className="font-display font-semibold text-xl tracking-tight text-white">CampusOS</span>
      </div>
      <div className="ml-9 mt-1"><PulseLine width={40} /></div>
      <p className="ml-9 mt-1 text-[9px] font-plexmono font-semibold uppercase" style={{ color: 'rgba(245,247,250,0.6)', letterSpacing: '0.18em' }}>
        College of Nursing Sciences, Osogbo
      </p>
    </div>
  )
}

// ── Persistent abstract backdrop (no stock photography) ────────
function Backdrop() {
  return (
    <div className="absolute inset-0" style={{
      background: `
        radial-gradient(1200px 700px at 15% 8%, rgba(45,106,79,0.55), transparent 60%),
        radial-gradient(900px 600px at 85% 95%, rgba(201,154,68,0.18), transparent 55%),
        linear-gradient(160deg, #16301F 0%, #0E1F13 55%, #0A160D 100%)`,
    }}>
      {/* dotted texture */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '26px 26px',
      }} />
      {/* soft glow */}
      <div className="absolute rounded-full" style={{
        width: 340, height: 340, top: '28%', left: '36%',
        background: 'radial-gradient(circle, rgba(231,198,135,0.3), transparent 70%)', filter: 'blur(10px)',
      }} />
      {/* big sweeping pulse line */}
      <div className="absolute left-0 w-full" style={{ top: '40%', height: 200, opacity: 0.9 }}>
        <svg viewBox="0 0 1200 220" preserveAspectRatio="none" className="w-full h-full">
          <polyline points="0,110 380,110 410,110 435,30 460,190 485,60 510,110 540,110 1200,110"
            fill="none" stroke="#E7C687" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="0,130 380,130 410,130 435,80 460,175 485,90 510,130 540,130 1200,130"
            fill="none" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
        </svg>
      </div>
      {/* small floating accent marks */}
      <svg className="absolute" style={{ top: '16%', right: '18%', opacity: 0.5 }} width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#E7C687" strokeWidth="1.4">
        <path d="M12 5v14M5 12h14" />
      </svg>
      <svg className="absolute" style={{ bottom: '22%', right: '10%', opacity: 0.4 }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8FBBA0" strokeWidth="1.4">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </div>
  )
}

function Dots({ count, active, onSelect }: { count: number; active: number; onSelect: (i: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <button key={i} onClick={() => onSelect(i)}
          className="border-0 bg-transparent cursor-pointer p-0 transition-all duration-300"
          style={{ width: i === active ? 28 : 8, height: 8, borderRadius: 4, background: i === active ? '#E7C687' : 'rgba(245,247,250,0.35)' }} />
      ))}
    </div>
  )
}

function Slide1() {
  return (
    <div className="flex flex-col justify-between h-full px-8 py-10 lg:px-16 lg:py-14">
      <BrandMark />
      <div className="mt-auto">
        <h1 className="font-display font-semibold text-4xl lg:text-5xl text-white leading-tight tracking-tight mb-1">
          The future of nursing<br />education in Nigeria.
        </h1>
        <div className="mt-3 mb-4"><PulseLine width={72} /></div>
        <p className="text-base lg:text-lg font-medium" style={{ color: 'rgba(245,247,250,0.75)' }}>
          Your campus. <span className="italic font-display" style={{ color: 'rgba(245,247,250,0.9)' }}>Digitally.</span>
        </p>
        <p className="mt-3 text-[11px] font-plexmono uppercase tracking-widest font-semibold" style={{ color: 'rgba(245,247,250,0.45)', letterSpacing: '0.2em' }}>
          Built for the College of Nursing Sciences, Osogbo
        </p>
      </div>
    </div>
  )
}

function Slide2() {
  const features = [
    { Icon: BookOpen, title: 'E-Library', desc: 'Lecturer-uploaded resources' },
    { Icon: Bot, title: 'AI Tutors', desc: '13 nursing tutors, always available' },
    { Icon: Layers, title: 'Flashcards', desc: 'Study smarter with spaced repetition' },
  ]
  return (
    <div className="flex flex-col justify-between h-full px-8 py-10 lg:px-16 lg:py-14">
      <BrandMark />
      <div className="mt-auto">
        <h1 className="font-display font-semibold text-3xl lg:text-4xl text-white leading-tight tracking-tight">
          Everything you need.<br />
          <span style={{ color: 'rgba(245,247,250,0.75)' }}>One login away.</span>
        </h1>
        <div className="mt-3 mb-8"><PulseLine width={72} /></div>
        <div className="flex flex-col gap-0">
          {features.map((f, i) => (
            <div key={f.title}>
              <div className="flex items-start gap-4 py-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,247,250,0.1)' }}>
                  <f.Icon size={19} strokeWidth={1.75} color="#E7C687" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-white">{f.title}</p>
                  <p className="text-sm" style={{ color: 'rgba(245,247,250,0.6)' }}>{f.desc}</p>
                </div>
              </div>
              {i < features.length - 1 && <div className="h-px" style={{ background: '#C99A44', opacity: 0.25 }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Slide3({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="flex flex-col justify-between h-full px-8 py-10 lg:px-16 lg:py-14">
      <BrandMark />
      <div className="mt-auto">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-6 rounded-full" style={{ background: '#2D6A4F' }} />
          <span className="text-sm font-semibold" style={{ color: 'rgba(245,247,250,0.6)' }}>Get started today</span>
        </div>
        <h1 className="font-display font-semibold text-4xl lg:text-5xl text-white leading-tight tracking-tight">Ready to begin?</h1>
        <div className="mt-3 mb-4"><PulseLine width={72} /></div>
        <p className="text-base mb-8" style={{ color: 'rgba(245,247,250,0.7)' }}>Sign in with your matric number or staff ID</p>
        <button onClick={onGetStarted}
          className="w-full max-w-xs py-4 rounded-2xl font-semibold text-base text-white border-0 cursor-pointer transition-all duration-200"
          style={{ background: '#122400', boxShadow: '0 8px 24px rgba(27,67,50,0.35)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 2px #C99A44, 0 8px 32px rgba(27,67,50,0.5)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(27,67,50,0.35)' }}>
          Get Started →
        </button>
        <p className="mt-5 text-xs" style={{ color: 'rgba(245,247,250,0.4)' }}>
          Having trouble? <span className="underline cursor-pointer" style={{ color: 'rgba(245,247,250,0.55)' }}>Contact your ICT Admin</span>
        </p>
      </div>
    </div>
  )
}

const SLIDE_COUNT = 3

export default function Splash() {
  const [current, setCurrent] = useState(0)
  const [fading, setFading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const t = setInterval(() => { goTo((current + 1) % SLIDE_COUNT) }, 4000)
    return () => clearInterval(t)
  }, [current])

  const goTo = (idx: number) => {
    if (idx === current) return
    setFading(true)
    setTimeout(() => { setCurrent(idx); setFading(false) }, 250)
  }

  const handleGetStarted = () => navigate('/login')

  return (
    <div className="relative w-full min-h-screen overflow-hidden select-none">
      <Backdrop />
      <div className="absolute inset-0 flex flex-col transition-opacity duration-500" style={{ opacity: fading ? 0 : 1 }}>
        {current === 0 && <Slide1 />}
        {current === 1 && <Slide2 />}
        {current === 2 && <Slide3 onGetStarted={handleGetStarted} />}
      </div>
      <div className="absolute bottom-8 left-0 right-0 flex justify-center">
        <Dots count={SLIDE_COUNT} active={current} onSelect={goTo} />
      </div>
    </div>
  )
}
