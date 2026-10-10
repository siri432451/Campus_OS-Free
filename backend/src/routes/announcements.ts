import { Router, Response } from 'express'
import { AnnouncementTarget, Role } from '@prisma/client'
import prisma from '../utils/prisma'
import { authenticate, isLecturer, requireRole, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// ── GET /api/announcements ────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!
    const page  = Math.max(1, parseInt((req.query.page as string) || '1', 10))
    const limit = Math.min(50, parseInt((req.query.limit as string) || '20', 10))
    const skip  = (page - 1) * limit

    const isStaff = ([Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.LECTURER, Role.REGISTRAR] as Role[]).includes(user.role)

    // Staff see everything; students/operators see their targets
    const where = isStaff
      ? {}
      : {
          target: {
            in: [
              AnnouncementTarget.ALL,
              AnnouncementTarget.STUDENTS,
              ...(user.level ? [user.level as unknown as AnnouncementTarget] : []),
            ] as AnnouncementTarget[],
          },
        }

    const [items, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: { createdBy: { select: { id: true, name: true, role: true } } },
      }),
      prisma.announcement.count({ where }),
    ])

    res.json({
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch { res.status(500).json({ error: 'Failed to fetch announcements' }) }
})

// ── POST /api/announcements ───────────────────────────────────
router.post('/', requireRole(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.LECTURER, Role.REGISTRAR), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, body, target = 'ALL', isPinned = false } = req.body
    if (!title?.trim() || !body?.trim()) {
      res.status(400).json({ error: 'Title and body are required' }); return
    }
    if (title.length > 200) {
      res.status(400).json({ error: 'Title must be 200 characters or fewer' }); return
    }
    const ann = await prisma.announcement.create({
      data: {
        title: title.trim(),
        body: body.trim(),
        target: target as AnnouncementTarget,
        isPinned: Boolean(isPinned),
        createdById: req.user!.id,
      },
      include: { createdBy: { select: { id: true, name: true, role: true } } },
    })
    res.status(201).json(ann)
  } catch { res.status(500).json({ error: 'Failed to create announcement' }) }
})

// ── PATCH /api/announcements/:id ─────────────────────────────
router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ann = await prisma.announcement.findUnique({ where: { id: req.params.id } })
    if (!ann) { res.status(404).json({ error: 'Not found' }); return }

    const isOwner = ann.createdById === req.user!.id
    const isAdmin = ([Role.SUPER_ADMIN, Role.SCHOOL_ADMIN] as Role[]).includes(req.user!.role)
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'Not authorised to edit this announcement' }); return
    }

    const { title, body, target, isPinned } = req.body
    if (title !== undefined && title.length > 200) {
      res.status(400).json({ error: 'Title must be 200 characters or fewer' }); return
    }

    const updated = await prisma.announcement.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(body  !== undefined ? { body: body.trim() }   : {}),
        ...(target !== undefined ? { target: target as AnnouncementTarget } : {}),
        ...(isPinned !== undefined ? { isPinned: Boolean(isPinned) } : {}),
      },
      include: { createdBy: { select: { id: true, name: true, role: true } } },
    })
    res.json(updated)
  } catch { res.status(500).json({ error: 'Failed to update announcement' }) }
})

// ── DELETE /api/announcements/:id ────────────────────────────
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ann = await prisma.announcement.findUnique({ where: { id: req.params.id } })
    if (!ann) { res.status(404).json({ error: 'Not found' }); return }

    const isOwner = ann.createdById === req.user!.id
    const isAdmin = ([Role.SUPER_ADMIN, Role.SCHOOL_ADMIN] as Role[]).includes(req.user!.role)
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'Not authorised to delete this announcement' }); return
    }

    await prisma.announcement.delete({ where: { id: req.params.id } })
    res.json({ message: 'Deleted' })
  } catch { res.status(500).json({ error: 'Failed to delete announcement' }) }
})

export default router
