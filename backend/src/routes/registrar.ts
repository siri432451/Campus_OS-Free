import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'
import prisma from '../utils/prisma'
import { authenticate, isRegistrar, AuthRequest } from '../middleware/auth'
import { sendWelcomeEmail } from '../services/onboarding'

const router = Router()
router.use(authenticate)
router.use(isRegistrar)

const DEFAULT_PASSWORD = 'Student123!'
const VALID_LEVELS = ['ND1', 'ND2', 'ND3', 'HND1', 'HND2']
const LEVEL_ORDER = ['ND1', 'ND2', 'ND3', 'HND1', 'HND2', 'RM1', 'RM2', 'RM3', 'PB1', 'PB2', 'Unspecified']
const levelRank = (l: string) => { const i = LEVEL_ORDER.indexOf(l); return i < 0 ? 99 : i }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STAFF_ROLES = [Role.LECTURER, Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINT_OPERATOR, Role.REGISTRAR]
// Directory excludes system/admin accounts (super admin, school admin, print operator)
const DIRECTORY_ROLES = [Role.LECTURER, Role.REGISTRAR]

const STUDENT_SELECT = {
  id: true, name: true, matricNo: true, level: true, department: true,
  email: true, phone: true, gender: true, dateOfBirth: true, stateOfOrigin: true,
  isActive: true, emailVerifiedAt: true, photoUrl: true,
  admissionDate: true, lastLogin: true, createdAt: true,
}

// ── GET /api/registrar/stats ──────────────────────────────────
router.get('/stats', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const [
      grouped, totalStudents, activeStudents, lecturers, admins, operators, registrars,
      recentlyActive, totalStaff, activeStaff, hods, lecturersByDeptRaw,
    ] = await Promise.all([
      prisma.user.groupBy({ by: ['department', 'level'], where: { role: Role.STUDENT }, _count: { _all: true } }),
      prisma.user.count({ where: { role: Role.STUDENT } }),
      prisma.user.count({ where: { role: Role.STUDENT, isActive: true } }),
      prisma.user.count({ where: { role: Role.LECTURER } }),
      prisma.user.count({ where: { role: { in: [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN] } } }),
      prisma.user.count({ where: { role: Role.PRINT_OPERATOR } }),
      prisma.user.count({ where: { role: Role.REGISTRAR } }),
      prisma.user.count({ where: { lastLogin: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { role: { in: STAFF_ROLES } } }),
      prisma.user.count({ where: { role: { in: STAFF_ROLES }, isActive: true } }),
      prisma.user.count({ where: { role: Role.LECTURER, isHod: true } }),
      prisma.user.groupBy({ by: ['department'], where: { role: Role.LECTURER }, _count: { _all: true } }),
    ])

    const deptMap: Record<string, { level: string; count: number }[]> = {}
    for (const row of grouped) {
      const dept = (row.department && row.department.trim()) || 'Unspecified'
      const level = (row.level as string | null) || 'Unspecified'
      if (!deptMap[dept]) deptMap[dept] = []
      deptMap[dept].push({ level, count: row._count._all })
    }
    const departments = Object.keys(deptMap).sort().map(dept => {
      const levels = deptMap[dept].sort((a, b) => levelRank(a.level) - levelRank(b.level))
      const total = levels.reduce((s, l) => s + l.count, 0)
      return { department: dept, total, levels }
    }).sort((a, b) => b.total - a.total)

    const lecturersByDepartment = lecturersByDeptRaw
      .map(r => ({ department: (r.department && r.department.trim()) || 'Unassigned', count: r._count._all }))
      .sort((a, b) => b.count - a.count)

    res.json({
      students: { total: totalStudents, active: activeStudents, departments },
      staff: {
        total: totalStaff, active: activeStaff,
        lecturers, admins, operators, registrars, hods,
        lecturersByDepartment,
      },
      engagement: { recentlyActive7d: recentlyActive },
    })
  } catch {
    res.status(500).json({ error: 'Failed to load registrar stats' })
  }
})

// ── GET /api/registrar/staff?role=&q= — read-only directory ───
router.get('/staff', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = ((req.query.q as string) || '').trim()
    const roleFilter = ((req.query.role as string) || '').trim().toUpperCase()

    const roleMap: Record<string, Role[]> = {
      LECTURER: [Role.LECTURER],
      REGISTRAR: [Role.REGISTRAR],
    }
    const where: any = { role: { in: roleMap[roleFilter] || DIRECTORY_ROLES } }
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { staffId: { contains: q, mode: 'insensitive' } },
      ]
    }

    const staff = await prisma.user.findMany({
      where, take: 300,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: {
        id: true, name: true, role: true, staffId: true, email: true,
        department: true, phone: true, isHod: true, isActive: true,
        photoUrl: true, lastLogin: true,
      },
    })
    res.json({ count: staff.length, staff })
  } catch {
    res.status(500).json({ error: 'Failed to load staff' })
  }
})

