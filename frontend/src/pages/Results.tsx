import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import GradeBadge from '../components/GradeBadge'
import { Skeleton, ResultRowSkeleton } from '../components/Skeleton'

// ── Types ─────────────────────────────────────────────────────
interface Course {
  id: string
  courseCode: string
  courseName: string
  semester: string
  academicYear: string
  score: number
  grade: string
  creditUnit: number
  gradePoint: number
}

interface Semester {
  academicYear: string
  semester: string
  gpa: string
  courses: Course[]
}

// ── Helpers ───────────────────────────────────────────────────
const GRADE_COLOR: Record<string, string> = {
  A: '#15803D', B: '#1D4ED8', C: '#B45309', D: '#C2410C', E: '#C2410C', F: '#DC2626'
}

function semLabel(s: Semester) {
  return `${s.academicYear} — Semester ${s.semester}`
}

function cgpa(semesters: Semester[]): string {
  if (!semesters.length) return '—'
  const allCourses = semesters.flatMap(s => s.courses)
  const totalPoints = allCourses.reduce((acc, c) => acc + (c.gradePoint ?? 0) * (c.creditUnit ?? 0), 0)
  const totalUnits = allCourses.reduce((acc, c) => acc + (c.creditUnit ?? 0), 0)
  return totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : '—'
}

function gpaClass(gpa: string): string {
  const n = parseFloat(gpa)
  if (n >= 4.5) return 'First Class'
  if (n >= 3.5) return 'Second Class Upper'
  if (n >= 2.5) return 'Second Class Lower'
  if (n >= 1.5) return 'Third Class'
  return 'Pass'
}

// ── Desktop table row ─────────────────────────────────────────
function CourseRow({ course }: { course: Course }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-purple-50/30 transition-colors">
      <td className="py-3 px-4">
        <span className="font-mono text-sm font-bold" style={{ color: '#122400' }}>
          {course.courseCode}
        </span>
      </td>
      <td className="py-3 px-4">
        <span className="text-sm font-medium" style={{ color: '#1B4332' }}>{course.courseName}</span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className="text-sm" style={{ color: '#64748b' }}>{course.creditUnit}</span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className="text-sm font-bold" style={{ color: GRADE_COLOR[course.grade] ?? '#64748b' }}>
          {typeof course.score === 'number' ? course.score.toFixed(1) : course.score}%
        </span>
      </td>
      <td className="py-3 px-4 text-center">
        <GradeBadge grade={course.grade} size="sm" />
      </td>
      <td className="py-3 px-4 text-center">
        <span className="text-sm" style={{ color: '#64748b' }}>
          {typeof course.gradePoint === 'number' ? course.gradePoint.toFixed(1) : course.gradePoint}
        </span>
      </td>
    </tr>
  )
}

// ── Mobile course card ────────────────────────────────────────
function CourseCard({ course }: { course: Course }) {
  return (
    <div className="bg-white rounded-2xl p-4 mb-3 flex items-center gap-3"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <GradeBadge grade={course.grade} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate" style={{ color: '#1B4332' }}>{course.courseName}</p>
        <p className="text-xs mt-0.5" style={{ color: '#8A9BB0' }}>
          {course.courseCode} · {course.creditUnit} units
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-black text-lg leading-none"
          style={{ color: GRADE_COLOR[course.grade] ?? '#64748b' }}>
          {typeof course.score === 'number' ? course.score.toFixed(0) : course.score}%
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#8A9BB0' }}>
          GP {typeof course.gradePoint === 'number' ? course.gradePoint.toFixed(1) : course.gradePoint}
        </p>
      </div>
    </div>
  )
}

