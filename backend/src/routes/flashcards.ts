import { Router, Response } from 'express'
import { LibraryCategory, Level, Role } from '@prisma/client'
import prisma from '../utils/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// ── SM-2 algorithm ────────────────────────────────────────────
interface SM2State {
  easeFactor: number
  interval: number
  repetitions: number
}

function sm2(prev: SM2State | null, quality: number): SM2State {
  let { easeFactor, interval, repetitions } = prev ?? {
    easeFactor: 2.5, interval: 0, repetitions: 0,
  }
  if (quality < 3) {
    repetitions = 0
    interval = 1
  } else {
    repetitions++
    if (repetitions === 1) interval = 1
    else if (repetitions === 2) interval = 6
    else interval = Math.round(interval * easeFactor)
  }
  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  )
  return { easeFactor, interval, repetitions }
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + days)
  return result
}

function intervalLabel(days: number): string {
  if (days < 1) return '10 min'
  if (days === 1) return '1 day'
  return `${days} days`
}

// ── GET /api/decks ─────────────────────────────────────────────
router.get('/decks', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { level, category, search, mine } = req.query
    const userId = req.user!.id

    const where: Record<string, unknown> = {
      OR: [
        { isPublic: true },
        { createdById: userId },
      ],
    }
    if (mine === 'true') {
      delete (where as Record<string, unknown>).OR
      where.createdById = userId
    }
    if (level) where.level = level
    if (category) where.category = category
    if (search) {
      where.title = { contains: search as string, mode: 'insensitive' }
    }

    const decks = await prisma.flashcardDeckV2.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { cards: true } },
        createdBy: { select: { name: true } },
      },
    })

    // For each deck count how many cards are due today for this user
    const now = new Date()
    const deckIds = decks.map(d => d.id)

    const dueCountsByDeck = await Promise.all(
      deckIds.map(async deckId => {
        // Cards with no review record OR nextReview <= now
        const deck = await prisma.flashcardDeckV2.findUnique({
          where: { id: deckId },
          select: { cards: { select: { id: true } } },
        })
        if (!deck) return { deckId, due: 0 }
        const cardIds = deck.cards.map(c => c.id)
        const reviewed = await prisma.flashcardReview.findMany({
          where: { userId, cardId: { in: cardIds }, nextReview: { gt: now } },
          select: { cardId: true },
        })
        const notDueIds = new Set(reviewed.map(r => r.cardId))
        const due = cardIds.filter(id => !notDueIds.has(id)).length
        return { deckId, due }
      })
    )
    const dueMap: Record<string, number> = {}
    dueCountsByDeck.forEach(({ deckId, due }) => { dueMap[deckId] = due })

    res.json(decks.map(d => ({ ...d, dueCount: dueMap[d.id] ?? 0 })))
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to fetch decks' }) }
})

// ── POST /api/decks ────────────────────────────────────────────
router.post('/decks', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, category, level, isPublic } = req.body
    if (!title?.trim()) { res.status(400).json({ error: 'Title required' }); return }
    const deck = await prisma.flashcardDeckV2.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        category: (category as LibraryCategory) || LibraryCategory.OTHER,
        level: (level as Level) || Level.ND1,
        isPublic: isPublic !== false,
        createdById: req.user!.id,
      },
    })
    res.status(201).json(deck)
  } catch { res.status(500).json({ error: 'Failed to create deck' }) }
})

// ── GET /api/decks/:id ─────────────────────────────────────────
router.get('/decks/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const deck = await prisma.flashcardDeckV2.findUnique({
      where: { id: req.params.id },
      include: {
        cards: { orderBy: { sortOrder: 'asc' } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { cards: true } },
      },
    })
    if (!deck) { res.status(404).json({ error: 'Not found' }); return }
    if (!deck.isPublic && deck.createdById !== req.user!.id) {
      res.status(403).json({ error: 'This deck is private' }); return
    }
    res.json(deck)
  } catch { res.status(500).json({ error: 'Failed to fetch deck' }) }
})

