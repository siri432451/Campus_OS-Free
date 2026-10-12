import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { rateLimit } from 'express-rate-limit'
import prisma from '../utils/prisma'
import { TranscriptData } from '../services/transcriptData'
import {
  INSTITUTION_NAME, STATUS_LABELS, EMAIL_RE, bankDetails, feeFor, phoneKey,
  randomCode, sniffReceipt, sendOfficialPdf,
} from '../services/transcriptRequests'

// No login is needed for these routes (alumni have no accounts), so they are rate limited.
const router = Router()

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests from this connection. Please try again later.' },
})
const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
})

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } })

function receiptUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single('receipt')(req, res, (err: unknown) => {
    if (err) { res.status(400).json({ error: 'The receipt must be a JPEG, PNG or PDF file under 2 MB.' }); return }
    next()
  })
}

function clean(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().replace(/\s+/g, ' ').slice(0, max)
  return t === '' ? null : t
}

const YEAR_RE = /^\d{4}$/
const PURPOSES = ['Employment', 'Further study', 'Nursing Council', 'Other']

const fail = (res: Response, error: string): void => { res.status(400).json({ error }) }

// ── GET /api/public/transcripts/info ──────────────────────────
router.get('/info', (_req: Request, res: Response): void => {
  res.json({
    institution: INSTITUTION_NAME,
    fees: { self: feeFor('SELF'), institution: feeFor('INSTITUTION') },
    bank: bankDetails(),
    purposes: PURPOSES,
  })
})

