import crypto from 'crypto'
import QRCode from 'qrcode'
import type { Response } from 'express'
import prisma from '../utils/prisma'
import { TranscriptData } from './transcriptData'
import { streamTranscriptPdf, transcriptPdfBuffer, PdfOptions } from './transcriptPdf'
import { sendMail } from './mailer'
import {
  baseUrl, receivedEmail, applicantTranscriptEmail, institutionTranscriptEmail, sentNoticeEmail, rejectedEmail,
} from './transcriptEmails'

// ── Settings (override with environment variables) ────────────
export const INSTITUTION_NAME = process.env.TRANSCRIPT_INSTITUTION || 'Osun State College of Nursing Sciences'

export function feeFor(delivery: string): number {
  const self = parseInt(process.env.TRANSCRIPT_FEE_SELF || '20000', 10) || 20000
  const inst = parseInt(process.env.TRANSCRIPT_FEE_INSTITUTION || '40000', 10) || 40000
  return delivery === 'INSTITUTION' ? inst : self
}

export function bankDetails() {
  return {
    bank: process.env.TRANSCRIPT_BANK || 'Wema Bank',
    accountNumber: process.env.TRANSCRIPT_ACCOUNT_NUMBER || '0446892643',
    accountName: process.env.TRANSCRIPT_ACCOUNT_NAME || 'OSUN STATE COLLEGE OF NURSING SCIENCE (OSCON STAFF WELFARE ACCOUNT)',
  }
}

export const STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Received',
  UNDER_REVIEW: 'Under review',
  AWAITING_RECORDS: 'Preparing records',
  APPROVED: 'Approved',
  SENT: 'Sent',
  REJECTED: 'Not approved',
}

// ── Codes and small checks ────────────────────────────────────
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 32 characters, no look-alikes

export function randomCode(length: number): string {
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += CODE_CHARS[bytes[i] % CODE_CHARS.length]
  return out
}

/** Last 10 digits, so +234 816 282 9070 and 0816 282 9070 match */
export function phoneKey(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10)
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Identify an uploaded receipt by its first bytes (JPEG, PNG or PDF only) */
export function sniffReceipt(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf.length > 4 && buf.toString('latin1', 0, 4) === '%PDF') return 'application/pdf'
  return null
}

export async function nextTranscriptNo(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `OSCON/TR/${year}/`
  let n = (await prisma.transcriptRequest.count({ where: { transcriptNo: { startsWith: prefix } } })) + 1
  for (let i = 0; i < 20; i++, n++) {
    const candidate = `${prefix}${String(n).padStart(4, '0')}`
    const clash = await prisma.transcriptRequest.findUnique({ where: { transcriptNo: candidate }, select: { id: true } })
    if (!clash) return candidate
  }
  throw new Error('Could not allocate a transcript number')
}

export function snapshotOf(data: TranscriptData): string {
  // the course list is not needed to reprint the transcript
  return JSON.stringify({ ...data, courses: [] })
}

interface IssuedRequest {
  delivery: string
  institutionName: string | null
  institutionLocation: string | null
  transcriptNo: string | null
  verifyCode: string | null
  issuedAt: Date | null
  issuedSnapshot: string | null
}

async function prepareOfficial(r: IssuedRequest): Promise<{ data: TranscriptData; opts: PdfOptions; verifyUrl: string }> {
  if (!r.issuedSnapshot || !r.transcriptNo || !r.verifyCode || !r.issuedAt) throw new Error('Transcript not issued')
  const data = JSON.parse(r.issuedSnapshot) as TranscriptData
  if (data.student.dateOfBirth) data.student.dateOfBirth = new Date(data.student.dateOfBirth as unknown as string)

  const verifyUrl = `${baseUrl()}/verify/${r.verifyCode}`
  const qrPng = await QRCode.toBuffer(verifyUrl, { width: 240, margin: 1 })
  const addressee = r.delivery === 'INSTITUTION'
    ? [r.institutionName || '', r.institutionLocation || ''].filter(Boolean)
    : ['To Whom It May Concern']
  return {
    data, verifyUrl,
    opts: { addressee, official: { transcriptNo: r.transcriptNo, verifyUrl, qrPng, issuedAt: r.issuedAt } },
  }
}

