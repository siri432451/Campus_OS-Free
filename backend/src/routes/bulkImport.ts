import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import multer from 'multer'

const router = Router()
const prisma = new PrismaClient()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, ''))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    if (vals.length < 2) continue
    const row: any = {}
    headers.forEach((h, idx) => { row[h] = vals[idx] || '' })
    rows.push(row)
  }
  return rows
}

// POST /api/admin/bulk-import/preview
router.post('/preview', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const csv = req.file.buffer.toString('utf-8')
    const rows = parseCSV(csv)
    if (!rows.length) return res.status(400).json({ error: 'CSV is empty or invalid' })

    const preview = rows.slice(0, 100).map((r, i) => ({
      row: i + 2,
      name: r.name || r.full_name || '',
      matric_no: r.matric_no || r.matric || '',
      department: r.department || r.dept || '',
      level: r.level || '',
      email: r.email || '',
      phone: r.phone || r.phone_number || '',
      gender: r.gender || '',
      valid: !!(r.name || r.full_name) && !!(r.matric_no || r.matric),
    }))

    const valid = preview.filter(r => r.valid).length
    const invalid = preview.filter(r => !r.valid).length

    res.json({ total: rows.length, preview, valid, invalid })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/admin/bulk-import/confirm
router.post('/confirm', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const csv = req.file.buffer.toString('utf-8')
    const rows = parseCSV(csv)
    if (!rows.length) return res.status(400).json({ error: 'CSV is empty' })

    const defaultPassword = await bcrypt.hash('Student123!', 10)
    let created = 0, skipped = 0, errors: string[] = []

    for (const r of rows) {
      const name = (r.name || r.full_name || '').trim()
      const matric = (r.matric_no || r.matric || '').trim()
      if (!name || !matric) { skipped++; continue }

      try {
        const exists = await prisma.user.findFirst({ where: { matricNo: matric } })
        if (exists) { skipped++; continue }

        const dept = (r.department || r.dept || 'Nursing Science').trim()
        const level = (r.level || 'ND1').trim()
        const email = (r.email || `${matric.toLowerCase().replace(/\//g, '.')}@cosn.edu.ng`).trim()

        await prisma.user.create({
          data: {
            name,
            email,
            password: defaultPassword,
            role: 'STUDENT',
            matricNo: matric,
            department: dept,
            level,
            phone: r.phone || r.phone_number || null,
            gender: r.gender || null,
            emailVerifiedAt: new Date(),

          }
        })
        created++
      } catch (e: any) {
        errors.push(`Row ${matric}: ${e.message?.substring(0, 60)}`)
      }
    }

    res.json({ created, skipped, errors: errors.slice(0, 20), total: rows.length })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
