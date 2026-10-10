import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { Resend } from 'resend'
import prisma from '../utils/prisma'

// ── Config ───────────────────────────────────────────────────
const CODE_TTL_MINUTES = 10
const RESEND_COOLDOWN_SECONDS = 30
const MAX_ATTEMPTS = 3
const FROM_ADDRESS = 'CampusOS <onboarding@campusos.space>'

// ── Resend client (lazily init so missing key only fails at call time) ──
let resendClient: Resend | null = null
function getResend(): Resend {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set')
    }
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

// ── Code generation ──────────────────────────────────────────
function generateSixDigitCode(): string {
  // crypto-strong, always 6 digits, no leading-zero loss
  const n = crypto.randomInt(0, 1_000_000)
  return n.toString().padStart(6, '0')
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

// ── Public API ───────────────────────────────────────────────

export type SendCodeResult =
  | { ok: true; cooldownRemaining: 0 }
  | { ok: false; reason: 'cooldown'; cooldownRemaining: number }
  | { ok: false; reason: 'no_email' }
  | { ok: false; reason: 'send_failed'; detail: string }

/**
 * Generate a fresh code, save its hash + expiry on the user, send via Resend.
 * Enforces a cooldown so users can't spam the resend button.
 */
export async function sendVerificationCode(userId: string, targetEmail: string): Promise<SendCodeResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { ok: false, reason: 'no_email' }
  if (!targetEmail) return { ok: false, reason: 'no_email' }

  // Cooldown check
  if (user.verificationLastSentAt) {
    const elapsed = (Date.now() - user.verificationLastSentAt.getTime()) / 1000
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      return { ok: false, reason: 'cooldown', cooldownRemaining: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed) }
    }
  }

  const code = generateSixDigitCode()
  const codeHash = hashCode(code)
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000)

  // Save BEFORE sending — if send fails, we don't have orphan codes,
  // but we accept the small risk of saved-but-not-sent (user can resend)
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: targetEmail,
        verificationCode: codeHash,
        verificationCodeExpiresAt: expiresAt,
        verificationAttempts: 0,
        verificationLastSentAt: new Date(),
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown'
    if (msg.includes('Unique constraint failed') && msg.includes('email')) {
      return { ok: false, reason: 'send_failed', detail: 'That email is already used by another account.' }
    }
    return { ok: false, reason: 'send_failed', detail: msg }
  }

  // Send email
  try {
    const result = await getResend().emails.send({
      from: FROM_ADDRESS,
      to: targetEmail,
      subject: `Your CampusOS verification code: ${code}`,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1A3C5E">
          <h1 style="margin:0 0 8px;font-size:22px">Verify your email</h1>
          <p style="margin:0 0 24px;color:#5C7080">Welcome to <strong>CampusOS</strong>, ${user.name}.</p>
          <div style="background:#F5F7FA;border-radius:12px;padding:24px;text-align:center;margin-bottom:16px">
            <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#7B5EA7;font-weight:700">Your code</div>
            <div style="font-size:36px;font-weight:900;letter-spacing:.2em;margin-top:8px;color:#1A3C5E">${code}</div>
          </div>
          <p style="margin:0;font-size:14px;color:#5C7080">This code expires in ${CODE_TTL_MINUTES} minutes. If you didn't request it, ignore this email.</p>
          <hr style="margin:24px 0;border:none;border-top:1px solid #E5E7EB">
          <p style="margin:0;font-size:12px;color:#8A9BB0">College of Nursing Sciences, Osogbo · CampusOS</p>
        </div>`,
    })
    if (result.error) {
      return { ok: false, reason: 'send_failed', detail: JSON.stringify(result.error) }
    }
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : 'unknown'
    return { ok: false, reason: 'send_failed', detail }
  }

  return { ok: true, cooldownRemaining: 0 }
}

export type VerifyCodeResult =
  | { ok: true }
  | { ok: false; reason: 'no_pending_code' }
  | { ok: false; reason: 'expired' }
  | { ok: false; reason: 'too_many_attempts'; attemptsLeft: 0 }
  | { ok: false; reason: 'wrong_code'; attemptsLeft: number }

/**
 * Check the submitted code against the stored hash.
 * Increments attempt count on wrong codes; locks after MAX_ATTEMPTS.
 * On success: clears code fields and sets emailVerifiedAt.
 */
export async function verifyCode(userId: string, submittedCode: string): Promise<VerifyCodeResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || !user.verificationCode || !user.verificationCodeExpiresAt) {
    return { ok: false, reason: 'no_pending_code' }
  }

  if (Date.now() > user.verificationCodeExpiresAt.getTime()) {
    return { ok: false, reason: 'expired' }
  }

  if (user.verificationAttempts >= MAX_ATTEMPTS) {
    return { ok: false, reason: 'too_many_attempts', attemptsLeft: 0 }
  }

  const submittedHash = hashCode(submittedCode.trim())
  if (submittedHash !== user.verificationCode) {
    const newAttempts = user.verificationAttempts + 1
    await prisma.user.update({
      where: { id: userId },
      data: { verificationAttempts: newAttempts },
    })
    const left = Math.max(0, MAX_ATTEMPTS - newAttempts)
    if (left === 0) {
      return { ok: false, reason: 'too_many_attempts', attemptsLeft: 0 }
    }
    return { ok: false, reason: 'wrong_code', attemptsLeft: left }
  }

  // Success — clear code, mark verified
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerifiedAt: new Date(),
      verificationCode: null,
      verificationCodeExpiresAt: null,
      verificationAttempts: 0,
      verificationLastSentAt: null,
    },
  })
  return { ok: true }
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; reason: 'wrong_current' }
  | { ok: false; reason: 'too_short' }
  | { ok: false; reason: 'same_as_current' }

/**
 * Verify the current password, hash the new one, save, mark passwordChangedAt.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, reason: 'too_short' }
  }
  if (currentPassword === newPassword) {
    return { ok: false, reason: 'same_as_current' }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { ok: false, reason: 'wrong_current' }

  const matches = await bcrypt.compare(currentPassword, user.password)
  if (!matches) return { ok: false, reason: 'wrong_current' }

  const newHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: userId },
    data: { password: newHash, passwordChangedAt: new Date() },
  })
  return { ok: true }
}

// ── Biodata save (one-time onboarding step) ─────────────────
export const REQUIRED_BIO_FIELDS = [
  'middleName',
  'dateOfBirth',
  'gender',
  'maritalStatus',
  'hometown',
  'localGovernment',
  'stateOfOrigin',
  'nationality',
  'contactAddress',
  'residentialAddress',
  'phone',
  'bloodGroup',
  'genotype',
] as const

type SaveBiodataResult =
  | { ok: true }
  | { ok: false; status: 400 | 404 | 409; error: string }

export async function saveBiodata(
  userId: string,
  body: Record<string, unknown>,
): Promise<SaveBiodataResult> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { biodataCompletedAt: true },
  })
  if (!existing) {
    return { ok: false, status: 404, error: 'User not found' }
  }
  if (existing.biodataCompletedAt) {
    return { ok: false, status: 409, error: 'Biodata already submitted. Contact admin to update.' }
  }

  const cleaned: Record<string, string> = {}
  for (const field of REQUIRED_BIO_FIELDS) {
    const raw = body[field]
    if (typeof raw !== 'string' || !raw.trim()) {
      return { ok: false, status: 400, error: field + ' is required' }
    }
    cleaned[field] = raw.trim()
  }

  const dob = new Date(cleaned.dateOfBirth)
  if (isNaN(dob.getTime())) {
    return { ok: false, status: 400, error: 'Invalid date of birth' }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      middleName: cleaned.middleName,
      dateOfBirth: dob,
      gender: cleaned.gender,
      maritalStatus: cleaned.maritalStatus,
      hometown: cleaned.hometown,
      localGovernment: cleaned.localGovernment,
      stateOfOrigin: cleaned.stateOfOrigin,
      nationality: cleaned.nationality,
      contactAddress: cleaned.contactAddress,
      residentialAddress: cleaned.residentialAddress,
      phone: cleaned.phone,
      bloodGroup: cleaned.bloodGroup,
      genotype: cleaned.genotype,
      biodataCompletedAt: new Date(),
    },
  })

  return { ok: true }
}

// ── Welcome email (sent by admin when creating a new student) ─────
const WELCOME_FROM = 'CampusOS Admissions <welcome@campusos.space>'
const LOGIN_URL = process.env.LOGIN_URL || 'https://campusos.duckdns.org'

type WelcomeEmailResult =
  | { ok: true }
  | { ok: false; reason: string }

export async function sendWelcomeEmail(
  fullName: string,
  matricNo: string,
  email: string,
  defaultPassword: string,
): Promise<WelcomeEmailResult> {
  if (!email) return { ok: false, reason: 'no_email' }

  try {
    await getResend().emails.send({
      from: WELCOME_FROM,
      to: email,
      subject: 'Welcome to CampusOS — your account is ready',
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1A3C5E">
          <h1 style="margin:0 0 8px;font-size:24px">Welcome to CampusOS</h1>
          <p style="margin:0 0 16px;color:#5C7080">
            Hello <strong>${fullName}</strong>, your student account has been created by the College of Nursing Sciences administration.
          </p>

          <div style="background:#F5F7FA;border-radius:12px;padding:20px;margin-bottom:20px">
            <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#7B5EA7;font-weight:700;margin-bottom:4px">Your matric number (login ID)</div>
            <div style="font-size:18px;font-weight:900;font-family:'Courier New',monospace;color:#1A3C5E;margin-bottom:14px">${matricNo}</div>

            <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#7B5EA7;font-weight:700;margin-bottom:4px">Your default password</div>
            <div style="font-size:18px;font-weight:900;font-family:'Courier New',monospace;color:#1A3C5E">${defaultPassword}</div>
          </div>

          <a href="${LOGIN_URL}" style="display:inline-block;background:#7B5EA7;color:white;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;margin-bottom:20px">
            Open CampusOS →
          </a>

          <h2 style="margin:24px 0 8px;font-size:16px;color:#1A3C5E">What to do on first login</h2>
          <ol style="margin:0 0 16px;padding-left:20px;color:#5C7080;font-size:14px;line-height:1.7">
            <li><strong>Change your default password</strong> immediately for security</li>
            <li><strong>Verify your email address</strong> by entering the code we send to this inbox</li>
            <li><strong>Complete your biodata</strong> — you only fill this once, so be accurate</li>
          </ol>

          <p style="margin:16px 0 0;color:#5C7080;font-size:13px">
            If you did not expect this email or believe it was sent in error, please contact your College administration.
          </p>

          <hr style="margin:24px 0;border:none;border-top:1px solid #E5E7EB">
          <p style="margin:0;color:#8A9BB0;font-size:12px;text-align:center">
            CampusOS · College of Nursing Sciences, Osogbo
          </p>
        </div>
      `,
    })
    return { ok: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown'
    return { ok: false, reason: msg }
  }
}


