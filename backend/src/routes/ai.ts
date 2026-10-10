import { Router, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { rateLimit } from 'express-rate-limit'
import { TutorMode } from '@prisma/client'
import prisma from '../utils/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { TUTOR_PROMPTS } from '../lib/tutorPrompts'

const router = Router()
router.use(authenticate)

const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: { error: 'Too many AI requests' } })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Legacy single-message chat (kept for backwards compat) ────
router.post('/chat-legacy', aiLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { message } = req.body
    if (!message?.trim()) { res.status(400).json({ error: 'Message required' }); return }
    const user = req.user!
    const history = await prisma.aiMessage.findMany({
      where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 10
    })
    const messages = history.reverse().map(m => ({
      role: m.role as 'user' | 'assistant', content: m.content
    }))
    messages.push({ role: 'user', content: message })
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 1024,
      system: `You are CampusOS AI, a helpful assistant for ${user.name}, a nursing student at the College of Nursing Sciences, Osogbo. Be concise, friendly, and Nigeria-aware.`,
      messages,
    })
    const reply = response.content[0].type === 'text' ? response.content[0].text : 'Sorry, I could not respond.'
    await prisma.aiMessage.createMany({
      data: [
        { userId: user.id, role: 'user', content: message },
        { userId: user.id, role: 'assistant', content: reply },
      ],
    })
    res.json({ reply })
  } catch (e) { console.error('AI legacy error:', e); res.status(500).json({ error: 'AI service unavailable' }) }
})

// ── POST /api/ai/chat — tutor-mode chat ───────────────────────
router.post('/chat', aiLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { mode, messages, conversationId } = req.body as {
      mode: TutorMode
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      conversationId?: string
    }

    if (!mode || !TUTOR_PROMPTS[mode]) {
      res.status(400).json({ error: 'Invalid or missing tutor mode' }); return
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages array required' }); return
    }

    const systemPrompt = TUTOR_PROMPTS[mode]

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: systemPrompt,
      messages: messages.slice(-20), // cap at last 20 for token budget
    })

    const reply = response.content[0].type === 'text'
      ? response.content[0].text
      : 'Sorry, I could not respond right now.'

    // Persist to conversation if id provided
    if (conversationId) {
      const lastUserMsg = messages[messages.length - 1]
      if (lastUserMsg?.role === 'user') {
        await prisma.chatMessage.create({
          data: {
            conversationId,
            role: 'USER',
            content: lastUserMsg.content,
          },
        })
      }
      await prisma.chatMessage.create({
        data: { conversationId, role: 'ASSISTANT', content: reply },
      })
      // Update conversation title from first user message
      const conv = await prisma.conversation.findUnique({ where: { id: conversationId } })
      if (conv && conv.title === 'New Conversation' && lastUserMsg?.role === 'user') {
        const autoTitle = lastUserMsg.content.slice(0, 60).replace(/\n/g, ' ')
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { title: autoTitle, updatedAt: new Date() },
        })
      } else if (conv) {
        await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } })
      }
    }

    res.json({ reply })
  } catch (e) {
    console.error('AI chat error:', e)
    res.status(500).json({ error: 'AI service unavailable' })
  }
})

// ── GET /api/ai/conversations ─────────────────────────────────
router.get('/conversations', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.user!.id },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true, mode: true, title: true, createdAt: true, updatedAt: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, role: true, createdAt: true },
        },
      },
    })
    res.json(conversations)
  } catch { res.status(500).json({ error: 'Failed to fetch conversations' }) }
})

// ── POST /api/ai/conversations ────────────────────────────────
router.post('/conversations', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { mode } = req.body as { mode: TutorMode }
    if (!mode || !TUTOR_PROMPTS[mode]) {
      res.status(400).json({ error: 'Valid mode required' }); return
    }
    const conv = await prisma.conversation.create({
      data: { userId: req.user!.id, mode, title: 'New Conversation' },
    })
    res.status(201).json(conv)
  } catch { res.status(500).json({ error: 'Failed to create conversation' }) }
})

// ── GET /api/ai/conversations/:id ────────────────────────────
router.get('/conversations/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conv = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!conv) { res.status(404).json({ error: 'Not found' }); return }
    if (conv.userId !== req.user!.id) { res.status(403).json({ error: 'Forbidden' }); return }
    res.json(conv)
  } catch { res.status(500).json({ error: 'Failed to fetch conversation' }) }
})

// ── DELETE /api/ai/conversations/:id ─────────────────────────
router.delete('/conversations/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conv = await prisma.conversation.findUnique({ where: { id: req.params.id } })
    if (!conv) { res.status(404).json({ error: 'Not found' }); return }
    if (conv.userId !== req.user!.id) { res.status(403).json({ error: 'Forbidden' }); return }
    await prisma.conversation.delete({ where: { id: req.params.id } })
    res.json({ message: 'Deleted' })
  } catch { res.status(500).json({ error: 'Failed to delete' }) }
})

// ── Legacy history endpoints ──────────────────────────────────
router.get('/history', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const messages = await prisma.aiMessage.findMany({
      where: { userId: req.user!.id }, orderBy: { createdAt: 'asc' }, take: 50,
    })
    res.json(messages)
  } catch { res.status(500).json({ error: 'Failed to fetch history' }) }
})

router.delete('/history', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.aiMessage.deleteMany({ where: { userId: req.user!.id } })
    res.json({ message: 'History cleared' })
  } catch { res.status(500).json({ error: 'Failed to clear' }) }
})

export default router
