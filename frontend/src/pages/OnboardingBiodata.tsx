import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Camera, AlertTriangle } from 'lucide-react'

const API = (import.meta.env.VITE_API_URL as string | undefined) || ''

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('campusos_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

type Form = {
  middleName: string; dateOfBirth: string; gender: string; maritalStatus: string
  hometown: string; localGovernment: string; stateOfOrigin: string; nationality: string
  contactAddress: string; residentialAddress: string; phone: string; bloodGroup: string; genotype: string
}

const EMPTY: Form = {
  middleName: '', dateOfBirth: '', gender: '', maritalStatus: '', hometown: '', localGovernment: '',
  stateOfOrigin: '', nationality: 'Nigerian', contactAddress: '', residentialAddress: '', phone: '', bloodGroup: '', genotype: '',
}

export default function OnboardingBiodata() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const [form, setForm] = useState<Form>(EMPTY)
  const [stage, setStage] = useState<'form' | 'confirm'>('form')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  async function compressImage(file: File, maxKB = 200): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const canvas = document.createElement('canvas')
        let { width, height } = img
        const MAX_DIM = 800
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM }
          else { width = Math.round(width * MAX_DIM / height); height = MAX_DIM }
        }
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        let quality = 0.85
        const tryCompress = () => {
          canvas.toBlob(blob => {
            if (!blob) { resolve(file); return }
            if (blob.size <= maxKB * 1024 || quality <= 0.3) {
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
            } else { quality -= 0.1; tryCompress() }
          }, 'image/jpeg', quality)
        }
        tryCompress()
      }
      img.src = url
    })
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true); setError(null)
    try {
      const compressed = await compressImage(file)
      setPhotoPreview(URL.createObjectURL(compressed))
      const fd = new FormData()
      fd.append('photo', compressed)
      const res = await fetch(`${API}/api/users/upload-photo`, { method: 'POST', headers: { ...authHeaders() }, body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Photo upload failed'); return }
      setPhotoUrl(data.photoUrl)
    } catch { setError('Photo upload failed') } finally { setPhotoUploading(false) }
  }

  function update<K extends keyof Form>(key: K, value: string) { setForm(f => ({ ...f, [key]: value })) }
  function allFilled(): boolean { return (Object.keys(form) as Array<keyof Form>).every(k => form[k].trim().length > 0) }

  function proceedToConfirm() {
    setError(null)
    if (!photoUrl) { setError('Please upload your passport photo before continuing.'); return }
    if (!allFilled()) { setError('All fields are required. Please fill every box.'); return }
    setStage('confirm')
  }

  async function submit() {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`${API}/api/auth/onboarding/save-biodata`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || `Request failed (${res.status})`); setStage('form'); return }
      try { await refreshUser() } catch { /* non-fatal */ }
      navigate('/dashboard', { replace: true })
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Network error'); setStage('form') } finally { setBusy(false) }
  }

  if (stage === 'confirm') {
    return (
      <div className="min-h-screen p-4 lg:p-8 bg-bg">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display font-semibold text-2xl mb-2 text-field">Please confirm your details</h1>
          <p className="text-sm mb-4 text-text2">Review carefully. <strong>You cannot modify this once submitted</strong> — only an admin can update your records later.</p>
          <div className="bg-white rounded-2xl p-5 mb-4 space-y-2 border border-mossline">
            <SummaryRow label="Middle name" value={form.middleName} />
            <SummaryRow label="Date of birth" value={form.dateOfBirth} />
            <SummaryRow label="Gender" value={form.gender} />
            <SummaryRow label="Marital status" value={form.maritalStatus} />
            <SummaryRow label="Hometown" value={form.hometown} />
            <SummaryRow label="Local government" value={form.localGovernment} />
            <SummaryRow label="State of origin" value={form.stateOfOrigin} />
            <SummaryRow label="Nationality" value={form.nationality} />
            <SummaryRow label="Contact address" value={form.contactAddress} />
            <SummaryRow label="Residential address" value={form.residentialAddress} />
            <SummaryRow label="Phone" value={form.phone} />
            <SummaryRow label="Blood group" value={form.bloodGroup} />
            <SummaryRow label="Genotype" value={form.genotype} />
          </div>
          {error && <div className="mb-3 p-3 rounded-xl text-sm" style={{ background: '#FEE2E2', color: '#991B1B' }}>{error}</div>}
          <div className="flex gap-3">
            <button onClick={() => setStage('form')} disabled={busy}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border border-mossline bg-white cursor-pointer disabled:opacity-50 text-ink">
              ← Go back and edit
            </button>
            <button onClick={submit} disabled={busy}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer disabled:opacity-50 bg-greenok">
              {busy ? 'Submitting…' : 'Yes, submit'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 lg:p-8 bg-bg">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs font-plexmono font-bold uppercase tracking-widest mb-1 text-ink">Welcome, {user?.name || 'Student'}</p>
        <h1 className="font-display font-semibold text-3xl mb-2 text-field">Complete your profile</h1>

        <div className="bg-white rounded-2xl p-5 mb-5 border border-mossline">
          <div className="text-xs font-bold uppercase tracking-wider mb-3 text-ink">Passport photo</div>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-bg" style={{ border: '2px dashed #C7D6C9' }}>
              {photoPreview ? <img src={photoPreview} alt="Passport" className="w-full h-full object-cover" /> : <Camera size={28} strokeWidth={1.5} className="text-text3" />}
            </div>
            <div className="flex-1">
              <label className="block cursor-pointer">
                <input type="file" accept=".jpg,.jpeg,.png" className="hidden" onChange={handlePhotoChange} disabled={photoUploading} />
                <div className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white text-center border-0 cursor-pointer ${photoUrl ? 'bg-greenok' : 'bg-ink'}`}
                  style={{ opacity: photoUploading ? 0.6 : 1 }}>
                  {photoUploading ? 'Uploading...' : photoUrl ? 'Photo uploaded' : 'Upload passport photo'}
                </div>
              </label>
              <p className="text-xs mt-1.5 text-text2">JPG or PNG. Will be compressed to under 200KB automatically.</p>
              {!photoUrl && <p className="text-xs mt-1 font-semibold" style={{ color: '#B8863B' }}>Required — upload before submitting</p>}
            </div>
          </div>
        </div>

        <p className="text-sm mb-1 text-text2">All fields are required. This is a one-time form.</p>
        <div className="flex items-start gap-2 text-xs mb-5 p-3 rounded-xl bg-goldbg" style={{ color: '#8a6218' }}>
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          <span>Once you submit, you cannot edit these details yourself. Only an admin can make changes later. Please fill carefully.</span>
        </div>

        <div className="bg-white rounded-2xl p-5 mb-4 space-y-4 border border-mossline">
          <Field label="Middle name" value={form.middleName} onChange={v => update('middleName', v)} placeholder="e.g. Adetola" />
          <Field label="Date of birth" type="date" value={form.dateOfBirth} onChange={v => update('dateOfBirth', v)} />
          <SelectField label="Gender" value={form.gender} onChange={v => update('gender', v)} options={['Male', 'Female']} />
          <SelectField label="Marital status" value={form.maritalStatus} onChange={v => update('maritalStatus', v)} options={['Single', 'Married', 'Divorced', 'Widowed']} />
          <Field label="Hometown" value={form.hometown} onChange={v => update('hometown', v)} placeholder="e.g. Iwo" />
          <Field label="Local government area" value={form.localGovernment} onChange={v => update('localGovernment', v)} placeholder="e.g. Iwo LGA" />
          <Field label="State of origin" value={form.stateOfOrigin} onChange={v => update('stateOfOrigin', v)} placeholder="e.g. Osun" />
          <Field label="Nationality" value={form.nationality} onChange={v => update('nationality', v)} placeholder="e.g. Nigerian" />
          <Field label="Contact address" value={form.contactAddress} onChange={v => update('contactAddress', v)} placeholder="Where letters can reach you" />
          <Field label="Residential address" value={form.residentialAddress} onChange={v => update('residentialAddress', v)} placeholder="Where you currently live" />
          <Field label="Phone number" type="tel" value={form.phone} onChange={v => update('phone', v)} placeholder="+234..." />
          <SelectField label="Blood group" value={form.bloodGroup} onChange={v => update('bloodGroup', v)} options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']} />
          <SelectField label="Genotype" value={form.genotype} onChange={v => update('genotype', v)} options={['AA', 'AS', 'SS', 'AC', 'SC']} />
        </div>

        {error && <div className="mb-3 p-3 rounded-xl text-sm" style={{ background: '#FEE2E2', color: '#991B1B' }}>{error}</div>}

        <div className="flex gap-3">
          <Link to="/dashboard" className="px-4 py-3 rounded-xl text-sm font-semibold border border-mossline bg-white text-center text-ink">Skip for now</Link>
          <button onClick={proceedToConfirm} disabled={busy}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer disabled:opacity-50 bg-ink">
            Review and submit
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <label className="block">
      <div className="text-xs font-semibold uppercase tracking-wide mb-1 text-text2">{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-mossline text-sm text-ink" />
    </label>
  )
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <label className="block">
      <div className="text-xs font-semibold uppercase tracking-wide mb-1 text-text2">{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-mossline text-sm bg-white text-ink">
        <option value="">— Select —</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </label>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b last:border-b-0" style={{ borderColor: '#F3F4F6' }}>
      <div className="text-xs uppercase tracking-wide text-text3">{label}</div>
      <div className="text-sm font-semibold text-right text-ink">{value}</div>
    </div>
  )
}
