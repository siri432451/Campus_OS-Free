import fs from 'fs'
import path from 'path'
import PDFDocument from 'pdfkit'
import type { Response } from 'express'
import { TranscriptData, TranscriptRow, YEAR_WORDS, SEM_WORDS, monthLabel, ordinalDate, dobLabel } from './transcriptData'

type Doc = InstanceType<typeof PDFDocument>

// ── Layout constants (A4) ─────────────────────────────────────
const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 40
const CW = PAGE_W - MARGIN * 2
const TOP = 50
const BOTTOM = PAGE_H - 60

// S/N, code, title, lecture, practical, total, credit, score, remark  (sums to CW)
const COLS = [24, 54, 160, 42, 52, 34, 36, 42, CW - 444]
const HEAD = ['S/N', 'COURSE CODE', 'COURSE TITLE', 'LECTURE (NO OF HOURS)', 'PRACTICAL (NO OF HOURS)',
  'TOTAL', 'CREDIT UNIT', 'EXAM SCORE', 'REMARK']

// ── Institution details (override with environment variables) ─
const INSTITUTION = process.env.TRANSCRIPT_INSTITUTION || 'OSUN STATE COLLEGE OF NURSING SCIENCES'
const ADDRESS = (process.env.TRANSCRIPT_ADDRESS || 'P.M.B 4405|OSOGBO, OSUN STATE, NIGERIA').split('|')
const CONTACT = process.env.TRANSCRIPT_CONTACT || ''

const NOTES = [
  'All courses are taught in English Language.',
  'A research study is presented by each student within the three months of lectures on Research Methodology.',
  'Maternal/Infant (Excluding Gynaecology) Theory and Practicals Covering Nursing Care Of Children, and Psychiatric Nursing/Mental Health (Excluding Neurology).',
  'Post Basic Midwifery students are exempted from Obstetric nursing while Post Basic Psychiatric students are exempted from Psychiatric Nursing experience.',
]

const GRADING: Array<[string, string, string]> = [
  ['A', '80% and above', 'Distinction'],
  ['B', '70% - 79%', 'Credit'],
  ['C', '50% - 69%', 'Pass'],
  ['F', '49% and below', 'Fail'],
]

function watermark(doc: Doc, text: string): void {
  doc.save()
  doc.rotate(-40, { origin: [PAGE_W / 2, PAGE_H / 2] })
  doc.fillColor('#000000').fillOpacity(0.07).font('Helvetica-Bold').fontSize(90)
  const w = doc.widthOfString(text)
  doc.text(text, (PAGE_W - w) / 2, PAGE_H / 2 - 45, { lineBreak: false })
  doc.restore()
}

const scoreText = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1))

// ── Table helpers ─────────────────────────────────────────────
function headerRow(doc: Doc, y: number): number {
  const h = 38
  let x = MARGIN
  doc.lineWidth(0.7).strokeColor('#000000').fillColor('#000000').font('Times-Bold').fontSize(7)
  COLS.forEach((w, i) => {
    doc.rect(x, y, w, h).stroke()
    doc.text(HEAD[i], x + 2, y + 6, { width: w - 4, align: 'center' })
    x += w
  })
  return y + h
}

function fitFont(doc: Doc, font: string, text: string, maxWidth: number, start: number): number {
  let size = start
  doc.font(font)
  while (size > 6) {
    doc.fontSize(size)
    if (doc.widthOfString(text) <= maxWidth) break
    size -= 0.5
  }
  return size
}

function dataRow(doc: Doc, y: number, r: TranscriptRow): number {
  doc.font('Times-Roman').fontSize(9)
  const titleH = doc.heightOfString(r.title, { width: COLS[2] - 8 })
  const h = Math.max(22, titleH + 12)
  const vals = [
    String(r.sn), r.code, r.title,
    r.lecture ? String(r.lecture) : '-', r.practical ? String(r.practical) : '-',
    String(r.total), String(r.credit), scoreText(r.score), r.remark,
  ]
  let x = MARGIN
  doc.lineWidth(0.7).strokeColor('#000000').fillColor('#000000')
  COLS.forEach((w, i) => {
    doc.rect(x, y, w, h).stroke()
    if (i === 8) {
      const size = fitFont(doc, 'Times-Bold', vals[i], w - 8, 8.5)
      doc.font('Times-Bold').fontSize(size)
      doc.text(vals[i], x + 4, y + 6 + (9 - size) / 2, { width: w - 8, align: 'center', lineBreak: false })
    } else {
      doc.font('Times-Roman').fontSize(9)
      doc.text(vals[i], x + 4, y + 6, { width: w - 8, align: i === 2 ? 'left' : 'center' })
    }
    x += w
  })
  return y + h
}

