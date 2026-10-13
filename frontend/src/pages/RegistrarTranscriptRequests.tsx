import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, FileText, Receipt } from 'lucide-react'
import api from '../api/client'

interface RequestRow {
  id: string
  trackingCode: string
  status: string
  applicantName: string
  matricNo: string | null
  delivery: string
  institutionName: string | null
  feeAmount: number
  createdAt: string
  studentId: string | null
  transcriptNo: string | null
}

interface RequestDetail extends RequestRow {
  entryYear: string | null
  completionYear: string | null
  email: string
  phone: string
  purpose: string | null
  institutionLocation: string | null
  institutionEmail: string | null
  note: string | null
  receiptMime: string | null
  rejectionReason: string | null
  registrarNote: string | null
  verifyCode: string | null
  issuedAt: string | null
  sentAt: string | null
  emailStatus: string | null
  emailTo: string | null
  emailSentAt: string | null
  emailError: string | null
}

interface StudentLite {
  id: string
  name: string
  matricNo: string | null
  level: string | null
  department: string | null
}

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: 'Received', UNDER_REVIEW: 'Under review', AWAITING_RECORDS: 'Preparing records',
  APPROVED: 'Approved', SENT: 'Sent', REJECTED: 'Not approved',
}
const STATUS_COLOR: Record<string, string> = {
  RECEIVED: '#B45309', UNDER_REVIEW: '#1D4ED8', AWAITING_RECORDS: '#7C3AED',
  APPROVED: '#1B4332', SENT: '#1B4332', REJECTED: '#B42318',
}
const FILTERS = ['', 'RECEIVED', 'UNDER_REVIEW', 'AWAITING_RECORDS', 'APPROVED', 'SENT', 'REJECTED']

const naira = (n: number) => `\u20A6${n.toLocaleString('en-NG')}`
const dateText = (s: string) => new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })

function errText(e: unknown): string {
  const anyE = e as { response?: { data?: { error?: string } } }
  return anyE?.response?.data?.error || 'Something went wrong. Please try again.'
}

async function blobErrText(e: unknown): Promise<string> {
  const anyE = e as { response?: { data?: Blob } }
  try {
    const text = await anyE?.response?.data?.text()
    if (text) return JSON.parse(text).error || 'Could not open the file.'
  } catch { /* fall through */ }
  return 'Could not open the file.'
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[10px] font-plexmono uppercase tracking-wide text-text2">{label}</div>
      <div className="text-sm text-ink break-words">{value || '\u2014'}</div>
    </div>
  )
}

export default function RegistrarTranscriptRequestsPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('')
  const [rows, setRows] = useState<RequestRow[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<RequestDetail | null>(null)
  const [student, setStudent] = useState<StudentLite | null>(null)
  const [recorded, setRecorded] = useState(0)
  const [suggestions, setSuggestions] = useState<StudentLite[]>([])
  const [q, setQ] = useState('')
  const [found, setFound] = useState<StudentLite[]>([])
  const [reason, setReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [altEmail, setAltEmail] = useState('')
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState('')

  const say = (ok: boolean, text: string) => { setFlash({ ok, text }); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const loadList = useCallback(async () => {
    try {
      const r = await api.get('/api/registrar/transcripts/requests', { params: filter ? { status: filter } : {} })
      setRows(r.data.requests)
      setCounts(r.data.counts)
    } catch (e) { say(false, errText(e)) }
  }, [filter])

  useEffect(() => { loadList() }, [loadList])

  const openRequest = async (id: string) => {
    setBusy('open')
    try {
      const r = await api.get(`/api/registrar/transcripts/requests/${id}`)
      setOpenId(id)
      setDetail(r.data.request)
      setStudent(r.data.student)
      setRecorded(r.data.recordedCourses)
      setRejecting(false)
      setReason('')
      setAltEmail('')
      setQ('')
      setFound([])
      setSuggestions([])
      if (!r.data.student) {
        try {
          const s = await api.get(`/api/registrar/transcripts/requests/${id}/suggest`)
          setSuggestions(s.data.students)
        } catch { /* suggestions are optional */ }
      }
    } catch (e) { say(false, errText(e)) }
    setBusy('')
  }

  const refresh = async () => {
    if (openId) await openRequest(openId)
    await loadList()
  }

  const act = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key)
    try {
      const msg = await fn()
      if (msg) say(true, msg)
      await refresh()
    } catch (e) { say(false, errText(e)) }
    setBusy('')
  }

  const searchStudents = async () => {
    try {
      const r = await api.get('/api/registrar/students', { params: { q } })
      setFound(r.data.students)
    } catch (e) { say(false, errText(e)) }
  }

  const matchStudent = (s: StudentLite) => act('match', async () => {
    await api.post(`/api/registrar/transcripts/requests/${openId}/match`, { studentId: s.id })
    return 'Matched to the student record.'
  })

  const setStatus = (status: string) => act(status, async () => {
    await api.post(`/api/registrar/transcripts/requests/${openId}/status`, { status })
    return 'Status updated.'
  })

  const reject = () => act('reject', async () => {
    await api.post(`/api/registrar/transcripts/requests/${openId}/reject`, { reason })
    setRejecting(false)
    return 'Request rejected.'
  })

  const approve = () => {
    if (!window.confirm('Issue the official transcript now? The scores as they are today will be locked into it.')) return
    act('approve', async () => {
      const r = await api.post(`/api/registrar/transcripts/requests/${openId}/approve`)
      return r.data.emailed
        ? `Transcript ${r.data.transcriptNo} issued and emailed to ${r.data.emailTo}.`
        : `Transcript ${r.data.transcriptNo} issued, but the email was NOT sent: ${r.data.emailError || 'unknown error'}`
    })
  }

  const sendEmail = () => act('email', async () => {
    const r = await api.post(`/api/registrar/transcripts/requests/${openId}/send-email`, { to: altEmail.trim() || undefined })
    setAltEmail('')
    return r.data.ok ? `Emailed to ${r.data.to}.` : `Email not sent: ${r.data.error || 'unknown error'}`
  })

  const markSent = () => act('sent', async () => {
    await api.post(`/api/registrar/transcripts/requests/${openId}/mark-sent`)
    return 'Marked as sent.'
  })

  const openFile = async (kind: 'receipt' | 'pdf') => {
    setBusy(kind)
    const tab = window.open('', '_blank')
    try {
      const r = await api.get(`/api/registrar/transcripts/requests/${openId}/${kind}`, { responseType: 'blob' })
      const url = URL.createObjectURL(r.data as Blob)
      if (tab) tab.location.href = url
      else window.location.href = url
    } catch (e) {
      if (tab) tab.close()
      say(false, await blobErrText(e))
    }
    setBusy('')
  }

  const issued = !!detail?.transcriptNo
  const final = detail?.status === 'REJECTED' || detail?.status === 'SENT'

  return (
    <div className="bg-bg" style={{ minHeight: '100%' }}>
      <div style={{ background: 'linear-gradient(180deg,#1B4332,#122400)' }} className="px-4 pt-6 pb-5 lg:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <div className="text-[12px] font-plexmono uppercase tracking-widest" style={{ color: '#BFE0C8' }}>Registrar's office</div>
            <h1 className="font-display font-semibold text-white leading-tight mt-1" style={{ fontSize: 28 }}>Transcript requests</h1>
            <p className="text-sm" style={{ color: '#CFE0D2' }}>Review payments, match records and issue transcripts</p>
          </div>
          <button onClick={() => navigate('/registrar/transcripts')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border-0 cursor-pointer flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            <ArrowLeft size={15} strokeWidth={2} /> Transcripts
          </button>
        </div>
      </div>

      <div className="px-4 pt-6 pb-24 lg:p-8 lg:pb-8 max-w-5xl mx-auto">
        {flash && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${flash.ok ? 'bg-moss text-ink' : 'bg-red-50 text-red-600'}`}>{flash.text}</div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map(f => (
            <button key={f || 'all'} onClick={() => { setFilter(f); setOpenId(null); setDetail(null) }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer"
              style={{
                border: '1px solid #D6E2D8',
                background: filter === f ? '#1B4332' : '#fff',
                color: filter === f ? '#fff' : '#1B2A22',
              }}>
              {f ? STATUS_LABEL[f] : 'All'}{f && counts[f] ? ` (${counts[f]})` : ''}
            </button>
          ))}
        </div>

        {/* List */}
        {!detail && (
          <div className="bg-white rounded-2xl border border-mossline">
            {rows.length === 0 && <div className="p-5 text-sm text-text2">No requests here yet.</div>}
            {rows.map(r => (
              <button key={r.id} onClick={() => openRequest(r.id)}
                className="w-full text-left px-4 py-3 border-0 border-b border-mossline bg-transparent cursor-pointer flex items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold text-ink text-sm">{r.applicantName}</span>
                  <span className="block text-xs text-text2">
                    {r.trackingCode} · {r.delivery === 'INSTITUTION' ? `To ${r.institutionName || 'institution'}` : 'To applicant'} · {naira(r.feeAmount)} · {dateText(r.createdAt)}
                  </span>
                </span>
                <span className="text-xs font-semibold flex-shrink-0" style={{ color: STATUS_COLOR[r.status] || '#1B2A22' }}>
                  {STATUS_LABEL[r.status] || r.status}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Detail */}
        {detail && (
          <div>
            <button onClick={() => { setDetail(null); setOpenId(null) }}
              className="mb-3 px-3 py-2 rounded-xl text-sm font-semibold border border-mossline bg-white cursor-pointer text-ink">
              {'\u2190'} All requests
            </button>

            <div className="bg-white rounded-2xl border border-mossline p-4 mb-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="font-display font-semibold text-ink text-xl">{detail.applicantName}</div>
                  <div className="text-xs text-text2 font-plexmono">{detail.trackingCode} · requested {dateText(detail.createdAt)}</div>
                </div>
                <div className="text-sm font-semibold" style={{ color: STATUS_COLOR[detail.status] || '#1B2A22' }}>
                  {STATUS_LABEL[detail.status] || detail.status}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Info label="Matric number given" value={detail.matricNo} />
                <Info label="Entered" value={detail.entryYear} />
                <Info label="Completed" value={detail.completionYear} />
                <Info label="Email" value={detail.email} />
                <Info label="Phone" value={detail.phone} />
                <Info label="Purpose" value={detail.purpose} />
                <Info label="Fee" value={naira(detail.feeAmount)} />
                <Info label="Delivery" value={detail.delivery === 'INSTITUTION' ? 'To another institution' : 'To the applicant'} />
                {detail.delivery === 'INSTITUTION' && <Info label="Institution" value={detail.institutionName} />}
                {detail.delivery === 'INSTITUTION' && <Info label="Location" value={detail.institutionLocation} />}
                {detail.delivery === 'INSTITUTION' && <Info label="Institution email" value={detail.institutionEmail} />}
              </div>
              {detail.note && <div className="mt-3 p-3 rounded-xl bg-moss text-sm text-ink">Note: {detail.note}</div>}
              {detail.rejectionReason && detail.status === 'REJECTED' && (
                <div className="mt-3 p-3 rounded-xl bg-red-50 text-sm text-red-600">Rejected: {detail.rejectionReason}</div>
              )}
              <button onClick={() => openFile('receipt')} disabled={busy === 'receipt'}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-mossline bg-white cursor-pointer text-ink disabled:opacity-60">
                <Receipt size={15} /> {busy === 'receipt' ? 'Opening…' : 'View payment receipt'}
              </button>
            </div>

            {/* Student record */}
            <div className="bg-white rounded-2xl border border-mossline p-4 mb-4">
              <div className="font-semibold text-ink text-sm mb-2">Student record</div>
              {student ? (
                <div>
                  <div className="text-sm text-ink">
                    <b>{student.name}</b> · <span className="font-plexmono text-xs">{student.matricNo || 'no matric number'}</span>
                  </div>
                  <div className="text-xs text-text2 mt-1">{recorded} course scores on record</div>
                  <button onClick={() => navigate(`/registrar/transcripts?student=${student.id}`)}
                    className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-mossline bg-white cursor-pointer text-ink">
                    <FileText size={15} /> Open scores in Transcripts
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-text2 mb-2">Pick the matching record, or search for it. Alumni must first be added as students.</p>
                  {suggestions.map(s => (
                    <button key={s.id} onClick={() => matchStudent(s)}
                      className="w-full text-left px-3 py-2 mb-1 rounded-xl border border-mossline bg-white cursor-pointer text-sm text-ink">
                      <b>{s.name}</b> <span className="text-xs text-text2 font-plexmono">{s.matricNo || ''} {s.level || ''}</span>
                    </button>
                  ))}
                  <div className="flex gap-2 mt-2">
                    <div className="flex-1 flex items-center gap-2 px-3 rounded-xl border border-mossline">
                      <Search size={14} className="text-text3" />
                      <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') searchStudents() }}
                        placeholder="Search by name or matric number"
                        className="flex-1 py-2 text-sm border-0 outline-none text-ink bg-transparent" />
                    </div>
                    <button onClick={searchStudents} className="px-4 py-2 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer bg-field">Search</button>
                  </div>
                  {found.map(s => (
                    <button key={s.id} onClick={() => matchStudent(s)}
                      className="w-full text-left px-3 py-2 mt-1 rounded-xl border border-mossline bg-white cursor-pointer text-sm text-ink">
                      <b>{s.name}</b> <span className="text-xs text-text2 font-plexmono">{s.matricNo || ''} {s.level || ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="bg-white rounded-2xl border border-mossline p-4">
              <div className="font-semibold text-ink text-sm mb-3">Actions</div>

              {issued && (
                <div className="mb-3 p-3 rounded-xl bg-moss text-sm text-ink">
                  Issued as <b className="font-plexmono">{detail.transcriptNo}</b>
                  {detail.issuedAt ? ` on ${dateText(detail.issuedAt)}` : ''}.
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {!issued && !final && (
                  <>
                    <button onClick={() => setStatus('UNDER_REVIEW')} disabled={!!busy}
                      className="px-4 py-2 rounded-xl text-sm font-semibold border border-mossline bg-white cursor-pointer text-ink disabled:opacity-60">Mark under review</button>
                    <button onClick={() => setStatus('AWAITING_RECORDS')} disabled={!!busy}
                      className="px-4 py-2 rounded-xl text-sm font-semibold border border-mossline bg-white cursor-pointer text-ink disabled:opacity-60">Preparing records</button>
                    <button onClick={approve} disabled={!!busy || !student}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer bg-field disabled:opacity-50">
                      {busy === 'approve' ? 'Issuing…' : 'Approve and issue'}
                    </button>
                    <button onClick={() => setRejecting(v => !v)} disabled={!!busy}
                      className="px-4 py-2 rounded-xl text-sm font-semibold border bg-white cursor-pointer disabled:opacity-60"
                      style={{ borderColor: '#F1B5B0', color: '#B42318' }}>Reject</button>
                  </>
                )}
                {issued && (
                  <button onClick={() => openFile('pdf')} disabled={busy === 'pdf'}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer bg-ink disabled:opacity-60">
                    <FileText size={15} /> {busy === 'pdf' ? 'Building…' : 'Open official transcript (PDF)'}
                  </button>
                )}
                {issued && detail.delivery === 'INSTITUTION' && detail.status !== 'SENT' && (
                  <button onClick={markSent} disabled={!!busy}
                    className="px-4 py-2 rounded-xl text-sm font-semibold border border-mossline bg-white cursor-pointer text-ink disabled:opacity-60">Mark as sent</button>
                )}
              </div>

              {issued && (
                <div className="mt-4 p-3 rounded-xl border border-mossline">
                  <div className="text-sm">
                    {detail.emailStatus === 'SENT' && (
                      <span className="text-ink">Emailed to <b>{detail.emailTo}</b>{detail.emailSentAt ? ` on ${dateText(detail.emailSentAt)}` : ''}.</span>
                    )}
                    {detail.emailStatus === 'FAILED' && (
                      <span style={{ color: '#B42318' }}>Email not sent{detail.emailTo ? ` to ${detail.emailTo}` : ''}: {detail.emailError}</span>
                    )}
                    {!detail.emailStatus && <span className="text-text2">Not emailed yet.</span>}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 mt-2">
                    <input value={altEmail} onChange={e => setAltEmail(e.target.value)} type="email"
                      placeholder={`Send to a different address (optional). Default: ${detail.delivery === 'INSTITUTION' ? (detail.institutionEmail || 'institution') : detail.email}`}
                      className="flex-1 px-3 py-2 rounded-xl text-sm border border-mossline outline-none text-ink" />
                    <button onClick={sendEmail} disabled={!!busy}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer bg-field disabled:opacity-60">
                      {busy === 'email' ? 'Sending\u2026' : detail.emailStatus === 'SENT' ? 'Send again' : 'Send by email'}
                    </button>
                  </div>
                </div>
              )}

              {!student && !issued && !final && <p className="text-xs text-text2 mt-2">Match a student record before approving.</p>}
              {detail.status === 'REJECTED' && (
                <button onClick={() => setStatus('UNDER_REVIEW')} disabled={!!busy}
                  className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold border border-mossline bg-white cursor-pointer text-ink">Reopen request</button>
              )}

              {rejecting && (
                <div className="mt-3">
                  <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                    placeholder="Tell the applicant why (they will see this)"
                    className="w-full px-3 py-2 rounded-xl text-sm border border-mossline outline-none text-ink" />
                  <button onClick={reject} disabled={!!busy}
                    className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer disabled:opacity-60"
                    style={{ background: '#B42318' }}>Confirm rejection</button>
                </div>
              )}

              {issued && detail.emailStatus !== 'SENT' && (
                <p className="text-xs text-text2 mt-3">
                  If the email does not go through, correct the address above and send again, or open the official PDF,
                  send it yourself and click "Mark as sent".
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
