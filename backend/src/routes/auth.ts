import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import prisma from '../utils/prisma'
import { requestPasswordReset, verifyPasswordReset } from '../services/onboarding'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// ── Validation schemas ────────────────────────────────────────
const loginSchema = z.object({
  identifier: z.string().min(1, 'Matric number or staff ID is required'),
  password: z.string().min(1, 'Password is required')
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain a number')
})

// ── Helper: generate JWT ──────────────────────────────────────
function generateToken(user: {
  id: string; role: string; name: string;
  matricNo?: string | null; staffId?: string | null;
  level?: string | null; department?: string | null
}) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      name: user.name,
      matricNo: user.matricNo,
      staffId: user.staffId,
      level: user.level,
      department: user.department
    },
    process.env.JWT_SECRET!,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
  )
}

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = loginSchema.safeParse(req.body)
    if (!body.success) {
      res.status(400).json({ error: body.error.errors[0].message })
      return
    }

    const { identifier, password } = body.data

    // Find by matric number, staff ID, or email
    const user = await prisma.user.findFirst({
      where: {
        isActive: true,
        OR: [
          { matricNo: identifier },
          { staffId: identifier },
          { email: identifier }
        ]
      }
    })

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    })

    const token = generateToken(user)

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        matricNo: user.matricNo,
        staffId: user.staffId,
        level: user.level,
        department: user.department,
        photoUrl: user.photoUrl,
        qrCode: user.qrCode,
        emailVerified: !!user.emailVerifiedAt,
        biodataCompleted: !!user.biodataCompletedAt,
      }
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, name: true, email: true,
        matricNo: true, staffId: true,
        role: true, department: true, level: true,
        phone: true, photoUrl: true, qrCode: true,
        isActive: true, lastLogin: true, createdAt: true,
        emailVerifiedAt: true, passwordChangedAt: true, biodataCompletedAt: true,
        middleName: true, dateOfBirth: true, gender: true, maritalStatus: true,
        hometown: true, localGovernment: true, stateOfOrigin: true, nationality: true,
        contactAddress: true, residentialAddress: true, bloodGroup: true, genotype: true,
        printCredit: {
          select: { balance: true, accountNo: true, bankName: true }
        }
      }
    })

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const { emailVerifiedAt, passwordChangedAt, biodataCompletedAt, ...rest } = user
    res.json({
      ...rest,
      emailVerified: !!emailVerifiedAt,
      passwordChanged: !!passwordChangedAt,
      biodataCompleted: !!biodataCompletedAt,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

// ── POST /api/auth/change-password ────────────────────────────
router.post('/change-password', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = changePasswordSchema.safeParse(req.body)
    if (!body.success) {
      res.status(400).json({ error: body.error.errors[0].message })
      return
    }

    const { currentPassword, newPassword } = body.data
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } })

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      res.status(400).json({ error: 'Current password is incorrect' })
      return
    }

    const hashed = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed }
    })

    res.json({ message: 'Password changed successfully' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' })
  }
})

// ── POST /api/auth/refresh ────────────────────────────────────
router.post('/refresh', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }
    })

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Account not found or deactivated' })
      return
    }

    const token = generateToken(user)
    res.json({ token })
  } catch (err) {
    res.status(500).json({ error: 'Failed to refresh token' })
  }
})


// ── POST /api/auth/forgot-password ──────────────────────────
// Public endpoint — accepts matric or staff id, sends reset code via email
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  const { identifier } = req.body || {}
  if (typeof identifier !== 'string' || !identifier.trim()) {
    res.status(400).json({ error: 'Matric number or staff ID is required' })
    return
  }
  const result = await requestPasswordReset(identifier)
  if (result.ok) {
    // Always 200 — don't reveal whether the identifier exists
    res.json({ ok: true, message: 'If an account exists for that ID with a verified email, a code has been sent.' })
    return
  }
  if (result.reason === 'cooldown') {
    res.status(429).json({ error: `Please wait ${result.cooldownRemaining}s before requesting another code.` })
    return
  }
  res.status(500).json({ error: 'Could not send reset email' })
})

// ── POST /api/auth/reset-password ──────────────────────────
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  const { identifier, code, newPassword } = req.body || {}
  if (typeof identifier !== 'string' || !identifier.trim()) {
    res.status(400).json({ error: 'Matric number or staff ID is required' })
    return
  }
  if (typeof code !== 'string' || !code.trim()) {
    res.status(400).json({ error: 'Reset code is required' })
    return
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters' })
    return
  }
  const result = await verifyPasswordReset(identifier, code, newPassword)
  if (result.ok) {
    res.json({ ok: true })
    return
  }
  const status =
    result.reason === 'weak_password' ? 400 :
    result.reason === 'too_many_attempts' ? 429 :
    result.reason === 'expired' ? 410 :
    400
  res.status(status).json({ error: result.reason })
})

export default router