// ── POST /api/public/transcripts/requests ─────────────────────
router.post('/requests', submitLimiter, receiptUpload, async (req: Request, res: Response): Promise<void> => {
  try {
    const b = req.body || {}
    const applicantName = clean(b.applicantName, 120)
    const email = clean(b.email, 120)
    const phone = clean(b.phone, 30)
    const delivery = b.delivery === 'INSTITUTION' ? 'INSTITUTION' : b.delivery === 'SELF' ? 'SELF' : null
    const matricNo = clean(b.matricNo, 40)
    const entryYear = clean(b.entryYear, 4)
    const completionYear = clean(b.completionYear, 4)
    const purposeRaw = clean(b.purpose, 60)
    const purpose = purposeRaw && PURPOSES.includes(purposeRaw) ? purposeRaw : null
    const note = clean(b.note, 1000)

    if (!applicantName || applicantName.length < 3) return fail(res, 'Please enter your full name as it appears on your records.')
    if (!email || !EMAIL_RE.test(email)) return fail(res, 'Please enter a valid email address.')
    if (!phone || phoneKey(phone).length < 10) return fail(res, 'Please enter a valid phone number.')
    if (!delivery) return fail(res, 'Please choose how the transcript should be delivered.')
    if ((entryYear && !YEAR_RE.test(entryYear)) || (completionYear && !YEAR_RE.test(completionYear))) {
      return fail(res, 'Years must be four digits, for example 2019.')
    }

    let institutionName: string | null = null
    let institutionLocation: string | null = null
    let institutionEmail: string | null = null
    if (delivery === 'INSTITUTION') {
      institutionName = clean(b.institutionName, 160)
      institutionLocation = clean(b.institutionLocation, 200)
      institutionEmail = clean(b.institutionEmail, 120)
      if (!institutionName || institutionName.length < 2) return fail(res, "Please enter the receiving institution's name.")
      if (!institutionLocation || institutionLocation.length < 2) return fail(res, "Please enter the receiving institution's location.")
      if (!institutionEmail || !EMAIL_RE.test(institutionEmail)) return fail(res, "Please enter the receiving institution's email address.")
    }

    if (!req.file) return fail(res, 'Please upload your payment receipt.')
    const mime = sniffReceipt(req.file.buffer)
    if (!mime) return fail(res, 'The receipt must be a JPEG, PNG or PDF file.')

    const feeAmount = feeFor(delivery)
    for (let attempt = 0; attempt < 5; attempt++) {
      const trackingCode = `TR-${randomCode(6)}`
      try {
        await prisma.transcriptRequest.create({
          data: {
            trackingCode, applicantName, matricNo, entryYear, completionYear, email, phone,
            phoneKey: phoneKey(phone), purpose, delivery, institutionName, institutionLocation,
            institutionEmail, note, feeAmount, receiptMime: mime, receiptData: req.file.buffer,
          },
        })
        res.status(201).json({ ok: true, trackingCode, feeAmount })
        return
      } catch (e) {
        if ((e as { code?: string }).code !== 'P2002') throw e
      }
    }
    res.status(500).json({ error: 'Could not create the request. Please try again.' })
  } catch {
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
})

// ── helpers for applicants looking up their own request ───────
async function findForApplicant(codeRaw: unknown, phoneRaw: unknown) {
  const code = String(codeRaw || '').trim().toUpperCase().replace(/\s+/g, '')
  const key = phoneKey(String(phoneRaw || ''))
  if (!code || key.length < 10) return null
  const r = await prisma.transcriptRequest.findUnique({ where: { trackingCode: code } })
  return r && r.phoneKey === key ? r : null
}

function statusMessage(r: { status: string; delivery: string; institutionName: string | null }): string {
  switch (r.status) {
    case 'RECEIVED': return 'We have received your request and payment receipt. The Registrar will review it shortly.'
    case 'UNDER_REVIEW': return 'Your request is being reviewed by the Registrar.'
    case 'AWAITING_RECORDS': return 'Your academic records are being prepared. This can take several working days.'
    case 'APPROVED':
      return r.delivery === 'SELF'
        ? 'Your transcript is ready. You can download it below.'
        : `Your transcript has been approved and will be sent to ${r.institutionName || 'the institution'}.`
    case 'SENT': return r.delivery === 'SELF'
      ? 'Your transcript has been issued. You can download it below.'
      : `Your transcript has been sent to ${r.institutionName || 'the institution'}.`
    case 'REJECTED': return 'Your request could not be approved.'
    default: return ''
  }
}

// ── POST /api/public/transcripts/track ────────────────────────
router.post('/track', lookupLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const r = await findForApplicant(req.body?.trackingCode, req.body?.phone)
    if (!r) { res.status(404).json({ error: 'No request was found for that tracking code and phone number.' }); return }
    res.json({
      trackingCode: r.trackingCode,
      status: r.status,
      statusLabel: STATUS_LABELS[r.status] || r.status,
      message: statusMessage(r),
      rejectionReason: r.status === 'REJECTED' ? r.rejectionReason : null,
      delivery: r.delivery,
      institutionName: r.institutionName,
      institutionLocation: r.institutionLocation,
      feeAmount: r.feeAmount,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      canDownload: r.delivery === 'SELF' && (r.status === 'APPROVED' || r.status === 'SENT') && !!r.issuedSnapshot,
    })
  } catch {
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
})

// ── POST /api/public/transcripts/download ─────────────────────
router.post('/download', lookupLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const r = await findForApplicant(req.body?.trackingCode, req.body?.phone)
    const ready = r && r.delivery === 'SELF' && (r.status === 'APPROVED' || r.status === 'SENT') && !!r.issuedSnapshot
    if (!r || !ready) { res.status(404).json({ error: 'This transcript is not available for download.' }); return }
    await sendOfficialPdf(res, r)
  } catch {
    if (!res.headersSent) res.status(500).json({ error: 'Could not build the transcript. Please try again.' })
    else res.end()
  }
})

// ── GET /api/public/transcripts/verify/:code ──────────────────
router.get('/verify/:code', lookupLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase()
    const r = code ? await prisma.transcriptRequest.findUnique({
      where: { verifyCode: code },
      select: { status: true, transcriptNo: true, issuedAt: true, issuedSnapshot: true },
    }) : null
    if (!r || !r.issuedSnapshot || (r.status !== 'APPROVED' && r.status !== 'SENT')) {
      res.json({ valid: false })
      return
    }
    const snap = JSON.parse(r.issuedSnapshot) as TranscriptData
    res.json({ valid: true, institution: INSTITUTION_NAME, name: snap.student.name, transcriptNo: r.transcriptNo, issuedAt: r.issuedAt })
  } catch {
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
})

export default router
