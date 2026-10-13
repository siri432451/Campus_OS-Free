import { Router, Response } from 'express'
import multer from 'multer'
import { Role } from '@prisma/client'
import prisma from '../utils/prisma'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { BASIC_NURSING, BASIC_NURSING_CURRICULUM } from '../data/basicNursingCurriculum'
import { loadTranscript, normCode } from '../services/transcriptData'
import { streamTranscriptPdf } from '../services/transcriptPdf'
import {
  STATUS_LABELS, EMAIL_RE, nextTranscriptNo, randomCode, sendOfficialPdf, snapshotOf, deliverByEmail, notifyRejected,
} from '../services/transcriptRequests'

const router = Router()
router.use(authenticate)
// Student records belong to the School Admin and the Registrar (not the Super Admin)
router.use(requireRole(Role.SCHOOL_ADMIN, Role.REGISTRAR))

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } })
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const MAX_IMPORT_ROWS = 500

// ── helpers ───────────────────────────────────────────────────
function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().slice(0, max)
  return t === '' ? null : t
}

function parseScore(v: unknown): number | null | 'invalid' {
  if (v === null || v === undefined) return null
  const raw = typeof v === 'string' ? v.trim().replace(/%$/, '') : v
  if (raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n < 0 || n > 100) return 'invalid'
  return Math.round(n * 10) / 10
}

function parseCsv(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  const pushRow = () => {
    row.push(cell)
    cell = ''
    if (row.some(c => c.trim() !== '')) rows.push(row)
    row = []
  }
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') { cell += '"'; i++ } else inQuotes = false
      } else cell += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      pushRow()
    } else cell += c
  }
  if (cell !== '' || row.length) pushRow()
  return rows
}

async function loadDefaultCurriculum(): Promise<number> {
  const seen = new Map<string, number>()
  const serials = new Map<string, number>()
  let created = 0
  for (const row of BASIC_NURSING_CURRICULUM) {
    const base = normCode(row.code)
    const n = (seen.get(base) || 0) + 1
    seen.set(base, n)
    // A repeated course code gets a letter suffix on its key (GNS310 → GNS310B)
    const key = n === 1 ? base : `${base}${String.fromCharCode(64 + n)}`
    const slot = `${row.year}-${row.semester}`
    const serial = (serials.get(slot) || 0) + 1
    serials.set(slot, serial)

    const existing = await prisma.transcriptCourse.findUnique({
      where: { programme_key: { programme: BASIC_NURSING, key } },
    })
    if (!existing) {
      await prisma.transcriptCourse.create({
        data: {
          programme: BASIC_NURSING, yearOfStudy: row.year, semester: row.semester, serial,
          code: row.code, key, title: row.title,
          lectureHours: row.lecture, practicalHours: row.practical, creditUnit: row.credit,
        },
      })
      created++
    }
  }
  return created
}

async function requireStudent(id: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id }, select: { role: true } })
  return !!u && u.role === Role.STUDENT
}

// ── GET /api/registrar/transcripts/catalog ────────────────────
router.get('/catalog', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const courses = await prisma.transcriptCourse.findMany({
      where: { programme: BASIC_NURSING },
      orderBy: [{ yearOfStudy: 'asc' }, { semester: 'asc' }, { serial: 'asc' }],
    })
    res.json({ programme: BASIC_NURSING, count: courses.length, courses })
  } catch {
    res.status(500).json({ error: 'Failed to load the course list' })
  }
})

// ── POST /api/registrar/transcripts/catalog/load-default ──────
router.post('/catalog/load-default', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const created = await loadDefaultCurriculum()
    res.json({ ok: true, created, message: created ? `Loaded ${created} courses.` : 'The course list was already loaded.' })
  } catch {
    res.status(500).json({ error: 'Failed to load the course list' })
  }
})

// ── GET /api/registrar/transcripts/scores-template.csv ────────
router.get('/scores-template.csv', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const courses = await prisma.transcriptCourse.findMany({
      where: { programme: BASIC_NURSING },
      orderBy: [{ yearOfStudy: 'asc' }, { semester: 'asc' }, { serial: 'asc' }],
      select: { key: true },
    })
    if (!courses.length) { res.status(400).json({ error: 'Load the course list first.' }); return }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="transcript-scores-template.csv"')
    res.send(['matric_no', 'name', ...courses.map(c => c.key)].join(',') + '\n')
  } catch {
    res.status(500).json({ error: 'Failed to build the template' })
  }
})