function totalRow(doc: Doc, y: number, lecture: number, practical: number): number {
  const h = 22
  const vals = ['', '', 'TOTAL', String(lecture), String(practical), String(lecture + practical), '', '', '']
  let x = MARGIN
  doc.lineWidth(0.7).strokeColor('#000000').fillColor('#000000').font('Times-Bold').fontSize(9.5)
  COLS.forEach((w, i) => {
    doc.rect(x, y, w, h).stroke()
    if (vals[i]) doc.text(vals[i], x + 4, y + 6, { width: w - 8, align: i === 2 ? 'left' : 'center' })
    x += w
  })
  return y + h
}

// ── Pages ─────────────────────────────────────────────────────
function titlePage(doc: Doc, data: TranscriptData, addressee: string[], issuedAt: Date, transcriptNo?: string): void {
  let y = 46
  const nameSize = fitFont(doc, 'Times-Bold', INSTITUTION, CW, 24)
  doc.fillColor('#000000').font('Times-Bold').fontSize(nameSize)
  doc.text(INSTITUTION, MARGIN, y, { width: CW, align: 'center' })
  y = doc.y + 4
  doc.font('Times-Roman').fontSize(12.5)
  for (const line of ADDRESS) {
    doc.text(line.trim(), MARGIN, y, { width: CW, align: 'center' })
    y = doc.y + 1
  }
  if (CONTACT) {
    doc.font('Times-Bold').fontSize(10)
    doc.text(CONTACT, MARGIN, y + 2, { width: CW, align: 'center' })
    y = doc.y
  }
  y += 8
  doc.lineWidth(0.8).strokeColor('#000000').moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).stroke()

  // Reference number and date
  y += 22
  const p = data.profile
  doc.font('Times-Bold').fontSize(10.5)
  doc.text(`OUR REF. NO: ${p?.refNo || transcriptNo || ''}`, MARGIN, y, { width: CW / 2, align: 'left' })
  doc.text(`DATE: ${ordinalDate(issuedAt)}`, MARGIN, y, { width: CW, align: 'right' })

  // Addressee (or dotted lines to be filled in by hand)
  y += 34
  if (addressee.length) {
    doc.font('Times-Roman').fontSize(11)
    for (const line of addressee.slice(0, 4)) {
      doc.text(line, MARGIN, y, { width: CW / 2 })
      y += 18
    }
  } else {
    doc.lineWidth(0.8).strokeColor('#000000').dash(1, { space: 2.5 })
    for (let i = 0; i < 4; i++) {
      doc.moveTo(MARGIN, y + 12).lineTo(MARGIN + 190, y + 12).stroke()
      y += 20
    }
    doc.undash()
  }

  // Title
  y += 34
  doc.font('Times-Bold').fontSize(14)
  doc.text('TRANSCRIPT \u2013 BASIC STUDENT', MARGIN, y, { width: CW, align: 'center', underline: true })
  y = doc.y + 22

  // Certification paragraph
  const s = data.student
  const g = (s.gender || '').trim().toLowerCase()
  const known = g.startsWith('f') || g.startsWith('m')
  const who = g.startsWith('f') ? 'she' : g.startsWith('m') ? 'he' : 'the student'
  const whose = g.startsWith('f') ? 'her' : g.startsWith('m') ? 'his' : 'the student\u2019s'
  const programme = p?.programmeTitle || 'Diploma Education in General Nursing'
  const entry = monthLabel(p?.entryMonth)
  const done = monthLabel(p?.completionMonth)

  const pieces: Array<{ t: string; bold?: boolean }> = [
    { t: 'This is to certify that ' },
    { t: `${s.name.toUpperCase()} `, bold: true },
  ]
  if (entry && done) {
    pieces.push({ t: `entered this College for the programme of ${programme} in ` })
    pieces.push({ t: `${entry} `, bold: true })
    pieces.push({ t: 'and completed the course in ' })
    pieces.push({ t: `${done}. `, bold: true })
  } else if (entry) {
    pieces.push({ t: `entered this College for the programme of ${programme} in ` })
    pieces.push({ t: `${entry}. `, bold: true })
  } else {
    pieces.push({ t: `is a student of this College in the programme of ${programme}. ` })
  }
  if (done && p?.certificate) {
    pieces.push({ t: `On completion, ${who} was awarded the ${p.certificate}. ` })
  }
  const conduct = (p?.conduct || 'satisfactory').toLowerCase()
  pieces.push({ t: `During ${known ? whose : 'the'} training, ${whose} conduct was ${conduct}. ` })
  pieces.push({ t: 'All courses were taught in ENGLISH LANGUAGE.', bold: true })

  doc.fontSize(12)
  pieces.forEach((piece, i) => {
    doc.font(piece.bold ? 'Times-Bold' : 'Times-Roman')
    const opts = { continued: i < pieces.length - 1, align: 'justify' as const, width: CW, lineGap: 9 }
    if (i === 0) doc.text(piece.t, MARGIN, y, opts)
    else doc.text(piece.t, opts)
  })

  if (s.dateOfBirth) {
    doc.font('Times-Bold').fontSize(11.5)
    doc.text(`DATE OF BIRTH: ${dobLabel(s.dateOfBirth)}`, MARGIN, doc.y + 18, { width: CW })
  }
}

