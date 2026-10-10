import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { showToast } from '../components/Toast'
import { Navigate } from 'react-router-dom'

const API = (import.meta.env.VITE_API_URL as string | undefined) || ''
const LECTURER_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'LECTURER']

const COURSES = [
  'Anatomy & Physiology', 'Pharmacology', 'Nutrition & Dietetics', 'Primary Health Care (PHC)',
  'Medical-Surgical Nursing', 'Foundation of Nursing', 'Community Health Nursing',
  'Reproductive Health', 'Maternal & Child Health', 'Midwifery Practice',
  'Mental Health / Psychiatric Nursing', 'Paediatric Nursing', 'Geriatric Nursing',
  'Microbiology', 'Nursing Ethics & Jurisprudence', 'Research & Statistics',
  'Health Education', 'Sociology', 'Psychology',
]

const ACADEMIC_YEARS = ['2023/2024', '2024/2025', '2025/2026', '2026/2027']
const SEMESTERS = ['First Semester', 'Second Semester']
const LEVELS = ['ND1', 'ND2', 'HND1', 'HND2']

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('campusos_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

type Student = {
  id: string
  name: string
  matricNo: string | null
  department: string | null
  level: string | null
}

type ResultEntry = {
  studentId: string
  studentName: string
  courseCode: string
  courseName: string
  score: string
  creditUnit: string
}

function calcGrade(score: number): string {
  if (isNaN(score)) return '—'
  if (score >= 70) return 'A'
  if (score >= 60) return 'B'
  if (score >= 50) return 'C'
  if (score >= 45) return 'D'
  if (score >= 40) return 'E'
  return 'F'
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return '#15803D'
    case 'B': return '#1D4ED8'
    case 'C': return '#B45309'
    case 'D': return '#C2410C'
    case 'E': return '#C2410C'
    case 'F': return '#DC2626'
    default: return '#94A3B8'
  }
}

