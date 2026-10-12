import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Stethoscope, GraduationCap, Lock, Eye, EyeOff } from 'lucide-react'

const IMG_2 = 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=1600&q=80'
const OVERLAY = 'linear-gradient(160deg, rgba(27,67,50,0.95) 0%, rgba(27,67,50,0.82) 100%)'

function PulseLine({ light = true, width = 64 }: { light?: boolean; width?: number }) {
  return (
    <svg viewBox="0 0 200 14" style={{ width, height: 10 }} aria-hidden="true">
      <polyline points="0,7 68,7 74,7 78,1 82,13 86,7 92,7 200,7" fill="none"
        stroke={light ? '#E7C687' : '#C99A44'} strokeWidth="1.8" />
    </svg>
  )
}

function BrandMark({ light = true }: { light?: boolean }) {
  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-2">
        <Stethoscope size={26} strokeWidth={1.75} color={light ? '#F5F7FA' : '#1B4332'} />
        <span className="font-display font-semibold text-xl tracking-tight" style={{ color: light ? '#F5F7FA' : '#1B4332' }}>CampusOS</span>
      </div>
      <div className="ml-9 mt-1"><PulseLine light={light} width={40} /></div>
      <p className="ml-9 mt-1 text-[9px] font-plexmono font-semibold uppercase"
        style={{ color: light ? 'rgba(245,247,250,0.6)' : '#1B4332', letterSpacing: '0.18em' }}>
        College of Nursing Sciences, Osogbo
      </p>
    </div>
  )
}

function InputField({ id, label, Icon, type = 'text', placeholder, value, onChange, autoComplete, rightSlot }: {
  id: string; label: string; Icon: any; type?: string; placeholder: string; value: string
  onChange: (v: string) => void; autoComplete?: string; rightSlot?: React.ReactNode
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="mb-5">
      <label htmlFor={id} className="block text-xs font-plexmono font-semibold uppercase mb-2" style={{ color: '#8A9BB0', letterSpacing: '0.1em' }}>
        {label}
      </label>
      <div className="flex items-center rounded-xl transition-all duration-200 overflow-hidden bg-bg"
        style={{ border: `1.5px solid ${focused ? '#122400' : '#E8EDF2'}`, boxShadow: focused ? '0 0 0 3px rgba(27,67,50,0.08)' : 'none' }}>
        <span className="pl-4 pr-2 flex-shrink-0 flex items-center" style={{ opacity: 0.55 }}>
          <Icon size={18} strokeWidth={1.75} color="#1B4332" />
        </span>
        <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="flex-1 py-3.5 pr-3 text-sm bg-transparent border-0 outline-none text-ink"
          style={{ fontFamily: 'inherit', minHeight: 48 }} />
        {rightSlot && <div className="pr-3 flex-shrink-0">{rightSlot}</div>}
      </div>
    </div>
  )
}

