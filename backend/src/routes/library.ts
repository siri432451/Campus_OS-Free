import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import * as FileType from 'file-type'
import { LibraryCategory, LibraryItemType, Role } from '@prisma/client'
import prisma from '../utils/prisma'
import { authenticate, isLecturer, AuthRequest } from '../middleware/auth'
import { processPdf, processVideo, cleanupFile, ensureThumbDir } from '../services/mediaService'

const router = Router()
router.use(authenticate)

// ── Directories ───────────────────────────────────────────────
const BASE_UPLOAD = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'library')
  : path.join(__dirname, '../../../uploads/library')
const THUMB_DIR = path.join(BASE_UPLOAD, 'thumbs')

function ensureDirs(): void {
  if (!fs.existsSync(BASE_UPLOAD)) fs.mkdirSync(BASE_UPLOAD, { recursive: true })
  ensureThumbDir()
}
ensureDirs()

// ── Multer — memory storage so we can sniff MIME first ────────
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 520 * 1024 * 1024 }, // 520 MB hard limit
})

// ── Allowed MIME types ────────────────────────────────────────
const ALLOWED_PDF  = ['application/pdf']
const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime']
const ALL_ALLOWED   = [...ALLOWED_PDF, ...ALLOWED_VIDEO]

const EXT_MAP: Record<string, string> = {
  'application/pdf':    'pdf',
  'video/mp4':          'mp4',
  'video/webm':         'webm',
  'video/quicktime':    'mov',
}

// ── Helper: build thumbnailUrl from item id ───────────────────
function thumbUrl(id: string): string {
  return `/api/library/${id}/thumbnail`
}

// ── Serialise book for JSON (BigInt → string) ─────────────────
function serialiseItem(item: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(item).map(([k, v]) => [k, typeof v === 'bigint' ? v.toString() : v])
  )
}

// ── GET /api/library ──────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { level, department, category, search, featured, type } = req.query

    const where: Record<string, unknown> = {}
    if (level) where.level = level
    if (department) where.department = department
    if (category) where.category = category
    if (type) where.type = type
    if (featured === 'true') where.isFeatured = true
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { author: { contains: search as string, mode: 'insensitive' } },
      ]
    }

    const items = await prisma.book.findMany({
      where,
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true, title: true, author: true, description: true,
        department: true, level: true, category: true,
        fileSize: true, downloadCount: true, isFeatured: true,
        type: true, mimeType: true, durationSeconds: true,
        pageCount: true, thumbnailPath: true, coverUrl: true,
        createdAt: true, uploadedById: true,
        uploadedBy: { select: { id: true, name: true } },
      },
    })

    const result = items.map(item => ({
      ...serialiseItem(item as unknown as Record<string, unknown>),
      thumbnailUrl: item.thumbnailPath ? thumbUrl(item.id) : item.coverUrl ?? null,
    }))

    res.json(result)
  } catch (err) {
    console.error('Library list error:', err)
    res.status(500).json({ error: 'Failed to fetch library items' })
  }
})