function semesterPages(doc: Doc, data: TranscriptData): void {
  const all = data.semesters
  let sumL = 0
  let sumP = 0
  for (const sem of all) for (const r of sem.rows) { sumL += r.lecture; sumP += r.practical }

  const years = Array.from(new Set(all.map(s => s.year))).sort((a, b) => a - b)
  years.forEach(year => {
    doc.addPage()
    let y = TOP
    for (const sem of all.filter(s => s.year === year)) {
      const title = `${YEAR_WORDS[year] || year} YEAR, ${SEM_WORDS[sem.semester]} SEMESTER`
      // keep a heading with at least its header row and first data row
      if (y > TOP && y + 26 + 38 + 40 > BOTTOM) { doc.addPage(); y = TOP }
      doc.fillColor('#000000').font('Times-Bold').fontSize(15)
      doc.text(title, MARGIN, y, { width: CW, align: 'center' })
      y += 28
      y = headerRow(doc, y)
      for (const r of sem.rows) {
        doc.font('Times-Roman').fontSize(9)
        const need = Math.max(22, doc.heightOfString(r.title, { width: COLS[2] - 8 }) + 12)
        if (y + need > BOTTOM) {
          doc.addPage()
          y = TOP
          doc.fillColor('#000000').font('Times-Bold').fontSize(12)
          doc.text(`${title} (CONTINUED)`, MARGIN, y, { width: CW, align: 'center' })
          y += 24
          y = headerRow(doc, y)
        }
        y = dataRow(doc, y, r)
      }
      const isLast = sem === all[all.length - 1]
      if (isLast) {
        if (y + 22 > BOTTOM) { doc.addPage(); y = TOP }
        y = totalRow(doc, y, sumL, sumP)
      }
      y += 30
    }
  })
}

const ASSETS = path.join(__dirname, '../../assets')

