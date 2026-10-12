import crypto from 'crypto'
import QRCode from 'qrcode'
import type { Response } from 'express'
import prisma from '../utils/prisma'
import { TranscriptData } from './transcriptData'
import { streamTranscriptPdf } from './transcriptPdf'

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

/** Streams the official (non-watermarked) PDF from the snapshot taken when the transcript was issued */
export async function sendOfficialPdf(res: Response, r: IssuedRequest): Promise<void> {
  if (!r.issuedSnapshot || !r.transcriptNo || !r.verifyCode || !r.issuedAt) throw new Error('Transcript not issued')
  const data = JSON.parse(r.issuedSnapshot) as TranscriptData
  if (data.student.dateOfBirth) data.student.dateOfBirth = new Date(data.student.dateOfBirth as unknown as string)

  const base = (process.env.FRONTEND_URL || '').replace(/\/+$/, '')
  const verifyUrl = `${base}/verify/${r.verifyCode}`
  const qrPng = await QRCode.toBuffer(verifyUrl, { width: 240, margin: 1 })
  const addressee = r.delivery === 'INSTITUTION'
    ? [r.institutionName || '', r.institutionLocation || ''].filter(Boolean)
    : ['To Whom It May Concern']

  streamTranscriptPdf(res, data, {
    addressee,
    official: { transcriptNo: r.transcriptNo, verifyUrl, qrPng, issuedAt: r.issuedAt },
  })
}
