import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Search, X, Plus, Pencil, UserX, UserCheck, KeyRound, Trash2, Printer, ChevronDown, ChevronUp } from 'lucide-react'

const INSTITUTION = 'College of Nursing Sciences, Osogbo'
const PASS_MARK = 50
const LEVELS = ['', 'ND1', 'ND2', 'ND3', 'HND1', 'HND2']
const FORM_LEVELS = ['ND1', 'ND2', 'ND3', 'HND1', 'HND2']

interface StudentRow {
  id: string; name: string; matricNo?: string | null; level?: string | null; department?: string | null
  email?: string | null; phone?: string | null; gender?: string | null; dateOfBirth?: string | null
  stateOfOrigin?: string | null; isActive: boolean; emailVerifiedAt?: string | null; photoUrl?: string | null
  admissionDate?: string | null; lastLogin?: string | null; createdAt?: string | null
}
interface ResCourse { id: string; courseCode: string; courseName: string; score: number; grade: string; creditUnit: number; gradePoint: number; isPublished: boolean }
interface ResSemester { academicYear: string; semester: string; gpa: string; totalUnits: number; courses: ResCourse[] }
interface StudentResults { cgpa: string; totalCourses: number; totalUnits: number; semesters: ResSemester[] }
interface FormState { id?: string; name: string; matricNo: string; email: string; department: string; level: string; phone: string; gender: string; admissionDate: string }