// ── POST /api/registrar/transcripts/import-scores (CSV) ───────
router.post('/import-scores', upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return }
    const rows = parseCsv(req.file.buffer.toString('utf-8'))
    if (rows.length < 2) { res.status(400).json({ error: 'The file is empty or has no data rows.' }); return }
    if (rows.length - 1 > MAX_IMPORT_ROWS) {
      res.status(400).json({ error: `Too many rows (max ${MAX_IMPORT_ROWS} per file). Split the file and upload again.` })
      return
    }

    const courses = await prisma.transcriptCourse.findMany({ where: { programme: BASIC_NURSING } })
    if (!courses.length) { res.status(400).json({ error: 'Load the course list first.' }); return }
    const byKey = new Map<string, string>(courses.map((c): [string, string] => [c.key, c.id]))

    const norm = (h: string) => h.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    const header = rows[0].map(norm)
    const matricCol = header.findIndex(h => h === 'MATRICNO' || h === 'MATRICNUMBER' || h === 'MATRIC')
    if (matricCol < 0) { res.status(400).json({ error: 'The first row must have a matric_no column.' }); return }

    const scoreCols: Array<{ col: number; courseId: string; key: string }> = []
    const unrecognised: string[] = []
    header.forEach((h, i) => {
      if (i === matricCol || !h || h === 'NAME' || h === 'FULLNAME') return
      const id = byKey.get(h)
      if (id) scoreCols.push({ col: i, courseId: id, key: h })
      else unrecognised.push(rows[0][i].trim())
    })
    if (!scoreCols.length) { res.status(400).json({ error: 'No course columns were recognised. Use the template.' }); return }

    const errors: Array<{ row: number; matric: string; message: string }> = []
    let studentsMatched = 0
    let scoresSaved = 0
    let unknownMatrics = 0

    for (let r = 1; r < rows.length; r++) {
      const line = rows[r]
      const matric = (line[matricCol] || '').trim()
      if (!matric) continue
      const student = await prisma.user.findFirst({
        where: { matricNo: { equals: matric, mode: 'insensitive' }, role: Role.STUDENT },
        select: { id: true },
      })
      if (!student) {
        unknownMatrics++
        if (errors.length < 30) errors.push({ row: r + 1, matric, message: 'No student with this matric number' })
        continue
      }

      const ops = []
      let rowOk = true
      for (const sc of scoreCols) {
        const cellVal = (line[sc.col] || '').trim()
        if (cellVal === '') continue
        const n = parseScore(cellVal)
        if (n === 'invalid' || n === null) {
          rowOk = false
          if (errors.length < 30) errors.push({ row: r + 1, matric, message: `Invalid score "${cellVal}" for ${sc.key}` })
          continue
        }
        ops.push(prisma.transcriptScore.upsert({
          where: { studentId_courseId: { studentId: student.id, courseId: sc.courseId } },
          update: { score: n, enteredById: req.user?.id },
          create: { studentId: student.id, courseId: sc.courseId, score: n, enteredById: req.user?.id },
        }))
      }
      if (ops.length) {
        await prisma.$transaction(ops)
        scoresSaved += ops.length
      }
      if (rowOk || ops.length) studentsMatched++
    }

    res.json({
      ok: true, studentsMatched, scoresSaved, unknownMatrics,
      unrecognisedColumns: unrecognised.slice(0, 20), errors,
    })
  } catch {
    res.status(500).json({ error: 'Import failed' })
  }
})

// ── GET /api/registrar/transcripts/students/:id ───────────────
router.get('/students/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const t = await loadTranscript(req.params.id)
    if (!t) { res.status(404).json({ error: 'Student not found' }); return }
    res.json({ student: t.student, profile: t.profile, courses: t.courses })
  } catch {
    res.status(500).json({ error: 'Failed to load the transcript record' })
  }
})

