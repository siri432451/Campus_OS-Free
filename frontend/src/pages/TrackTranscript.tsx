import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Download } from 'lucide-react'
import api from '../api/client'
import PublicShell from '../components/PublicShell'

interface Tracked {
  trackingCode: string
  status: string
  statusLabel: string
  message: string
  rejectionReason: string | null
  delivery: string
  institutionName: string | null
  institutionLocation: string | null
  feeAmount: number
  createdAt: string
  updatedAt: string
  canDownload: boolean
}

const STEPS = ['RECEIVED', 'UNDER_REVIEW', 'APPROVED']

function errText(e: unknown): string {
  const anyE = e as { response?: { data?: { error?: string } } }
  return anyE?.response?.data?.error || 'Something went wrong. Please try again.'
}

async function blobErrText(e: unknown): Promise<string> {
  const anyE = e as { response?: { data?: Blob } }
  try {
    const text = await anyE?.response?.data?.text()
    if (text) return JSON.parse(text).error || 'Could not download the transcript.'
  } catch { /* fall through */ }
  return 'Could not download the transcript.'
}

export default function TrackTranscriptPage() {
  const location = useLocation()
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('code') || '')
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState<Tracked | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const track = async () => {
    setError('')
    setResult(null)
    setBusy('track')
    try {
      const r = await api.post('/api/public/transcripts/track', { trackingCode: code, phone })
      setResult(r.data)
    } catch (e) { setError(errText(e)) }
    setBusy('')
  }

  const download = async () => {
    setError('')
    setBusy('download')
    const tab = window.open('', '_blank')
    try {
      const r = await api.post('/api/public/transcripts/download', { trackingCode: code, phone }, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      if (tab) tab.location.href = url
      else window.location.href = url
    } catch (e) {
      if (tab) tab.close()
      setError(await blobErrText(e))
    }
    setBusy('')
  }

  const stepIndex = result ? Math.max(STEPS.indexOf(result.status === 'AWAITING_RECORDS' ? 'UNDER_REVIEW' : result.status === 'SENT' ? 'APPROVED' : result.status), 0) : 0
  const rejected = result?.status === 'REJECTED'

  return (
    <PublicShell title="Track your request" subtitle="Enter your tracking code and the phone number you used">
      <div className="bg-white rounded-2xl border border-mossline p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] font-plexmono font-semibold uppercase tracking-wide text-text2">Tracking code</span>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="TR-XXXXXX"
              className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm border border-mossline outline-none text-ink font-plexmono" />
          </label>
          <label className="block">
            <span className="text-[11px] font-plexmono font-semibold uppercase tracking-wide text-text2">Phone number</span>
            <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="0800 000 0000"
              onKeyDown={e => { if (e.key === 'Enter') track() }}
              className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm border border-mossline outline-none text-ink" />
          </label>
        </div>
        <button onClick={track} disabled={busy === 'track'}
          className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer bg-field disabled:opacity-60">
          {busy === 'track' ? 'Checking…' : 'Track'}
        </button>
        {error && <div className="mt-4 p-3 rounded-xl text-sm bg-red-50 text-red-600">{error}</div>}
      </div>

      {result && (
        <div className="bg-white rounded-2xl border border-mossline p-5 mt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="font-plexmono text-text2 text-xs">{result.trackingCode}</div>
            <div className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: rejected ? '#FDECEC' : '#E3F1E6', color: rejected ? '#B42318' : '#1B4332' }}>
              {result.statusLabel}
            </div>
          </div>

          {!rejected && (
            <div className="flex items-center gap-2 mt-4">
              {['Received', 'Under review', 'Approved'].map((label, i) => (
                <div key={label} className="flex-1">
                  <div className="h-1.5 rounded-full" style={{ background: i <= stepIndex ? '#1B4332' : '#D6E2D8' }} />
                  <div className="text-[11px] mt-1 text-text2">{label}</div>
                </div>
              ))}
            </div>
          )}

          <p className="text-sm text-ink mt-4">{result.message}</p>
          {rejected && result.rejectionReason && (
            <div className="mt-3 p-3 rounded-xl text-sm bg-red-50 text-red-600">Reason: {result.rejectionReason}</div>
          )}
          {result.delivery === 'INSTITUTION' && (
            <p className="text-xs text-text2 mt-3">
              To: {result.institutionName}{result.institutionLocation ? `, ${result.institutionLocation}` : ''}
            </p>
          )}
          <p className="text-xs text-text2 mt-1">Requested {new Date(result.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

          {result.canDownload && (
            <button onClick={download} disabled={busy === 'download'}
              className="mt-4 flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer bg-ink disabled:opacity-60">
              <Download size={15} /> {busy === 'download' ? 'Preparing…' : 'Download transcript'}
            </button>
          )}
        </div>
      )}
    </PublicShell>
  )
}
