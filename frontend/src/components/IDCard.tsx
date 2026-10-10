import QRCode from 'react-qr-code'

interface IDCardProps {
  name: string
  role: string
  matricNo?: string | null
  staffId?: string | null
  department?: string | null
  level?: string | null
  qrCode?: string | null
  photoUrl?: string | null
  institution?: string
  academicYear?: string
  onQRClick?: () => void
}

const LEVEL_LABEL: Record<string, string> = {
  ND1: 'ND1', ND2: 'ND2', ND3: 'ND3', HND1: 'HND1', HND2: 'HND2',
  // keep old values in case DB hasn't migrated yet
  L100: '100 Level', L200: '200 Level', L300: '300 Level', L400: '400 Level', L500: '500 Level'
}

const ROLE_LABEL: Record<string, string> = {
  STUDENT:        'Student',
  LECTURER:       'Lecturer',
  SCHOOL_ADMIN:   'Administrator',
  SUPER_ADMIN:    'System Admin',
  PRINT_OPERATOR: 'Print Operator',
}

function InitialsAvatar({ name, size = 64 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="flex items-center justify-center font-black text-white flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'rgba(255,255,255,0.18)',
        border: '3px solid rgba(255,255,255,0.35)',
        fontSize: size * 0.3
      }}>
      {initials}
    </div>
  )
}

export default function IDCard({
  name, role, matricNo, staffId, department, level,
  qrCode, photoUrl,
  institution = 'College of Nursing Sciences, Osogbo',
  academicYear = '2023/2024',
  onQRClick
}: IDCardProps) {
  const identifier  = matricNo ?? staffId ?? '—'
  const roleLabel   = ROLE_LABEL[role] ?? role
  const levelLabel  = level ? (LEVEL_LABEL[level] ?? level) : null
  const qrValue     = qrCode ?? identifier

  return (
    <div className="w-full rounded-3xl overflow-hidden relative"
      style={{ background: 'linear-gradient(145deg, #1B4332 0%, #122400 100%)', boxShadow: '0 24px 64px rgba(27,67,50,0.45)' }}>

      {/* Decorative circles */}
      {[180, 130, 90].map((s, i) => (
        <div key={i} className="absolute rounded-full pointer-events-none"
          style={{ width: s, height: s, top: -s * 0.25, right: -s * 0.25, border: `2px solid rgba(255,255,255,${0.06 + i * 0.02})` }} />
      ))}

      <div className="relative z-10 p-6">
        {/* Institution header */}
        <div className="text-[10px] font-bold tracking-[1.5px] uppercase mb-5 leading-tight"
          style={{ color: 'rgba(255,255,255,0.55)' }}>
          {institution}
        </div>

        {/* Avatar + info */}
        <div className="flex items-center gap-4 mb-5">
          {photoUrl
            ? <img src={photoUrl} alt={name} className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                style={{ border: '3px solid rgba(255,255,255,0.35)' }} />
            : <InitialsAvatar name={name} size={64} />
          }
          <div className="min-w-0">
            <div className="font-black text-xl text-white leading-tight truncate">{name}</div>
            <div className="text-xs mt-1 font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {identifier}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {department}{levelLabel ? ` · ${levelLabel}` : ''}
            </div>
          </div>
        </div>

        <div className="h-px mb-5" style={{ background: 'rgba(255,255,255,0.15)' }} />

        {/* Bottom row */}
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <div>
              <div className="text-[10px] mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Role</div>
              <div className="text-sm font-bold text-white">{roleLabel}</div>
            </div>
            <div>
              <div className="text-[10px] mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Academic Year</div>
              <div className="text-sm font-bold text-white">{academicYear}</div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: 'rgba(39,174,96,0.25)', color: '#4ade80' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              Active
            </div>
          </div>

          {/* QR Code */}
          <button onClick={onQRClick}
            className="flex-shrink-0 p-2 rounded-xl bg-white cursor-pointer hover:scale-105 transition-transform active:scale-95 border-0"
            title="Tap to enlarge QR code">
            <QRCode value={qrValue} size={72} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Large QR modal ────────────────────────────────────────────
interface QRModalProps {
  value: string
  label?: string
  onClose: () => void
}

export function QRModal({ value, label, onClose }: QRModalProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl p-8 flex flex-col items-center gap-5"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}>
        <div className="font-black text-base" style={{ color: '#1B4332' }}>Scan to verify</div>
        <div className="p-4 rounded-2xl" style={{ background: '#F5F7FA' }}>
          <QRCode value={value} size={220} />
        </div>
        {label && (
          <div className="text-sm font-mono font-bold tracking-wider" style={{ color: '#122400' }}>
            {label}
          </div>
        )}
        <p className="text-xs text-center" style={{ color: '#8A9BB0' }}>
          Show this at the gate, exam hall, or print station
        </p>
        <button onClick={onClose}
          className="px-8 py-3 rounded-2xl font-bold text-sm text-white border-0 cursor-pointer"
          style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)' }}>
          Close
        </button>
      </div>
    </div>
  )
}
