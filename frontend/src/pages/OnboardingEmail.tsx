import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Mail } from 'lucide-react'

const API = (import.meta.env.VITE_API_URL as string | undefined) || ''

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('campusos_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

type Stage = 'enter-email' | 'enter-code'

export default function OnboardingEmail() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const [stage, setStage] = useState<Stage>('enter-email')
  const [email, setEmail] = useState<string>(user?.email || '')
  const [code, setCode] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState<number>(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => Math.max(0, c - 1)), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function sendCode() {
    setError(null); setInfo(null)
    if (!email.trim() || !email.includes('@')) { setError('Enter a valid email address'); return }
    setBusy(true)
    try {
      const res = await fetch(`${API}/api/auth/onboarding/send-code`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.cooldownRemaining) setCooldown(data.cooldownRemaining)
        setError(data.error || 'Could not send code')
        return
      }
      setStage('enter-code')
      setInfo(data.message || `A 6-digit code has been sent to ${email.trim()}.`)
      setCooldown(30)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Network error') } finally { setBusy(false) }
  }

  async function submitCode() {
    setError(null); setInfo(null)
    if (!/^\d{6}$/.test(code.trim())) { setError('Enter the 6-digit code'); return }
    setBusy(true)
    try {
      const res = await fetch(`${API}/api/auth/onboarding/verify-code`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not verify code')
        if (data.reason === 'expired' || data.reason === 'too_many_attempts' || data.reason === 'no_pending_code') {
          setStage('enter-email'); setCode('')
        }
        return
      }
      setInfo('✓ Email verified! Returning to dashboard…')
      try { await refreshUser() } catch {}
      setTimeout(() => navigate('/dashboard'), 1000)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Network error') } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 lg:p-8 border border-mossline">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-moss flex items-center justify-center mx-auto mb-3">
            <Mail size={26} strokeWidth={1.75} className="text-field" />
          </div>
          <h1 className="font-display font-semibold text-2xl text-field">Verify your email</h1>
          <p className="mt-3 text-sm text-text2">We need to confirm your email so you can recover your account and receive important notices.</p>
        </div>

        {stage === 'enter-email' && (
          <>
            <label className="block mb-4">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1 text-text2">Email address</div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" disabled={busy}
                className="w-full px-3 py-2 rounded-lg border border-mossline text-sm text-ink" />
              {user?.email && <div className="mt-1 text-xs text-text2">We had {user.email} on file. You can keep it or change it.</div>}
            </label>
            {error && <div className="mb-3 p-2 rounded text-sm" style={{ background: '#FEE2E2', color: '#991B1B' }}>{error}</div>}
            <button onClick={sendCode} disabled={busy}
              className="w-full py-3 rounded-xl font-semibold text-base text-white border-0 cursor-pointer disabled:opacity-50 bg-ink">
              {busy ? 'Sending…' : 'Send code'}
            </button>
            <button onClick={() => navigate('/dashboard')} disabled={busy} className="w-full mt-2 py-2 text-xs cursor-pointer border-0 bg-transparent text-text2">
              Back to dashboard
            </button>
          </>
        )}

        {stage === 'enter-code' && (
          <>
            {info && <div className="mb-3 p-2 rounded text-sm bg-greenokbg text-greenok">{info}</div>}
            <label className="block mb-4">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1 text-text2">6-digit code</div>
              <input type="text" inputMode="numeric" pattern="\d{6}" maxLength={6} value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" disabled={busy}
                className="w-full px-3 py-3 rounded-lg border border-mossline text-center font-plexmono text-2xl tracking-[0.4em] text-ink" autoFocus />
              <div className="mt-1 text-xs text-text2">Sent to {email} · expires in 10 minutes</div>
            </label>
            {error && <div className="mb-3 p-2 rounded text-sm" style={{ background: '#FEE2E2', color: '#991B1B' }}>{error}</div>}
            <button onClick={submitCode} disabled={busy || code.length !== 6}
              className="w-full py-3 rounded-xl font-semibold text-base text-white border-0 cursor-pointer disabled:opacity-50 mb-2 bg-ink">
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            <button onClick={() => { if (cooldown === 0 && !busy) sendCode() }} disabled={busy || cooldown > 0}
              className="w-full py-2 rounded-xl text-sm font-semibold border border-mossline bg-white cursor-pointer disabled:opacity-50 text-ink">
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
            <button onClick={() => { setStage('enter-email'); setCode(''); setError(null); setInfo(null) }} disabled={busy}
              className="w-full mt-2 py-2 text-xs cursor-pointer border-0 bg-transparent text-text2">
              Use a different email
            </button>
          </>
        )}
      </div>
    </div>
  )
}
