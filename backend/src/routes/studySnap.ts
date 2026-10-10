import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import Anthropic from '@anthropic-ai/sdk'
import { rateLimit } from 'express-rate-limit'
import prisma from '../utils/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const snapLimiter = rateLimit({ windowMs: 60 * 1000, max: 8, message: { error: 'Too many uploads. Please wait a moment and try again.' } })

const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads')
const SNAP_DIR = path.join(UPLOAD_ROOT, 'study-snaps')
if (!fs.existsSync(SNAP_DIR)) fs.mkdirSync(SNAP_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, SNAP_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, `${(req as AuthRequest).user!.id}-${Date.now()}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp)$/.test(file.mimetype)) cb(null, true)
    else cb(new Error('Only JPG, PNG or WEBP images are allowed'))
  },
})

const MIME_MAP: Record<string, 'image/jpeg' | 'image/png' | 'image/webp'> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
}

interface SnapQuestion { question: string; options: string[]; correctIndex: number; explanation: string }

function safeParseAiJson(raw: string): { review: string; questions: SnapQuestion[] } | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match ? match[0] : raw)
    if (typeof parsed.review !== 'string') return null
    const questions: SnapQuestion[] = Array.isArray(parsed.questions)
      ? parsed.questions
          .filter((q: any) => q && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length >= 2 && typeof q.correctIndex === 'number')
          .slice(0, 6)
          .map((q: any) => ({
            question: String(q.question),
            options: q.options.map((o: any) => String(o)),
            correctIndex: Math.max(0, Math.min(q.options.length - 1, Math.round(q.correctIndex))),
            explanation: typeof q.explanation === 'string' ? q.explanation : '',
          }))
      : []
    return { review: parsed.review, questions }
  } catch {
    return null
  }
}

// ── POST /api/study-snap — upload a photo, get review + quiz ──
router.post('/', snapLimiter, upload.single('photo'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: 'A photo is required' }); return }
  const imageUrl = `/uploads/study-snaps/${req.file.filename}`
  const subject = (req.body?.subject && String(req.body.subject).trim().slice(0, 80)) || null

  try {
    const ext = path.extname(req.file.filename).toLowerCase()
    const mediaType = MIME_MAP[ext] || 'image/jpeg'
    const base64 = fs.readFileSync(req.file.path).toString('base64')

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1800,
      system: `You are the Snap & Study Coach for nursing students at the College of Nursing Sciences, Osogbo. A student has photographed a page of notes, a textbook excerpt, or a past question. Read the image carefully, then respond with STRICT JSON ONLY (no markdown fences, no commentary outside the JSON) in this exact shape:
{"review":"a short, encouraging review of the content: what it covers, 2-3 key points to remember, and any correction if something in the image looks medically inaccurate","questions":[{"question":"...","options":["A text","B text","C text","D text"],"correctIndex":0,"explanation":"why this is correct, one sentence"}]}
Generate 4 to 6 multiple-choice questions strictly based on the content of the image. Keep language clear and exam-relevant to Nigerian nursing/midwifery education. If the image is unreadable or not study material, set "questions" to an empty array and explain why in "review".`,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: subject ? `Subject/topic hint: ${subject}` : 'Please review this and generate practice questions.' },
        ],
      }],
    })

    const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const parsed = safeParseAiJson(raw)

    const snap = await prisma.studySnap.create({
      data: {
        studentId: req.user!.id,
        imageUrl,
        subject,
        review: parsed?.review || 'We could not fully analyse this image. Please try a clearer photo.',
        questions: (parsed?.questions || []) as any,
        status: parsed ? 'READY' : 'FAILED',
      },
    })

    res.status(201).json({
      id: snap.id,
      imageUrl: snap.imageUrl,
      subject: snap.subject,
      review: snap.review,
      status: snap.status,
      questions: (parsed?.questions || []).map(q => ({ question: q.question, options: q.options })), // correctIndex withheld
      questionCount: (parsed?.questions || []).length,
      createdAt: snap.createdAt,
    })
  } catch (e) {
    console.error('study-snap create error:', e)
    try {
      await prisma.studySnap.create({
        data: { studentId: req.user!.id, imageUrl, subject, review: 'AI processing failed. Please try again.', questions: [], status: 'FAILED' },
      })
    } catch { /* non-fatal */ }
    res.status(500).json({ error: 'AI could not process this image right now. Please try again.' })
  }
})

// ── GET /api/study-snap — student's history ────────────────────
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const snaps = await prisma.studySnap.findMany({
      where: { studentId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, imageUrl: true, subject: true, status: true, score: true, answeredCount: true, createdAt: true },
    })
    res.json({ snaps })
  } catch { res.status(500).json({ error: 'Failed to load history' }) }
})

// ── GET /api/study-snap/:id — one snap (questions without answers if unanswered) ──
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const snap = await prisma.studySnap.findUnique({ where: { id: req.params.id } })
    if (!snap || snap.studentId !== req.user!.id) { res.status(404).json({ error: 'Not found' }); return }
    const questions = (snap.questions as unknown as SnapQuestion[]) || []
    const revealed = snap.score !== null
    res.json({
      id: snap.id, imageUrl: snap.imageUrl, subject: snap.subject, review: snap.review, status: snap.status,
      score: snap.score, answeredCount: snap.answeredCount, createdAt: snap.createdAt,
      questions: questions.map(q => revealed
        ? q
        : { question: q.question, options: q.options }),
    })
  } catch { res.status(500).json({ error: 'Failed to load' }) }
})

// ── POST /api/study-snap/:id/submit — grade the quiz ───────────
router.post('/:id/submit', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const snap = await prisma.studySnap.findUnique({ where: { id: req.params.id } })
    if (!snap || snap.studentId !== req.user!.id) { res.status(404).json({ error: 'Not found' }); return }
    if (snap.score !== null) { res.status(409).json({ error: 'This quiz has already been submitted' }); return }

    const { answers } = req.body as { answers: number[] }
    const questions = (snap.questions as unknown as SnapQuestion[]) || []
    if (!Array.isArray(answers) || answers.length !== questions.length) {
      res.status(400).json({ error: `Expected ${questions.length} answers` }); return
    }

    let correct = 0
    const results = questions.map((q, i) => {
      const isCorrect = answers[i] === q.correctIndex
      if (isCorrect) correct++
      return { question: q.question, options: q.options, correctIndex: q.correctIndex, yourAnswer: answers[i], isCorrect, explanation: q.explanation }
    })

    const updated = await prisma.studySnap.update({
      where: { id: snap.id },
      data: { score: correct, answeredCount: questions.length },
    })

    res.json({ score: correct, total: questions.length, results, submittedAt: updated.updatedAt })
  } catch { res.status(500).json({ error: 'Failed to submit' }) }
})

// ── DELETE /api/study-snap/:id ──────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const snap = await prisma.studySnap.findUnique({ where: { id: req.params.id } })
    if (!snap || snap.studentId !== req.user!.id) { res.status(404).json({ error: 'Not found' }); return }
    const filePath = path.join(UPLOAD_ROOT, 'study-snaps', path.basename(snap.imageUrl))
    fs.unlink(filePath, () => {})
    await prisma.studySnap.delete({ where: { id: snap.id } })
    res.json({ message: 'Deleted' })
  } catch { res.status(500).json({ error: 'Failed to delete' }) }
})

export default router