// ── PUT /api/registrar/transcripts/students/:id/profile ───────
router.put('/students/:id/profile', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id
    if (!(await requireStudent(id))) { res.status(404).json({ error: 'Student not found' }); return }
    const b = req.body || {}
    const entryMonth = cleanText(b.entryMonth, 7)
    const completionMonth = cleanText(b.completionMonth, 7)
    if ((entryMonth && !MONTH_RE.test(entryMonth)) || (completionMonth && !MONTH_RE.test(completionMonth))) {
      res.status(400).json({ error: 'Dates must be a month and year.' }); return
    }
    const data = {
      refNo: cleanText(b.refNo, 60),
      programmeTitle: cleanText(b.programmeTitle, 120),
      certificate: cleanText(b.certificate, 200),
      entryMonth, completionMonth,
      conduct: cleanText(b.conduct, 60),
      examYear: cleanText(b.examYear, 40),
      examResult: cleanText(b.examResult, 300),
    }
    const profile = await prisma.academicProfile.upsert({
      where: { studentId: id },
      update: data,
      create: { studentId: id, programme: BASIC_NURSING, ...data },
    })
    res.json({ ok: true, profile })
  } catch {
    res.status(500).json({ error: 'Failed to save the profile' })
  }
})

// ── PUT /api/registrar/transcripts/students/:id/scores ────────
router.put('/students/:id/scores', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id
    if (!(await requireStudent(id))) { res.status(404).json({ error: 'Student not found' }); return }
    const list = Array.isArray(req.body?.scores) ? req.body.scores : null
    if (!list || list.length > 200) { res.status(400).json({ error: 'Invalid scores' }); return }

    const courses = await prisma.transcriptCourse.findMany({ where: { programme: BASIC_NURSING }, select: { id: true } })
    const valid = new Set(courses.map(c => c.id))

    const ops = []
    let saved = 0
    let cleared = 0
    for (const item of list) {
      if (!item || typeof item.courseId !== 'string' || !valid.has(item.courseId)) {
        res.status(400).json({ error: 'Unknown course in the list' }); return
      }
      const n = parseScore(item.score)
      if (n === 'invalid') { res.status(400).json({ error: 'Scores must be numbers from 0 to 100.' }); return }
      if (n === null) {
        ops.push(prisma.transcriptScore.deleteMany({ where: { studentId: id, courseId: item.courseId } }))
        cleared++
      } else {
        ops.push(prisma.transcriptScore.upsert({
          where: { studentId_courseId: { studentId: id, courseId: item.courseId } },
          update: { score: n, enteredById: req.user?.id },
          create: { studentId: id, courseId: item.courseId, score: n, enteredById: req.user?.id },
        }))
        saved++
      }
    }
    await prisma.$transaction(ops)
    res.json({ ok: true, saved, cleared })
  } catch {
    res.status(500).json({ error: 'Failed to save scores' })
  }
})

// ── GET /api/registrar/transcripts/students/:id/pdf ───────────
// Preview only: carries a PREVIEW watermark until official issuing is added.
router.get('/students/:id/pdf', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const t = await loadTranscript(req.params.id)
    if (!t) { res.status(404).json({ error: 'Student not found' }); return }
    if (!t.semesters.length) { res.status(400).json({ error: 'No scores have been entered for this student yet.' }); return }
    streamTranscriptPdf(res, t, { preview: true })
  } catch {
    if (!res.headersSent) res.status(500).json({ error: 'Failed to build the transcript' })
    else res.end()
  }
})

// ═══════════════════════════════════════════════════════════════
// Transcript requests (from students and alumni)
// ═══════════════════════════════════════════════════════════════

const REQUEST_FIELDS = {
  id: true, trackingCode: true, status: true, applicantName: true, matricNo: true,
  entryYear: true, completionYear: true, email: true, phone: true, purpose: true,
  delivery: true, institutionName: true, institutionLocation: true, institutionEmail: true,
  note: true, feeAmount: true, receiptMime: true, studentId: true, rejectionReason: true,
  registrarNote: true, transcriptNo: true, verifyCode: true, issuedAt: true, sentAt: true,
  emailStatus: true, emailTo: true, emailSentAt: true, emailError: true,
  createdAt: true, updatedAt: true,
} as const

// ── GET /requests?status= ─────────────────────────────────────
router.get('/requests', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = typeof req.query.status === 'string' && STATUS_LABELS[req.query.status] ? req.query.status : undefined
    const [requests, grouped] = await Promise.all([
      prisma.transcriptRequest.findMany({
        where: status ? { status } : {},
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true, trackingCode: true, status: true, applicantName: true, matricNo: true,
          delivery: true, institutionName: true, feeAmount: true, createdAt: true, studentId: true, transcriptNo: true,
        },
      }),
      prisma.transcriptRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    ])
    const counts: Record<string, number> = {}
    for (const g of grouped) counts[g.status] = g._count._all
    res.json({ requests, counts })
  } catch {
    res.status(500).json({ error: 'Failed to load requests' })
  }
})

