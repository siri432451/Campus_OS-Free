import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import prisma from '../utils/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

router.get('/profile', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, matricNo: true, staffId: true, role: true, department: true, level: true, phone: true, photoUrl: true, qrCode: true, lastLogin: true, createdAt: true, printCredit: { select: { balance: true, accountNo: true, bankName: true } } }
    })
    res.json(user)
  } catch { res.status(500).json({ error: 'Failed to fetch profile' }) }
})

router.patch('/profile', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { phone } = req.body
    const user = await prisma.user.update({ where: { id: req.user!.id }, data: { phone }, select: { id: true, name: true, phone: true } })
    res.json(user)
  } catch { res.status(500).json({ error: 'Failed to update' }) }
})


const PHOTO_DIR = '/var/www/campusos/uploads/photos'
if (!fs.existsSync(PHOTO_DIR)) fs.mkdirSync(PHOTO_DIR, { recursive: true })

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PHOTO_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  },
})

const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) cb(null, true)
    else cb(new Error('Only JPG and PNG files are allowed'))
  },
})

router.post('/upload-photo', photoUpload.single('photo'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No photo uploaded' }); return }
    const photoUrl = `/uploads/photos/${req.file.filename}`
    const existing = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { photoUrl: true } })
    if (existing?.photoUrl) {
      const oldPath = `/var/www/campusos${existing.photoUrl}`
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
    }
    await prisma.user.update({ where: { id: req.user!.id }, data: { photoUrl } })
    res.json({ ok: true, photoUrl })
  } catch (e) {
    console.error('photo upload error:', e)
    res.status(500).json({ error: 'Failed to upload photo' })
  }
})

export default router