export default function LecturerResults() {
  const { user } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [activeTab, setActiveTab] = useState<'sheet' | 'single' | 'bulk'>('sheet')

  // ── Single entry form ──
  const [form, setForm] = useState({
    studentId: '', courseName: COURSES[0], courseCode: '', semester: 'First Semester',
    academicYear: '2025/2026', score: '', creditUnit: '2',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<{ studentName: string; courseName: string; score: string; grade: string } | null>(null)

  // ── Bulk paste ──
  const [bulkText, setBulkText] = useState('')
  const [bulkSemester, setBulkSemester] = useState('First Semester')
  const [bulkYear, setBulkYear] = useState('2025/2026')
  const [bulkCourseName, setBulkCourseName] = useState(COURSES[0])
  const [bulkCourseCode, setBulkCourseCode] = useState('')
  const [bulkCreditUnit, setBulkCreditUnit] = useState('2')
  const [bulkParsed, setBulkParsed] = useState<ResultEntry[]>([])
  const [bulkSubmitting, setBulkSubmitting] = useState(false)

  // ── Class Sheet (NEW) ──
  const [sheetLevel, setSheetLevel] = useState('')
  const [sheetCourse, setSheetCourse] = useState(COURSES[0])
  const [sheetCourseCode, setSheetCourseCode] = useState('')
  const [sheetCredit, setSheetCredit] = useState('2')
  const [sheetSemester, setSheetSemester] = useState('First Semester')
  const [sheetYear, setSheetYear] = useState('2025/2026')
  const [sheetScores, setSheetScores] = useState<Record<string, string>>({})
  const [sheetSearch, setSheetSearch] = useState('')
  const [sheetSubmitting, setSheetSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/api/results/students`, { headers: { ...authHeaders() } })
        if (!res.ok) throw new Error('Failed')
        const json = await res.json()
        setStudents(json.students)
      } catch { showToast('Could not load students', 'error') }
      finally { setLoadingStudents(false) }
    }
    load()
  }, [])

  // Students in the chosen level for the class sheet
  const sheetStudents = useMemo(() => {
    let list = sheetLevel ? students.filter(s => s.level === sheetLevel) : []
    const q = sheetSearch.trim().toLowerCase()
    if (q) list = list.filter(s => s.name.toLowerCase().includes(q) || (s.matricNo ?? '').toLowerCase().includes(q))
    return list
  }, [students, sheetLevel, sheetSearch])

  const sheetEntered = Object.values(sheetScores).filter(v => v !== '' && v !== undefined).length

  function setSheetScore(id: string, val: string) {
    if (val === '') { setSheetScores(p => ({ ...p, [id]: '' })); return }
    const n = Number(val)
    if (isNaN(n) || n < 0 || n > 100) return
    setSheetScores(p => ({ ...p, [id]: val }))
  }

  async function submitSheet() {
    if (!sheetLevel || !sheetCourse || sheetEntered === 0) return
    const levelStudents = students.filter(s => s.level === sheetLevel)
    const results = levelStudents
      .filter(s => sheetScores[s.id] !== undefined && sheetScores[s.id] !== '')
      .map(s => ({
        studentId: s.id,
        courseName: sheetCourse,
        courseCode: sheetCourseCode || sheetCourse.substring(0, 6).toUpperCase(),
        score: Number(sheetScores[s.id]),
        creditUnit: Number(sheetCredit) || 2,
      }))
    if (results.length === 0) { showToast('Enter at least one score', 'error'); return }
    setSheetSubmitting(true)
    try {
      const res = await fetch(`${API}/api/results/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ semester: sheetSemester, academicYear: sheetYear, results }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Failed', 'error'); return }
      showToast(`${data.created} results submitted for admin approval`, 'success')
      setSheetScores({})
    } catch { showToast('Network error', 'error') }
    finally { setSheetSubmitting(false) }
  }

  async function submitSingle() {
    if (!form.studentId || !form.courseName || !form.score) return
    const scoreNum = Number(form.score)
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      showToast('Score must be 0-100', 'error'); return
    }
    setSubmitting(true)
    try {
      const student = students.find(s => s.id === form.studentId)
      const res = await fetch(`${API}/api/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          studentId: form.studentId,
          courseName: form.courseName,
          courseCode: form.courseCode || form.courseName.substring(0, 6).toUpperCase(),
          semester: form.semester,
          academicYear: form.academicYear,
          score: scoreNum,
          creditUnit: Number(form.creditUnit) || 2,
        }),
      })
      if (!res.ok) { const d = await res.json(); showToast(d.error || 'Failed', 'error'); return }
      setSubmitted({ studentName: student?.name || '', courseName: form.courseName, score: form.score, grade: calcGrade(scoreNum) })
      setForm(f => ({ ...f, studentId: '', score: '' }))
    } catch { showToast('Network error', 'error') }
    finally { setSubmitting(false) }
  }

  function parseBulk(text: string) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const parsed: ResultEntry[] = []
    for (const line of lines) {
      const parts = line.split(/[\t ,]/).map(p => p.trim()).filter(Boolean)
      if (parts.length < 2) continue
      const matricOrName = parts[0]
      const score = parts[parts.length - 1]
      if (isNaN(Number(score))) continue
      const student = students.find(s =>
        s.matricNo?.toLowerCase() === matricOrName.toLowerCase() ||
        s.name.toLowerCase() === matricOrName.toLowerCase()
      )
      if (!student) continue
      parsed.push({
        studentId: student.id,
        studentName: student.name,
        courseCode: bulkCourseCode || bulkCourseName.substring(0, 6).toUpperCase(),
        courseName: bulkCourseName,
        score,
        creditUnit: bulkCreditUnit,
      })
    }
    setBulkParsed(parsed)
  }

  async function submitBulk() {
    if (bulkParsed.length === 0) return
    setBulkSubmitting(true)
    try {
      const res = await fetch(`${API}/api/results/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          semester: bulkSemester,
          academicYear: bulkYear,
          results: bulkParsed.map(r => ({
            studentId: r.studentId,
            courseName: r.courseName,
            courseCode: r.courseCode,
            score: Number(r.score),
            creditUnit: Number(r.creditUnit),
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error || 'Failed', 'error'); return }
      showToast(`${data.created} results submitted for admin approval`, 'success')
      setBulkText(''); setBulkParsed([])
    } catch { showToast('Network error', 'error') }
    finally { setBulkSubmitting(false) }
  }

  if (!user || !LECTURER_ROLES.includes(user.role)) return <Navigate to="/dashboard" replace />

  const labelStyle = { color: '#1B4332', opacity: 0.7 }
  const inputStyle = { borderColor: '#E5E7EB' }

  return (
    <div className="min-h-screen p-4 lg:p-8 pb-28" style={{ background: '#F5F7FA' }}>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#122400' }}>Lecturer</p>
          <h1 className="text-3xl font-black" style={{ color: '#1B4332' }}>Enter Results</h1>
          <div className="mt-2 h-1 w-16 rounded-full" style={{ background: '#D4A24C' }} />
          <p className="mt-2 text-xs" style={{ color: '#8A9BB0' }}>Results are submitted to admin for approval before students can see them.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b" style={{ borderColor: '#E5E7EB' }}>
          {([['sheet','Class Sheet'],['single','Single Entry'],['bulk','Bulk Paste']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className="px-4 py-2 text-sm font-bold border-b-2 border-0 bg-transparent cursor-pointer"
              style={{ color: activeTab === key ? '#122400' : '#1B4332', borderColor: activeTab === key ? '#122400' : 'transparent', opacity: activeTab === key ? 1 : 0.6 }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── CLASS SHEET TAB (NEW) ── */}
        {activeTab === 'sheet' && (
          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>Level</div>
                <select value={sheetLevel} onChange={e => { setSheetLevel(e.target.value); setSheetScores({}) }}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={inputStyle}>
                  <option value="">Select level…</option>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
              <label className="block col-span-2 lg:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>Course</div>
                <select value={sheetCourse} onChange={e => setSheetCourse(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={inputStyle}>
                  {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>Course Code</div>
                <input type="text" value={sheetCourseCode} onChange={e => setSheetCourseCode(e.target.value)}
                  placeholder="e.g. NSG201" className="w-full px-3 py-2 rounded-lg border text-sm font-mono" style={inputStyle} />
              </label>
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>Units</div>
                <select value={sheetCredit} onChange={e => setSheetCredit(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={inputStyle}>
                  {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>Semester</div>
                <select value={sheetSemester} onChange={e => setSheetSemester(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={inputStyle}>
                  {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>Academic Year</div>
                <select value={sheetYear} onChange={e => setSheetYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={inputStyle}>
                  {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
            </div>

            {loadingStudents && <p className="text-sm text-center py-6" style={{ color: '#8A9BB0' }}>Loading students…</p>}

            {!loadingStudents && !sheetLevel && (
              <div className="text-center py-10">
                <p className="text-4xl mb-3">📝</p>
                <p className="font-bold mb-1" style={{ color: '#1B4332' }}>Select a level to load students</p>
                <p className="text-xs" style={{ color: '#8A9BB0' }}>Then type each score — the grade shows instantly</p>
              </div>
            )}

            {!loadingStudents && sheetLevel && (
              <>
                <div className="flex items-center justify-between mb-3 gap-3">
                  <div className="relative flex-1 max-w-xs">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🔍</span>
                    <input value={sheetSearch} onChange={e => setSheetSearch(e.target.value)}
                      placeholder="Find student…"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none" style={inputStyle} />
                  </div>
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0" style={{ background: '#E3EFE7', color: '#122400' }}>
                    {sheetEntered} scored
                  </span>
                </div>

                {sheetStudents.length === 0 ? (
                  <p className="text-center text-sm py-8" style={{ color: '#8A9BB0' }}>No students in {sheetLevel}</p>
                ) : (
                  <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#EEF1F5' }}>
                    {sheetStudents.map((s, idx) => {
                      const raw = sheetScores[s.id] ?? ''
                      const grade = calcGrade(Number(raw))
                      return (
                        <div key={s.id} className="flex items-center gap-3 px-4 py-2.5"
                          style={{ background: idx % 2 ? '#FBFCFD' : '#fff', borderBottom: '1px solid #F1F4F7' }}>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate" style={{ color: '#1B4332' }}>{s.name}</p>
                            <p className="text-xs" style={{ color: '#8A9BB0' }}>{s.matricNo ?? '—'}</p>
                          </div>
                          <input type="number" min={0} max={100} inputMode="numeric"
                            value={raw} onChange={e => setSheetScore(s.id, e.target.value)}
                            placeholder="—"
                            className="w-20 px-3 py-2 rounded-lg border text-sm text-center font-bold outline-none"
                            style={{ background: '#F5F7FA', borderColor: '#E8EDF2', color: '#1B4332' }} />
                          <span className="w-7 text-center font-black text-base" style={{ color: gradeColor(grade) }}>{grade}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                <button onClick={submitSheet} disabled={sheetSubmitting || sheetEntered === 0}
                  className="w-full mt-4 py-3 rounded-xl text-sm font-bold text-white border-0 cursor-pointer disabled:opacity-50"
                  style={{ background: '#122400' }}>
                  {sheetSubmitting ? 'Submitting…' : `Submit ${sheetEntered} Result${sheetEntered === 1 ? '' : 's'} for Approval`}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── SINGLE ENTRY TAB ── */}
        {activeTab === 'single' && (
          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
            {submitted && (
              <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: '#D1FAE5', color: '#065F46' }}>
                Submitted: <strong>{submitted.studentName}</strong> — {submitted.courseName} — {submitted.score}% ({submitted.grade})
                <button onClick={() => setSubmitted(null)} className="ml-2 underline text-xs border-0 bg-transparent cursor-pointer" style={{ color: '#065F46' }}>dismiss</button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>Student</div>
                <select value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={inputStyle}>
                  <option value="">Select student...</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} — {s.matricNo} {s.level ? `(${s.level})` : ''}</option>
                  ))}
                </select>
              </label>
              <label className="block col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>Course</div>
                <select value={form.courseName} onChange={e => setForm({ ...form, courseName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={inputStyle}>
                  {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>Course Code</div>
                <input type="text" value={form.courseCode} onChange={e => setForm({ ...form, courseCode: e.target.value })}
                  placeholder="e.g. NSG201" className="w-full px-3 py-2 rounded-lg border text-sm font-mono" style={inputStyle} />
              </label>
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>Credit Units</div>
                <select value={form.creditUnit} onChange={e => setForm({ ...form, creditUnit: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={inputStyle}>
                  {[1,2,3,4,6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>Academic Year</div>
                <select value={form.academicYear} onChange={e => setForm({ ...form, academicYear: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={inputStyle}>
                  {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>Semester</div>
                <select value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={inputStyle}>
                  {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>Score (0-100)</div>
                <input type="number" min="0" max="100" value={form.score} onChange={e => setForm({ ...form, score: e.target.value })}
                  placeholder="e.g. 72" className="w-full px-3 py-2 rounded-lg border text-sm" style={inputStyle} />
                {form.score && !isNaN(Number(form.score)) && (
                  <div className="mt-1 text-xs font-bold" style={{ color: '#122400' }}>Grade: {calcGrade(Number(form.score))}</div>
                )}
              </label>
            </div>
            <button onClick={submitSingle} disabled={submitting || !form.studentId || !form.score}
              className="w-full py-3 rounded-xl text-sm font-bold text-white border-0 cursor-pointer disabled:opacity-50"
              style={{ background: '#122400' }}>
              {submitting ? 'Submitting...' : 'Submit for Admin Approval'}
            </button>
          </div>
        )}

        {/* ── BULK PASTE TAB ── */}
        {activeTab === 'bulk' && (
          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 4px 24px rgba(27,67,50,0.06)' }}>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="block col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>Course</div>
                <select value={bulkCourseName} onChange={e => setBulkCourseName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={inputStyle}>
                  {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>Course Code</div>
                <input type="text" value={bulkCourseCode} onChange={e => setBulkCourseCode(e.target.value)}
                  placeholder="e.g. NSG201" className="w-full px-3 py-2 rounded-lg border text-sm font-mono" style={inputStyle} />
              </label>
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>Credit Units</div>
                <select value={bulkCreditUnit} onChange={e => setBulkCreditUnit(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={inputStyle}>
                  {[1,2,3,4,6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>Academic Year</div>
                <select value={bulkYear} onChange={e => setBulkYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={inputStyle}>
                  {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>Semester</div>
                <select value={bulkSemester} onChange={e => setBulkSemester(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white" style={inputStyle}>
                  {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <div className="mb-1">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={labelStyle}>Paste Results</div>
              <p className="text-xs mb-2" style={{ color: '#8A9BB0' }}>
                One per line: <code className="bg-gray-100 px-1 rounded">matric_no,score</code> or <code className="bg-gray-100 px-1 rounded">student_name,score</code>
              </p>
              <textarea value={bulkText}
                onChange={e => { setBulkText(e.target.value); parseBulk(e.target.value) }}
                rows={6} placeholder={'NSG/2022/001,72\nNSG/2022/002,65\nNSG/2021/001,58'}
                className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none font-mono"
                style={{ border: '1.5px solid #E8EDF2', background: '#F5F7FA' }} />
            </div>
            {bulkParsed.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold mb-2" style={{ color: '#065F46' }}>{bulkParsed.length} students matched</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {bulkParsed.map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs" style={{ background: '#F5F7FA' }}>
                      <span style={{ color: '#1B4332' }}>{r.studentName}</span>
                      <span className="font-bold" style={{ color: '#122400' }}>{r.score}% — {calcGrade(Number(r.score))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {bulkText && bulkParsed.length === 0 && (
              <p className="text-xs mb-3" style={{ color: '#92400E' }}>No students matched. Check matric numbers match exactly.</p>
            )}
            <button onClick={submitBulk} disabled={bulkSubmitting || bulkParsed.length === 0}
              className="w-full py-3 rounded-xl text-sm font-bold text-white border-0 cursor-pointer disabled:opacity-50"
              style={{ background: '#122400' }}>
              {bulkSubmitting ? 'Submitting...' : `Submit ${bulkParsed.length > 0 ? bulkParsed.length + ' Results' : 'Results'} for Approval`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