// ── Password reset ──────────────────────────────────────────
const PWRESET_TTL_MINUTES = 30
const PWRESET_COOLDOWN_SECONDS = 60
const PWRESET_MAX_ATTEMPTS = 3
const PWRESET_FROM = 'CampusOS <onboarding@campusos.space>'
const PWRESET_MIN_PASSWORD_LENGTH = 8

type PwResetRequestResult =
  | { ok: true }
  | { ok: false; reason: 'cooldown'; cooldownRemaining: number }
  | { ok: false; reason: 'no_identifier' | 'send_failed' }

export async function requestPasswordReset(identifier: string): Promise<PwResetRequestResult> {
  if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
    return { ok: false, reason: 'no_identifier' }
  }
  const clean = identifier.trim()

  // Find user by matric OR staff_id (case-insensitive)
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { matricNo: { equals: clean, mode: 'insensitive' } },
        { staffId:  { equals: clean, mode: 'insensitive' } },
      ],
    },
  })

  // Always return ok to avoid leaking which accounts exist
  if (!user) {
    console.warn('Password reset requested for unknown identifier:', clean)
    return { ok: true }
  }

  // Cooldown
  if (user.passwordResetSentAt) {
    const elapsed = (Date.now() - user.passwordResetSentAt.getTime()) / 1000
    if (elapsed < PWRESET_COOLDOWN_SECONDS) {
      return { ok: false, reason: 'cooldown', cooldownRemaining: Math.ceil(PWRESET_COOLDOWN_SECONDS - elapsed) }
    }
  }

  // Skip if no verified email — we can't deliver to them
  if (!user.email || !user.emailVerifiedAt) {
    console.warn('Password reset skipped (no verified email) for', clean)
    return { ok: true }
  }

  const code = generateSixDigitCode()
  const codeHash = hashCode(code)
  const expiresAt = new Date(Date.now() + PWRESET_TTL_MINUTES * 60 * 1000)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetCode: codeHash,
      passwordResetExpiresAt: expiresAt,
      passwordResetSentAt: new Date(),
      verificationAttempts: 0,
    },
  })

  // Send email
  try {
    await getResend().emails.send({
      from: PWRESET_FROM,
      to: user.email,
      subject: `Reset your CampusOS password: ${code}`,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1A3C5E">
          <h1 style="margin:0 0 8px;font-size:22px">Password reset request</h1>
          <p style="margin:0 0 24px;color:#5C7080">Hi ${user.name}, someone (hopefully you) requested a password reset.</p>
          <div style="background:#F5F7FA;border-radius:12px;padding:24px;text-align:center;margin-bottom:16px">
            <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#7B5EA7;font-weight:700">Reset code</div>
            <div style="font-size:36px;font-weight:900;letter-spacing:.2em;margin-top:8px;color:#1A3C5E">${code}</div>
          </div>
          <p style="margin:0;font-size:14px;color:#5C7080">This code expires in ${PWRESET_TTL_MINUTES} minutes. If you didn't request a reset, ignore this email — your password stays the same.</p>
          <hr style="margin:24px 0;border:none;border-top:1px solid #E5E7EB">
          <p style="margin:0;color:#8A9BB0;font-size:12px;text-align:center">CampusOS · College of Nursing Sciences, Osogbo</p>
        </div>
      `,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown'
    console.error('Password reset email failed for', user.email, '-', msg)
    return { ok: false, reason: 'send_failed' }
  }

  return { ok: true }
}

type PwResetVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_code' | 'expired' | 'too_many_attempts' | 'weak_password' | 'no_identifier' }

export async function verifyPasswordReset(
  identifier: string,
  code: string,
  newPassword: string,
): Promise<PwResetVerifyResult> {
  if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
    return { ok: false, reason: 'no_identifier' }
  }
  if (typeof newPassword !== 'string' || newPassword.length < PWRESET_MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: 'weak_password' }
  }
  if (typeof code !== 'string' || code.length !== 6) {
    return { ok: false, reason: 'invalid_code' }
  }

  const clean = identifier.trim()
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { matricNo: { equals: clean, mode: 'insensitive' } },
        { staffId:  { equals: clean, mode: 'insensitive' } },
      ],
    },
  })

  if (!user || !user.passwordResetCode || !user.passwordResetExpiresAt) {
    return { ok: false, reason: 'invalid_code' }
  }

  if (user.verificationAttempts >= PWRESET_MAX_ATTEMPTS) {
    return { ok: false, reason: 'too_many_attempts' }
  }

  if (user.passwordResetExpiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'expired' }
  }

  const submittedHash = hashCode(code)
  if (submittedHash !== user.passwordResetCode) {
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationAttempts: { increment: 1 } },
    })
    return { ok: false, reason: 'invalid_code' }
  }

  // Code matches — set new password, clear reset state
  const newHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: newHash,
      passwordChangedAt: new Date(),
      passwordResetCode: null,
      passwordResetExpiresAt: null,
      passwordResetSentAt: null,
      verificationAttempts: 0,
    },
  })

  return { ok: true }
}