function admissionDisplay(s: StudentRow): string {
  if (s.admissionDate) return new Date(s.admissionDate).toLocaleDateString()
  const m = (s.matricNo || '').match(/(19\d{2}|20\d{2})/)
  return m ? m[1] : '—'
}
function admissionYear(s: StudentRow): string {
  if (s.admissionDate) return String(new Date(s.admissionDate).getFullYear())
  const m = (s.matricNo || '').match(/(19\d{2}|20\d{2})/)
  return m ? m[1] : '—'
}
function summarise(results: StudentResults) {
  const all = results.semesters.flatMap(s => s.courses)
  const passed = all.filter(c => c.score >= PASS_MARK).length
  return { total: all.length, passed, failed: all.length - passed, units: results.totalUnits,
    avg: all.length ? (all.reduce((s, c) => s + c.score, 0) / all.length).toFixed(1) : '—' }
}
function esc(v: unknown): string { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

function printTranscript(s: StudentRow, results: StudentResults) {
  const sum = summarise(results)
  const rows = results.semesters.map(sem => {
    const courseRows = sem.courses.map(c => `
      <tr><td>${esc(c.courseCode)}</td><td>${esc(c.courseName)}</td>
      <td class="c">${esc(c.creditUnit)}</td><td class="c">${esc(c.score)}</td>
      <td class="c ${c.score >= PASS_MARK ? 'pass' : 'fail'}">${c.score >= PASS_MARK ? 'PASS' : 'FAIL'}</td></tr>`).join('')
    return `<tr class="sem"><td colspan="5">${esc(sem.academicYear)} &nbsp;·&nbsp; ${esc(sem.semester)} &nbsp;·&nbsp; ${esc(sem.totalUnits)} units</td></tr>${courseRows}`
  }).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Transcript - ${esc(s.name)}</title>
  <style>
    *{box-sizing:border-box} body{font-family:Georgia,'Times New Roman',serif;color:#111;margin:0;padding:32px;max-width:820px}
    .hd{text-align:center;border-bottom:3px double #1B4332;padding-bottom:12px;margin-bottom:16px}
    .hd h1{margin:0;font-size:20px;color:#1B4332;letter-spacing:.5px}.hd p{margin:4px 0 0;font-size:12px;color:#444}
    .title{text-align:center;font-size:15px;font-weight:bold;letter-spacing:2px;margin:14px 0 18px;text-transform:uppercase}
    .id{width:100%;font-size:13px;border-collapse:collapse;margin-bottom:18px}.id td{padding:3px 6px}.id .k{color:#555;width:130px}
    table.r{width:100%;border-collapse:collapse;font-size:12px}
    table.r th{background:#1B4332;color:#fff;padding:6px;text-align:left;font-size:11px}
    table.r td{border:1px solid #ccc;padding:5px 6px}table.r td.c{text-align:center}
    tr.sem td{background:#E3EFE7;font-weight:bold;color:#1B4332;font-size:11px}
    .pass{color:#166534;font-weight:bold}.fail{color:#991B1B;font-weight:bold}
    .sumbox{margin-top:18px;border:1px solid #1B4332;border-radius:6px;padding:10px 14px;font-size:13px;display:flex;gap:24px;flex-wrap:wrap}
    .sumbox b{color:#1B4332}.note{margin-top:14px;font-size:11px;color:#666;font-style:italic}
    .sig{margin-top:48px;display:flex;justify-content:space-between;font-size:12px}
    .sig div{border-top:1px solid #333;padding-top:4px;width:200px;text-align:center}
    @media print{body{padding:12px}}
  </style></head><body onload="window.print()">
    <div class="hd"><h1>${esc(INSTITUTION)}</h1><p>Office of the Registrar</p></div>
    <div class="title">Statement of Academic Results</div>
    <table class="id">
      <tr><td class="k">Name</td><td><b>${esc(s.name)}</b></td><td class="k">Matric No</td><td>${esc(s.matricNo ?? '—')}</td></tr>
      <tr><td class="k">Programme</td><td>${esc(s.department ?? '—')}</td><td class="k">Current Level</td><td>${esc(s.level ?? '—')}</td></tr>
      <tr><td class="k">Year of Admission</td><td>${esc(admissionYear(s))}</td><td class="k">Status</td><td>${s.isActive ? 'Active' : 'Inactive'}</td></tr>
    </table>
    <table class="r">
      <thead><tr><th>Code</th><th>Course Title</th><th style="text-align:center">Units</th><th style="text-align:center">Score</th><th style="text-align:center">Remark</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:18px;color:#888">No results recorded.</td></tr>'}</tbody>
    </table>
    <div class="sumbox"><span><b>Total Courses:</b> ${sum.total}</span><span><b>Passed:</b> ${sum.passed}</span><span><b>Failed:</b> ${sum.failed}</span><span><b>Total Units:</b> ${sum.units}</span><span><b>Average Score:</b> ${sum.avg}%</span></div>
    <div class="note">Pass mark: ${PASS_MARK}%. This is a provisional statement of results generated from the CampusOS portal and is not an officially sealed transcript.</div>
    <div class="sig"><div>Registrar</div><div>Official Stamp</div></div>
  </body></html>`
  const w = window.open('', '_blank')
  if (!w) { alert('Please allow pop-ups to print the transcript.'); return }
  w.document.write(html); w.document.close()
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-plexmono font-semibold uppercase tracking-wide text-text3">{label}</div>
      <div className="font-medium break-words text-ink">{value}</div>
    </div>
  )
}
function Input({ label, value, onChange, type = 'text', placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; disabled?: boolean
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-plexmono font-semibold uppercase tracking-wide text-text2">{label}</span>
      <input type={type} value={value} disabled={disabled} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2 rounded-xl text-sm border border-mossline outline-none disabled:opacity-60 text-ink" />
    </label>
  )
}

function StudentForm({ initial, departments, onClose, onSaved }: {
  initial: FormState; departments: string[]; onClose: () => void; onSaved: (msg: string) => void
}) {
  const isEdit = !!initial.id
  const [f, setF] = useState<FormState>(initial)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: keyof FormState) => (v: string) => setF(prev => ({ ...prev, [k]: v }))

  const submit = async () => {
    setErr(''); setSaving(true)
    try {
      const body = {
        name: f.name, email: f.email, level: f.level, department: f.department,
        phone: f.phone, gender: f.gender, admissionDate: f.admissionDate || undefined,
        ...(isEdit ? {} : { matricNo: f.matricNo }),
      }
      if (isEdit) await api.patch(`/api/registrar/students/${f.id}`, body)
      else await api.post('/api/registrar/students', body)
      onSaved(isEdit ? 'Student updated.' : `Student created. Default password: Student123!`)
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Something went wrong. Please check the fields and try again.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(18,36,0,0.45)' }} onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg text-ink">{isEdit ? 'Edit student' : 'Add student'}</h2>
          <button onClick={onClose} className="text-xl border-0 bg-transparent cursor-pointer text-text2">✕</button>
        </div>
        {err && <div className="mb-3 p-3 rounded-xl bg-red-50 text-red-600 text-xs">{err}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Input label="Full Name" value={f.name} onChange={set('name')} placeholder="Surname First Middle" /></div>
          <Input label="Matric Number" value={f.matricNo} onChange={set('matricNo')} placeholder="NSG/2025/001" disabled={isEdit} />
          <Input label="Email" type="email" value={f.email} onChange={set('email')} placeholder="student@email.com" />
          <label className="block">
            <span className="text-[10px] font-plexmono font-semibold uppercase tracking-wide text-text2">Programme / Department</span>
            <input list="dept-list" value={f.department} onChange={e => set('department')(e.target.value)}
              placeholder="Nursing Science" className="w-full mt-1 px-3 py-2 rounded-xl text-sm border border-mossline outline-none text-ink" />
            <datalist id="dept-list">{departments.map(d => <option key={d} value={d} />)}</datalist>
          </label>
          <label className="block">
            <span className="text-[10px] font-plexmono font-semibold uppercase tracking-wide text-text2">Level</span>
            <select value={f.level} onChange={e => set('level')(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl text-sm border border-mossline outline-none bg-white text-ink">
              <option value="">Select level</option>
              {FORM_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <Input label="Phone" value={f.phone} onChange={set('phone')} placeholder="0803..." />
          <label className="block">
            <span className="text-[10px] font-plexmono font-semibold uppercase tracking-wide text-text2">Gender</span>
            <select value={f.gender} onChange={e => set('gender')(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl text-sm border border-mossline outline-none bg-white text-ink">
              <option value="">—</option><option value="Male">Male</option><option value="Female">Female</option>
            </select>
          </label>
          <Input label="Admission Date" type="date" value={f.admissionDate} onChange={set('admissionDate')} />
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-mossline cursor-pointer bg-white text-text2">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer disabled:opacity-50 bg-field">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create student'}
          </button>
        </div>
        {!isEdit && <p className="text-[11px] mt-3 text-text3">The student logs in with their matric number and the default password, then sets their own on first login.</p>}
      </div>
    </div>
  )
}

export default function RegistrarStudents() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [level, setLevel] = useState(searchParams.get('level') || '')
  const [department, setDepartment] = useState(searchParams.get('department') || '')
  const [rows, setRows] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<'profile' | 'transcript'>('profile')
  const [depts, setDepts] = useState<string[]>([])
  const [form, setForm] = useState<FormState | null>(null)
  const [flash, setFlash] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [resCache, setResCache] = useState<Record<string, StudentResults | null>>({})
  const [resLoadingId, setResLoadingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(false)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (level) params.set('level', level)
      if (department) params.set('department', department)
      const res = await api.get<{ count: number; students: StudentRow[] }>(`/api/registrar/students?${params.toString()}`)
      setRows(res.data.students || [])
    } catch { setError(true) } finally { setLoading(false) }
  }, [q, level, department])

  useEffect(() => { load() }, [])
  useEffect(() => {
    api.get<{ departments: string[] }>('/api/registrar/departments').then(r => setDepts(r.data.departments || [])).catch(() => {})
  }, [])

  const fetchResults = async (id: string) => {
    if (resCache[id] !== undefined) return
    setResLoadingId(id)
    try {
      const res = await api.get<StudentResults>(`/api/registrar/students/${id}/results`)
      setResCache(prev => ({ ...prev, [id]: res.data }))
    } catch { setResCache(prev => ({ ...prev, [id]: null })) } finally { setResLoadingId(null) }
  }
  const toggle = (id: string) => {
    if (openId === id) { setOpenId(null); return }
    setOpenId(id); setTab('profile'); fetchResults(id)
  }
  const flashMsg = (m: string) => { setFlash(m); setTimeout(() => setFlash(''), 6000) }
  const onSaved = (msg: string) => { setForm(null); flashMsg(msg); load() }
  const openCreate = () => setForm({ name: '', matricNo: '', email: '', department: '', level: '', phone: '', gender: '', admissionDate: new Date().toISOString().slice(0, 10) })
  const openEdit = (s: StudentRow) => setForm({
    id: s.id, name: s.name, matricNo: s.matricNo || '', email: s.email || '',
    department: s.department || '', level: s.level || '', phone: s.phone || '', gender: s.gender || '',
    admissionDate: s.admissionDate ? new Date(s.admissionDate).toISOString().slice(0, 10) : '',
  })
  const toggleActive = async (s: StudentRow) => {
    setBusyId(s.id)
    try { await api.patch(`/api/registrar/students/${s.id}`, { isActive: !s.isActive }); flashMsg(s.isActive ? 'Student deactivated.' : 'Student reactivated.'); load() }
    catch { flashMsg('Could not update status.') } finally { setBusyId(null) }
  }
  const resetPw = async (s: StudentRow) => {
    if (!confirm(`Reset ${s.name}'s password to the default?`)) return
    setBusyId(s.id)
    try { const r = await api.patch<{ defaultPassword: string }>(`/api/registrar/students/${s.id}/reset-password`, {}); flashMsg(`Password reset to: ${r.data.defaultPassword}`) }
    catch { flashMsg('Could not reset password.') } finally { setBusyId(null) }
  }
  const remove = async (s: StudentRow) => {
    if (!confirm(`Permanently delete ${s.name}? This cannot be undone.`)) return
    setBusyId(s.id)
    try { await api.delete(`/api/registrar/students/${s.id}`); flashMsg('Student deleted.'); setOpenId(null); load() }
    catch (e: any) { flashMsg(e?.response?.data?.error || 'Could not delete student.') } finally { setBusyId(null) }
  }
  const clearFilters = () => { setLevel(''); setDepartment(''); setQ('') }
  const activeFilter = [department, level].filter(Boolean).join(' · ')

  return (
    <div className="bg-bg" style={{ minHeight: '100%' }}>
      <div style={{ background: 'linear-gradient(180deg,#1B4332,#122400)' }} className="px-4 pt-6 pb-5 lg:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <div className="text-[12px] font-plexmono uppercase tracking-widest" style={{ color: '#BFE0C8' }}>Registrar's office</div>
            <h1 className="font-display font-semibold text-white leading-tight mt-1" style={{ fontSize: 28 }}>Student records</h1>
            <p className="text-sm" style={{ color: '#CFE0D2' }}>{activeFilter ? `Viewing: ${activeFilter}` : 'Search, register, verify, and print'}</p>
          </div>
          <button onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border-0 cursor-pointer flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            <ArrowLeft size={15} strokeWidth={2} /> Home
          </button>
        </div>
      </div>

      <div className="px-4 pt-6 pb-24 lg:p-8 lg:pb-8 max-w-5xl mx-auto">

        {flash && <div className="mb-4 p-3 rounded-xl text-sm font-medium bg-moss text-ink">{flash}</div>}

        <div className="bg-white rounded-2xl p-3 mb-3 flex flex-col sm:flex-row gap-2 border border-mossline">
          <div className="flex-1 flex items-center gap-2 px-3 rounded-xl border border-mossline">
            <Search size={16} className="text-text3 flex-shrink-0" />
            <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') load() }}
              placeholder="Search by name or matric number"
              className="flex-1 py-2.5 text-sm border-0 outline-none text-ink bg-transparent" />
          </div>
          <select value={level} onChange={e => setLevel(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-sm border border-mossline outline-none bg-white text-ink">
            {LEVELS.map(l => <option key={l || 'all'} value={l}>{l || 'All levels'}</option>)}
          </select>
          <button onClick={() => load()} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer bg-field">Search</button>
        </div>

        <div className="flex items-center justify-between mb-4">
          {activeFilter
            ? <button onClick={() => { clearFilters(); setTimeout(load, 0) }} className="flex items-center gap-1 text-xs font-semibold border-0 bg-transparent cursor-pointer text-field">
                <X size={13} /> Clear filters
              </button>
            : <span />}
          <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer bg-ink">
            <Plus size={15} /> Add student
          </button>
        </div>

        {loading && <div className="text-center py-10 text-sm text-text2">Loading…</div>}
        {error && <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm">Failed to load records. Please try again.</div>}

        {!loading && !error && (
          <>
            <p className="text-xs font-semibold mb-3 text-text2">{rows.length} student{rows.length === 1 ? '' : 's'} found</p>
            <div className="space-y-2.5">
              {rows.map(s => {
                const open = openId === s.id
                const verified = !!s.emailVerifiedAt
                const results = resCache[s.id]
                const sum = results ? summarise(results) : null
                const busy = busyId === s.id
                return (
                  <div key={s.id} className="bg-white rounded-2xl overflow-hidden border border-mossline">
                    <button onClick={() => toggle(s.id)} className="w-full flex items-center gap-3 p-3 border-0 bg-transparent cursor-pointer text-left">
                      <div className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold overflow-hidden bg-field">
                        {s.photoUrl ? <img src={s.photoUrl} alt="" className="w-full h-full object-cover" /> : (s.name?.charAt(0) ?? '?')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate text-ink">{s.name}</div>
                        <div className="text-xs truncate text-text2 font-plexmono">{s.matricNo ?? 'No matric'} · {s.department ?? '—'} · {s.level ?? '—'}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${s.isActive ? 'bg-greenokbg text-greenok' : 'bg-red-100 text-red-800'}`}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {open ? <ChevronUp size={16} className="text-text3 flex-shrink-0" /> : <ChevronDown size={16} className="text-text3 flex-shrink-0" />}
                    </button>

                    {open && (
                      <div className="border-t border-mossline">
                        <div className="flex gap-1 px-3 pt-3">
                          {(['profile', 'transcript'] as const).map(t => (
                            <button key={t} onClick={() => setTab(t)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-0 cursor-pointer capitalize ${tab === t ? 'bg-ink text-white' : 'bg-moss text-text2'}`}>
                              {t}
                            </button>
                          ))}
                        </div>

                        {tab === 'profile' && (
                          <div className="px-3 pb-3 pt-3">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                              <Field label="Matric No" value={s.matricNo ?? '—'} />
                              <Field label="Programme" value={s.department ?? '—'} />
                              <Field label="Level" value={s.level ?? '—'} />
                              <Field label="Admission" value={admissionDisplay(s)} />
                              <Field label="Email" value={s.email ?? '—'} />
                              <Field label="Phone" value={s.phone ?? '—'} />
                              <Field label="Gender" value={s.gender ?? '—'} />
                              <Field label="State of Origin" value={s.stateOfOrigin ?? '—'} />
                              <Field label="Email verified" value={verified ? 'Yes' : 'No'} />
                              <Field label="Last login" value={s.lastLogin ? new Date(s.lastLogin).toLocaleDateString() : 'Never'} />
                            </div>
                            <div className="flex flex-wrap gap-2 mt-4">
                              <button onClick={() => openEdit(s)} disabled={busy}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border-0 cursor-pointer text-white disabled:opacity-50 bg-field">
                                <Pencil size={13} /> Edit
                              </button>
                              <button onClick={() => toggleActive(s)} disabled={busy}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-mossline cursor-pointer disabled:opacity-50 bg-white text-ink">
                                {s.isActive ? <UserX size={13} /> : <UserCheck size={13} />} {s.isActive ? 'Deactivate' : 'Reactivate'}
                              </button>
                              <button onClick={() => resetPw(s)} disabled={busy}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-mossline cursor-pointer disabled:opacity-50 bg-white text-ink">
                                <KeyRound size={13} /> Reset password
                              </button>
                              <button onClick={() => remove(s)} disabled={busy}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer disabled:opacity-50 bg-white"
                                style={{ borderColor: '#FECACA', color: '#991B1B' }}>
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          </div>
                        )}

                        {tab === 'transcript' && (
                          <div className="px-3 pb-3 pt-3">
                            {resLoadingId === s.id && <div className="text-xs py-3 text-text2">Loading results…</div>}
                            {results === null && <div className="text-xs py-3 text-red-500">Could not load results.</div>}
                            {results && (
                              <>
                                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                  {sum && (
                                    <div className="flex gap-3 flex-wrap text-xs text-ink">
                                      <span><b>{sum.passed}</b> passed</span><span><b>{sum.failed}</b> failed</span>
                                      <span><b>{sum.units}</b> units</span><span>avg <b>{sum.avg}%</b></span>
                                    </div>
                                  )}
                                  <button onClick={() => printTranscript(s, results)} disabled={results.semesters.length === 0}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white border-0 cursor-pointer disabled:opacity-40 bg-field">
                                    <Printer size={13} /> Print / Save PDF
                                  </button>
                                </div>
                                {results.semesters.length === 0 && <div className="text-xs py-3 text-text2">No results recorded for this student yet.</div>}
                                {results.semesters.map((sem, idx) => (
                                  <div key={idx} className="rounded-xl mb-2.5 overflow-hidden border border-mossline">
                                    <div className="flex items-center justify-between px-3 py-2 bg-moss">
                                      <span className="text-xs font-semibold text-ink">{sem.academicYear} · {sem.semester}</span>
                                      <span className="text-xs font-semibold text-field font-plexmono">{sem.totalUnits} units</span>
                                    </div>
                                    <div className="divide-y divide-mossline">
                                      {sem.courses.map(c => {
                                        const pass = c.score >= PASS_MARK
                                        return (
                                          <div key={c.id} className="flex items-center gap-2 px-3 py-2">
                                            <div className="min-w-0 flex-1">
                                              <div className="text-xs font-semibold truncate text-ink">{c.courseCode}</div>
                                              <div className="text-[11px] truncate text-text2">{c.courseName}</div>
                                            </div>
                                            {!c.isPublished && (
                                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-goldbg" style={{ color: '#8a6218' }}>PENDING</span>
                                            )}
                                            <span className="text-[11px] w-10 text-center flex-shrink-0 font-plexmono text-text2">{c.creditUnit}u</span>
                                            <span className="text-xs font-semibold w-9 text-right flex-shrink-0 text-ink font-plexmono">{c.score}</span>
                                            <span className={`text-[10px] font-bold w-12 text-center rounded-md flex-shrink-0 py-0.5 ${pass ? 'bg-greenokbg text-greenok' : 'bg-red-100 text-red-800'}`}>
                                              {pass ? 'PASS' : 'FAIL'}
                                            </span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {rows.length === 0 && <div className="text-center py-10 text-sm text-text2">No students match your search.</div>}
            </div>
          </>
        )}
      </div>

      {form && <StudentForm initial={form} departments={depts} onClose={() => setForm(null)} onSaved={onSaved} />}
    </div>
  )
}