// ── GPA circle ────────────────────────────────────────────────
function GPACircle({ gpa, label }: { gpa: string; label: string }) {
  const n = parseFloat(gpa)
  const color = n >= 4.5 ? '#15803D' : n >= 3.5 ? '#122400' : n >= 2.5 ? '#1D4ED8' : n >= 1.5 ? '#B45309' : '#DC2626'
  return (
    <div className="text-center">
      <div className="inline-flex flex-col items-center justify-center w-24 h-24 rounded-full border-4"
        style={{ borderColor: color, background: `${color}10` }}>
        <span className="font-black text-2xl leading-none" style={{ color }}>{gpa}</span>
        <span className="text-[9px] font-bold uppercase tracking-wide mt-1" style={{ color: '#8A9BB0' }}>GPA</span>
      </div>
      <p className="text-[11px] font-medium mt-2" style={{ color: '#8A9BB0' }}>{label}</p>
    </div>
  )
}

export default function Results() {
  const navigate = useNavigate()
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeSem, setActiveSem] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.get<Semester[]>('/api/results/my')
      .then(r => { if (!cancelled) { setSemesters(r.data); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  const current = semesters[activeSem]
  const cumulativeGpa = cgpa(semesters)

  // ── Mobile ────────────────────────────────────────────────
  const MobileContent = (
    <div className="h-full flex flex-col" style={{ background: '#F5F7FA' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#1B4332,#122400)', padding: '52px 24px 24px', borderRadius: '0 0 28px 28px' }}>
        <button onClick={() => navigate('/dashboard')}
          className="border-0 bg-transparent cursor-pointer mb-3 text-sm font-medium"
          style={{ color: 'rgba(255,255,255,0.7)', padding: 0 }}>← Back</button>
        <h1 className="font-black text-2xl text-white">Results</h1>

        {!loading && current && (
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {semLabel(current)}
          </p>
        )}

        {/* GPA banner */}
        <div className="mt-4 rounded-2xl p-4 flex justify-between items-center"
          style={{ background: 'rgba(39,174,96,0.15)', border: '1px solid rgba(39,174,96,0.3)' }}>
          {loading
            ? <>
                <div>
                  <Skeleton className="h-3 w-24 mb-2" style={{ background: 'rgba(255,255,255,0.15)' }} />
                  <Skeleton className="h-8 w-16" style={{ background: 'rgba(255,255,255,0.1)' }} />
                </div>
              </>
            : <>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Courses this semester</p>
                  <p className="font-black text-3xl leading-none" style={{ color: '#4ade80' }}>
                    {current?.courses.length ?? 0}
                  </p>
                </div>
              </>
          }
        </div>
      </div>

      {/* Semester selector (if multiple) */}
      {semesters.length > 1 && (
        <div className="flex gap-2 px-6 py-4 overflow-x-auto">
          {semesters.map((s, i) => (
            <button key={i} onClick={() => setActiveSem(i)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border-0 cursor-pointer"
              style={{ background: i === activeSem ? '#122400' : '#fff', color: i === activeSem ? '#fff' : '#8A9BB0', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
              {s.academicYear} S{s.semester}
            </button>
          ))}
        </div>
      )}

      {/* Course list */}
      <div className="flex-1 overflow-y-auto px-6 pb-24 pt-4">
        {loading && [0,1,2,3,4].map(i => <ResultRowSkeleton key={i} />)}

        {!loading && error && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="font-bold" style={{ color: '#1B4332' }}>Failed to load results</p>
          </div>
        )}

        {!loading && !error && semesters.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-bold mb-1" style={{ color: '#1B4332' }}>No results yet</p>
            <p className="text-sm" style={{ color: '#8A9BB0' }}>Results will appear here once approved by admin</p>
          </div>
        )}

        {!loading && current && current.courses.map(c => <CourseCard key={c.id} course={c} />)}
      </div>
    </div>
  )

  // ── Desktop ───────────────────────────────────────────────
  const DesktopContent = (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-8 py-4"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div className="max-w-5xl xl:max-w-6xl 2xl:max-w-[1500px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-black text-2xl" style={{ color: '#1B4332' }}>Results</h1>
            {!loading && current && (
              <p className="text-sm mt-0.5" style={{ color: '#8A9BB0' }}>{semLabel(current)}</p>
            )}
          </div>

          {/* Semester selector */}
          {semesters.length > 1 && (
            <select value={activeSem} onChange={e => setActiveSem(Number(e.target.value))}
              className="text-sm font-semibold px-4 py-2.5 rounded-xl border outline-none cursor-pointer"
              style={{ borderColor: '#E8EDF2', background: '#F5F7FA', color: '#1B4332' }}>
              {semesters.map((s, i) => (
                <option key={i} value={i}>{semLabel(s)}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="px-6 xl:px-8 py-8 max-w-5xl xl:max-w-6xl 2xl:max-w-[1500px] mx-auto">
        {/* GPA summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 xl:gap-5 mb-8">
          {loading
            ? [0,1,2].map(i => (
                <div key={i} className="bg-white rounded-2xl p-6 text-center" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                  <Skeleton className="h-24 w-24 rounded-full mx-auto mb-3" />
                  <Skeleton className="h-3 w-20 mx-auto" />
                </div>
              ))
            : <>
                <div className="bg-white rounded-2xl p-6 text-center" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                  <GPACircle gpa={current?.gpa ?? '—'} label="Semester GPA" />
                </div>

                <div className="bg-white rounded-2xl p-6 flex flex-col items-center justify-center" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                  <div className="w-24 h-24 rounded-full flex items-center justify-center mb-2"
                    style={{ background: '#E3EFE7' }}>
                    <span className="font-black text-2xl" style={{ color: '#122400' }}>
                      {current?.courses.length ?? 0}
                    </span>
                  </div>
                  <p className="text-xs font-medium" style={{ color: '#8A9BB0' }}>Courses this semester</p>
                  <p className="text-xs font-bold mt-1" style={{ color: '#122400' }}>
                    {gpaClass(current?.gpa ?? '0')}
                  </p>
                </div>
              </>
          }
        </div>

        {/* Results table */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
          {loading && (
            <div className="p-6 space-y-3">
              {[0,1,2,3,4,5].map(i => <ResultRowSkeleton key={i} />)}
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">⚠️</p>
              <p className="font-black text-lg mb-2" style={{ color: '#1B4332' }}>Failed to load results</p>
              <button onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-xl text-white font-bold border-0 cursor-pointer text-sm"
                style={{ background: '#122400' }}>Retry</button>
            </div>
          )}

          {!loading && !error && semesters.length === 0 && (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-black text-lg mb-2" style={{ color: '#1B4332' }}>No results published yet</p>
              <p className="text-sm" style={{ color: '#8A9BB0' }}>Results will appear here once approved by admin</p>
            </div>
          )}

          {!loading && !error && current && current.courses.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>Code</th>
                  <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>Course Title</th>
                  <th className="py-3 px-4 text-center text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>Units</th>
                  <th className="py-3 px-4 text-center text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>Score</th>
                  <th className="py-3 px-4 text-center text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>Grade</th>
                  <th className="py-3 px-4 text-center text-xs font-bold uppercase tracking-wide" style={{ color: '#8A9BB0' }}>GP</th>
                </tr>
              </thead>
              <tbody>
                {current.courses.map(c => <CourseRow key={c.id} course={c} />)}
              </tbody>
              <tfoot>
                <tr style={{ background: '#F5F7FA' }}>
                  <td colSpan={2} className="py-3 px-4 text-sm font-bold" style={{ color: '#1B4332' }}>Total</td>
                  <td className="py-3 px-4 text-center text-sm font-bold" style={{ color: '#1B4332' }}>
                    {current.courses.reduce((s, c) => s + (c.creditUnit ?? 0), 0)}
                  </td>
                  <td />
                  <td />
                  <td className="py-3 px-4 text-center text-sm font-bold" style={{ color: '#122400' }}>
                    GPA: {current.gpa}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div className="lg:hidden h-full">{MobileContent}</div>
      <div className="hidden lg:block">{DesktopContent}</div>
    </>
  )
}
