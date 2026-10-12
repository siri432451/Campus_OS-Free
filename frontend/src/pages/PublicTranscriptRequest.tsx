import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Upload } from 'lucide-react'
import api from '../api/client'
import PublicShell from '../components/PublicShell'

interface Info {
  institution: string
  fees: { self: number; institution: number }
  bank: { bank: string; accountNumber: string; accountName: string }
  purposes: string[]
}

const naira = (n: number) => `\u20A6${n.toLocaleString('en-NG')}`

function errText(e: unknown): string {
  const anyE = e as { response?: { data?: { error?: string } } }
  return anyE?.response?.data?.error || 'Something went wrong. Please check your connection and try again.'
}

function Field({ label, value, onChange, type = 'text', placeholder, required, hint }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
  placeholder?: string; required?: boolean; hint?: string
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-plexmono font-semibold uppercase tracking-wide text-text2">
        {label}{required ? ' *' : ''}
      </span>
      <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm border border-mossline outline-none text-ink bg-white" />
      {hint && <span className="block text-[11px] text-text2 mt-1">{hint}</span>}
    </label>
  )
}

export default function PublicTranscriptRequestPage() {
  const [info, setInfo] = useState<Info | null>(null)
  const [loadError, setLoadError] = useState('')
  const [f, setF] = useState({
    applicantName: '', matricNo: '', entryYear: '', completionYear: '', email: '', phone: '',
    purpose: '', delivery: 'SELF', institutionName: '', institutionLocation: '', institutionEmail: '', note: '',
  })
  const [receipt, setReceipt] = useState<File | null>(null)
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ trackingCode: string; feeAmount: number } | null>(null)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    api.get('/api/public/transcripts/info')
      .then(r => setInfo(r.data))
      .catch(() => setLoadError('Could not load the request form. Please refresh the page.'))
  }, [])

  const set = (k: keyof typeof f) => (v: string) => setF(prev => ({ ...prev, [k]: v }))
  const fee = info ? (f.delivery === 'INSTITUTION' ? info.fees.institution : info.fees.self) : 0

  const copy = async (text: string, tag: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(tag); setTimeout(() => setCopied(''), 1500) } catch { /* ignore */ }
  }

  const pickFile = (file: File | undefined) => {
    setError('')
    if (!file) { setReceipt(null); return }
    if (file.size > 2 * 1024 * 1024) { setError('The receipt file is too large. Please upload a file under 2 MB.'); setReceipt(null); return }
    setReceipt(file)
  }

  const submit = async () => {
    setError('')
    if (!receipt) { setError('Please upload your payment receipt.'); return }
    if (!agree) { setError('Please confirm that the details you entered are correct.'); return }
    setBusy(true)
    try {
      const fd = new FormData()
      Object.entries(f).forEach(([k, v]) => fd.append(k, v))
      fd.append('receipt', receipt)
      const r = await api.post('/api/public/transcripts/requests', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setDone({ trackingCode: r.data.trackingCode, feeAmount: r.data.feeAmount })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) { setError(errText(e)) }
    setBusy(false)
  }

  if (done) {
    return (
      <PublicShell title="Request received" subtitle="Keep your tracking code safe">
        <div className="bg-white rounded-2xl border border-mossline p-5">
          <div className="text-xs font-plexmono uppercase tracking-wide text-text2">Your tracking code</div>
          <div className="flex items-center gap-3 mt-1">
            <div className="font-plexmono font-semibold text-ink" style={{ fontSize: 30, letterSpacing: 2 }}>{done.trackingCode}</div>
            <button onClick={() => copy(done.trackingCode, 'code')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-mossline bg-white cursor-pointer text-ink">
              <Copy size={13} /> {copied === 'code' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-sm text-ink mt-4">
            We have received your request and payment receipt ({naira(done.feeAmount)}). The Registrar will review it.
            Use the tracking code and the phone number you entered to follow its progress.
          </p>
          <Link to={`/track-transcript?code=${done.trackingCode}`}
            className="inline-block mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold text-white no-underline bg-field">
            Track my request
          </Link>
        </div>
      </PublicShell>
    )
  }

  return (
    <PublicShell title="Request a transcript" subtitle={info?.institution || 'Osun State College of Nursing Sciences'}>
      {loadError && <div className="mb-4 p-3 rounded-xl text-sm bg-red-50 text-red-600">{loadError}</div>}

      {info && (
        <div className="bg-white rounded-2xl border border-mossline p-5 mb-4">
          <div className="font-semibold text-ink text-sm">How it works</div>
          <ol className="text-sm text-ink mt-2 pl-5 list-decimal space-y-1">
            <li>Pay the fee into the account below.</li>
            <li>Fill in your details and upload the payment receipt.</li>
            <li>Track your request with the code you receive.</li>
          </ol>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-moss p-3">
              <div className="text-[11px] font-plexmono uppercase text-text2">Sent to you</div>
              <div className="font-display font-semibold text-ink text-xl">{naira(info.fees.self)}</div>
            </div>
            <div className="rounded-xl bg-moss p-3">
              <div className="text-[11px] font-plexmono uppercase text-text2">Sent to an institution</div>
              <div className="font-display font-semibold text-ink text-xl">{naira(info.fees.institution)}</div>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-mossline p-3 text-sm text-ink">
            <div className="text-[11px] font-plexmono uppercase text-text2">Pay to</div>
            <div className="font-semibold mt-1">{info.bank.accountName}</div>
            <div>{info.bank.bank}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-plexmono font-semibold" style={{ fontSize: 18, letterSpacing: 1 }}>{info.bank.accountNumber}</span>
              <button onClick={() => copy(info.bank.accountNumber, 'acct')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-mossline bg-white cursor-pointer text-ink">
                <Copy size={12} /> {copied === 'acct' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-mossline p-5">
        <div className="font-semibold text-ink text-sm mb-3">Your details</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Field label="Full name" required value={f.applicantName} onChange={set('applicantName')}
              hint="Exactly as it appears on your college records." />
          </div>
          <Field label="Matric / registration number" value={f.matricNo} onChange={set('matricNo')} hint="If you remember it." />
          <label className="block">
            <span className="text-[11px] font-plexmono font-semibold uppercase tracking-wide text-text2">Purpose</span>
            <select value={f.purpose} onChange={e => set('purpose')(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm border border-mossline outline-none text-ink bg-white">
              <option value="">Select…</option>
              {(info?.purposes || []).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <Field label="Year you entered" value={f.entryYear} onChange={set('entryYear')} placeholder="e.g. 2019" />
          <Field label="Year you completed" value={f.completionYear} onChange={set('completionYear')} placeholder="e.g. 2022" />
          <Field label="Email" required type="email" value={f.email} onChange={set('email')} />
          <Field label="Phone number" required type="tel" value={f.phone} onChange={set('phone')} hint="You will need it to track your request." />
        </div>

        <div className="font-semibold text-ink text-sm mt-6 mb-2">Where should the transcript go?</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { v: 'SELF', t: 'To me', s: info ? naira(info.fees.self) : '' },
            { v: 'INSTITUTION', t: 'To another institution', s: info ? naira(info.fees.institution) : '' },
          ].map(o => (
            <button key={o.v} type="button" onClick={() => set('delivery')(o.v)}
              className="text-left p-3 rounded-xl cursor-pointer"
              style={{ border: f.delivery === o.v ? '2px solid #1B4332' : '1px solid #D6E2D8', background: f.delivery === o.v ? '#EEF4EF' : '#fff' }}>
              <div className="font-semibold text-ink text-sm">{o.t}</div>
              <div className="text-xs text-text2">{o.s}</div>
            </button>
          ))}
        </div>

        {f.delivery === 'INSTITUTION' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div className="sm:col-span-2">
              <Field label="Institution name" required value={f.institutionName} onChange={set('institutionName')} />
            </div>
            <Field label="Location" required value={f.institutionLocation} onChange={set('institutionLocation')} placeholder="City, state or country" />
            <Field label="Institution email" required type="email" value={f.institutionEmail} onChange={set('institutionEmail')} />
          </div>
        )}

        <label className="block mt-4">
          <span className="text-[11px] font-plexmono font-semibold uppercase tracking-wide text-text2">Note (optional)</span>
          <textarea value={f.note} onChange={e => set('note')(e.target.value)} rows={3}
            placeholder="Anything the Registrar should know"
            className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm border border-mossline outline-none text-ink bg-white" />
        </label>

        <div className="font-semibold text-ink text-sm mt-5 mb-2">Payment receipt *</div>
        <label className="flex items-center gap-2 px-4 py-3 rounded-xl border border-mossline cursor-pointer text-sm text-ink bg-white">
          <Upload size={16} />
          <span className="flex-1 truncate">{receipt ? receipt.name : 'Upload a photo or PDF of your receipt (max 2 MB)'}</span>
          <input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden"
            onChange={e => pickFile(e.target.files?.[0])} />
        </label>

        <label className="flex items-start gap-2 mt-4 text-sm text-ink cursor-pointer">
          <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-1" />
          <span>I confirm that the details above are correct{info ? ` and that I have paid ${naira(fee)}` : ''}.</span>
        </label>

        {error && <div className="mt-4 p-3 rounded-xl text-sm bg-red-50 text-red-600">{error}</div>}

        <button onClick={submit} disabled={busy || !info}
          className="mt-5 w-full px-5 py-3 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer bg-field disabled:opacity-60">
          {busy ? 'Submitting…' : 'Submit request'}
        </button>
        <p className="text-center text-xs text-text2 mt-3">
          Already requested? <Link to="/track-transcript" className="font-semibold text-ink">Track your request</Link>
        </p>
      </div>
    </PublicShell>
  )
}
