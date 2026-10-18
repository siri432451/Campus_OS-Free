import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { randomInt } from 'crypto'
import { authenticate, AuthRequest } from '../middleware/auth'
import prisma from '../utils/prisma'
import { sendVerificationCode, sendWelcomeEmail } from '../services/onboarding'

const router = Router()
router.use(authenticate)

// Random temporary password (no look-alike characters), e.g. "Kt7mQp3xZw9R"
function generateTempPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < length; i++) out += chars[randomInt(chars.length)]
  return out
}

const ADMIN_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN']
const SUPER_ROLES = ['SUPER_ADMIN']

function requireAdmin(req: AuthRequest, res: Response): boolean {
  if (!req.user || !ADMIN_ROLES.includes(req.user.role)) {
    res.status(403).json({ error: 'Admin access required' })
    return false
  }
  return true
}

// GET /api/admin/stats
router.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return

  try {
    const isSuper = SUPER_ROLES.includes(req.user!.role)

    // Day boundary in UTC. Good enough for now; refine to user TZ later if needed.
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)

    // ── User counts ──
    const [
      total,
      students,
      lecturers,
      operators,
      superAdmins,
      schoolAdmins,
      verified,
      biodataCompleted,
      nursingCount,
      midwiferyCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.user.count({ where: { role: 'LECTURER' } }),
      prisma.user.count({ where: { role: 'PRINT_OPERATOR' } }),
      prisma.user.count({ where: { role: 'SUPER_ADMIN' } }),
      prisma.user.count({ where: { role: 'SCHOOL_ADMIN' } }),
      prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
      prisma.user.count({ where: { role: 'STUDENT', biodataCompletedAt: { not: null } } }),
      prisma.user.count({ where: { role: 'STUDENT', department: { contains: 'Nursing', mode: 'insensitive' } } }),
      prisma.user.count({ where: { role: 'STUDENT', department: { contains: 'Midwifery', mode: 'insensitive' } } }),
    ])
    const admins = superAdmins + schoolAdmins

    // ── Print job counts ──
    const [queued, printedToday, printedTotal, cancelledTotal] = await Promise.all([
      prisma.printJob.count({ where: { status: 'QUEUED' } }),
      prisma.printJob.count({ where: { status: 'DONE', completedAt: { gte: startOfDay } } }),
      prisma.printJob.count({ where: { status: 'DONE' } }),
      prisma.printJob.count({ where: { status: 'CANCELLED' } }),
    ])

    const response: {
      users: Record<string, number>
      print: Record<string, number>
      revenue?: Record<string, number>
    } = {
      users: {
        total,
        students,
        lecturers,
        operators,
        admins,
        verified,
        unverified: total - verified,
        biodataCompleted,
        nursingCount,
        midwiferyCount,
      },
      print: {
        queued,
        printedToday,
        printedTotal,
        cancelledTotal,
      },
    }

    // ── Revenue (SUPER_ADMIN only) ──
    if (isSuper) {
      const [topupsToday, topupsTotal, topupSumToday, topupSumTotal] = await Promise.all([
        prisma.printCreditTopup.count({ where: { status: 'success', createdAt: { gte: startOfDay } } }),
        prisma.printCreditTopup.count({ where: { status: 'success' } }),
        prisma.printCreditTopup.aggregate({
          _sum: { amount: true },
          where: { status: 'success', createdAt: { gte: startOfDay } },
        }),
        prisma.printCreditTopup.aggregate({
          _sum: { amount: true },
          where: { status: 'success' },
        }),
      ])
      response.revenue = {
        topupsToday,
        totalTodayKobo: topupSumToday._sum.amount || 0,
        topupsTotal,
        totalTotalKobo: topupSumTotal._sum.amount || 0,
      }
    }

    res.json(response)
  } catch (e) {
    console.error('admin/stats error:', e)
    res.status(500).json({ error: 'Failed to load stats' })
  }
})


