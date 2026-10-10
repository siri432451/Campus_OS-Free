import { Router, Response } from 'express'
import prisma from '../utils/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

router.post('/grant', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { macAddress } = req.body
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000)
    await prisma.wifiSession.updateMany({ where: { studentId: req.user!.id, isActive: true }, data: { isActive: false } })
    const session = await prisma.wifiSession.create({ data: { studentId: req.user!.id, macAddress, ipAddress: req.ip, expiresAt, isActive: true } })
    res.json({ granted: true, expiresAt: session.expiresAt })
  } catch { res.status(500).json({ error: 'Failed to grant' }) }
})

router.get('/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const session = await prisma.wifiSession.findFirst({ where: { studentId: req.user!.id, isActive: true, expiresAt: { gt: new Date() } }, orderBy: { grantedAt: 'desc' } })
    res.json({ active: !!session, session })
  } catch { res.status(500).json({ error: 'Failed to check' }) }
})

export default router