// ── GET /requests/:id ─────────────────────────────────────────
router.get('/requests/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await prisma.transcriptRequest.findUnique({ where: { id: req.params.id }, select: REQUEST_FIELDS })
    if (!r) { res.status(404).json({ error: 'Request not found' }); return }
    let student = null
    let recordedCourses = 0
    if (r.studentId) {
      const t = await loadTranscript(r.studentId)
      if (t) {
        student = { id: t.student.id, name: t.student.name, matricNo: t.student.matricNo, level: t.student.level, department: t.student.department }
        recordedCourses = t.courses.filter(c => c.score !== null).length
      }
    }
    res.json({ request: r, student, recordedCourses, statusLabel: STATUS_LABELS[r.status] || r.status })
  } catch {
    res.status(500).json({ error: 'Failed to load the request' })
  }
})

// ── GET /requests/:id/suggest — possible matching student records ──
router.get('/requests/:id/suggest', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await prisma.transcriptRequest.findUnique({
      where: { id: req.params.id }, select: { applicantName: true, matricNo: true },
    })
    if (!r) { res.status(404).json({ error: 'Request not found' }); return }
    const or: Array<Record<string, unknown>> = [{ name: { contains: r.applicantName, mode: 'insensitive' } }]
    if (r.matricNo) or.push({ matricNo: { equals: r.matricNo, mode: 'insensitive' } })
    const students = await prisma.user.findMany({
      where: { role: Role.STUDENT, OR: or },
      select: { id: true, name: true, matricNo: true, level: true, department: true },
      take: 8,
    })
    res.json({ students })
  } catch {
    res.status(500).json({ error: 'Failed to search' })
  }
})

// ── GET /requests/:id/receipt ─────────────────────────────────
router.get('/requests/:id/receipt', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await prisma.transcriptRequest.findUnique({
      where: { id: req.params.id }, select: { receiptData: true, receiptMime: true },
    })
    if (!r || !r.receiptData || !r.receiptMime) { res.status(404).json({ error: 'No receipt on file' }); return }
    res.setHeader('Content-Type', r.receiptMime)
    res.setHeader('Content-Disposition', 'inline; filename="payment-receipt"')
    res.send(Buffer.from(r.receiptData))
  } catch {
    res.status(500).json({ error: 'Failed to load the receipt' })
  }
})

// ── POST /requests/:id/match ──────────────────────────────────
router.post('/requests/:id/match', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const studentId = req.body?.studentId
    if (typeof studentId !== 'string' || !(await requireStudent(studentId))) {
      res.status(404).json({ error: 'Student not found' }); return
    }
    const r = await prisma.transcriptRequest.findUnique({ where: { id: req.params.id }, select: { transcriptNo: true } })
    if (!r) { res.status(404).json({ error: 'Request not found' }); return }
    if (r.transcriptNo) { res.status(409).json({ error: 'This transcript has already been issued.' }); return }
    await prisma.transcriptRequest.update({ where: { id: req.params.id }, data: { studentId } })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to match the record' })
  }
})

// ── POST /requests/:id/status — review / awaiting records ─────
router.post('/requests/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = req.body?.status
    if (status !== 'UNDER_REVIEW' && status !== 'AWAITING_RECORDS') { res.status(400).json({ error: 'Invalid status' }); return }
    const r = await prisma.transcriptRequest.findUnique({ where: { id: req.params.id }, select: { transcriptNo: true } })
    if (!r) { res.status(404).json({ error: 'Request not found' }); return }
    if (r.transcriptNo) { res.status(409).json({ error: 'This transcript has already been issued.' }); return }
    await prisma.transcriptRequest.update({
      where: { id: req.params.id },
      data: { status, registrarNote: cleanText(req.body?.note, 500), rejectionReason: null },
    })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to update the request' })
  }
})

// ── POST /requests/:id/reject ─────────────────────────────────
router.post('/requests/:id/reject', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reason = cleanText(req.body?.reason, 500)
    if (!reason || reason.length < 3) { res.status(400).json({ error: 'Please give a reason for rejecting this request.' }); return }
    const r = await prisma.transcriptRequest.findUnique({ where: { id: req.params.id }, select: { transcriptNo: true } })
    if (!r) { res.status(404).json({ error: 'Request not found' }); return }
    if (r.transcriptNo) { res.status(409).json({ error: 'This transcript has already been issued.' }); return }
    await prisma.transcriptRequest.update({ where: { id: req.params.id }, data: { status: 'REJECTED', rejectionReason: reason } })
    void notifyRejected(req.params.id, reason)
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to reject the request' })
  }
})

