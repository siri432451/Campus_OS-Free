import { Router, Response } from 'express'
import { Grade } from '@prisma/client'
import prisma from '../utils/prisma'
import { authenticate, isLecturer, AuthRequest } from '../middleware/auth'

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

function calcGrade(score: number): { grade: Grade; point: number } {
  if (score >= 70) return { grade: Grade.A, point: 5.0 }
  if (score >= 60) return { grade: Grade.B, point: 4.0 }
  if (score >= 50) return { grade: Grade.C, point: 3.0 }
  if (score >= 45) return { grade: Grade.D, point: 2.0 }
  if (score >= 40) return { grade: Grade.E, point: 1.0 }
  return { grade: Grade.F, point: 0.0 }
}

// ── GET /api/results/courses ───────────────────────────────────
router.get('/courses', (_req, res: Response): void => {
  res.json({ courses: COURSES })
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
    const { studentId, courseCode, courseName, semester, academicYear, score, creditUnit } = req.body
    if (!studentId || !courseCode || score === undefined) {
      res.status(400).json({ error: 'Missing required fields' }); return
    }
    const { grade, point } = calcGrade(Number(score))
    const result = await prisma.result.upsert({
      where: { studentId_courseCode_semester_academicYear: { studentId, courseCode, semester, academicYear } },
      update: { score, grade, gradePoint: point, creditUnit, lecturerId: req.user!.id, isPublished: false, approvedAt: null, approvedById: null, rejectedAt: null, rejectedById: null, rejectionReason: null },
      create: { studentId, courseCode, courseName, semester, academicYear, score, grade, gradePoint: point, creditUnit: creditUnit || 2, lecturerId: req.user!.id },
    })
    res.status(201).json(result)
  } catch { res.status(500).json({ error: 'Failed to save result' }) }
})

// ── POST /api/results/bulk ─────────────────────────────────────
router.post('/bulk', isLecturer, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { results, semester, academicYear } = req.body as {
      results: Array<{ studentId: string; courseCode: string; courseName: string; score: number; creditUnit?: number }>
      semester: string
      academicYear: string
    }
    if (!Array.isArray(results) || results.length === 0) {
      res.status(400).json({ error: 'results array required' }); return
    }
    let created = 0
    for (const r of results) {
      const { grade, point } = calcGrade(Number(r.score))
      await prisma.result.upsert({
        where: { studentId_courseCode_semester_academicYear: { studentId: r.studentId, courseCode: r.courseCode, semester, academicYear } },
        update: { score: r.score, grade, gradePoint: point, creditUnit: r.creditUnit || 2, lecturerId: req.user!.id, isPublished: false, approvedAt: null, approvedById: null, rejectedAt: null, rejectedById: null, rejectionReason: null },
        create: { studentId: r.studentId, courseCode: r.courseCode, courseName: r.courseName, semester, academicYear, score: r.score, grade, gradePoint: point, creditUnit: r.creditUnit || 2, lecturerId: req.user!.id },
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
    if (['ND1', 'ND2', 'HND1', 'HND2'].includes(level)) where.level = level
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
