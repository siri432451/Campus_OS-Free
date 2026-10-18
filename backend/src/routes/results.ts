import { Router, Response } from 'express'
import { Grade } from '@prisma/client'
import prisma from '../utils/prisma'
import { authenticate, isLecturer, AuthRequest } from '../middleware/auth'
import { BASIC_NURSING_CURRICULUM } from '../data/basicNursingCurriculum'

const router = Router()
router.use(authenticate)

const ADMIN_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN']

export const COURSES = [
  'Anatomy',
  'Pharmacology',
  'Nutrition & Dietetics',
  'Primary Health Care (PHC)',
  'Medical-Surgical Nursing',
  'Foundation of Nursing (Concepts)',
  'Foundation of Nursing (Practical)',
  'Community Health Nursing',
  'Family Planning',
  'Maternal & Child Health',
  'Paediatric Nursing',
  'Psychiatric Nursing',
  'Geriatric Nursing',
  'Microbiology',
  'Physiology',
  'Biochemistry',
  'Health Education',
  'Sociology',
  'Psychology',
  'Research Methods',
]

// Same bands as the printed transcript: A 80+ (Distinction), B 70-79 (Credit),
// C 50-69 (Pass), F 49 and below (Fail).
function calcGrade(score: number): { grade: Grade; point: number } {
  if (score >= 80) return { grade: Grade.A, point: 5.0 }
  if (score >= 70) return { grade: Grade.B, point: 4.0 }
  if (score >= 50) return { grade: Grade.C, point: 3.0 }
  return { grade: Grade.F, point: 0.0 }
}

// Student level -> year of the 3-year Basic Nursing programme
const LEVEL_YEARS = [
  { level: 'ND1', year: 1, label: 'Year 1' },
  { level: 'ND2', year: 2, label: 'Year 2' },
  { level: 'ND3', year: 3, label: 'Year 3' },
]

const normCode = (c: string): string => (c || '').replace(/\s+/g, '').toUpperCase()
const semesterNo = (s: string): number => (/second/i.test(s || '') ? 2 : /first/i.test(s || '') ? 1 : 0)

/** Finds the curriculum course for a code (and semester). Title, code and credit units come from here. */
function resolveCourse(code: string, name: string | undefined, semester: string) {
  const sem = semesterNo(semester)
  const matches = BASIC_NURSING_CURRICULUM.filter(
    c => normCode(c.code) === normCode(code) && (!sem || c.semester === sem)
  )
  if (!matches.length) return null
  return matches.find(c => name && c.title.toLowerCase() === name.toLowerCase()) ?? matches[0]
}

const validScore = (n: unknown): boolean => n !== '' && n !== null && !isNaN(Number(n)) && Number(n) >= 0 && Number(n) <= 100

// ── GET /api/results/courses ───────────────────────────────────
router.get('/courses', (_req, res: Response): void => {
  res.json({ courses: COURSES })
})

// ── GET /api/results/curriculum ────────────────────────────────
// Courses for each year and semester, taken from the transcript curriculum
router.get('/curriculum', (_req, res: Response): void => {
  const levels = LEVEL_YEARS.map(l => ({
    ...l,
    semesters: [1, 2].map(sem => ({
      semester: sem,
      label: sem === 1 ? 'First Semester' : 'Second Semester',
      courses: BASIC_NURSING_CURRICULUM
        .filter(c => c.year === l.year && c.semester === sem)
        .map(c => ({ code: c.code, title: c.title, lecture: c.lecture, practical: c.practical, credit: c.credit })),
    })),
  }))
  res.json({ levels })
})

// ── GET /api/results/my ────────────────────────────────────────
router.get('/my', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const results = await prisma.result.findMany({
      where: { studentId: req.user!.id, isPublished: true },
      orderBy: [{ academicYear: 'desc' }, { semester: 'desc' }],
    })
    const grouped: Record<string, typeof results> = {}
    for (const r of results) {
      const key = `${r.academicYear}-${r.semester}`
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(r)
    }
    const semesters = Object.entries(grouped).map(([key, courses]) => {
      const [year, sem] = key.split(/-(.+)/)
      return { academicYear: year, semester: sem, courses }
    })
    res.json(semesters)
  } catch { res.status(500).json({ error: 'Failed to fetch results' }) }
})

// ── POST /api/results ──────────────────────────────────────────
router.post('/', isLecturer, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { studentId, courseCode, courseName, semester, academicYear, score } = req.body
    if (!studentId || !courseCode || score === undefined) {
      res.status(400).json({ error: 'Missing required fields' }); return
    }
    if (!validScore(score)) { res.status(400).json({ error: 'Score must be between 0 and 100' }); return }
    const course = resolveCourse(courseCode, courseName, semester)
    if (!course) {
      res.status(400).json({ error: `"${courseCode}" is not a course in the ${semester} curriculum` }); return
    }
    const { grade, point } = calcGrade(Number(score))
    const result = await prisma.result.upsert({
      where: { studentId_courseCode_semester_academicYear: { studentId, courseCode: course.code, semester, academicYear } },
      update: { courseName: course.title, score, grade, gradePoint: point, creditUnit: course.credit, lecturerId: req.user!.id, isPublished: false, approvedAt: null, approvedById: null, rejectedAt: null, rejectedById: null, rejectionReason: null },
      create: { studentId, courseCode: course.code, courseName: course.title, semester, academicYear, score, grade, gradePoint: point, creditUnit: course.credit, lecturerId: req.user!.id },
    })
    res.status(201).json(result)
  } catch { res.status(500).json({ error: 'Failed to save result' }) }
})