// ── PATCH /api/decks/:id ───────────────────────────────────────
router.patch('/decks/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const deck = await prisma.flashcardDeckV2.findUnique({ where: { id: req.params.id } })
    if (!deck) { res.status(404).json({ error: 'Not found' }); return }
    const isOwner = deck.createdById === req.user!.id
    const isAdmin = ([Role.SUPER_ADMIN, Role.SCHOOL_ADMIN] as Role[]).includes(req.user!.role)
    if (!isOwner && !isAdmin) { res.status(403).json({ error: 'Forbidden' }); return }

    const { title, description, category, level, isPublic } = req.body
    const updated = await prisma.flashcardDeckV2.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(level !== undefined ? { level } : {}),
        ...(isPublic !== undefined ? { isPublic } : {}),
      },
    })
    res.json(updated)
  } catch { res.status(500).json({ error: 'Failed to update deck' }) }
})

// ── DELETE /api/decks/:id ──────────────────────────────────────
router.delete('/decks/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const deck = await prisma.flashcardDeckV2.findUnique({ where: { id: req.params.id } })
    if (!deck) { res.status(404).json({ error: 'Not found' }); return }
    const isOwner = deck.createdById === req.user!.id
    const isAdmin = ([Role.SUPER_ADMIN, Role.SCHOOL_ADMIN] as Role[]).includes(req.user!.role)
    if (!isOwner && !isAdmin) { res.status(403).json({ error: 'Forbidden' }); return }
    await prisma.flashcardDeckV2.delete({ where: { id: req.params.id } })
    res.json({ message: 'Deleted' })
  } catch { res.status(500).json({ error: 'Failed to delete deck' }) }
})

// ── POST /api/decks/:id/cards ──────────────────────────────────
router.post('/decks/:id/cards', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const deck = await prisma.flashcardDeckV2.findUnique({ where: { id: req.params.id } })
    if (!deck) { res.status(404).json({ error: 'Deck not found' }); return }
    if (deck.createdById !== req.user!.id) { res.status(403).json({ error: 'Forbidden' }); return }

    const { front, back, sortOrder } = req.body
    if (!front?.trim() || !back?.trim()) {
      res.status(400).json({ error: 'Front and back are required' }); return
    }

    // Auto-increment order if not provided
    let order = sortOrder
    if (order === undefined) {
      const lastCard = await prisma.flashcardCard.findFirst({
        where: { deckId: req.params.id }, orderBy: { sortOrder: 'desc' },
      })
      order = (lastCard?.sortOrder ?? -1) + 1
    }

    const card = await prisma.flashcardCard.create({
      data: { deckId: req.params.id, front: front.trim(), back: back.trim(), sortOrder: order },
    })
    res.status(201).json(card)
  } catch { res.status(500).json({ error: 'Failed to add card' }) }
})

// ── POST /api/decks/:id/cards/bulk ────────────────────────────
router.post('/decks/:id/cards/bulk', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const deck = await prisma.flashcardDeckV2.findUnique({ where: { id: req.params.id } })
    if (!deck) { res.status(404).json({ error: 'Deck not found' }); return }
    if (deck.createdById !== req.user!.id) { res.status(403).json({ error: 'Forbidden' }); return }

    const { cards } = req.body as { cards: Array<{ front: string; back: string }> }
    if (!Array.isArray(cards) || cards.length === 0) {
      res.status(400).json({ error: 'cards array required' }); return
    }

    const lastCard = await prisma.flashcardCard.findFirst({
      where: { deckId: req.params.id }, orderBy: { sortOrder: 'desc' },
    })
    let baseOrder = (lastCard?.sortOrder ?? -1) + 1

    const created = await prisma.flashcardCard.createMany({
      data: cards
        .filter(c => c.front?.trim() && c.back?.trim())
        .map(c => ({
          deckId: req.params.id,
          front: c.front.trim(),
          back: c.back.trim(),
          sortOrder: baseOrder++,
        })),
    })
    res.status(201).json({ created: created.count })
  } catch { res.status(500).json({ error: 'Failed to bulk import cards' }) }
})

// ── PATCH /api/cards/:id ───────────────────────────────────────
router.patch('/cards/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const card = await prisma.flashcardCard.findUnique({
      where: { id: req.params.id }, include: { deck: { select: { createdById: true } } },
    })
    if (!card) { res.status(404).json({ error: 'Not found' }); return }
    if (card.deck.createdById !== req.user!.id) { res.status(403).json({ error: 'Forbidden' }); return }

    const { front, back, sortOrder } = req.body
    const updated = await prisma.flashcardCard.update({
      where: { id: req.params.id },
      data: {
        ...(front !== undefined ? { front: front.trim() } : {}),
        ...(back  !== undefined ? { back: back.trim() }   : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
    })
    res.json(updated)
  } catch { res.status(500).json({ error: 'Failed to update card' }) }
})