// ── POST /api/library/upload ──────────────────────────────────
router.post(
  '/upload',
  isLecturer,
  memUpload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    let savedFilePath: string | null = null
    let savedThumbPath: string | null = null

    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided' })
        return
      }

      // ── 1. Sniff MIME from buffer ───────────────────────────
      const detected = await FileType.fromBuffer(req.file.buffer)
      const mimeType = detected?.mime ?? req.file.mimetype

      if (!ALL_ALLOWED.includes(mimeType)) {
        res.status(400).json({
          error: `File type not allowed. Accepted: PDF, MP4, WebM, MOV. Detected: ${mimeType}`,
        })
        return
      }

      const isPdf = ALLOWED_PDF.includes(mimeType)
      const isVideo = ALLOWED_VIDEO.includes(mimeType)

      // ── 2. Size limits ──────────────────────────────────────
      const maxBytes = isPdf ? 100 * 1024 * 1024 : 500 * 1024 * 1024
      if (req.file.buffer.length > maxBytes) {
        res.status(400).json({
          error: `File too large. Max ${isPdf ? '100 MB for PDFs' : '500 MB for videos'}`,
        })
        return
      }

      // ── 3. Validate form fields ─────────────────────────────
      const { title, author, description, department, category, isFeatured } = req.body
      const levelRaw: string | string[] | undefined = req.body.level

      if (!title?.trim()) {
        res.status(400).json({ error: 'Title is required' })
        return
      }
      if (!category) {
        res.status(400).json({ error: 'Category is required' })
        return
      }
      // Level: accept single value or first of array
      const levelValue = Array.isArray(levelRaw) ? levelRaw[0] : levelRaw

      // ── 4. Write file to disk ───────────────────────────────
      const itemId = uuidv4()
      const ext = EXT_MAP[mimeType] ?? 'bin'
      const filename = `${itemId}.${ext}`
      savedFilePath = path.join(BASE_UPLOAD, filename)
      fs.writeFileSync(savedFilePath, req.file.buffer)

      // ── 5. Process media ────────────────────────────────────
      let pageCount: number | null = null
      let durationSeconds: number | null = null
      let thumbnailPath: string | null = null

      if (isPdf) {
        const result = await processPdf(savedFilePath, itemId)
        pageCount = result.pageCount || null
        savedThumbPath = result.thumbnailPath
        thumbnailPath = result.thumbnailPath
      } else if (isVideo) {
        const result = await processVideo(savedFilePath, itemId)
        durationSeconds = result.durationSeconds || null
        savedThumbPath = result.thumbnailPath
        thumbnailPath = result.thumbnailPath
      }

      // ── 6. Determine featured (admin-only) ──────────────────
      const canSetFeatured = req.user!.role === Role.SUPER_ADMIN || req.user!.role === Role.SCHOOL_ADMIN
      const featured = canSetFeatured && (isFeatured === 'true' || isFeatured === true)

      // ── 7. Insert DB row ────────────────────────────────────
      const created = await prisma.book.create({
        data: {
          id: itemId,
          title: title.trim(),
          author: author?.trim() || null,
          description: description?.trim() || null,
          department: department?.trim() || null,
          level: levelValue as Parameters<typeof prisma.book.create>[0]['data']['level'] ?? undefined,
          category: category as LibraryCategory,
          filePath: savedFilePath,
          fileSize: BigInt(req.file.buffer.length),
          type: isPdf ? LibraryItemType.PDF : LibraryItemType.VIDEO,
          mimeType,
          pageCount: pageCount ?? undefined,
          durationSeconds: durationSeconds ?? undefined,
          thumbnailPath: thumbnailPath ?? undefined,
          isFeatured: featured,
          uploadedById: req.user!.id,
        },
        select: {
          id: true, title: true, author: true, type: true,
          mimeType: true, pageCount: true, durationSeconds: true,
          level: true, category: true, isFeatured: true, createdAt: true,
          uploadedBy: { select: { name: true } },
        },
      })

      res.status(201).json({
        ...serialiseItem(created as unknown as Record<string, unknown>),
        thumbnailUrl: thumbnailPath ? thumbUrl(itemId) : null,
      })
    } catch (err) {
      // Clean up partial files on any failure
      cleanupFile(savedFilePath)
      cleanupFile(savedThumbPath)
      console.error('Upload error:', err)
      res.status(500).json({ error: 'Upload failed. Please try again.' })
    }
  }
)

// ── GET /api/library/:id/thumbnail ───────────────────────────
router.get('/:id/thumbnail', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const item = await prisma.book.findUnique({
      where: { id: req.params.id },
      select: { thumbnailPath: true, coverUrl: true },
    })
    if (!item) { res.status(404).json({ error: 'Not found' }); return }

    if (item.thumbnailPath && fs.existsSync(item.thumbnailPath)) {
      res.set('Cache-Control', 'public, max-age=86400')
      res.set('Content-Type', 'image/png')
      res.sendFile(path.resolve(item.thumbnailPath))
      return
    }

    // Fall back: redirect to coverUrl or 404
    if (item.coverUrl) {
      res.redirect(item.coverUrl)
      return
    }

    res.status(404).json({ error: 'No thumbnail available' })
  } catch {
    res.status(500).json({ error: 'Failed to serve thumbnail' })
  }
})

