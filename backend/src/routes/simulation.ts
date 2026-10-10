import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const router = Router()
const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'campusos_secret'

function getStudentId(req: Request): string | null {
  try {
    const auth = req.headers.authorization
    if (!auth) return null
    const token = auth.replace('Bearer ', '')
    const decoded: any = jwt.verify(token, JWT_SECRET)
    return decoded.userId || null
  } catch { return null }
}

// POST /api/simulation/score — save score and update XP
router.post('/score', async (req: Request, res: Response) => {
  try {
    const studentId = getStudentId(req)
    if (!studentId) return res.status(401).json({ error: 'Unauthorized' })

    const { procedure_id, procedure_title, mode, score, total, xp_earned, passed } = req.body

    // Save score
    await prisma.$executeRaw`
      INSERT INTO simulation_scores (id, student_id, procedure_id, procedure_title, mode, score, total, xp_earned, passed)
      VALUES (gen_random_uuid()::text, ${studentId}, ${procedure_id}, ${procedure_title}, ${mode}, ${score}, ${total}, ${xp_earned}, ${passed})
    `

    // Upsert XP
    await prisma.$executeRaw`
      INSERT INTO student_xp (student_id, total_xp, last_activity, updated_at)
      VALUES (${studentId}, ${xp_earned}, CURRENT_DATE, NOW())
      ON CONFLICT (student_id) DO UPDATE SET
        total_xp = student_xp.total_xp + ${xp_earned},
        last_activity = CURRENT_DATE,
        updated_at = NOW(),
        streak = CASE
          WHEN student_xp.last_activity = CURRENT_DATE - INTERVAL '1 day' THEN student_xp.streak + 1
          WHEN student_xp.last_activity = CURRENT_DATE THEN student_xp.streak
          ELSE 1
        END
    `

    // Get updated XP
    const xpRow = await prisma.$queryRaw`
      SELECT total_xp, streak FROM student_xp WHERE student_id = ${studentId}
    ` as any[]

    res.json({ success: true, total_xp: xpRow[0]?.total_xp || 0, streak: xpRow[0]?.streak || 0 })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/simulation/leaderboard?dept=all
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const dept = req.query.dept as string || 'all'

    let rows: any[]
    if (dept === 'all') {
      rows = await prisma.$queryRaw`
        SELECT u.id, u.name, u.matric_no, u.department,
               COALESCE(sx.total_xp, 0) as total_xp,
               COALESCE(sx.streak, 0) as streak
        FROM users u
        LEFT JOIN student_xp sx ON sx.student_id = u.id
        WHERE u.role = 'STUDENT' AND u.is_active = true
        ORDER BY total_xp DESC
        LIMIT 20
      `
    } else {
      rows = await prisma.$queryRaw`
        SELECT u.id, u.name, u.matric_no, u.department,
               COALESCE(sx.total_xp, 0) as total_xp,
               COALESCE(sx.streak, 0) as streak
        FROM users u
        LEFT JOIN student_xp sx ON sx.student_id = u.id
        WHERE u.role = 'STUDENT' AND u.is_active = true AND u.department = ${dept}
        ORDER BY total_xp DESC
        LIMIT 20
      `
    }

    res.json({ leaderboard: rows })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/simulation/my-xp — get current student XP
router.get('/my-xp', async (req: Request, res: Response) => {
  try {
    const studentId = getStudentId(req)
    if (!studentId) return res.status(401).json({ error: 'Unauthorized' })

    const rows = await prisma.$queryRaw`
      SELECT total_xp, streak FROM student_xp WHERE student_id = ${studentId}
    ` as any[]

    res.json({ total_xp: rows[0]?.total_xp || 0, streak: rows[0]?.streak || 0 })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