// GET /api/admin/students — paginated, filterable, searchable
router.get('/students', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return

  try {
    const {
      level = 'all',
      department = '',
      active = 'all',
      verified = 'all',
      search = '',
      page = '1',
      pageSize = '20',
    } = req.query as Record<string, string>

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20))
    const skip = (pageNum - 1) * size

    const where: Record<string, unknown> = { role: 'STUDENT' }

    if (level !== 'all' && ['ND1', 'ND2', 'HND1', 'HND2'].includes(level)) {
      where.level = level
    }
    if (department && department.trim()) {
      where.department = { contains: department.trim(), mode: 'insensitive' }
    }
    if (active === 'true') where.isActive = true
    else if (active === 'false') where.isActive = false

    if (verified === 'true') where.emailVerifiedAt = { not: null }
    else if (verified === 'false') where.emailVerifiedAt = null

    if (search && search.trim()) {
      const q = search.trim()
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { matricNo: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [total, students] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          matricNo: true,
          email: true,
          level: true,
          department: true,
          phone: true,
          photoUrl: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          emailVerifiedAt: true,
          middleName: true,
          dateOfBirth: true,
          gender: true,
          maritalStatus: true,
          hometown: true,
          localGovernment: true,
          stateOfOrigin: true,
          nationality: true,
          contactAddress: true,
          residentialAddress: true,
          bloodGroup: true,
          genotype: true,
          biodataCompletedAt: true,
        },
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
        skip,
        take: size,
      }),
    ])

    const studentsOut = students.map(s => ({
      ...s,
      emailVerified: !!s.emailVerifiedAt,
    }))

    res.json({
      students: studentsOut,
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    })
  } catch (e) {
    console.error('admin students list error:', e)
    res.status(500).json({ error: 'Failed to load students' })
  }
})

const VALID_LEVELS = ['ND1', 'ND2', 'HND1', 'HND2']
const DEFAULT_PASSWORD = 'Student123!'

// POST /api/admin/users — admin creates a single student
router.post('/users', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return

  try {
    const { name, matricNo, level, department, email } = req.body || {}

    // ── Validation ──────────────────────────────────────────
    if (typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'Full name is required (min 2 chars)' })
      return
    }
    if (typeof matricNo !== 'string' || !matricNo.trim()) {
      res.status(400).json({ error: 'Matric number is required' })
      return
    }
    if (typeof level !== 'string' || !VALID_LEVELS.includes(level)) {
      res.status(400).json({ error: `Level must be one of: ${VALID_LEVELS.join(', ')}` })
      return
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ error: 'Valid email is required' })
      return
    }

    const cleanMatric = matricNo.trim()
    const cleanEmail = email.trim().toLowerCase()
    const cleanName = name.trim()
    const cleanDept = (department && typeof department === 'string' ? department.trim() : '') || 'Nursing Science'

    // ── Duplicate checks ────────────────────────────────────
    const existingByMatric = await prisma.user.findUnique({ where: { matricNo: cleanMatric } })
    if (existingByMatric) {
      res.status(409).json({ error: `A user with matric ${cleanMatric} already exists` })
      return
    }
    const existingByEmail = await prisma.user.findUnique({ where: { email: cleanEmail } })
    if (existingByEmail) {
      res.status(409).json({ error: `A user with email ${cleanEmail} already exists` })
      return
    }

    // ── Create user + print credit row in one transaction ──
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)
    const newUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name: cleanName,
          email: cleanEmail,
          matricNo: cleanMatric,
          password: passwordHash,
          role: 'STUDENT',
          department: cleanDept,
          level: level as 'ND1' | 'ND2' | 'HND1' | 'HND2',
          // emailVerifiedAt + passwordChangedAt left NULL → forced through onboarding
        },
      })
      await tx.printCredit.create({
        data: { studentId: u.id, balance: 0 },
      })
      return u
    })

    // ── Welcome email with login credentials (non-fatal) ──
    let emailStatus: 'sent' | 'failed' = 'failed'
    let emailDetail = ''
    try {
      const result = await sendWelcomeEmail(cleanName, cleanMatric, cleanEmail, DEFAULT_PASSWORD)
      if (result.ok) {
        emailStatus = 'sent'
      } else {
        emailDetail = result.reason
        console.warn('Welcome email failed for', cleanEmail, '-', result.reason)
      }
    } catch (e: unknown) {
      emailDetail = e instanceof Error ? e.message : 'unknown'
      console.warn('Welcome email threw for', cleanEmail, '-', emailDetail)
    }

    res.status(201).json({
      ok: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        matricNo: newUser.matricNo,
        email: newUser.email,
        level: newUser.level,
        department: newUser.department,
      },
      defaultPassword: DEFAULT_PASSWORD,
      emailStatus,
      emailDetail,
    })
  } catch (e) {
    console.error('admin create user error:', e)
    res.status(500).json({ error: 'Failed to create user' })
  }
})


