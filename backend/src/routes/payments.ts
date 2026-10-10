import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { authenticate, AuthRequest } from '../middleware/auth'
import prisma from '../utils/prisma'

const router = Router()
router.use(authenticate)

const ADMIN_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN']
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'receipts')
  : path.join(__dirname, '../../uploads/receipts')

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
    cb(null, unique)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error('Only JPG, PNG and PDF files are allowed'))
  },
})

const PAYMENT_CATEGORIES = [
  'School Fees',
  'Acceptance Fee',
  'Exam Levy',
  'Lab Fee',
  'Caution Fee',
]

// ── POST /api/payments/submit ──────────────────────────────────
router.post('/submit', upload.single('receipt'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user!.role !== 'STUDENT') { res.status(403).json({ error: 'Students only' }); return }
    if (!req.file) { res.status(400).json({ error: 'Receipt file is required' }); return }

    const { academicYear, semester, categories } = req.body
    if (!academicYear?.trim() || !semester?.trim()) {
      res.status(400).json({ error: 'Academic year and semester are required' }); return
    }

    let parsedCategories: string[] = []
    try {
      parsedCategories = typeof categories === 'string' ? JSON.parse(categories) : categories
    } catch { res.status(400).json({ error: 'Invalid categories' }); return }

    if (!Array.isArray(parsedCategories) || parsedCategories.length === 0) {
      res.status(400).json({ error: 'Select at least one payment category' }); return
    }

    const invalid = parsedCategories.filter(c => !PAYMENT_CATEGORIES.includes(c))
    if (invalid.length > 0) { res.status(400).json({ error: `Invalid categories: ${invalid.join(', ')}` }); return }

    const receiptUrl = `/uploads/receipts/${req.file.filename}`

    const id = `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const submission = await prisma.$queryRaw`
      INSERT INTO payment_submissions (id, student_id, academic_year, semester, payment_categories, receipt_url, receipt_filename, status, created_at, updated_at)
      VALUES (${id}, ${req.user!.id}, ${academicYear.trim()}, ${semester.trim()}, ${parsedCategories}, ${receiptUrl}, ${req.file.originalname}, 'PENDING', NOW(), NOW())
      RETURNING *
    `

    res.status(201).json({ ok: true, submission })
  } catch (e) {
    console.error('payment submit error:', e)
    res.status(500).json({ error: 'Failed to submit payment' })
  }
})

// ── GET /api/payments/my ───────────────────────────────────────
router.get('/my', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user!.role !== 'STUDENT') { res.status(403).json({ error: 'Students only' }); return }
    const submissions = await prisma.$queryRaw`
      SELECT ps.*, u.name as reviewed_by_name
      FROM payment_submissions ps
      LEFT JOIN users u ON u.id = ps.reviewed_by
      WHERE ps.student_id = ${req.user!.id}
      ORDER BY ps.created_at DESC
    `
    res.json({ submissions })
  } catch (e) {
    console.error('payment my error:', e)
    res.status(500).json({ error: 'Failed to load payments' })
  }
})

// ── GET /api/payments/admin ────────────────────────────────────
router.get('/admin', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!ADMIN_ROLES.includes(req.user!.role)) { res.status(403).json({ error: 'Admin only' }); return }
    const { status = 'all', search = '' } = req.query as Record<string, string>

    let query = `
      SELECT ps.*, u.name as student_name, u.matric_no as student_matric, u.department, u.level,
             u.photo_url as student_photo, r.name as reviewed_by_name
      FROM payment_submissions ps
      JOIN users u ON u.id = ps.student_id
      LEFT JOIN users r ON r.id = ps.reviewed_by
      WHERE 1=1
    `
    const params: unknown[] = []
    let i = 1

    if (status !== 'all') { query += ` AND ps.status = $${i++}`; params.push(status) }
    if (search.trim()) {
      query += ` AND (u.name ILIKE $${i} OR u.matric_no ILIKE $${i})`
      params.push(`%${search.trim()}%`)
      i++
    }
    query += ' ORDER BY ps.created_at DESC LIMIT 100'

    const submissions = await prisma.$queryRawUnsafe(query, ...params)
    res.json({ submissions })
  } catch (e) {
    console.error('payment admin list error:', e)
    res.status(500).json({ error: 'Failed to load payments' })
  }
})

// ── PATCH /api/payments/:id/review ────────────────────────────
router.patch('/:id/review', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!ADMIN_ROLES.includes(req.user!.role)) { res.status(403).json({ error: 'Admin only' }); return }
    const { status, adminNote } = req.body
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({ error: 'Status must be APPROVED or REJECTED' }); return
    }

    const existing = await prisma.$queryRaw`SELECT id FROM payment_submissions WHERE id = ${req.params.id}` as unknown[]
    if (!existing || (existing as unknown[]).length === 0) { res.status(404).json({ error: 'Submission not found' }); return }

    await prisma.$queryRaw`
      UPDATE payment_submissions
      SET status = ${status}, admin_note = ${adminNote || null}, reviewed_by = ${req.user!.id}, reviewed_at = NOW(), updated_at = NOW()
      WHERE id = ${req.params.id}
    `
    res.json({ ok: true })
  } catch (e) {
    console.error('payment review error:', e)
    res.status(500).json({ error: 'Failed to review payment' })
  }
})

export default router
