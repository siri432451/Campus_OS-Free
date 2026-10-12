import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import path from 'path'
import { rateLimit } from 'express-rate-limit'
import dotenv from 'dotenv'

dotenv.config()

// ── BigInt JSON serialization patch ───────────────────────────
;(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString()
}

import authRoutes        from './routes/auth'
import userRoutes        from './routes/users'
import bookRoutes        from './routes/books'
import libraryRoutes     from './routes/library'
import resultRoutes      from './routes/results'
import attendanceRoutes  from './routes/attendance'
import printRoutes       from './routes/print'
import onboardingRoutes from './routes/onboarding'
import announcementRoutes from './routes/announcements'
import wifiRoutes        from './routes/wifi'
import simulationRoutes  from './routes/simulation'
import flashcardRoutes   from './routes/flashcards'
import aiRoutes          from './routes/ai'
import paymentRoutes     from './routes/payments'
import healthRoutes      from './routes/health'
import adminRoutes       from './routes/admin'
import bulkImportRoutes  from './routes/bulkImport'
import studySnapRoutes  from './routes/studySnap'
import registrarRoutes   from './routes/registrar'
import transcriptRoutes  from './routes/transcripts'
import publicTranscriptRoutes from './routes/publicTranscripts'

const app = express()
const PORT = process.env.PORT || 3001

// ── Trust proxy (nginx) ───────────────────────────────────────
app.set('trust proxy', 1)

// ── Security ──────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// ── Rate limiting ─────────────────────────────────────────────
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false })
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { error: 'Too many login attempts. Try again in 15 minutes.' } })
app.use(limiter)

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ── Logging ───────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') app.use(morgan('combined'))

// ── Static files ──────────────────────────────────────────────
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads')
app.use('/uploads', express.static(uploadDir))

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({ status: 'ok', app: 'CampusOS API', version: '1.0.0', timestamp: new Date().toISOString() })
})

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',          authLimiter, authRoutes)
app.use('/api/users',         userRoutes)
app.use('/api/books',         bookRoutes)           // deprecated alias
app.use('/api/library',       libraryRoutes)
app.use('/api/results',       resultRoutes)
app.use('/api/attendance',    attendanceRoutes)
app.use('/api/print',         printRoutes)
app.use('/api/auth/onboarding', onboardingRoutes)
app.use('/api/announcements', announcementRoutes)
app.use('/api/wifi',          wifiRoutes)
app.use('/api/simulation',    simulationRoutes)
// Flashcards: mount on /api so internal paths /decks/* and /cards/* become /api/decks/* and /api/cards/*
app.use('/api',               flashcardRoutes)
app.use('/api/ai',            aiRoutes)
app.use('/api/payments',      paymentRoutes)
app.use('/api/health',        healthRoutes)
app.use('/api/admin',         adminRoutes)
app.use('/api/admin/bulk-import', bulkImportRoutes)
app.use('/api/study-snap',    studySnapRoutes)
app.use('/api/registrar/transcripts', transcriptRoutes)
app.use('/api/public/transcripts', publicTranscriptRoutes)
app.use('/api/registrar',     registrarRoutes)

// ── 404 ───────────────────────────────────────────────────────
app.use((_, res) => res.status(404).json({ error: 'Route not found' }))

// ── Error handler ─────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  })
})

app.listen(PORT, () => {
  console.log(`🚀 CampusOS API running on port ${PORT}`)
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
})

export default app

