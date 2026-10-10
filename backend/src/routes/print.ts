import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import pdfParse from 'pdf-parse'
import prisma from '../utils/prisma'
import { authenticate, isOperator, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

const uploadDir = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'print')
  : path.join(__dirname, '../../uploads/print')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
})
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } })

function calcCost(pages: number, copies: number, isColor: boolean): number {
  return pages * copies * (isColor ? 3 : 1)
}

router.post('/jobs', upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ error: 'File required' }); return }
    const { copies = 1, isColor = false } = req.body
    const c = parseInt(copies)
    const color = isColor === 'true' || isColor === true

    // Read page count from the PDF itself
    let pages: number
    try {
      const buffer = fs.readFileSync(req.file.path)
      const parsed = await pdfParse(buffer)
      pages = parsed.numpages
      if (!pages || pages < 1) throw new Error('Invalid PDF (no pages detected)')
    } catch (parseErr) {
      // PDF could not be parsed — clean up and return a clean error
      try { fs.unlinkSync(req.file.path) } catch {}
      res.status(400).json({ error: 'Could not read PDF. The file may be corrupted, encrypted, or not a valid PDF.' })
      return
    }

    const cost = calcCost(pages, c, color)
    const credit = await prisma.printCredit.findUnique({ where: { studentId: req.user!.id } })
    if (!credit || credit.balance < cost) {
      fs.unlinkSync(req.file.path)
      res.status(400).json({ error: `Insufficient balance. ${pages}p ${color ? 'color' : 'B&W'} costs ${cost} credits; you have ${credit?.balance ?? 0}.` })
      return
    }
    const [job] = await prisma.$transaction([
      prisma.printJob.create({ data: { studentId: req.user!.id, filePath: req.file.path, fileName: req.file.originalname, pages, copies: c, isColor: color, creditCost: cost } }),
      prisma.printCredit.update({ where: { studentId: req.user!.id }, data: { balance: { decrement: cost } } })
    ])
    res.status(201).json(job)
  } catch { if (req.file) try { fs.unlinkSync(req.file.path) } catch {} ; res.status(500).json({ error: 'Failed to submit' }) }
})

router.get('/queue', isOperator, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const jobs = await prisma.printJob.findMany({ where: { status: 'QUEUED' }, orderBy: { serialNo: 'asc' }, include: { student: { select: { name: true, matricNo: true } } } })
    res.json(jobs)
  } catch { res.status(500).json({ error: 'Failed to fetch queue' }) }
})

router.patch('/jobs/:id', isOperator, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body
    const data: Record<string, unknown> = { status, operatorId: req.user!.id }
    if (status === 'DONE') data.completedAt = new Date()

    const job = await prisma.printJob.findUnique({ where: { id: req.params.id } })
    if (!job) { res.status(404).json({ error: 'Job not found' }); return }

    const updated = await prisma.printJob.update({ where: { id: req.params.id }, data })

    // Refund credits on cancel
    if (status === 'CANCELLED' && job.status === 'QUEUED') {
      await prisma.printCredit.update({
        where: { studentId: job.studentId },
        data: { balance: { increment: job.creditCost } },
      })
    }

    res.json(updated)
  } catch { res.status(500).json({ error: 'Failed to update' }) }
})

router.get('/my-history', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const jobs = await prisma.printJob.findMany({ where: { studentId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 20 })
    res.json(jobs)
  } catch { res.status(500).json({ error: 'Failed to fetch history' }) }
})

router.get('/balance', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const credit = await prisma.printCredit.findUnique({ where: { studentId: req.user!.id } })
    res.json(credit || { balance: 0, accountNo: null, bankName: 'Wema Bank' })
  } catch { res.status(500).json({ error: 'Failed to fetch balance' }) }
})

router.get('/jobs/:id/file', isOperator, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const job = await prisma.printJob.findUnique({ where: { id: req.params.id } })
    if (!job) { res.status(404).json({ error: 'Job not found' }); return }
    if (!fs.existsSync(job.filePath)) { res.status(404).json({ error: 'File missing on disk' }); return }
    res.download(job.filePath, job.fileName)
  } catch { res.status(500).json({ error: 'Failed to download file' }) }
})

