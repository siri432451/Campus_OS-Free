import prisma from '../utils/prisma'
import { BASIC_NURSING } from '../data/basicNursingCurriculum'

// ── Grading scale (as printed on the college transcript) ──────
//  A  80% and above  Distinction   B  70–79%  Credit
//  C  50–69%  Pass                 F  49% and below  Fail
export function remarkFor(score: number): string {
  if (score >= 80) return 'DISTINCTION'
  if (score >= 70) return 'CREDIT'
  if (score >= 50) return 'PASSED'
  return 'FAILED'
}

export const normCode = (code: string): string => code.replace(/\s+/g, '').toUpperCase()

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December']

/** 'YYYY-MM' → 'October, 2019' (empty string when missing or invalid) */
export function monthLabel(ym?: string | null): string {
  if (!ym) return ''
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(ym)
  return m ? `${MONTHS[parseInt(m[2], 10) - 1]}, ${m[1]}` : ''
}

export function ordinalSuffix(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return 'th'
  const map: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' }
  return map[day % 10] || 'th'
}

/** e.g. '10TH OCTOBER, 2026' (used for the issue date) */
export function ordinalDate(d: Date): string {
  return `${d.getDate()}${ordinalSuffix(d.getDate()).toUpperCase()} ${MONTHS[d.getMonth()].toUpperCase()}, ${d.getFullYear()}`
}

/** e.g. '15th May, 2003' (date of birth is stored as a UTC date) */
export function dobLabel(d: Date): string {
  return `${d.getUTCDate()}${ordinalSuffix(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}, ${d.getUTCFullYear()}`
}

export const YEAR_WORDS = ['', 'FIRST', 'SECOND', 'THIRD', 'FOURTH']
export const SEM_WORDS = ['', 'FIRST', 'SECOND']

export interface CourseWithScore {
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

export interface TranscriptRow {
  sn: number
  code: string
  title: string
  lecture: number
  practical: number
  total: number
  credit: number
  score: number
  remark: string
}

export interface TranscriptSemester {
  year: number
  semester: number
  rows: TranscriptRow[]
}

export interface TranscriptData {
  student: {
    id: string; name: string; matricNo: string | null; gender: string | null
    dateOfBirth: Date | null; level: string | null; department: string | null
  }
  profile: {
    refNo: string | null; programmeTitle: string | null; certificate: string | null
    entryMonth: string | null; completionMonth: string | null; conduct: string | null
    examYear: string | null; examResult: string | null
  } | null
  courses: CourseWithScore[]
  semesters: TranscriptSemester[]
}

/**
 * Loads a student's curriculum with scores.
 * Score priority: a score typed into the transcript record, otherwise the student's published
 * Result for the same course code (only when that code appears once in the curriculum).
 */
export async function loadTranscript(studentId: string, programme = BASIC_NURSING): Promise<TranscriptData | null> {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, matricNo: true, gender: true, dateOfBirth: true, level: true, department: true, role: true },
  })
  if (!student || student.role !== 'STUDENT') return null

  const [profile, catalog, scores, results] = await Promise.all([
    prisma.academicProfile.findUnique({ where: { studentId } }),
    prisma.transcriptCourse.findMany({
      where: { programme },
      orderBy: [{ yearOfStudy: 'asc' }, { semester: 'asc' }, { serial: 'asc' }],
    }),
    prisma.transcriptScore.findMany({ where: { studentId } }),
    prisma.result.findMany({
      where: { studentId, isPublished: true },
      orderBy: { createdAt: 'desc' },
      select: { courseCode: true, score: true },
    }),
  ])

  const scoreByCourse = new Map<string, number>(scores.map(s => [s.courseId, s.score]))
  const resultByCode = new Map<string, number>()
  for (const r of results) {
    const k = normCode(r.courseCode)
    if (!resultByCode.has(k)) resultByCode.set(k, Number(r.score))
  }
  const codeCount = new Map<string, number>()
  for (const c of catalog) codeCount.set(normCode(c.code), (codeCount.get(normCode(c.code)) || 0) + 1)

  const courses: CourseWithScore[] = catalog.map(c => {
    let score: number | null = null
    let source: CourseWithScore['source'] = null
    const typed = scoreByCourse.get(c.id)
    if (typed !== undefined) { score = typed; source = 'transcript' }
    else if (codeCount.get(normCode(c.code)) === 1 && resultByCode.has(normCode(c.code))) {
      score = resultByCode.get(normCode(c.code)) as number
      source = 'results'
    }
    return {
      id: c.id, yearOfStudy: c.yearOfStudy, semester: c.semester, serial: c.serial,
      code: c.code, key: c.key, title: c.title, lectureHours: c.lectureHours,
      practicalHours: c.practicalHours, creditUnit: c.creditUnit, score, source,
    }
  })

  // Only courses that have a score appear on the printed transcript
  const semesters: TranscriptSemester[] = []
  for (const year of [1, 2, 3, 4]) {
    for (const semester of [1, 2]) {
      const rows = courses
        .filter(c => c.yearOfStudy === year && c.semester === semester && c.score !== null)
        .map((c, i): TranscriptRow => ({
          sn: i + 1, code: c.code, title: c.title, lecture: c.lectureHours, practical: c.practicalHours,
          total: c.lectureHours + c.practicalHours, credit: c.creditUnit,
          score: c.score as number, remark: remarkFor(c.score as number),
        }))
      if (rows.length) semesters.push({ year, semester, rows })
    }
  }

  return {
    student: {
      id: student.id, name: student.name, matricNo: student.matricNo, gender: student.gender,
      dateOfBirth: student.dateOfBirth, level: student.level, department: student.department,
    },
    profile: profile ? {
      refNo: profile.refNo, programmeTitle: profile.programmeTitle, certificate: profile.certificate,
      entryMonth: profile.entryMonth, completionMonth: profile.completionMonth, conduct: profile.conduct,
      examYear: profile.examYear, examResult: profile.examResult,
    } : null,
    courses,
    semesters,
  }
}