// ── GET /api/admin/lecturers ───────────────────────────────────
router.get('/lecturers', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return
  try {
    const { search = '', department = '' } = req.query as Record<string, string>
    const where: Record<string, unknown> = { role: 'LECTURER' }
    if (search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { staffId: { contains: search.trim(), mode: 'insensitive' } },
      ]
    }
    if (department.trim()) where.department = { contains: department.trim(), mode: 'insensitive' }
    const lecturers = await prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, staffId: true, email: true,
        department: true, phone: true, photoUrl: true,
        isActive: true, isHod: true, lastLogin: true, createdAt: true,
        emailVerifiedAt: true,
      },
    })
    res.json({ lecturers })
  } catch (e) {
    console.error('admin lecturers list error:', e)
    res.status(500).json({ error: 'Failed to load lecturers' })
  }
})

// ── POST /api/admin/lecturers ──────────────────────────────────
router.post('/lecturers', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return
  try {
    const { name, staffId, department, email, phone } = req.body || {}
    if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return }
    if (!staffId?.trim()) { res.status(400).json({ error: 'Staff ID is required' }); return }
    if (!email?.trim()) { res.status(400).json({ error: 'Email is required' }); return }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ staffId: staffId.trim() }, { email: email.trim() }] }
    })
    if (existing) {
      res.status(409).json({ error: existing.staffId === staffId.trim() ? 'Staff ID already exists' : 'Email already exists' })
      return
    }

    const DEFAULT_PASSWORD = generateTempPassword()
    const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10)
    const newUser = await prisma.user.create({
      data: {
        id: `lect-${Date.now()}`,
        name: name.trim(),
        staffId: staffId.trim(),
        email: email.trim(),
        department: department?.trim() || null,
        phone: phone?.trim() || null,
        password: hashed,
        role: 'LECTURER',
        isActive: true,
      },
    })
    res.status(201).json({
      ok: true,
      user: { id: newUser.id, name: newUser.name, staffId: newUser.staffId, email: newUser.email, department: newUser.department },
      defaultPassword: DEFAULT_PASSWORD,
    })
  } catch (e) {
    console.error('admin create lecturer error:', e)
    res.status(500).json({ error: 'Failed to create lecturer' })
  }
})

// ── PATCH /api/admin/lecturers/:id ────────────────────────────
router.patch('/lecturers/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return
  try {
    const lecturer = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!lecturer || lecturer.role !== 'LECTURER') { res.status(404).json({ error: 'Lecturer not found' }); return }

    const { name, department, email, phone, isActive, isHod } = req.body
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(department !== undefined ? { department: department?.trim() || null } : {}),
        ...(email !== undefined ? { email: email.trim() } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(isHod !== undefined ? { isHod } : {}),
      },
      select: {
        id: true, name: true, staffId: true, email: true,
        department: true, phone: true, isActive: true, isHod: true,
      },
    })
    res.json({ ok: true, user: updated })
  } catch (e) {
    console.error('admin update lecturer error:', e)
    res.status(500).json({ error: 'Failed to update lecturer' })
  }
})

// ── PATCH /api/admin/lecturers/:id/reset-password ─────────────
router.patch('/lecturers/:id/reset-password', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return
  try {
    const lecturer = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!lecturer || lecturer.role !== 'LECTURER') { res.status(404).json({ error: 'Lecturer not found' }); return }
    const DEFAULT_PASSWORD = generateTempPassword()
    const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10)
    await prisma.user.update({ where: { id: req.params.id }, data: { password: hashed } })
    res.json({ ok: true, defaultPassword: DEFAULT_PASSWORD })
  } catch (e) {
    res.status(500).json({ error: 'Failed to reset password' })
  }
})

export default router