// ── GET /api/registrar/departments ────────────────────────────
router.get('/departments', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rows = await prisma.user.findMany({
      where: { role: Role.STUDENT, department: { not: null } },
      select: { department: true }, distinct: ['department'], orderBy: { department: 'asc' },
    })
    res.json({ departments: rows.map(r => r.department).filter(Boolean) })
  } catch {
    res.status(500).json({ error: 'Failed to load departments' })
  }
})

// ── GET /api/registrar/students?q=&level=&department= ─────────
router.get('/students', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = ((req.query.q as string) || '').trim()
    const level = ((req.query.level as string) || '').trim()
    const department = ((req.query.department as string) || '').trim()

    const where: any = { role: Role.STUDENT }
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { matricNo: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (level && level !== 'Unspecified') where.level = level
    if (level === 'Unspecified') where.level = null
    if (department && department !== 'Unspecified') where.department = department
    if (department === 'Unspecified') where.department = null

    const students = await prisma.user.findMany({ where, take: 200, orderBy: { name: 'asc' }, select: STUDENT_SELECT })
    res.json({ count: students.length, students })
  } catch {
    res.status(500).json({ error: 'Failed to search students' })
  }
})

// ── POST /api/registrar/students — create ─────────────────────
router.post('/students', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, matricNo, level, department, email, phone, gender, admissionDate } = req.body || {}

    if (typeof name !== 'string' || name.trim().length < 2) { res.status(400).json({ error: 'Full name is required (min 2 chars)' }); return }
    if (typeof matricNo !== 'string' || !matricNo.trim()) { res.status(400).json({ error: 'Matric number is required' }); return }
    if (typeof level !== 'string' || !VALID_LEVELS.includes(level)) { res.status(400).json({ error: `Level must be one of: ${VALID_LEVELS.join(', ')}` }); return }
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) { res.status(400).json({ error: 'Valid email is required' }); return }

    const cleanMatric = matricNo.trim()
    const cleanEmail = email.trim().toLowerCase()
    const cleanName = name.trim()
    const cleanDept = (department && typeof department === 'string' ? department.trim() : '') || 'Nursing Science'
    const admittedAt = admissionDate ? new Date(admissionDate) : new Date()

    const byMatric = await prisma.user.findUnique({ where: { matricNo: cleanMatric } })
    if (byMatric) { res.status(409).json({ error: `A user with matric ${cleanMatric} already exists` }); return }
    const byEmail = await prisma.user.findUnique({ where: { email: cleanEmail } })
    if (byEmail) { res.status(409).json({ error: `A user with email ${cleanEmail} already exists` }); return }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)
    const created = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name: cleanName, email: cleanEmail, matricNo: cleanMatric,
          password: passwordHash, role: Role.STUDENT, department: cleanDept,
          level: level as any,
          phone: (phone && typeof phone === 'string' ? phone.trim() : '') || null,
          gender: (gender && typeof gender === 'string' ? gender.trim() : '') || null,
          admissionDate: admittedAt,
        },
      })
      await tx.printCredit.create({ data: { studentId: u.id, balance: 0 } })
      return u
    })

    let emailStatus: 'sent' | 'failed' = 'failed'
    try {
      const result = await sendWelcomeEmail(cleanName, cleanMatric, cleanEmail, DEFAULT_PASSWORD)
      if (result && result.ok) emailStatus = 'sent'
    } catch { /* non-fatal */ }

    res.status(201).json({
      ok: true, defaultPassword: DEFAULT_PASSWORD, emailStatus,
      student: { id: created.id, name: created.name, matricNo: created.matricNo, email: created.email, level: created.level, department: created.department },
    })
  } catch {
    res.status(500).json({ error: 'Failed to create student' })
  }
})

// ── PATCH /api/registrar/students/:id — edit ──────────────────
router.patch('/students/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!student || student.role !== Role.STUDENT) { res.status(404).json({ error: 'Student not found' }); return }

    const { name, email, phone, level, department, gender, stateOfOrigin, isActive, admissionDate } = req.body || {}
    if (level !== undefined && !VALID_LEVELS.includes(level)) { res.status(400).json({ error: 'Invalid level' }); return }
    if (email !== undefined && !EMAIL_RE.test(String(email).trim())) { res.status(400).json({ error: 'Invalid email' }); return }

    const data: any = {}
    if (name !== undefined) data.name = String(name).trim()
    if (email !== undefined) data.email = String(email).trim().toLowerCase()
    if (phone !== undefined) data.phone = String(phone).trim() || null
    if (level !== undefined) data.level = level
    if (department !== undefined) data.department = String(department).trim() || null
    if (gender !== undefined) data.gender = String(gender).trim() || null
    if (stateOfOrigin !== undefined) data.stateOfOrigin = String(stateOfOrigin).trim() || null
    if (isActive !== undefined) data.isActive = Boolean(isActive)
    if (admissionDate !== undefined) data.admissionDate = admissionDate ? new Date(admissionDate) : null

    const updated = await prisma.user.update({ where: { id: req.params.id }, data, select: STUDENT_SELECT })
    res.json({ ok: true, student: updated })
  } catch (e: any) {
    if (e?.code === 'P2002') { res.status(409).json({ error: 'That email or matric is already in use' }); return }
    res.status(500).json({ error: 'Failed to update student' })
  }
})

