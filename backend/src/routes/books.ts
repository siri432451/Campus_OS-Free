import { Router, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { Level } from '@prisma/client'
import prisma from '../utils/prisma'
import { authenticate, isAdmin, isLecturer, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

const uploadDir = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'books')
  : path.join(__dirname, '../../uploads/books')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const u = `${Date.now()}-${Math.random().toString(36).substring(2)}`
    cb(null, u + path.extname(file.originalname))
  }
})
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } })

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { level, department, category, search, featured } = req.query
    const where: Record<string, unknown> = {}
    if (level) where.level = level
    if (department) where.department = department
    if (category) where.category = category
    if (featured === 'true') where.isFeatured = true
    if (search) where.OR = [
      { title: { contains: search as string, mode: 'insensitive' } },
      { author: { contains: search as string, mode: 'insensitive' } }
    ]
    const books = await prisma.book.findMany({
      where, orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, title: true, author: true, description: true, department: true, level: true, category: true, fileSize: true, coverUrl: true, downloadCount: true, isFeatured: true, createdAt: true, uploadedBy: { select: { name: true } } }
    })
    res.json(books)
  } catch (e) { console.error('BOOKS GET ERROR:', e); res.status(500).json({ error: 'Failed to fetch books' }) }
})

router.post('/', isLecturer, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ error: 'File required' }); return }
    const { title, author, description, department, level, category } = req.body
    if (!title) { res.status(400).json({ error: 'Title required' }); return }
    const book = await prisma.book.create({
      data: { title, author, description, department, level: level as Level | undefined, category, filePath: req.file.path, fileSize: BigInt(req.file.size), uploadedById: req.user!.id }
    })
    res.status(201).json(book)
  } catch { if (req.file) try { fs.unlinkSync(req.file.path) } catch {} ; res.status(500).json({ error: 'Upload failed' }) }
})

router.get('/:id/download', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const book = await prisma.book.findUnique({ where: { id: req.params.id } })
    if (!book) { res.status(404).json({ error: 'Not found' }); return }
    await prisma.book.update({ where: { id: book.id }, data: { downloadCount: { increment: 1 } } })
    res.download(book.filePath)
  } catch { res.status(500).json({ error: 'Download failed' }) }
})

router.delete('/:id', isAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const book = await prisma.book.findUnique({ where: { id: req.params.id } })
    if (!book) { res.status(404).json({ error: 'Not found' }); return }
    if (fs.existsSync(book.filePath)) fs.unlinkSync(book.filePath)
    await prisma.book.delete({ where: { id: req.params.id } })
    res.json({ message: 'Deleted' })
  } catch { res.status(500).json({ error: 'Delete failed' }) }
})

export default router
