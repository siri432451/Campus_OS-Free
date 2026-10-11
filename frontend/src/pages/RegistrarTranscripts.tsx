import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, FileText, Upload, Download, Save } from 'lucide-react'
import api from '../api/client'

interface StudentLite {
  id: string
  name: string
  matricNo: string | null
  level: string | null
  department: string | null
}

interface Course {
  id: string
  yearOfStudy: number
  semester: number
  serial: number
  code: string
  key: string
  title: string
  lectureHours: number
  practicalHours: number
  creditUnit: number
  score: number | null
  source: 'transcript' | 'results' | null
}

interface ProfileForm {
  refNo: string
  programmeTitle: string
  certificate: string
  entryMonth: string
  completionMonth: string
  conduct: string
  examYear: string
  examResult: string
}

interface ImportResult {
  studentsMatched: number
  scoresSaved: number
  unknownMatrics: number
  unrecognisedColumns: string[]
  errors: Array<{ row: number; matric: string; message: string }>
}

const EMPTY_PROFILE: ProfileForm = {
  refNo: '', programmeTitle: '', certificate: '', entryMonth: '', completionMonth: '',
  conduct: '', examYear: '', examResult: '',
}

const YEAR_WORDS = ['', 'First', 'Second', 'Third', 'Fourth']
const SEM_WORDS = ['', 'First', 'Second']

function errText(e: unknown): string {
  const anyE = e as { response?: { data?: { error?: string } } }
  return anyE?.response?.data?.error || 'Something went wrong. Please try again.'
}

/** Errors for blob responses arrive as a Blob containing JSON */
async function blobErrText(e: unknown): Promise<string> {
  const anyE = e as { response?: { data?: Blob } }
  try {
    const text = await anyE?.response?.data?.text()
    if (text) return JSON.parse(text).error || 'Could not build the transcript.'
  } catch { /* fall through */ }
  return 'Could not build the transcript.'
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-plexmono font-semibold uppercase tracking-wide text-text2">{label}</span>
      <input type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2 rounded-xl text-sm border border-mossline outline-none text-ink" />
    </label>
  )
}