function notesPage(doc: Doc, data: TranscriptData, official?: OfficialOptions): void {
  doc.addPage()
  const p = data.profile
  let y = 60
  const hasExam = !!(p?.examYear || p?.examResult)

  doc.fillColor('#000000').font('Times-Bold').fontSize(14)
  doc.text(hasExam ? 'NURSING COUNCIL FINAL QUALIFYING EXAMINATION' : 'NOTES AND GRADING SCALE',
    MARGIN, y, { width: CW, align: 'center', underline: true })
  y = doc.y + 30

  if (hasExam) {
    doc.font('Times-Bold').fontSize(11.5)
    doc.text(`YEAR: ${(p?.examYear || '').toUpperCase()}`, MARGIN + 10, y, { width: 200 })
    doc.font('Times-Roman').fontSize(11.5)
    doc.text(`GRADE: ${p?.examResult || ''}`, MARGIN + 215, y, { width: CW - 225 })
    y = Math.max(doc.y, y + 16) + 36
    doc.font('Times-Bold').fontSize(11.5)
    doc.text('RESIT:-', MARGIN + 10, y, { width: 200 })
    y = doc.y + 30
  }

  doc.font('Times-Bold').fontSize(11.5).text('NOTE:', MARGIN + 10, y, { width: 60 })
  NOTES.forEach((note, i) => {
    doc.font('Times-Roman').fontSize(10.5)
    doc.text(`${i + 1}.`, MARGIN + 70, y, { width: 20 })
    doc.text(note, MARGIN + 95, y, { width: CW - 110 })
    y = doc.y + 10
  })

  y += 14
  doc.font('Times-Bold').fontSize(11.5).text('GRADING:', MARGIN + 10, y, { width: 100 })
  y = doc.y + 14
  doc.font('Times-Roman').fontSize(11.5)
  for (const [letter, range, label] of GRADING) {
    doc.text(letter, MARGIN + 50, y, { width: 30 })
    doc.text('=', MARGIN + 95, y, { width: 20 })
    doc.text(range, MARGIN + 130, y, { width: 150 })
    doc.text('-', MARGIN + 290, y, { width: 20 })
    doc.text(label, MARGIN + 320, y, { width: 150 })
    y += 26
  }

  // Signature block
  const sy = Math.max(y + 90, PAGE_H - 190)
  const sigX = PAGE_W - MARGIN - 190
  if (official) {
    const sig = path.join(ASSETS, 'registrar-signature.png')
    const stamp = path.join(ASSETS, 'registrar-stamp.png')
    if (fs.existsSync(sig)) doc.image(sig, sigX + 25, sy - 52, { fit: [140, 48] })
    if (fs.existsSync(stamp)) doc.image(stamp, sigX - 95, sy - 82, { fit: [90, 90] })
  }
  doc.lineWidth(0.8).strokeColor('#000000').moveTo(sigX, sy).lineTo(PAGE_W - MARGIN, sy).stroke()
  doc.fillColor('#000000').font('Times-Bold').fontSize(11)
  doc.text('REGISTRAR', sigX, sy + 5, { width: 190, align: 'center' })
  doc.font('Times-Roman').fontSize(10)
  doc.text(official ? `Date: ${ordinalDate(official.issuedAt)}` : 'Date: ............................',
    sigX, sy + 22, { width: 190, align: 'center' })

  if (official) {
    // QR code + verification details
    doc.image(official.qrPng, MARGIN, sy - 40, { width: 82 })
    doc.font('Times-Bold').fontSize(9.5)
    doc.text(`Transcript No: ${official.transcriptNo}`, MARGIN + 92, sy - 34, { width: 230 })
    doc.font('Times-Roman').fontSize(8.5)
    doc.text('Scan the code, or visit the address below, to confirm that this transcript is genuine:',
      MARGIN + 92, doc.y + 3, { width: 230 })
    doc.font('Times-Italic').fontSize(8.5)
    doc.text(official.verifyUrl, MARGIN + 92, doc.y + 3, { width: 230 })
  } else {
    doc.font('Times-Italic').fontSize(9)
    doc.text('Valid only when signed and stamped by the Registrar.', MARGIN, sy + 5, { width: 250 })
  }
}

// ── Public API ────────────────────────────────────────────────
export interface OfficialOptions {
  transcriptNo: string
  verifyUrl: string
  qrPng: Buffer
  issuedAt: Date
}

export interface PdfOptions {
  preview?: boolean
  addressee?: string[]
  official?: OfficialOptions
}

export function streamTranscriptPdf(res: Response, data: TranscriptData, opts: PdfOptions = {}): void {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 20, left: 40, right: 40 },
    info: { Title: `Transcript - ${data.student.name}`, Author: INSTITUTION },
  })
  const safeName = (data.student.matricNo || data.student.name).replace(/[^A-Za-z0-9]+/g, '-')
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="transcript-${safeName}.pdf"`)
  doc.pipe(res)

  if (opts.preview && !opts.official) {
    watermark(doc, 'PREVIEW')
    doc.on('pageAdded', () => watermark(doc, 'PREVIEW'))
  }

  const issuedAt = opts.official?.issuedAt ?? new Date()
  titlePage(doc, data, opts.addressee || [], issuedAt, opts.official?.transcriptNo)
  semesterPages(doc, data)
  notesPage(doc, data, opts.official)
  doc.end()
}