// ── DELETE /api/cards/:id ──────────────────────────────────────
router.delete('/cards/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const card = await prisma.flashcardCard.findUnique({
      where: { id: req.params.id }, include: { deck: { select: { createdById: true } } },
    })
    if (!card) { res.status(404).json({ error: 'Not found' }); return }
    if (card.deck.createdById !== req.user!.id) { res.status(403).json({ error: 'Forbidden' }); return }
    await prisma.flashcardCard.delete({ where: { id: req.params.id } })
    res.json({ message: 'Deleted' })
  } catch { res.status(500).json({ error: 'Failed to delete card' }) }
})

// ── GET /api/decks/:id/study ───────────────────────────────────
router.get('/decks/:id/study', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const deck = await prisma.flashcardDeckV2.findUnique({
      where: { id: req.params.id },
      include: { cards: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!deck) { res.status(404).json({ error: 'Not found' }); return }
    if (!deck.isPublic && deck.createdById !== req.user!.id) {
      res.status(403).json({ error: 'Private deck' }); return
    }

    const now = new Date()
    const userId = req.user!.id

    // Fetch all reviews for this user + this deck's cards
    const reviews = await prisma.flashcardReview.findMany({
      where: {
        userId,
        cardId: { in: deck.cards.map(c => c.id) },
      },
    })
    const reviewMap: Record<string, typeof reviews[0]> = {}
    reviews.forEach(r => { reviewMap[r.cardId] = r })

    // Cards due: no review OR nextReview <= now
    const dueCards = deck.cards
      .filter(c => !reviewMap[c.id] || reviewMap[c.id].nextReview <= now)
      .slice(0, 50) // cap at 50 per session

    // Compute predicted intervals for the 4 rating buttons
    const cardsWithIntervals = dueCards.map(card => {
      const rev = reviewMap[card.id] ?? null
      const prevState: SM2State | null = rev
        ? { easeFactor: rev.easeFactor, interval: rev.interval, repetitions: rev.repetitions }
        : null
      return {
        ...card,
        predictions: {
          again: intervalLabel(sm2(prevState, 1).interval),
          hard:  intervalLabel(sm2(prevState, 3).interval),
          good:  intervalLabel(sm2(prevState, 4).interval),
          easy:  intervalLabel(sm2(prevState, 5).interval),
        },
      }
    })

    res.json({
      deckTitle: deck.title,
      totalDue: dueCards.length,
      totalCards: deck.cards.length,
      cards: cardsWithIntervals,
    })
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to fetch study session' }) }
})

// ── POST /api/cards/:id/review ─────────────────────────────────
router.post('/cards/:id/review', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { quality } = req.body as { quality: 0 | 1 | 2 | 3 | 4 | 5 }
    if (quality === undefined || quality < 0 || quality > 5) {
      res.status(400).json({ error: 'quality must be 0-5' }); return
    }

    const card = await prisma.flashcardCard.findUnique({ where: { id: req.params.id } })
    if (!card) { res.status(404).json({ error: 'Card not found' }); return }

    const userId = req.user!.id
    const existing = await prisma.flashcardReview.findUnique({
      where: { userId_cardId: { userId, cardId: req.params.id } },
    })

    const prevState: SM2State | null = existing
      ? { easeFactor: existing.easeFactor, interval: existing.interval, repetitions: existing.repetitions }
      : null

    const next = sm2(prevState, quality)
    const nextReview = addDays(new Date(), next.interval)

    const review = await prisma.flashcardReview.upsert({
      where: { userId_cardId: { userId, cardId: req.params.id } },
      update: {
        easeFactor: next.easeFactor,
        interval: next.interval,
        repetitions: next.repetitions,
        nextReview,
        lastReview: new Date(),
        updatedAt: new Date(),
      },
      create: {
        userId,
        cardId: req.params.id,
        easeFactor: next.easeFactor,
        interval: next.interval,
        repetitions: next.repetitions,
        nextReview,
        lastReview: new Date(),
      },
    })

    res.json({
      ...review,
      nextReviewLabel: intervalLabel(next.interval),
    })
  } catch { res.status(500).json({ error: 'Failed to save review' }) }
})

export default router
