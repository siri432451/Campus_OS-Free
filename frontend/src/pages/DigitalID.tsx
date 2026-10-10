import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import IDCard, { QRModal } from '../components/IDCard'
import { Skeleton } from '../components/Skeleton'

const API = (import.meta.env.VITE_API_URL as string | undefined) || ''
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('campusos_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}
// Compress image client-side before upload (keeps uploads small on campus wifi)
async function compressImg(file: File, maxDim = 600, quality = 0.8): Promise<Blob> {
  const img = document.createElement('img')
  const url = URL.createObjectURL(file)
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
  let { width, height } = img
  if (width > height && width > maxDim) { height = (height * maxDim) / width; width = maxDim }
  else if (height > maxDim) { width = (width * maxDim) / height; height = maxDim }
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
  URL.revokeObjectURL(url)
  return new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', quality))
}


interface MeData {
  id: string
  name: string
  role: string
  matricNo?: string
  staffId?: string
  department?: string
  level?: string
  photoUrl?: string
  qrCode?: string
  email?: string
  createdAt?: string
  // Biodata
  middleName?: string
  dateOfBirth?: string
  gender?: string
  maritalStatus?: string
  hometown?: string
  localGovernment?: string
  stateOfOrigin?: string
  nationality?: string
  contactAddress?: string
  residentialAddress?: string
  phone?: string
  bloodGroup?: string
  genotype?: string
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })
}

function hasBiodata(p: MeData): boolean {
  return !!(p.middleName || p.gender || p.bloodGroup || p.stateOfOrigin)
}

const ACADEMIC_YEAR = '2023/2024'