/** Streams the official (non-watermarked) PDF from the snapshot taken when the transcript was issued */
export async function sendOfficialPdf(res: Response, r: IssuedRequest): Promise<void> {
  const { data, opts } = await prepareOfficial(r)
  streamTranscriptPdf(res, data, opts)
}

// ── Email delivery ────────────────────────────────────────────

export interface DeliveryResult {
  ok: boolean
  to?: string
  error?: string
}

/**
 * Emails the official PDF: to the applicant, or to the receiving institution (the applicant then
 * gets a short notice). The outcome is recorded on the request. Never throws.
 */
export async function deliverByEmail(requestId: string, overrideTo?: string): Promise<DeliveryResult> {
  try {
    const r = await prisma.transcriptRequest.findUnique({ where: { id: requestId } })
    if (!r || !r.transcriptNo || !r.issuedSnapshot) return { ok: false, error: 'This transcript has not been issued yet.' }

    const to = overrideTo || (r.delivery === 'INSTITUTION' ? r.institutionEmail : r.email)
    if (!to) return { ok: false, error: 'There is no email address to send to.' }

    const { data, opts, verifyUrl } = await prepareOfficial(r)
    const pdf = await transcriptPdfBuffer(data, opts)
    const mail = r.delivery === 'INSTITUTION'
      ? institutionTranscriptEmail(r, verifyUrl)
      : applicantTranscriptEmail({ applicantName: r.applicantName, transcriptNo: r.transcriptNo }, verifyUrl)

    const sent = await sendMail({
      to, ...mail,
      attachments: [{ filename: `Transcript-${r.transcriptNo.replace(/[^A-Za-z0-9]+/g, '-')}.pdf`, content: pdf }],
    })

    if (sent.ok) {
      await prisma.transcriptRequest.update({
        where: { id: requestId },
        data: { emailStatus: 'SENT', emailTo: to, emailSentAt: new Date(), emailError: null, status: 'SENT', sentAt: new Date() },
      })
      if (r.delivery === 'INSTITUTION' && r.email) {
        const notice = sentNoticeEmail({
          applicantName: r.applicantName, transcriptNo: r.transcriptNo,
          institutionName: r.institutionName, institutionEmail: r.institutionEmail,
        })
        const n = await sendMail({ to: r.email, ...notice })
        if (!n.ok) console.error('Sent-notice email failed:', n.error)
      }
      return { ok: true, to }
    }

    await prisma.transcriptRequest.update({
      where: { id: requestId },
      data: { emailStatus: 'FAILED', emailTo: to, emailError: (sent.error || 'Unknown error').slice(0, 300) },
    })
    return { ok: false, to, error: sent.error }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not send the email.' }
  }
}

/** "Request received" confirmation. Failures are logged and ignored. */
export async function notifyReceived(r: {
  applicantName: string; email: string; trackingCode: string; delivery: string; institutionName: string | null; feeAmount: number
}): Promise<void> {
  try {
    const res = await sendMail({ to: r.email, ...receivedEmail(r) })
    if (!res.ok) console.error('Confirmation email not sent:', res.error)
  } catch (e) { console.error('Confirmation email error:', e) }
}

/** Tells the applicant why a request was rejected. Failures are logged and ignored. */
export async function notifyRejected(requestId: string, reason: string): Promise<void> {
  try {
    const r = await prisma.transcriptRequest.findUnique({
      where: { id: requestId }, select: { applicantName: true, email: true, trackingCode: true },
    })
    if (!r) return
    const res = await sendMail({ to: r.email, ...rejectedEmail(r, reason) })
    if (!res.ok) console.error('Rejection email not sent:', res.error)
  } catch (e) { console.error('Rejection email error:', e) }
}
