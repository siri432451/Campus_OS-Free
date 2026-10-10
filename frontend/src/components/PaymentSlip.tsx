import { useEffect } from 'react'

const API = (import.meta.env.VITE_API_URL as string | undefined) || ''

type SlipProps = {
  submission: {
    id: string
    student_name: string
    student_matric: string
    student_photo: string | null
    department: string | null
    level: string | null
    academic_year: string
    semester: string
    payment_categories: string[]
    admin_note: string | null
    reviewed_by_name: string | null
    reviewed_at: string | null
  }
  onClose: () => void
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function generateRef(id: string): string {
  return 'COSN-' + id.slice(-8).toUpperCase()
}

export default function PaymentSlip({ submission, onClose }: SlipProps) {
  useEffect(() => {
    setTimeout(() => window.print(), 500)
  }, [])

  const ref = generateRef(submission.id)

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #exam-slip, #exam-slip * { visibility: visible !important; }
          #exam-slip { position: fixed !important; left: 0 !important; top: 0 !important; width: 100% !important; }
          #close-btn { display: none !important; }
        }
        @keyframes fadeIn { from{opacity:0;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }
      `}</style>

      {/* Backdrop */}
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}>
        <div id="exam-slip"
          onClick={e => e.stopPropagation()}
          style={{
            background: '#fff',
            width: '100%',
            maxWidth: 480,
            borderRadius: 4,
            padding: 0,
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
            animation: 'fadeIn 0.3s ease',
            fontFamily: 'Georgia, serif',
            overflow: 'hidden',
          }}>

          {/* Header band */}
          <div style={{
            background: 'linear-gradient(135deg, #1B4332, #122400)',
            padding: '20px 24px 16px',
            textAlign: 'center',
            position: 'relative',
          }}>
            {/* Watermark circles */}
            <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)' }} />
            <div style={{ position: 'absolute', top: -10, right: -10, width: 80, height: 80, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)' }} />

            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>
              Federal Republic of Nigeria
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.2, marginBottom: 2 }}>
              Osun State College of Nursing Sciences
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', letterSpacing: 1 }}>
              CampusOS Student Portal
            </div>
          </div>

          {/* Slip title */}
          <div style={{
            background: '#D4A24C',
            padding: '8px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase' }}>
              Payment Confirmation Slip
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '20px 24px' }}>
            {/* Student section */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-start' }}>
              {/* Photo */}
              <div style={{
                width: 80, height: 90,
                border: '3px solid #1B4332',
                borderRadius: 4,
                overflow: 'hidden',
                flexShrink: 0,
                background: '#F5F7FA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {submission.student_photo
                  ? <img src={`${API}${submission.student_photo}`} alt="Student"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 32 }}>👤</span>
                }
              </div>

              {/* Details */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#1B4332', marginBottom: 4 }}>
                  {submission.student_name}
                </div>
                <table style={{ fontSize: 12, color: '#444', borderCollapse: 'collapse', width: '100%' }}>
                  <tbody>
                    <tr>
                      <td style={{ paddingBottom: 3, color: '#888', width: 90 }}>Matric No:</td>
                      <td style={{ fontWeight: 700, color: '#1B4332', fontFamily: 'monospace' }}>{submission.student_matric || '—'}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingBottom: 3, color: '#888' }}>Department:</td>
                      <td style={{ fontWeight: 600 }}>{submission.department || '—'}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingBottom: 3, color: '#888' }}>Level:</td>
                      <td style={{ fontWeight: 600 }}>{submission.level || '—'}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingBottom: 3, color: '#888' }}>Session:</td>
                      <td style={{ fontWeight: 600 }}>{submission.academic_year} · {submission.semester}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1.5px solid #E5E7EB', marginBottom: 16 }} />

            {/* Payment categories */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Payment Categories
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {submission.payment_categories.map((cat, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontSize: 12,
                    color: '#065F46',
                    fontWeight: 600,
                  }}>
                    <span style={{ color: '#065F46' }}>✓</span> {cat}
                  </div>
                ))}
              </div>
            </div>

            {/* Admin note */}
            {submission.admin_note && (
              <div style={{
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderRadius: 6,
                padding: '8px 12px',
                marginBottom: 16,
                fontSize: 12,
                color: '#92400E',
              }}>
                <span style={{ fontWeight: 700 }}>Admin Note: </span>
                {submission.admin_note}
              </div>
            )}

            {/* Approval details */}
            <div style={{
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: 6,
              padding: '10px 14px',
              marginBottom: 16,
              fontSize: 12,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#888' }}>Status:</span>
                <span style={{ fontWeight: 800, color: '#065F46' }}>✓ APPROVED</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#888' }}>Approved by:</span>
                <span style={{ fontWeight: 600, color: '#1B4332' }}>{submission.reviewed_by_name || 'Admin'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#888' }}>Date:</span>
                <span style={{ fontWeight: 600 }}>{formatDate(submission.reviewed_at)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888' }}>Reference:</span>
                <span style={{ fontWeight: 800, color: '#122400', fontFamily: 'monospace' }}>{ref}</span>
              </div>
            </div>

            {/* Official stamp */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <div style={{
                width: 90, height: 90,
                borderRadius: '50%',
                border: '3px double #1B4332',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: 8,
                position: 'relative',
              }}>
                <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', border: '1px solid #1B4332', opacity: 0.3 }} />
                <div style={{ fontSize: 7, fontWeight: 900, color: '#1B4332', textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1.3 }}>
                  Osun State<br/>College of<br/>Nursing<br/>Sciences
                </div>
                <div style={{ fontSize: 8, color: '#122400', fontWeight: 700, marginTop: 2 }}>OFFICIAL</div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              borderTop: '1px dashed #E5E7EB',
              paddingTop: 12,
              textAlign: 'center',
              fontSize: 11,
              color: '#888',
              lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 700, color: '#E63946', marginBottom: 4 }}>
                ⚠️ Present this slip at the examination hall. No slip, no entry.
              </div>
              <div>This slip is valid for {submission.academic_year} {submission.semester} only.</div>
              <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 10, color: '#bbb' }}>
                Ref: {ref} · Generated by CampusOS
              </div>
            </div>
          </div>
        </div>

        {/* Close + Print buttons */}
        <div id="close-btn" style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8 }}>
          <button onClick={() => window.print()}
            style={{ background: '#1B4332', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            🖨️ Print
          </button>
          <button onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            ✕ Close
          </button>
        </div>
      </div>
    </>
  )
}