// ── PATCH /api/registrar/students/:id/reset-password ──────────
router.patch('/students/:id/reset-password', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const student = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!student || student.role !== Role.STUDENT) { res.status(404).json({ error: 'Student not found' }); return }
    const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10)
    await prisma.user.update({ where: { id: req.params.id }, data: { password: hashed, passwordChangedAt: null } })
    res.json({ ok: true, defaultPassword: DEFAULT_PASSWORD })
  } catch {
    res.status(500).json({ error: 'Failed to reset password' })
  }
})

// ── DELETE /api/registrar/students/:id — guarded hard delete ──
router.delete('/students/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id
    const student = await prisma.user.findUnique({ where: { id } })
    if (!student || student.role !== Role.STUDENT) { res.status(404).json({ error: 'Student not found' }); return }

    const [results, attendance, printJobs] = await Promise.all([
      prisma.result.count({ where: { studentId: id } }),
      prisma.attendanceRecord.count({ where: { studentId: id } }),
      prisma.printJob.count({ where: { studentId: id } }),
    ])
    if (results > 0 || attendance > 0 || printJobs > 0) {
      res.status(409).json({
        error: 'This student has academic or activity records and cannot be deleted. Deactivate the account instead.',
        counts: { results, attendance, printJobs },
      })
      return
    }

    await prisma.$transaction([
      prisma.aiMessage.deleteMany({ where: { userId: id } }),
      prisma.flashcardProgress.deleteMany({ where: { userId: id } }),
      prisma.simulationSession.deleteMany({ where: { userId: id } }),
      prisma.wifiSession.deleteMany({ where: { studentId: id } }),
      prisma.printCreditTopup.deleteMany({ where: { studentId: id } }),
      prisma.printCredit.deleteMany({ where: { studentId: id } }),
      prisma.user.delete({ where: { id } }),
    ])
    res.json({ ok: true, message: 'Student deleted' })
  } catch {
    res.status(500).json({ error: 'Failed to delete student' })
  }
})

// ── GET /api/registrar/students/:id/results ───────────────────
router.get('/students/:id/results', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id
    const student = await prisma.user.findUnique({ where: { id }, select: { ...STUDENT_SELECT, role: true } })
    if (!student || student.role !== Role.STUDENT) { res.status(404).json({ error: 'Student not found' }); return }

    const results = await prisma.result.findMany({
      where: { studentId: id },
      orderBy: [{ academicYear: 'desc' }, { semester: 'desc' }, { courseCode: 'asc' }],
    })

    const groups: Record<string, { academicYear: string; semester: string; courses: any[] }> = {}
    for (const r of results) {
      const key = `${r.academicYear}__${r.semester}`
      if (!groups[key]) groups[key] = { academicYear: r.academicYear, semester: r.semester, courses: [] }
      groups[key].courses.push({
        id: r.id, courseCode: r.courseCode, courseName: r.courseName,
        score: Number(r.score), grade: r.grade, creditUnit: r.creditUnit,
        gradePoint: Number(r.gradePoint), isPublished: r.isPublished,
      })
    }
    const semesters = Object.values(groups).map(g => {
      const units = g.courses.reduce((s, c) => s + c.creditUnit, 0)
      const points = g.courses.reduce((s, c) => s + c.gradePoint * c.creditUnit, 0)
      return { ...g, totalUnits: units, gpa: units > 0 ? (points / units).toFixed(2) : '—' }
    })
    const allCourses = semesters.flatMap(s => s.courses)
    const allUnits = allCourses.reduce((s, c) => s + c.creditUnit, 0)
    const allPoints = allCourses.reduce((s, c) => s + c.gradePoint * c.creditUnit, 0)
    const cgpa = allUnits > 0 ? (allPoints / allUnits).toFixed(2) : '—'

    res.json({ student, cgpa, totalCourses: allCourses.length, totalUnits: allUnits, semesters })
  } catch {
    res.status(500).json({ error: 'Failed to load student results' })
  }
})

export default router
