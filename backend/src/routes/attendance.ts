import { Router, Response } from 'express'
import prisma from '../utils/prisma'
import { authenticate, isLecturer, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

function genCode(len = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

router.post('/sessions', isLecturer, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { courseCode, courseName, level, department, durationMinutes = 60 } = req.body
    if (!courseCode || !courseName) { res.status(400).json({ error: 'Course details required' }); return }
    let sessionCode = genCode(); let attempts = 0
    while (attempts < 10) {
      const exists = await prisma.attendanceSession.findUnique({ where: { sessionCode } })
      if (!exists) break; sessionCode = genCode(); attempts++
    }
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000)
    const session = await prisma.attendanceSession.create({
      data: { lecturerId: req.user!.id, courseCode, courseName, sessionCode, level, department, expiresAt }
    })
    res.status(201).json(session)
  } catch { res.status(500).json({ error: 'Failed to create session' }) }
})

router.post('/scan', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionCode } = req.body
    if (!sessionCode) { res.status(400).json({ error: 'Session code required' }); return }
    const session = await prisma.attendanceSession.findUnique({ where: { sessionCode } })
    if (!session || !session.isActive) { res.status(404).json({ error: 'Invalid or expired session' }); return }
    if (session.expiresAt && session.expiresAt < new Date()) {
      await prisma.attendanceSession.update({ where: { id: session.id }, data: { isActive: false } })
      res.status(400).json({ error: 'Session has expired' }); return
    }
    const existing = await prisma.attendanceRecord.findUnique({ where: { sessionId_studentId: { sessionId: session.id, studentId: req.user!.id } } })
    if (existing) { res.status(409).json({ error: 'Already marked' }); return }
    const record = await prisma.attendanceRecord.create({ data: { sessionId: session.id, studentId: req.user!.id } })
    res.status(201).json({ message: 'Attendance recorded', record })
  } catch { res.status(500).json({ error: 'Failed to record attendance' }) }
})

router.patch('/sessions/:id/close', isLecturer, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const s = await prisma.attendanceSession.update({ where: { id: req.params.id }, data: { isActive: false } })
    res.json(s)
  } catch { res.status(500).json({ error: 'Failed to close' }) }
})

router.get('/sessions/:id/report', isLecturer, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = await prisma.attendanceSession.findUnique({ where: { id: req.params.id }, include: { records: { include: { student: { select: { name: true, matricNo: true } } } } } })
    if (!session) { res.status(404).json({ error: 'Not found' }); return }
    res.json(session)
  } catch { res.status(500).json({ error: 'Failed to fetch report' }) }
})

export default router
