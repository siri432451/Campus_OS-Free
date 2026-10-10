import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import {
  changePassword,
  saveBiodata,
  sendVerificationCode,
  verifyCode,
} from '../services/onboarding'

const router = Router()
router.use(authenticate)

// ── POST /api/auth/onboarding/change-password ──────────────────
router.post('/change-password', async (req: AuthRequest, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body || {}
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    res.status(400).json({ error: 'currentPassword and newPassword required' })
    return
  }

  const result = await changePassword(req.user!.id, currentPassword, newPassword)
  if (!result.ok) {
    const messages: Record<string, string> = {
      wrong_current: 'Your current password is incorrect.',
      too_short: 'New password must be at least 8 characters.',
      same_as_current: 'New password must be different from your current password.',
    }
    res.status(400).json({ error: messages[result.reason] || 'Could not change password' })
    return
  }
  res.json({ ok: true })
})

// ── POST /api/auth/onboarding/send-code ────────────────────────
router.post('/send-code', async (req: AuthRequest, res: Response): Promise<void> => {
  const { email } = req.body || {}
  if (typeof email !== 'string' || !email.includes('@') || email.length < 5) {
    res.status(400).json({ error: 'Valid email required' })
    return
  }

  // Light email format sanity check
  const emailNormalized = email.trim().toLowerCase()
  const looksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)
  if (!looksValid) {
    res.status(400).json({ error: 'Email format is invalid' })
    return
  }

  const result = await sendVerificationCode(req.user!.id, emailNormalized)
  if (!result.ok) {
    if (result.reason === 'cooldown') {
      res.status(429).json({
        error: `Please wait ${result.cooldownRemaining} seconds before requesting another code.`,
        cooldownRemaining: result.cooldownRemaining,
      })
      return
    }
    if (result.reason === 'send_failed') {
      console.error('Resend failed:', result.detail)
      res.status(500).json({ error: 'Could not send the email. Please try again or contact admin.' })
      return
    }
    res.status(400).json({ error: 'Could not send code' })
    return
  }
  res.json({ ok: true, message: `A 6-digit code has been sent to ${emailNormalized}.` })
})

// ── POST /api/auth/onboarding/verify-code ──────────────────────
router.post('/verify-code', async (req: AuthRequest, res: Response): Promise<void> => {
  const { code } = req.body || {}
  if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    res.status(400).json({ error: 'Enter the 6-digit code from your email' })
    return
  }

  const result = await verifyCode(req.user!.id, code.trim())
  if (!result.ok) {
    const messages: Record<string, string> = {
      no_pending_code: 'No pending verification. Send a new code first.',
      expired: 'That code has expired. Send a new one.',
      too_many_attempts: 'Too many wrong attempts. Send a new code.',
      wrong_code: 'Wrong code.',
    }
    let msg = messages[result.reason] || 'Could not verify code'
    if (result.reason === 'wrong_code') {
      msg = `Wrong code. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? 'attempt' : 'attempts'} left.`
    }
    res.status(400).json({ error: msg, reason: result.reason })
    return
  }
  res.json({ ok: true })
})


// ── POST /api/auth/onboarding/save-biodata ──────────────────
router.post('/save-biodata', async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await saveBiodata(req.user!.id, req.body || {})
  if (result.ok) {
    res.json({ ok: true })
    return
  }
  res.status(result.status).json({ error: result.error })
})

export default router
