import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { Role } from '@prisma/client'
import prisma from '../utils/prisma'

export interface AuthUser {
  id: string
  role: Role
  name: string
  matricNo?: string | null
  staffId?: string | null
  level?: string | null
  department?: string | null
}

export interface AuthRequest extends Request {
  user?: AuthUser
}

// ── Verify JWT token ──────────────────────────────────────────
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' })
      return
    }

    const token = authHeader.split(' ')[1]
    const secret = process.env.JWT_SECRET!

    const decoded = jwt.verify(token, secret) as AuthUser & { iat: number; exp: number }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true, role: true, name: true,
        matricNo: true, staffId: true,
        level: true, department: true,
        isActive: true
      }
    })

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Account not found or deactivated' })
      return
    }

    req.user = user
    next()
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' })
      return
    }
    res.status(401).json({ error: 'Invalid token' })
  }
}

// ── Role-based access control ─────────────────────────────────
export const requireRole = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}`
      })
      return
    }
    next()
  }
}

// ── Shorthand role guards ─────────────────────────────────────
export const isAdmin = requireRole(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN)
export const isSuperAdmin = requireRole(Role.SUPER_ADMIN)
export const isLecturer = requireRole(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.LECTURER)
export const isStudent = requireRole(Role.STUDENT)
export const isOperator = requireRole(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINT_OPERATOR)
export const isRegistrar = requireRole(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.REGISTRAR)
export const isAnyStaff = requireRole(
  Role.SUPER_ADMIN, Role.SCHOOL_ADMIN,
  Role.LECTURER, Role.PRINT_OPERATOR
)
