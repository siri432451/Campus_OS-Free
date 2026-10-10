import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

declare global {
  interface Window { PaystackPop?: { setup: (opts: PaystackSetupOpts) => { openIframe: () => void } } }
}
type PaystackSetupOpts = {
  key: string
  email: string
  amount: number
  ref: string
  currency?: string
  callback: (response: { reference: string }) => void
  onClose: () => void
}

type Balance = { balance: number; accountNo: string | null; bankName: string | null }
type Job = {
  id: string
  fileName: string
  pages: number
  copies: number
  isColor: boolean
  creditCost: number
  status: 'QUEUED' | 'PRINTING' | 'DONE' | 'CANCELLED'
  createdAt: string
}

const API = (import.meta.env.VITE_API_URL as string | undefined) || ''

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('campusos_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function statusBadge(status: Job['status']) {
  const map: Record<Job['status'], { bg: string; fg: string; label: string }> = {
    QUEUED:    { bg: '#FEF3C7', fg: '#92400E', label: 'Queued' },
    PRINTING:  { bg: '#DBEAFE', fg: '#1E40AF', label: 'Printing' },
    DONE:      { bg: '#D1FAE5', fg: '#065F46', label: 'Printed' },
    CANCELLED: { bg: '#FEE2E2', fg: '#991B1B', label: 'Cancelled' },
  }
  const s = map[status]
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export default function PrintWallet() {
  const navigate = useNavigate()
  const [balance, setBalance] = useState<Balance | null>(null)
  const [history, setHistory] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [copies, setCopies] = useState<string>('1')
  const [isColor, setIsColor] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState<string | null>(null)

  const { user } = useAuth()

  // Top-up modal state
  const [topupOpen, setTopupOpen] = useState(false)
  const [topupAmount, setTopupAmount] = useState<string>('')
  const [topupBusy, setTopupBusy] = useState(false)
  const [topupMsg, setTopupMsg] = useState<string | null>(null)

  // Load Paystack inline.js once
  useEffect(() => {
    if (window.PaystackPop) return
    const s = document.createElement('script')
    s.src = 'https://js.paystack.co/v1/inline.js'
    s.async = true
    document.body.appendChild(s)
  }, [])

  async function startTopup(naira: number) {
    // Paystack requires an email. Synthesize one from matric/staff ID if none on file.
    const idTag = (user?.matricNo || user?.staffId || user?.id || 'student').toString().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
    const studentEmail = `${idTag}@students.campusos.com`

    if (naira < 200 || naira > 20000) {
      setTopupMsg('Amount must be between ₦200 and ₦20,000')
      return
    }

    setTopupBusy(true)
    setTopupMsg(null)
    try {
      // 1. Initiate on backend
      const initRes = await fetch(`${API}/api/print/topup/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ amount: naira }),
      })
      const initData = await initRes.json()
      if (!initRes.ok) throw new Error(initData.error || 'Could not start payment')

      // 2. Open Paystack popup
      if (!window.PaystackPop) throw new Error('Paystack not loaded yet, please try again')
      const handler = window.PaystackPop.setup({
        key: initData.publicKey,
        email: studentEmail,
        amount: initData.amount,           // already in kobo
        ref: initData.reference,
        currency: 'NGN',
        callback: (response) => {
          // Verify on backend (fire and forget — UI updates after)
          verifyTopup(response.reference)
        },
        onClose: () => {
          setTopupBusy(false)
          setTopupMsg('Payment cancelled.')
        },
      })
      handler.openIframe()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setTopupMsg(`Failed to start payment: ${msg}`)
      setTopupBusy(false)
    }
  }

  async function verifyTopup(reference: string) {
    setTopupMsg('Verifying payment…')
    try {
      const res = await fetch(`${API}/api/print/topup/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ reference }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')

      setTopupMsg(`✓ Payment confirmed! +${data.credits} credits added.`)
      setTimeout(() => {
        setTopupOpen(false)
        setTopupMsg(null)
        setTopupAmount('')
      }, 2500)
      await refresh()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setTopupMsg(`Verification failed: ${msg}`)
    } finally {
      setTopupBusy(false)
    }
  }

  const refresh = useCallback(async () => {
    try {
      const [balRes, histRes] = await Promise.all([
        fetch(`${API}/api/print/balance`, { headers: { ...authHeaders() } }),
        fetch(`${API}/api/print/my-history`, { headers: { ...authHeaders() } }),
      ])
      if (balRes.status === 401) { navigate('/login'); return }
      if (!balRes.ok) throw new Error(`Balance HTTP ${balRes.status}`)
      if (!histRes.ok) throw new Error(`History HTTP ${histRes.status}`)
      setBalance(await balRes.json())
      setHistory(await histRes.json())
      setError(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(`Failed to load wallet: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => { refresh() }, [refresh])

  // Estimate cost from file size (50KB ~ 1 page is a rough average).
  // The real page count comes from the server after upload.
  const estimatedPages = file ? Math.max(1, Math.round(file.size / 51200)) : 0
  const cost = (() => {
    const c = parseInt(copies || '1', 10)
    if (estimatedPages <= 0 || isNaN(c) || c <= 0) return 0
    return estimatedPages * c * (isColor ? 3 : 1)
  })()

  const canSubmit = !!file && balance !== null && !submitting

  async function submit() {
    if (!file || cost <= 0) return
    setSubmitting(true)
    setSubmitMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('copies', copies)
      fd.append('isColor', String(isColor))
      const res = await fetch(`${API}/api/print/jobs`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSubmitMsg(data.error || `Upload failed (HTTP ${res.status})`)
        return
      }
      setSubmitMsg('✓ Submitted to print queue. The operator will print it shortly.')
      setFile(null)
      setCopies('1')
      setIsColor(false)
      const inputEl = document.getElementById('file-input') as HTMLInputElement | null
      if (inputEl) inputEl.value = ''
      await refresh()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setSubmitMsg(`Upload failed: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen p-4 lg:p-8" style={{ background: '#F5F7FA' }}>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight" style={{ color: '#1B4332' }}>
            Print Wallet
          </h1>
          <div className="mt-1 h-px w-12" style={{ background: '#D4A24C' }} />
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl text-sm" style={{ background: '#FEE2E2', color: '#991B1B' }}>
            {error}
          </div>
        )}

        {loading && (
          <div className="text-sm" style={{ color: '#1B4332', opacity: 0.6 }}>Loading…</div>
        )}

        {balance && (
          <div className="rounded-2xl p-6 mb-6 text-white relative" style={{ background: 'linear-gradient(135deg, #1B4332 0%, #122400 100%)' }}>
            <div className="text-xs uppercase tracking-widest opacity-70">Available credits</div>
            <div className="mt-1 text-4xl font-black">{balance.balance.toLocaleString()}</div>
            <div className="mt-1 text-sm opacity-80">
              Enough for {balance.balance} pages B&W or {Math.floor(balance.balance / 3)} pages color
            </div>
            <button
              onClick={() => setTopupOpen(true)}
              className="absolute top-6 right-6 px-4 py-2 rounded-lg text-sm font-bold border-0 cursor-pointer"
              style={{ background: '#D4A24C', color: '#1B4332' }}
            >
              + Top up
            </button>
          </div>
        )}

        {/* Top-up modal */}
        {topupOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(27,67,50,0.55)' }}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-black text-lg" style={{ color: '#1B4332' }}>Top up your wallet</h3>
                <button
                  onClick={() => { if (!topupBusy) { setTopupOpen(false); setTopupMsg(null); setTopupAmount('') } }}
                  disabled={topupBusy}
                  className="text-2xl leading-none border-0 bg-transparent cursor-pointer"
                  style={{ color: '#1B4332', opacity: 0.5 }}
                >×</button>
              </div>
              <p className="text-xs mb-4" style={{ color: '#1B4332', opacity: 0.7 }}>
                ₦25 = 1 credit = 1 B&W page
              </p>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {[500, 1000, 2500].map(n => (
                  <button
                    key={n}
                    onClick={() => startTopup(n)}
                    disabled={topupBusy}
                    className="py-3 rounded-lg text-sm font-bold border cursor-pointer disabled:opacity-50"
                    style={{ borderColor: '#E5E7EB', background: '#fff', color: '#1B4332' }}
                  >
                    <div>₦{n.toLocaleString()}</div>
                    <div className="text-[10px] font-medium opacity-60 mt-0.5">{Math.floor(n/25)} credits</div>
                  </button>
                ))}
              </div>

              <div className="text-xs uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.6 }}>
                Or custom amount
              </div>
              <div className="flex gap-2 mb-3">
                <input
                  type="number"
                  min={200}
                  max={20000}
                  step={100}
                  placeholder="e.g. 750"
                  value={topupAmount}
                  onChange={e => setTopupAmount(e.target.value)}
                  disabled={topupBusy}
                  className="flex-1 px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: '#E5E7EB' }}
                />
                <button
                  onClick={() => {
                    const n = parseInt(topupAmount, 10)
                    if (isNaN(n)) { setTopupMsg('Enter a valid number'); return }
                    startTopup(n)
                  }}
                  disabled={topupBusy || !topupAmount}
                  className="px-4 py-2 rounded-lg text-sm font-bold border-0 cursor-pointer disabled:opacity-50"
                  style={{ background: '#122400', color: '#fff' }}
                >
                  Pay
                </button>
              </div>

              {topupMsg && (
                <div className="mt-3 p-2 rounded text-sm" style={{
                  background: topupMsg.startsWith('✓') ? '#D1FAE5' : '#FEE2E2',
                  color: topupMsg.startsWith('✓') ? '#065F46' : '#991B1B',
                }}>
                  {topupMsg}
                </div>
              )}

              <p className="text-xs mt-4 text-center" style={{ color: '#1B4332', opacity: 0.5 }}>
                Test mode · Use card 4084 0840 8408 4081, CVV 408, exp 01/30, PIN 0000, OTP 123456
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-5 lg:p-6 mb-6" style={{ boxShadow: '0 2px 12px rgba(27,67,50,0.06)' }}>
          <h2 className="font-bold text-lg mb-4" style={{ color: '#1B4332' }}>Send a document to print</h2>

          <label className="block mb-4">
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>
              File (PDF, max 20 MB)
            </div>
            <input
              id="file-input"
              type="file"
              accept="application/pdf"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm"
            />
            {file && (
              <div className="mt-1 text-xs" style={{ color: '#1B4332', opacity: 0.6 }}>
                {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            )}
          </label>

          <div className="flex gap-3 mb-5">
            <label className="flex-1">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>
                Copies
              </div>
              <input
                type="number"
                min={1}
                value={copies}
                onChange={e => setCopies(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: '#E5E7EB' }}
              />
            </label>
            <label className="flex-1 flex flex-col">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1B4332', opacity: 0.7 }}>
                Mode
              </div>
              <button
                type="button"
                onClick={() => setIsColor(!isColor)}
                className="px-3 py-2 rounded-lg border text-sm font-semibold cursor-pointer"
                style={{
                  borderColor: '#E5E7EB',
                  background: isColor ? '#122400' : '#fff',
                  color: isColor ? '#fff' : '#1B4332',
                }}
              >
                {isColor ? '🎨 Color (×3)' : '⚫ Black & White'}
              </button>
            </label>
          </div>

          {file && (
            <div className="p-3 rounded-lg mb-4" style={{ background: '#F5F7FA' }}>
              <div className="flex items-center justify-between">
                <div className="text-sm" style={{ color: '#1B4332' }}>Estimated cost</div>
                <div className="font-black text-lg" style={{ color: '#1B4332' }}>~{cost} credits</div>
              </div>
              <div className="text-xs mt-1" style={{ color: '#1B4332', opacity: 0.6 }}>
                Estimated for ~{estimatedPages} {estimatedPages === 1 ? 'page' : 'pages'}. Final cost is calculated from the actual PDF after upload.
              </div>
            </div>
          )}

          {balance && cost > balance.balance && (
            <div className="mb-3 text-sm" style={{ color: '#991B1B' }}>
              Not enough credits. You need {cost - balance.balance} more.
            </div>
          )}

          {submitMsg && (
            <div className="mb-3 text-sm" style={{ color: submitMsg.startsWith('✓') ? '#065F46' : '#991B1B' }}>
              {submitMsg}
            </div>
          )}

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="w-full py-3 rounded-xl font-bold text-base text-white border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#122400' }}
          >
            {submitting ? 'Sending…' : 'Send to Print Queue'}
          </button>
        </div>

        <div className="bg-white rounded-2xl p-5 lg:p-6" style={{ boxShadow: '0 2px 12px rgba(27,67,50,0.06)' }}>
          <h2 className="font-bold text-lg mb-3" style={{ color: '#1B4332' }}>Recent prints</h2>
          {history.length === 0 ? (
            <div className="text-sm py-2" style={{ color: '#1B4332', opacity: 0.6 }}>
              No print jobs yet. Send your first document above.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#E5E7EB' }}>
              {history.map(j => (
                <div key={j.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate text-sm" style={{ color: '#1B4332' }}>{j.fileName}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#1B4332', opacity: 0.6 }}>
                      {j.pages}p {j.copies > 1 ? `×${j.copies} ` : ''}· {j.isColor ? 'Color' : 'B&W'} · {j.creditCost} credits · {timeAgo(j.createdAt)}
                    </div>
                  </div>
                  {statusBadge(j.status)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