// ── POST /api/results/bulk ─────────────────────────────────────
router.post('/bulk', isLecturer, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { results, semester, academicYear } = req.body as {
      results: Array<{ studentId: string; courseCode: string; courseName: string; score: number }>
      semester: string
      academicYear: string
    }
    if (!Array.isArray(results) || results.length === 0) {
      res.status(400).json({ error: 'results array required' }); return
    }
    // Check every row first so nothing is half-saved
    const rows = []
    for (const r of results) {
      if (!validScore(r.score)) { res.status(400).json({ error: 'Every score must be between 0 and 100' }); return }
      const course = resolveCourse(r.courseCode, r.courseName, semester)
      if (!course) {
        res.status(400).json({ error: `"${r.courseCode}" is not a course in the ${semester} curriculum` }); return
      }
      rows.push({ r, course })
    }
    let created = 0
    for (const { r, course } of rows) {
      const { grade, point } = calcGrade(Number(r.score))
      await prisma.result.upsert({
        where: { studentId_courseCode_semester_academicYear: { studentId: r.studentId, courseCode: course.code, semester, academicYear } },
        update: { courseName: course.title, score: r.score, grade, gradePoint: point, creditUnit: course.credit, lecturerId: req.user!.id, isPublished: false, approvedAt: null, approvedById: null, rejectedAt: null, rejectedById: null, rejectionReason: null },
        create: { studentId: r.studentId, courseCode: course.code, courseName: course.title, semester, academicYear, score: r.score, grade, gradePoint: point, creditUnit: course.credit, lecturerId: req.user!.id },
      })
      created++
    }
    res.status(201).json({ created })
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to bulk save results' }) }
})

// ── GET /api/results/admin/pending ────────────────────────────
router.get('/admin/pending', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!ADMIN_ROLES.includes(req.user!.role)) { res.status(403).json({ error: 'Admin only' }); return }
    const { status = 'pending', search = '', course = '' } = req.query as Record<string, string>

    const publishedFilter = status === 'approved' ? true : status === 'rejected' ? false : false
    const where: Record<string, unknown> = {}
    if (status === 'pending') where.isPublished = false
    else if (status === 'approved') { where.isPublished = true; where.approvedAt = { not: null } }
    else if (status === 'rejected') { where.isPublished = false; where.rejectedAt = { not: null } }

    if (course.trim()) where.courseName = { contains: course.trim(), mode: 'insensitive' }

    const results = await prisma.result.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { id: true, name: true, matricNo: true, department: true, level: true } },
        lecturer: { select: { id: true, name: true, staffId: true } },
      },
    })

    // Filter by search after join
    const filtered = search.trim()
      ? results.filter(r =>
          r.student.name.toLowerCase().includes(search.toLowerCase()) ||
          (r.student.matricNo || '').toLowerCase().includes(search.toLowerCase())
        )
      : results

    res.json({ results: filtered })
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to fetch pending results' }) }
})

// ── PATCH /api/results/:id/approve ────────────────────────────
router.patch('/:id/approve', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!ADMIN_ROLES.includes(req.user!.role)) { res.status(403).json({ error: 'Admin only' }); return }
    const result = await prisma.result.update({
      where: { id: req.params.id },
      data: { isPublished: true, approvedAt: new Date(), approvedById: req.user!.id, rejectedAt: null, rejectedById: null, rejectionReason: null },
    })
    res.json({ ok: true, result })
  } catch { res.status(500).json({ error: 'Failed to approve' }) }
})

// ── PATCH /api/results/:id/reject ─────────────────────────────
router.patch('/:id/reject', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!ADMIN_ROLES.includes(req.user!.role)) { res.status(403).json({ error: 'Admin only' }); return }
    const { reason } = req.body
    const result = await prisma.result.update({
      where: { id: req.params.id },
      data: { isPublished: false, rejectedAt: new Date(), rejectedById: req.user!.id, rejectionReason: reason || null, approvedAt: null, approvedById: null },
    })
    res.json({ ok: true, result })
  } catch { res.status(500).json({ error: 'Failed to reject' }) }
})

// ── PATCH /api/results/admin/batch-approve ────────────────────
router.patch('/admin/batch-approve', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!ADMIN_ROLES.includes(req.user!.role)) { res.status(403).json({ error: 'Admin only' }); return }
    const { ids } = req.body as { ids: string[] }
    if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: 'ids array required' }); return }
    await prisma.result.updateMany({
      where: { id: { in: ids } },
      data: { isPublished: true, approvedAt: new Date(), approvedById: req.user!.id },
    })
    res.json({ ok: true, approved: ids.length })
  } catch { res.status(500).json({ error: 'Failed to batch approve' }) }
})

// ── GET /api/results/student/:studentId ───────────────────────
router.get('/student/:studentId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isOwn = req.user!.id === req.params.studentId
    const isStaff = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'LECTURER'].includes(req.user!.role)
    if (!isOwn && !isStaff) { res.status(403).json({ error: 'Forbidden' }); return }
    const results = await prisma.result.findMany({
      where: { studentId: req.params.studentId, isPublished: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json(results)
  } catch { res.status(500).json({ error: 'Failed to fetch results' }) }
})


// GET /api/results/students?level=ND1 — lecturer loads students (optionally by level)
router.get('/students', isLecturer, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const level = (req.query.level as string) || ''
    const where: Record<string, unknown> = { role: 'STUDENT' }
    if (['ND1', 'ND2', 'ND3', 'HND1', 'HND2'].includes(level)) where.level = level
    const students = await prisma.user.findMany({
      where,
      select: { id: true, name: true, matricNo: true, department: true, level: true },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      take: 500,
    })
    res.json({ students })
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to load students' }) }
})

export default router