export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async () => {
    if (!identifier.trim() || !password) {
      setError('Please enter your matric number / staff ID and password')
      return
    }
    setLoading(true); setError('')
    try {
      await login(identifier.trim(), password)
      navigate('/dashboard')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Invalid credentials — please check and try again'
      setError(msg)
    } finally { setLoading(false) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSubmit() }

  const FormPanel = (
    <div className="flex flex-col justify-center px-8 py-10 lg:px-12 xl:px-16 w-full">
      <div className="w-full max-w-sm mx-auto">
        <h2 className="font-display font-semibold text-2xl mb-1 text-field">Sign In</h2>
        <div className="mb-6"><PulseLine light={false} width={28} /></div>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: '#FEE2E2', color: '#DC2626' }}>{error}</div>
        )}

        <InputField id="identifier" label="Matric Number / Staff ID" Icon={GraduationCap}
          placeholder="e.g. NSG/2022/001 or LEC001" value={identifier} onChange={setIdentifier} autoComplete="username" />

        <InputField id="password" label="Password" Icon={Lock} type={showPass ? 'text' : 'password'}
          placeholder="Enter your password" value={password} onChange={setPassword} autoComplete="current-password"
          rightSlot={
            <button type="button" onClick={() => setShowPass(p => !p)} className="border-0 bg-transparent cursor-pointer p-0 flex items-center" style={{ color: '#8A9BB0' }} tabIndex={-1}>
              {showPass ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
            </button>
          } />

        <div className="flex justify-end -mt-2 mb-6">
          <button type="button" onClick={() => navigate('/forgot-password')} className="text-xs font-semibold border-0 bg-transparent cursor-pointer p-0 text-ink">
            Forgot Password?
          </button>
        </div>

        <button onClick={handleSubmit} onKeyDown={handleKeyDown} disabled={loading}
          className="w-full py-4 rounded-2xl font-semibold text-base text-white border-0 cursor-pointer transition-all duration-200 disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #2D6A4F, #122400)', boxShadow: '0 8px 28px rgba(27,67,50,0.35)', minHeight: 52 }}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 2px #C99A44, 0 8px 32px rgba(27,67,50,0.45)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 28px rgba(27,67,50,0.35)' }}>
          {loading ? 'Signing in…' : 'Sign In →'}
        </button>

        <p className="mt-5 text-center text-xs" style={{ color: '#8A9BB0' }}>
          Having trouble?{' '}<span className="font-semibold cursor-pointer text-ink">Contact your ICT Admin</span>
        </p>
        <p className="mt-2 text-center text-xs" style={{ color: '#8A9BB0' }}>
          Alumnus or former student?{' '}
          <span className="font-semibold cursor-pointer text-ink" onClick={() => navigate('/request-transcript')}>Request a transcript</span>
        </p>
      </div>
    </div>
  )

  return (
    <>
      <div className="lg:hidden flex flex-col min-h-screen bg-bg">
        <div className="relative flex-shrink-0" style={{ height: '38vh', minHeight: 220, backgroundImage: `url(${IMG_2})`, backgroundSize: 'cover', backgroundPosition: 'center top' }}>
          <div className="absolute inset-0" style={{ background: OVERLAY }} />
          <div className="absolute inset-0 flex flex-col justify-between px-7 py-7">
            <BrandMark light />
            <div>
              <h1 className="font-display font-semibold text-3xl text-white leading-tight">Welcome back.</h1>
              <div className="mt-2 mb-2"><PulseLine width={48} /></div>
              <p className="text-sm" style={{ color: 'rgba(245,247,250,0.65)' }}>Sign in to continue your journey.</p>
            </div>
          </div>
        </div>
        <div className="flex-1 rounded-t-3xl -mt-5 relative z-10 bg-bg">{FormPanel}</div>
      </div>

      <div className="hidden lg:flex min-h-screen w-full">
        <div className="relative flex-1" style={{ backgroundImage: `url(${IMG_2})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0" style={{ background: OVERLAY }} />
          <div className="absolute inset-0 flex flex-col justify-center px-14 xl:px-20">
            <BrandMark light />
            <div className="mt-12">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 rounded-full" style={{ background: '#2D6A4F' }} />
                <span className="text-xs font-semibold" style={{ color: 'rgba(245,247,250,0.5)' }}>Student Portal</span>
              </div>
              <h1 className="font-display font-semibold text-5xl xl:text-6xl text-white leading-[1.05] tracking-tight">Welcome<br />back.</h1>
              <div className="mt-4 mb-4"><PulseLine width={64} /></div>
              <p className="text-lg" style={{ color: 'rgba(245,247,250,0.65)' }}>Sign in to continue your journey.</p>
            </div>
            <p className="absolute bottom-10 left-14 xl:left-20 text-xs italic" style={{ color: 'rgba(245,247,250,0.3)', maxWidth: 280 }}>
              "Training the next generation of nursing professionals in Nigeria."
            </p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-bg">
          <div className="w-full max-w-md px-4">
            <div className="bg-white rounded-3xl px-8 py-10" style={{ boxShadow: '0 24px 64px rgba(27,67,50,0.10)' }}>{FormPanel}</div>
          </div>
        </div>
      </div>
    </>
  )
}