export default function RegistrarTranscriptsPage() {
  const navigate = useNavigate()

  const [catalogCount, setCatalogCount] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<StudentLite[]>([])
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] = useState<StudentLite | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [profile, setProfile] = useState<ProfileForm>(EMPTY_PROFILE)
  const [scores, setScores] = useState<Record<string, string>>({})
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const say = (ok: boolean, text: string) => { setFlash({ ok, text }); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const loadCatalog = useCallback(async () => {
    try {
      const r = await api.get('/api/registrar/transcripts/catalog')
      setCatalogCount(r.data.count)
    } catch { setCatalogCount(0) }
  }, [])

  useEffect(() => { loadCatalog() }, [loadCatalog])

  const loadDefaultCatalog = async () => {
    setBusy('catalog')
    try {
      const r = await api.post('/api/registrar/transcripts/catalog/load-default')
      say(true, r.data.message)
      await loadCatalog()
    } catch (e) { say(false, errText(e)) }
    setBusy('')
  }

  const search = async () => {
    setBusy('search')
    try {
      const r = await api.get('/api/registrar/students', { params: { q } })
      setResults(r.data.students)
      setSearched(true)
    } catch (e) { say(false, errText(e)) }
    setBusy('')
  }

  const openStudent = async (s: StudentLite) => {
    setBusy('open')
    try {
      const r = await api.get(`/api/registrar/transcripts/students/${s.id}`)
      const list: Course[] = r.data.courses
      const p = r.data.profile
      setSelected(s)
      setCourses(list)
      setProfile(p ? {
        refNo: p.refNo || '', programmeTitle: p.programmeTitle || '', certificate: p.certificate || '',
        entryMonth: p.entryMonth || '', completionMonth: p.completionMonth || '', conduct: p.conduct || '',
        examYear: p.examYear || '', examResult: p.examResult || '',
      } : EMPTY_PROFILE)
      const initial: Record<string, string> = {}
      list.forEach(c => { if (c.source === 'transcript' && c.score !== null) initial[c.id] = String(c.score) })
      setScores(initial)
      setFlash(null)
    } catch (e) { say(false, errText(e)) }
    setBusy('')
  }

  const saveProfile = async () => {
    if (!selected) return
    setBusy('profile')
    try {
      await api.put(`/api/registrar/transcripts/students/${selected.id}/profile`, profile)
      say(true, 'Academic details saved.')
    } catch (e) { say(false, errText(e)) }
    setBusy('')
  }

  const originalOf = (c: Course): string => (c.source === 'transcript' && c.score !== null ? String(c.score) : '')

  const saveScores = async () => {
    if (!selected) return
    const changed = courses
      .filter(c => (scores[c.id] ?? '') !== originalOf(c))
      .map(c => ({ courseId: c.id, score: scores[c.id] ?? '' }))
    if (!changed.length) { say(true, 'No changes to save.'); return }
    setBusy('scores')
    try {
      const r = await api.put(`/api/registrar/transcripts/students/${selected.id}/scores`, { scores: changed })
      say(true, `Scores saved (${r.data.saved} added or updated, ${r.data.cleared} cleared).`)
      await openStudent(selected)
    } catch (e) { say(false, errText(e)) }
    setBusy('')
  }

  const previewPdf = async () => {
    if (!selected) return
    setBusy('pdf')
    const tab = window.open('', '_blank')
    try {
      const r = await api.get(`/api/registrar/transcripts/students/${selected.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      if (tab) tab.location.href = url
      else window.location.href = url
    } catch (e) {
      if (tab) tab.close()
      say(false, await blobErrText(e))
    }
    setBusy('')
  }

  const downloadTemplate = async () => {
    setBusy('template')
    try {
      const r = await api.get('/api/registrar/transcripts/scores-template.csv', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'transcript-scores-template.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { say(false, await blobErrText(e)) }
    setBusy('')
  }

  const importScores = async (file: File | undefined) => {
    if (!file) return
    setBusy('import')
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await api.post('/api/registrar/transcripts/import-scores', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportResult(r.data)
      say(true, `Import finished: ${r.data.scoresSaved} scores saved for ${r.data.studentsMatched} students.`)
    } catch (e) { say(false, errText(e)) }
    setBusy('')
  }

  const setP = (k: keyof ProfileForm) => (v: string) => setProfile(prev => ({ ...prev, [k]: v }))

  // group courses by year + semester for display
  const groups: Array<{ year: number; semester: number; list: Course[] }> = []
  courses.forEach(c => {
    const g = groups.find(x => x.year === c.yearOfStudy && x.semester === c.semester)
    if (g) g.list.push(c)
    else groups.push({ year: c.yearOfStudy, semester: c.semester, list: [c] })
  })

  return (
    <div className="bg-bg" style={{ minHeight: '100%' }}>
      <div style={{ background: 'linear-gradient(180deg,#1B4332,#122400)' }} className="px-4 pt-6 pb-5 lg:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <div className="text-[12px] font-plexmono uppercase tracking-widest" style={{ color: '#BFE0C8' }}>Registrar's office</div>
            <h1 className="font-display font-semibold text-white leading-tight mt-1" style={{ fontSize: 28 }}>Transcripts</h1>
            <p className="text-sm" style={{ color: '#CFE0D2' }}>Enter scores for students and alumni and preview the transcript</p>
          </div>
          <button onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border-0 cursor-pointer flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            <ArrowLeft size={15} strokeWidth={2} /> Home
          </button>
        </div>
      </div>

      <div className="px-4 pt-6 pb-24 lg:p-8 lg:pb-8 max-w-5xl mx-auto">
        {flash && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${flash.ok ? 'bg-moss text-ink' : 'bg-red-50 text-red-600'}`}>{flash.text}</div>
        )}

        {/* Course list status */}
        {catalogCount === 0 && (
          <div className="mb-4 p-4 rounded-2xl bg-goldbg border border-mossline">
            <div className="font-semibold text-ink text-sm">The standard course list has not been loaded yet</div>
            <p className="text-xs text-text2 mt-1">
              This adds the Basic Nursing curriculum (55 courses with hours and credit units). You only need to do this once.
            </p>
            <button onClick={loadDefaultCatalog} disabled={busy === 'catalog'}
              className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer bg-field disabled:opacity-60">
              {busy === 'catalog' ? 'Loading…' : 'Load standard course list'}
            </button>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-2xl p-3 mb-3 flex flex-col sm:flex-row gap-2 border border-mossline">
          <div className="flex-1 flex items-center gap-2 px-3 rounded-xl border border-mossline">
            <Search size={16} className="text-text3 flex-shrink-0" />
            <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search() }}
              placeholder="Search a student or alumnus by name or matric number"
              className="flex-1 py-2.5 text-sm border-0 outline-none text-ink bg-transparent" />
          </div>
          <button onClick={search} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer bg-field">
            {busy === 'search' ? 'Searching…' : 'Search'}
          </button>
        </div>

        {searched && !selected && (
          <div className="bg-white rounded-2xl border border-mossline mb-4">
            {results.length === 0 && <div className="p-4 text-sm text-text2">No students found. Alumni must first be added as students.</div>}
            {results.map(s => (
              <button key={s.id} onClick={() => openStudent(s)}
                className="w-full text-left px-4 py-3 border-0 border-b border-mossline bg-transparent cursor-pointer flex items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold text-ink text-sm">{s.name}</span>
                  <span className="block text-xs text-text2 font-plexmono">{s.matricNo || 'No matric number'} · {s.department || 'No programme'} · {s.level || '—'}</span>
                </span>
                <FileText size={16} className="text-field flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Selected student */}
        {selected && (
          <div className="mb-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="font-display font-semibold text-ink text-xl">{selected.name}</div>
                <div className="text-xs text-text2 font-plexmono">{selected.matricNo || 'No matric number'}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setSelected(null); setCourses([]) }}
                  className="px-3 py-2 rounded-xl text-sm font-semibold border border-mossline bg-white cursor-pointer text-ink">Change</button>
                <button onClick={previewPdf} disabled={busy === 'pdf'}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer bg-ink disabled:opacity-60">
                  <FileText size={15} /> {busy === 'pdf' ? 'Building…' : 'Preview transcript'}
                </button>
              </div>
            </div>

            {/* Academic details */}
            <div className="bg-white rounded-2xl p-4 border border-mossline mb-4">
              <div className="font-semibold text-ink text-sm mb-3">Details printed on the transcript</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Reference number" value={profile.refNo} onChange={setP('refNo')} placeholder="e.g. PP/0000/BASIC 2019/00" />
                <Field label="Programme" value={profile.programmeTitle} onChange={setP('programmeTitle')} placeholder="Diploma Education in General Nursing" />
                <Field label="Entered (month and year)" type="month" value={profile.entryMonth} onChange={setP('entryMonth')} />
                <Field label="Completed (month and year)" type="month" value={profile.completionMonth} onChange={setP('completionMonth')} />
                <div className="sm:col-span-2">
                  <Field label="Certificate awarded" value={profile.certificate} onChange={setP('certificate')}
                    placeholder="R.N. Certificate of the Nursing and Midwifery Council of Nigeria" />
                </div>
                <Field label="Conduct" value={profile.conduct} onChange={setP('conduct')} placeholder="satisfactory" />
                <Field label="Council exam: year" value={profile.examYear} onChange={setP('examYear')} placeholder="e.g. NOVEMBER, 2022" />
                <div className="sm:col-span-2">
                  <Field label="Council exam: result" value={profile.examResult} onChange={setP('examResult')}
                    placeholder="e.g. PASSED the Final Qualifying Examination at FIRST ATTEMPT" />
                </div>
              </div>
              <button onClick={saveProfile} disabled={busy === 'profile'}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer bg-field disabled:opacity-60">
                <Save size={15} /> {busy === 'profile' ? 'Saving…' : 'Save details'}
              </button>
            </div>

            {/* Scores */}
            {courses.length === 0 && <div className="p-4 text-sm text-text2 bg-white rounded-2xl border border-mossline">Load the standard course list first.</div>}
            {groups.map(g => (
              <div key={`${g.year}-${g.semester}`} className="bg-white rounded-2xl border border-mossline mb-3 overflow-hidden">
                <div className="px-4 py-2.5 bg-moss font-semibold text-ink text-sm">
                  {YEAR_WORDS[g.year]} year, {SEM_WORDS[g.semester]} semester
                </div>
                {g.list.map(c => (
                  <div key={c.id} className="px-4 py-2 border-t border-mossline flex items-center gap-3">
                    <div className="w-20 text-xs font-plexmono text-text2 flex-shrink-0">{c.code}</div>
                    <div className="flex-1 text-sm text-ink">
                      {c.title}
                      <span className="block text-[11px] text-text2">
                        {c.lectureHours} lecture · {c.practicalHours} practical · {c.creditUnit} credit
                        {c.source === 'results' && (scores[c.id] ?? '') === '' ? ` · from published results: ${c.score}` : ''}
                      </span>
                    </div>
                    <input type="number" min={0} max={100} step="0.5" inputMode="decimal"
                      value={scores[c.id] ?? ''} placeholder="Score"
                      onChange={e => setScores(prev => ({ ...prev, [c.id]: e.target.value }))}
                      className="w-24 px-2 py-1.5 rounded-lg text-sm border border-mossline outline-none text-ink text-right" />
                  </div>
                ))}
              </div>
            ))}
            {courses.length > 0 && (
              <button onClick={saveScores} disabled={busy === 'scores'}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white border-0 cursor-pointer bg-field disabled:opacity-60">
                <Save size={15} /> {busy === 'scores' ? 'Saving…' : 'Save scores'}
              </button>
            )}
          </div>
        )}

        {/* Bulk import */}
        {catalogCount !== null && catalogCount > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-mossline">
            <div className="font-semibold text-ink text-sm">Import scores for a whole class</div>
            <p className="text-xs text-text2 mt-1">
              Download the template, fill in one row per student (matric number and a score under each course; leave a cell empty if
              the course was not taken), save as CSV and upload it. Students must already exist in the system.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={downloadTemplate} disabled={busy === 'template'}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-mossline bg-white cursor-pointer text-ink disabled:opacity-60">
                <Download size={15} /> Download template
              </button>
              <label className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer bg-field">
                <Upload size={15} /> {busy === 'import' ? 'Importing…' : 'Upload filled CSV'}
                <input type="file" accept=".csv,text/csv" className="hidden" disabled={busy === 'import'}
                  onChange={e => { importScores(e.target.files?.[0]); e.target.value = '' }} />
              </label>
            </div>
            {importResult && (
              <div className="mt-3 text-xs text-ink">
                <div>{importResult.scoresSaved} scores saved for {importResult.studentsMatched} students.
                  {importResult.unknownMatrics > 0 ? ` ${importResult.unknownMatrics} matric numbers were not found.` : ''}</div>
                {importResult.unrecognisedColumns.length > 0 && (
                  <div className="mt-1 text-text2">Ignored columns: {importResult.unrecognisedColumns.join(', ')}</div>
                )}
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-red-600">
                    {importResult.errors.map((er, i) => <li key={i}>Row {er.row} ({er.matric}): {er.message}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