// ── POST /requests/:id/approve — issue the official transcript ─
router.post('/requests/:id/approve', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await prisma.transcriptRequest.findUnique({
      where: { id: req.params.id }, select: { studentId: true, transcriptNo: true },
    })
    if (!r) { res.status(404).json({ error: 'Request not found' }); return }
    if (r.transcriptNo) { res.status(409).json({ error: 'This transcript has already been issued.' }); return }
    if (!r.studentId) { res.status(400).json({ error: 'Match this request to a student record first.' }); return }

    const t = await loadTranscript(r.studentId)
    if (!t || !t.semesters.length) {
      res.status(400).json({ error: 'No scores have been entered for this student yet. Add them under Transcripts first.' }); return
    }

    let verifyCode = ''
    for (let i = 0; i < 5 && !verifyCode; i++) {
      const candidate = randomCode(10)
      const clash = await prisma.transcriptRequest.findUnique({ where: { verifyCode: candidate }, select: { id: true } })
      if (!clash) verifyCode = candidate
    }
    if (!verifyCode) { res.status(500).json({ error: 'Could not issue the transcript. Please try again.' }); return }

    const transcriptNo = await nextTranscriptNo()
    await prisma.transcriptRequest.update({
      where: { id: req.params.id },
      data: {
        status: 'APPROVED', transcriptNo, verifyCode, issuedAt: new Date(), issuedById: req.user?.id,
        issuedSnapshot: snapshotOf(t), rejectionReason: null,
      },
    })
    // Email the official PDF straight away. If this fails the transcript is still issued
    // and the Registrar can retry from the request page.
    const mail = await deliverByEmail(req.params.id)
    res.json({ ok: true, transcriptNo, emailed: mail.ok, emailTo: mail.to, emailError: mail.error })
  } catch {
    res.status(500).json({ error: 'Failed to issue the transcript' })
  }
})

// ── POST /requests/:id/send-email — send (or resend) the official PDF by email ─
router.post('/requests/:id/send-email', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const to = cleanText(req.body?.to, 120)
    if (to && !EMAIL_RE.test(to)) { res.status(400).json({ error: 'That email address does not look right.' }); return }
    const r = await prisma.transcriptRequest.findUnique({ where: { id: req.params.id }, select: { transcriptNo: true } })
    if (!r) { res.status(404).json({ error: 'Request not found' }); return }
    if (!r.transcriptNo) { res.status(400).json({ error: 'Approve and issue the transcript first.' }); return }
    const mail = await deliverByEmail(req.params.id, to || undefined)
    res.json({ ok: mail.ok, to: mail.to, error: mail.error })
  } catch {
    res.status(500).json({ error: 'Failed to send the email' })
  }
})

// ── POST /requests/:id/mark-sent — after sending to the institution ─
router.post('/requests/:id/mark-sent', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await prisma.transcriptRequest.findUnique({ where: { id: req.params.id }, select: { transcriptNo: true, delivery: true } })
    if (!r) { res.status(404).json({ error: 'Request not found' }); return }
    if (!r.transcriptNo) { res.status(400).json({ error: 'Approve and issue the transcript first.' }); return }
    await prisma.transcriptRequest.update({ where: { id: req.params.id }, data: { status: 'SENT', sentAt: new Date() } })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Failed to update the request' })
  }
})

// ── GET /requests/:id/pdf — the official transcript ───────────
router.get('/requests/:id/pdf', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await prisma.transcriptRequest.findUnique({
      where: { id: req.params.id },
      select: {
        delivery: true, institutionName: true, institutionLocation: true,
        transcriptNo: true, verifyCode: true, issuedAt: true, issuedSnapshot: true,
      },
    })
    if (!r || !r.transcriptNo) { res.status(400).json({ error: 'This transcript has not been issued yet.' }); return }
    await sendOfficialPdf(res, r)
  } catch {
    if (!res.headersSent) res.status(500).json({ error: 'Failed to build the transcript' })
    else res.end()
  }
})

export default router
