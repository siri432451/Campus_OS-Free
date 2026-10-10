import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const API = (import.meta.env.VITE_API_URL as string | undefined) || ''

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('campusos_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

interface WifiSession {
  id: string
  grantedAt: string
  expiresAt: string
}

interface StatusResponse {
  active: boolean
  session: WifiSession | null
}

function formatRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const hrs = Math.floor(ms / (1000 * 60 * 60))
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  return `${hrs}h ${mins}m remaining`
}

export default function Wifi() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState('')

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/wifi/status`, { headers: { ...authHeaders() } })
      if (res.status === 401) { navigate('/login'); return }
      if (!res.ok) throw new Error('Failed to check status')
      const data = await res.json() as StatusResponse
      setStatus(data)
      setError('')
    } catch {
      setError('Could not load Wi-Fi status. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleConnect = async () => {
    setActing(true); setError('')
    try {
      // Software session grant only — not a real captive-portal / router-level network join.
      // Browsers do not expose device MAC addresses to JS for privacy reasons.
      const res = await fetch(`${API}/api/wifi/grant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ macAddress: '' }),
      })
      if (!res.ok) throw new Error('Failed to connect')
      await fetchStatus()
    } catch {
      setError('Could not connect right now. Please try again.')
    } finally {
      setActing(false)
    }
  }

  const active = status?.active ?? false

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 lg:py-10">
      <h1 className="font-black text-xl lg:text-2xl mb-1" style={{ color: '#1A3C5E' }}>Campus Wi-Fi</h1>
      <p className="text-sm mb-6" style={{ color: '#8A9BB0' }}>Manage your campus network connection.</p>

      <div className="rounded-3xl mb-6 p-6 lg:p-8 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1B4332, #122400)' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        <div className="relative z-10">
          {loading ? (
            <div className="animate-pulse">
              <div className="h-4 w-32 rounded mb-3" style={{ background: 'rgba(255,255,255,0.15)' }} />
              <div className="h-8 w-48 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
            </div>
          ) : (
            <>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
                style={{ background: 'rgba(255,255,255,0.12)' }}>
                <span className="text-sm">📶</span>
                <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  {active ? 'Active Session' : 'No Active Session'}
                </span>
                <div className="w-2 h-2 rounded-full" style={{ background: active ? '#4ade80' : '#fbbf24' }} />
              </div>

              <h2 className="font-black text-2xl text-white mb-1">
                {active ? 'Connected' : 'Not Connected'}
              </h2>

              {active && status?.session && (
                <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {formatRemaining(status.session.expiresAt)}
                </p>
              )}
              {!active && (
                <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Connect to get campus network access for 12 hours.
                </p>
              )}

              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: 'rgba(220,38,38,0.15)', color: '#fca5a5' }}>
                  {error}
                </div>
              )}

              <button onClick={handleConnect} disabled={acting}
                className="px-6 py-3.5 rounded-2xl font-semibold text-sm text-white border-0 cursor-pointer transition-opacity disabled:opacity-60"
                style={{ background: active ? 'rgba(255,255,255,0.15)' : 'linear-gradient(135deg,#E7C687,#C99A44)', color: active ? '#fff' : '#1B4332' }}>
                {acting ? 'Please wait…' : active ? 'Extend Session' : 'Connect to Campus Wi-Fi'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