export default function DigitalID() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [meData, setMeData] = useState<MeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)

  const canUploadPhoto = ['STUDENT', 'LECTURER'].includes((meData ?? user as MeData | null)?.role ?? '')

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setUploadMsg(null)
    try {
      const blob = await compressImg(file)
      const fd = new FormData()
      fd.append('photo', blob, 'passport.jpg')
      const res = await fetch(`${API}/api/users/upload-photo`, { method: 'POST', headers: { ...authHeaders() }, body: fd })
      const data = await res.json()
      if (!res.ok) { setUploadMsg(data.error || 'Upload failed'); return }
      // Update the card instantly with cache-bust
      setMeData(prev => prev ? { ...prev, photoUrl: `${data.photoUrl}?t=${Date.now()}` } : prev)
      setUploadMsg('Passport photo updated ✓')
    } catch { setUploadMsg('Upload failed — try a smaller image') }
    finally { setUploading(false) }
  }


  useEffect(() => {
    let cancelled = false
    api.get<MeData>('/api/auth/me')
      .then(r => { if (!cancelled) { setMeData(r.data); setLoading(false) } })
      .catch(() => {
        if (!cancelled) {
          // Fall back to cached user from auth context
          if (user) setMeData(user as MeData)
          else setError(true)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [user])

  const profile = meData ?? (user as MeData | null)
  const qrValue = profile?.qrCode ?? profile?.matricNo ?? profile?.staffId ?? 'CAMPUSOS'

  const PhotoUploadCard = canUploadPhoto ? (
    <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ background: '#E3EFE7' }}>
          {profile?.photoUrl
            ? <img src={profile.photoUrl.startsWith('http') ? profile.photoUrl : `${API}${profile.photoUrl}`} alt="" className="w-full h-full object-cover" />
            : <span className="text-xl">📷</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm" style={{ color: '#1B4332' }}>Passport Photograph</p>
          <p className="text-xs" style={{ color: '#8A9BB0' }}>
            {profile?.photoUrl ? 'Tap to change your photo' : 'Upload a clear passport photo'}
          </p>
        </div>
        <label className="px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer flex-shrink-0"
          style={{ background: uploading ? '#2D6A4F' : '#122400', opacity: uploading ? 0.7 : 1 }}>
          {uploading ? 'Uploading…' : profile?.photoUrl ? 'Change' : 'Upload'}
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handlePhotoUpload} />
        </label>
      </div>
      {uploadMsg && (
        <p className="text-xs font-semibold mt-2" style={{ color: uploadMsg.includes('✓') ? '#065F46' : '#DC2626' }}>{uploadMsg}</p>
      )}
    </div>
  ) : null

  const LoadingSkeleton = (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-40 mb-6" />
      <div className="rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(145deg,#1B4332,#122400)', padding: 24 }}>
        <Skeleton className="h-4 w-40 mb-5" style={{ background: 'rgba(255,255,255,0.2)' }} />
        <div className="flex gap-4 mb-5">
          <Skeleton className="w-16 h-16 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }} />
          <div className="flex-1">
            <Skeleton className="h-5 w-36 mb-2" style={{ background: 'rgba(255,255,255,0.2)' }} />
            <Skeleton className="h-3 w-24 mb-1" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <Skeleton className="h-3 w-32" style={{ background: 'rgba(255,255,255,0.1)' }} />
          </div>
        </div>
        <Skeleton className="h-px w-full mb-5" style={{ background: 'rgba(255,255,255,0.15)' }} />
        <div className="flex justify-between">
          <Skeleton className="h-16 w-28" style={{ background: 'rgba(255,255,255,0.15)' }} />
          <Skeleton className="h-20 w-20 rounded-xl" style={{ background: 'rgba(255,255,255,0.2)' }} />
        </div>
      </div>
    </div>
  )

  // ── Mobile ────────────────────────────────────────────────
  const MobileContent = (
    <div className="h-full flex flex-col" style={{ background: '#F5F7FA' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#1B4332,#122400)', padding: '52px 24px 20px' }}>
        <button onClick={() => navigate('/dashboard')}
          className="border-0 bg-transparent cursor-pointer mb-3 text-sm font-medium"
          style={{ color: 'rgba(255,255,255,0.7)', padding: 0 }}>← Back</button>
        <h1 className="font-black text-2xl text-white">Digital ID Card</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>Your official student identity</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? LoadingSkeleton : error && !profile ? (
          <div className="text-center py-16 px-6">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="font-bold mb-1" style={{ color: '#1B4332' }}>Could not load ID</p>
            <p className="text-sm mb-4" style={{ color: '#8A9BB0' }}>Check your connection</p>
            <button onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl text-white font-bold border-0 cursor-pointer"
              style={{ background: '#122400' }}>Retry</button>
          </div>
        ) : profile ? (
          <div className="p-6 pb-24 space-y-5">
            <IDCard
              name={profile.name}
              role={profile.role}
              matricNo={profile.matricNo}
              staffId={profile.staffId}
              department={profile.department}
              level={profile.level}
              qrCode={qrValue}
              photoUrl={profile.photoUrl}
              academicYear={ACADEMIC_YEAR}
              onQRClick={() => setShowQR(true)}
            />

            <p className="text-center text-xs" style={{ color: '#8A9BB0' }}>
              Tap the QR code to enlarge for scanning
            </p>

            {PhotoUploadCard}

            {/* Download / share button */}
            <button
              onClick={() => setShowQR(true)}
              className="w-full py-4 rounded-2xl font-bold text-white border-0 cursor-pointer transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)', boxShadow: '0 8px 24px rgba(27,67,50,0.35)' }}>
              🔍 Enlarge QR Code
            </button>

            {/* Info rows */}
            <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              {[
                { label: 'Full Name', value: profile.name },
                { label: profile.matricNo ? 'Matric Number' : 'Staff ID', value: profile.matricNo ?? profile.staffId ?? '—' },
                { label: 'Department', value: profile.department ?? '—' },
                { label: 'Academic Year', value: ACADEMIC_YEAR },
                { label: 'Status', value: 'Active ✓' },
              ].map((row, i) => (
                <div key={i} className="px-5 py-3.5 border-b border-gray-100 last:border-0 flex justify-between items-center">
                  <span className="text-xs font-medium" style={{ color: '#8A9BB0' }}>{row.label}</span>
                  <span className="text-sm font-bold" style={{ color: '#1B4332' }}>{row.value}</span>
                </div>
              ))}
            </div>

            {hasBiodata(profile) ? (
              <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="font-black text-sm" style={{ color: '#1B4332' }}>Personal Information</h3>
                </div>
                {[
                  { label: 'Middle Name',         value: profile.middleName ?? '—' },
                  { label: 'Date of Birth',       value: formatDate(profile.dateOfBirth) },
                  { label: 'Gender',              value: profile.gender ?? '—' },
                  { label: 'Marital Status',      value: profile.maritalStatus ?? '—' },
                  { label: 'Phone',               value: profile.phone ?? '—' },
                  { label: 'Hometown',            value: profile.hometown ?? '—' },
                  { label: 'Local Government',    value: profile.localGovernment ?? '—' },
                  { label: 'State of Origin',     value: profile.stateOfOrigin ?? '—' },
                  { label: 'Nationality',         value: profile.nationality ?? '—' },
                  { label: 'Contact Address',     value: profile.contactAddress ?? '—' },
                  { label: 'Residential Address', value: profile.residentialAddress ?? '—' },
                  { label: 'Blood Group',         value: profile.bloodGroup ?? '—' },
                  { label: 'Genotype',            value: profile.genotype ?? '—' },
                ].map((row, i) => (
                  <div key={i} className="px-5 py-3.5 border-b border-gray-100 last:border-0 flex justify-between items-center gap-3">
                    <span className="text-xs font-medium flex-shrink-0" style={{ color: '#8A9BB0' }}>{row.label}</span>
                    <span className="text-sm font-bold text-right" style={{ color: '#1B4332' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-amber-50 rounded-2xl p-4 text-center" style={{ border: '1px solid #FCD34D' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: '#92400E' }}>Profile incomplete</p>
                <p className="text-xs" style={{ color: '#92400E' }}>Complete your biodata in onboarding to see your full personal info here.</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )

  // ── Desktop ───────────────────────────────────────────────
  const DesktopContent = (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-8 py-4"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div className="max-w-4xl mx-auto">
          <h1 className="font-black text-2xl" style={{ color: '#1B4332' }}>Digital ID Card</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8A9BB0' }}>Your official institution identity</p>
        </div>
      </div>

      <div className="px-8 py-10 max-w-4xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-2 gap-8">
            <Skeleton className="h-96 rounded-3xl" />
            <div className="space-y-4">
              {[0,1,2,3,4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          </div>
        ) : error && !profile ? (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">⚠️</p>
            <p className="font-black text-xl mb-2" style={{ color: '#1B4332' }}>Could not load ID</p>
            <button onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-xl text-white font-bold border-0 cursor-pointer"
              style={{ background: '#122400' }}>Retry</button>
          </div>
        ) : profile ? (
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            {/* Left: ID Card */}
            <div className="space-y-4">
              <IDCard
                name={profile.name}
                role={profile.role}
                matricNo={profile.matricNo}
                staffId={profile.staffId}
                department={profile.department}
                level={profile.level}
                qrCode={qrValue}
                photoUrl={profile.photoUrl}
                academicYear={ACADEMIC_YEAR}
                onQRClick={() => setShowQR(true)}
              />
              <button onClick={() => setShowQR(true)}
                className="w-full py-3.5 rounded-2xl font-bold text-white border-0 cursor-pointer transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)', boxShadow: '0 6px 20px rgba(27,67,50,0.35)' }}>
                🔍 Enlarge QR for Scanning
              </button>
              {PhotoUploadCard}
            </div>

            {/* Right: Details */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-black text-base" style={{ color: '#1B4332' }}>ID Details</h2>
                </div>
                {[
                  { label: 'Full Name', value: profile.name },
                  { label: profile.matricNo ? 'Matric Number' : 'Staff ID', value: profile.matricNo ?? profile.staffId ?? '—' },
                  { label: 'Role', value: profile.role },
                  { label: 'Department', value: profile.department ?? '—' },
                  { label: 'Academic Year', value: ACADEMIC_YEAR },
                  { label: 'Status', value: '● Active' },
                ].map((row, i) => (
                  <div key={i} className="px-6 py-4 border-b border-gray-100 last:border-0 flex justify-between items-center">
                    <span className="text-sm font-medium" style={{ color: '#8A9BB0' }}>{row.label}</span>
                    <span className="text-sm font-bold" style={{ color: row.label === 'Status' ? '#27AE60' : '#1B4332' }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {hasBiodata(profile) ? (
                <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="font-black text-base" style={{ color: '#1B4332' }}>Personal Information</h2>
                  </div>
                  {[
                    { label: 'Middle Name',         value: profile.middleName ?? '—' },
                    { label: 'Date of Birth',       value: formatDate(profile.dateOfBirth) },
                    { label: 'Gender',              value: profile.gender ?? '—' },
                    { label: 'Marital Status',      value: profile.maritalStatus ?? '—' },
                    { label: 'Phone',               value: profile.phone ?? '—' },
                    { label: 'Hometown',            value: profile.hometown ?? '—' },
                    { label: 'Local Government',    value: profile.localGovernment ?? '—' },
                    { label: 'State of Origin',     value: profile.stateOfOrigin ?? '—' },
                    { label: 'Nationality',         value: profile.nationality ?? '—' },
                    { label: 'Contact Address',     value: profile.contactAddress ?? '—' },
                    { label: 'Residential Address', value: profile.residentialAddress ?? '—' },
                    { label: 'Blood Group',         value: profile.bloodGroup ?? '—' },
                    { label: 'Genotype',            value: profile.genotype ?? '—' },
                  ].map((row, i) => (
                    <div key={i} className="px-6 py-4 border-b border-gray-100 last:border-0 flex justify-between items-center gap-3">
                      <span className="text-sm font-medium flex-shrink-0" style={{ color: '#8A9BB0' }}>{row.label}</span>
                      <span className="text-sm font-bold text-right" style={{ color: '#1B4332' }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-amber-50 rounded-2xl p-4 text-center" style={{ border: '1px solid #FCD34D' }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#92400E' }}>Profile incomplete</p>
                  <p className="text-xs" style={{ color: '#92400E' }}>Complete your biodata in onboarding to see your full personal info here.</p>
                </div>
              )}

              {/* Usage instructions */}
              <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <h3 className="font-bold text-sm mb-3" style={{ color: '#1B4332' }}>Where to use your QR Code</h3>
                {[
                  { icon: '🚪', title: 'Campus Access', desc: 'Scan at entry gates and restricted areas' },
                  { icon: '📝', title: 'Exam Attendance', desc: 'Show to invigilator for verification' },
                  { icon: '🖨️', title: 'Print Station', desc: 'Authenticate at the printing kiosk' },
                  { icon: '📚', title: 'Library Access', desc: 'Check out physical books and resources' },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#1B4332' }}>{item.title}</p>
                      <p className="text-xs" style={{ color: '#8A9BB0' }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )

  return (
    <>
      <div className="lg:hidden h-full">{MobileContent}</div>
      <div className="hidden lg:block">{DesktopContent}</div>

      {showQR && profile && (
        <QRModal
          value={qrValue}
          label={profile.matricNo ?? profile.staffId}
          onClose={() => setShowQR(false)}
        />
      )}
    </>
  )
}
