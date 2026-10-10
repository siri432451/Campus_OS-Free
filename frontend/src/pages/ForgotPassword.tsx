import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { KeyRound, CheckCircle2 } from 'lucide-react'

const API = (import.meta.env.VITE_API_URL as string | undefined) || ''

type Stage = 'enter-id' | 'enter-code'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [stage, setStage] = useState<Stage>('enter-id')
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => Math.max(0, c - 1)), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function requestCode() {
    setError(null); setInfo(null)
    if (!identifier.trim()) { setError('Please enter your matric number or staff ID'); return }
    setBusy(true)
    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      })
      const data = await res.json()
      if (res.status === 429) {
        const m = data.error && data.error.match(/(\d+)s/)
        if (m) setCooldown(parseInt(m[1], 10))
        setError(data.error || 'Please wait before requesting again')
        return
      }
      if (!res.ok) { setError(data.error || 'Could not send reset code'); return }
      setInfo('If an account exists with that ID and a verified email, a code has been sent. Check your inbox (and spam folder).')
      setStage('enter-code'); setCooldown(60)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Network error') } finally { setBusy(false) }
  }

  async function resendCode() {
    if (cooldown > 0) return
    setError(null); setInfo(null); setBusy(true)
    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      })
      const data = await res.json()
      if (res.status === 429) {
        const m = data.error && data.error.match(/(\d+)s/)
        if (m) setCooldown(parseInt(m[1], 10))
        setError(data.error || 'Please wait')
        return
      }
      if (res.ok) { setInfo('Code re-sent. Check your inbox.'); setCooldown(60) }
      else setError(data.error || 'Could not resend')
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Network error') } finally { setBusy(false) }
  }

  async function submitReset() {
    setError(null); setInfo(null)
    if (!code.trim() || code.trim().length !== 6) { setError('Enter the 6-digit code from your email'); return }
    if (newPassword.length < 8) { setError('New password must be at least 8 characters'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return }
    setBusy(true)
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), code: code.trim(), newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        const friendly: Record<string, string> = {
          invalid_code: 'That code is invalid or expired. Check the email and try again.',
          expired: 'That code has expired. Request a new one.',
          too_many_attempts: 'Too many wrong attempts. Request a new code.',
          weak_password: 'Password must be at least 8 characters.',
          no_identifier: 'Matric or staff ID missing.',
        }
        setError(friendly[data.error] || data.error || 'Could not reset password')
        return
      }
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Network error') } finally { setBusy(false) }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
        <div className="bg-white rounded-2xl p-8 w-full max-w-md text-center border border-mossline">
          <CheckCircle2 size={48} strokeWidth={1.5} className="mx-auto mb-3 text-greenok" />
          <h1 className="font-display font-semibold text-2xl mb-2 text-greenok">Password reset</h1>
          <p className="text-sm mb-4 text-text2">Your password has been updated. Redirecting you to login…</p>
          <Link to="/login" className="inline-block px-4 py-2 rounded-xl text-sm font-semibold text-white bg-ink" style={{ textDecoration: 'none' }}>
            Go to login now
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-mossline">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={16} className="text-ink" />
          <p className="text-xs font-plexmono font-bold uppercase tracking-widest text-ink">Account recovery</p>
        </div>
        <h1 className="font-display font-semibold text-2xl mb-2 text-field">Forgot password?</h1>

        {stage === 'enter-id' && (
          <>
            <p className="text-sm mb-5 text-text2">Enter your matric number or staff ID. We'll email a 6-digit reset code to the email on file.</p>
            <label className="block mb-4">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1 text-text2">Matric / Staff ID</div>
              <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') requestCode() }}
                placeholder="e.g. NSG/2022/001 or ADMIN001" disabled={busy}
                className="w-full px-3 py-2.5 rounded-lg border border-mossline text-sm font-plexmono text-ink" />
            </label>
            {error && <div className="mb-3 p-3 rounded-xl text-sm" style={{ background: '#FEE2E2', color: '#991B1B' }}>{error}</div>}
            <button onClick={requestCode} disabled={busy}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer disabled:opacity-50 bg-ink">
              {busy ? 'Sending…' : 'Send reset code'}
            </button>
            <div className="mt-5 text-center">
              <Link to="/login" className="text-xs underline text-text2">Back to login</Link>
            </div>
          </>
        )}

        {stage === 'enter-code' && (
          <>
            {info && <div className="mb-4 p-3 rounded-xl text-sm bg-greenokbg text-greenok">{info}</div>}
            <p className="text-sm mb-4 text-text2">Enter the 6-digit code and your new password.</p>
            <label className="block mb-3">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1 text-text2">6-digit code</div>
              <input type="text" value={code} maxLength={6} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456" disabled={busy}
                className="w-full px-3 py-2.5 rounded-lg border border-mossline text-lg font-plexmono text-center tracking-widest text-ink" />
            </label>
            <label className="block mb-3">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1 text-text2">New password</div>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters" disabled={busy} className="w-full px-3 py-2.5 rounded-lg border border-mossline text-sm text-ink" />
            </label>
            <label className="block mb-3">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1 text-text2">Confirm password</div>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitReset() }}
                placeholder="Re-enter password" disabled={busy} className="w-full px-3 py-2.5 rounded-lg border border-mossline text-sm text-ink" />
            </label>
            {error && <div className="mb-3 p-3 rounded-xl text-sm" style={{ background: '#FEE2E2', color: '#991B1B' }}>{error}</div>}
            <button onClick={submitReset} disabled={busy}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer disabled:opacity-50 mb-3 bg-greenok">
              {busy ? 'Resetting…' : 'Reset password'}
            </button>
            <div className="flex justify-between items-center text-xs">
              <button onClick={resendCode} disabled={busy || cooldown > 0} className="underline border-0 bg-transparent cursor-pointer disabled:opacity-30 text-text2">
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
              <button onClick={() => { setStage('enter-id'); setCode(''); setNewPassword(''); setConfirmPassword(''); setError(null); setInfo(null) }}
                className="underline border-0 bg-transparent cursor-pointer text-text2">
                Use different ID
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