router.get('/stats', isOperator, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const [queuedNow, doneToday, cancelledToday, creditsToday, totalDone, totalCredits] = await Promise.all([
      prisma.printJob.count({ where: { status: 'QUEUED' } }),
      prisma.printJob.count({ where: { status: 'DONE', completedAt: { gte: startOfToday } } }),
      prisma.printJob.count({ where: { status: 'CANCELLED', createdAt: { gte: startOfToday } } }),
      prisma.printJob.aggregate({ _sum: { creditCost: true }, where: { status: 'DONE', completedAt: { gte: startOfToday } } }),
      prisma.printJob.count({ where: { status: 'DONE' } }),
      prisma.printJob.aggregate({ _sum: { creditCost: true }, where: { status: 'DONE' } }),
    ])

    res.json({
      queuedNow,
      today: {
        printed: doneToday,
        cancelled: cancelledToday,
        credits: creditsToday._sum.creditCost ?? 0,
      },
      allTime: {
        printed: totalDone,
        credits: totalCredits._sum.creditCost ?? 0,
      },
    })
  } catch { res.status(500).json({ error: 'Failed to fetch stats' }) }
})

// ── Top-up endpoints ──────────────────────────────────────────
// Conversion: 1 credit = ₦25. Stored in DB as kobo (₦ x 100).
const KOBO_PER_CREDIT = 25 * 100  // 1 credit costs 2500 kobo (₦25)

router.post('/topup/initiate', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount } = req.body  // amount in NAIRA from the frontend
    const naira = parseInt(amount, 10)
    if (isNaN(naira) || naira < 200 || naira > 20000) {
      res.status(400).json({ error: 'Top-up must be between ₦200 and ₦20,000' })
      return
    }
    const kobo = naira * 100
    const reference = `cos-tu-${req.user!.id.slice(-8)}-${Date.now()}`

    await prisma.printCreditTopup.create({
      data: { studentId: req.user!.id, amount: kobo, reference, status: 'pending' },
    })

    const publicKey = process.env.PAYSTACK_PUBLIC_KEY
    if (!publicKey) {
      res.status(500).json({ error: 'Paystack not configured on server' })
      return
    }

    res.json({ reference, amount: kobo, publicKey })
  } catch {
    res.status(500).json({ error: 'Failed to initiate top-up' })
  }
})

router.post('/topup/verify', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { reference } = req.body
    if (!reference || typeof reference !== 'string') {
      res.status(400).json({ error: 'Reference required' })
      return
    }

    // Find our record
    const topup = await prisma.printCreditTopup.findUnique({ where: { reference } })
    if (!topup) {
      res.status(404).json({ error: 'Top-up not found' })
      return
    }
    if (topup.studentId !== req.user!.id) {
      res.status(403).json({ error: 'Not your top-up' })
      return
    }
    if (topup.status === 'success') {
      res.json({ status: 'success', alreadyVerified: true })
      return
    }

    // Verify with Paystack server-to-server
    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) {
      res.status(500).json({ error: 'Paystack not configured on server' })
      return
    }

    const psRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    })
    const psBody = await psRes.json() as { status: boolean; data?: { status: string; amount: number; currency: string } }

    if (!psRes.ok || !psBody.status || !psBody.data) {
      await prisma.printCreditTopup.update({ where: { reference }, data: { status: 'failed' } })
      res.status(400).json({ error: 'Paystack verification failed' })
      return
    }

    // Sanity-check what Paystack tells us matches what we expected
    if (psBody.data.status !== 'success') {
      await prisma.printCreditTopup.update({ where: { reference }, data: { status: psBody.data.status } })
      res.status(400).json({ error: `Payment ${psBody.data.status}` })
      return
    }
    if (psBody.data.amount !== topup.amount) {
      await prisma.printCreditTopup.update({ where: { reference }, data: { status: 'amount_mismatch' } })
      res.status(400).json({ error: 'Amount mismatch — please contact support' })
      return
    }
    if (psBody.data.currency !== 'NGN') {
      await prisma.printCreditTopup.update({ where: { reference }, data: { status: 'currency_mismatch' } })
      res.status(400).json({ error: 'Wrong currency' })
      return
    }

    // Credit the wallet inside a transaction (idempotent: only credit if still pending)
    const credits = Math.floor(topup.amount / KOBO_PER_CREDIT)
    await prisma.$transaction([
      prisma.printCreditTopup.update({ where: { reference }, data: { status: 'success' } }),
      prisma.printCredit.upsert({
        where: { studentId: req.user!.id },
        update: { balance: { increment: credits } },
        create: { studentId: req.user!.id, balance: credits },
      }),
    ])

    res.json({ status: 'success', credits })
  } catch (e) {
    console.error('topup verify error', e)
    res.status(500).json({ error: 'Failed to verify top-up' })
  }
})

export default router