// ── GET /api/library/:id/download (PDFs only) ─────────────────
router.get('/:id/download', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const item = await prisma.book.findUnique({ where: { id: req.params.id } })
    if (!item) { res.status(404).json({ error: 'Not found' }); return }
    if (item.type !== LibraryItemType.PDF) {
      res.status(400).json({ error: 'This item is a video. Use /stream instead.' })
      return
    }
    if (!fs.existsSync(item.filePath)) {
      res.status(404).json({ error: 'File not found on disk' })
      return
    }
    await prisma.book.update({ where: { id: item.id }, data: { downloadCount: { increment: 1 } } })
    const safeName = item.title.replace(/[^a-zA-Z0-9\s-]/g, '').trim()
    res.download(item.filePath, `${safeName}.pdf`)
  } catch {
    res.status(500).json({ error: 'Download failed' })
  }
})

// ── GET /api/library/:id/stream (videos only) ─────────────────
router.get('/:id/stream', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const item = await prisma.book.findUnique({ where: { id: req.params.id } })
    if (!item) { res.status(404).json({ error: 'Not found' }); return }
    if (item.type !== LibraryItemType.VIDEO) {
      res.status(400).json({ error: 'This item is a PDF. Use /download instead.' })
      return
    }
    if (!fs.existsSync(item.filePath)) {
      res.status(404).json({ error: 'File not found on disk' })
      return
    }

    const stat = fs.statSync(item.filePath)
    const fileSize = stat.size
    const rangeHeader = req.headers.range

    res.set('Accept-Ranges', 'bytes')
    res.set('Content-Type', item.mimeType || 'video/mp4')

    if (rangeHeader) {
      // Parse Range header
      const parts = rangeHeader.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunkSize = end - start + 1

      res.status(206)
      res.set('Content-Range', `bytes ${start}-${end}/${fileSize}`)
      res.set('Content-Length', String(chunkSize))

      const stream = fs.createReadStream(item.filePath, { start, end })
      stream.pipe(res)
    } else {
      res.set('Content-Length', String(fileSize))
      fs.createReadStream(item.filePath).pipe(res)
    }
  } catch (err) {
    console.error('Stream error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Streaming failed' })
    }
  }
})

// ── PATCH /api/library/:id ────────────────────────────────────
router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const item = await prisma.book.findUnique({ where: { id: req.params.id } })
    if (!item) { res.status(404).json({ error: 'Not found' }); return }

    const isOwner = item.uploadedById === req.user!.id
    const isAdmin = req.user!.role === Role.SUPER_ADMIN || req.user!.role === Role.SCHOOL_ADMIN
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'Not authorised to edit this item' })
      return
    }

    const { title, author, description, department, level, category, isFeatured } = req.body
    const canSetFeatured = isAdmin

    const updated = await prisma.book.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(author !== undefined ? { author: author?.trim() || null } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(department !== undefined ? { department: department?.trim() || null } : {}),
        ...(level !== undefined ? { level } : {}),
        ...(category !== undefined ? { category: category as LibraryCategory } : {}),
        ...(isFeatured !== undefined && canSetFeatured
          ? { isFeatured: isFeatured === true || isFeatured === 'true' }
          : {}),
      },
      select: {
        id: true, title: true, author: true, description: true,
        department: true, level: true, category: true,
        type: true, isFeatured: true, updatedAt: true,
        uploadedBy: { select: { name: true } },
      },
    })

    res.json(serialiseItem(updated as unknown as Record<string, unknown>))
  } catch {
    res.status(500).json({ error: 'Failed to update item' })
  }
})

// ── DELETE /api/library/:id ───────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const item = await prisma.book.findUnique({ where: { id: req.params.id } })
    if (!item) { res.status(404).json({ error: 'Not found' }); return }

    const isOwner = item.uploadedById === req.user!.id
    const isAdmin = req.user!.role === Role.SUPER_ADMIN || req.user!.role === Role.SCHOOL_ADMIN
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'Not authorised to delete this item' })
      return
    }

    // Remove files
    cleanupFile(item.filePath)
    if (item.thumbnailPath) cleanupFile(item.thumbnailPath)

    await prisma.book.delete({ where: { id: req.params.id } })
    res.json({ message: 'Deleted successfully' })
  } catch {
    res.status(500).json({ error: 'Failed to delete item' })
  }
})

export default router
