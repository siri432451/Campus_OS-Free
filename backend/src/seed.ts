import { PrismaClient, Role, Level, Grade, AnnouncementTarget, LibraryCategory } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { randomBytes } from 'crypto'

const prisma = new PrismaClient()

// Demo accounts only get the well-known demo passwords if SEED_DEMO_PASSWORDS=true.
// Otherwise they get a random password nobody knows (safe for a public server).
const DEMO = process.env.SEED_DEMO_PASSWORDS === 'true'
const demoPassword = (known: string) => (DEMO ? known : randomBytes(18).toString('hex'))

async function main() {
  console.log('🌱 Seeding CampusOS database...')

  // ── Admin ─────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || (DEMO ? 'Admin123!' : randomBytes(18).toString('hex')), 12)
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'admin@campusos.edu.ng' },
    update: {},
    create: {
      name: process.env.ADMIN_NAME || 'System Administrator',
      email: process.env.ADMIN_EMAIL || 'admin@campusos.edu.ng',
      staffId: 'ADMIN001',
      password: adminPassword,
      role: Role.SUPER_ADMIN,
      department: 'Administration'
    }
  })
  console.log(`✅ Admin: ${admin.email}`)

  // ── Lecturers ─────────────────────────────────────────────
  const lecturerData = [
    { name: 'Dr. Amaka Okonkwo', staffId: 'LEC001', email: 'a.okonkwo@campusos.edu.ng', department: 'Nursing Science' },
    { name: 'Prof. Bola Adeyemi', staffId: 'LEC002', email: 'b.adeyemi@campusos.edu.ng', department: 'Pharmacology' },
    { name: 'Dr. Chidi Nwachukwu', staffId: 'LEC003', email: 'c.nwachukwu@campusos.edu.ng', department: 'Anatomy' },
  ]

  for (const l of lecturerData) {
    const password = await bcrypt.hash(demoPassword('Lecturer123!'), 12)
    await prisma.user.upsert({
      where: { staffId: l.staffId },
      update: {},
      create: { ...l, password, role: Role.LECTURER }
    })
  }
  console.log('✅ Lecturers seeded')

  // ── Students ──────────────────────────────────────────────
  const studentData = [
    { name: 'Adunola Bello', matricNo: 'NSG/2022/001', level: Level.ND2 },
    { name: 'Chineye Obiagwu', matricNo: 'NSG/2021/001', level: Level.ND3 },
    { name: 'Precious Ogunade', matricNo: 'NSG/2023/001', level: Level.ND1 },
    { name: 'Fatima Abdullahi', matricNo: 'NSG/2022/002', level: Level.ND2 },
    { name: 'Emeka Okafor', matricNo: 'NSG/2021/002', level: Level.ND3 },
  ]

  for (const s of studentData) {
    const password = await bcrypt.hash(demoPassword('Student123!'), 12)
    const qrCode = `CAMPUSOS_${uuidv4().replace(/-/g, '').toUpperCase()}`
    const student = await prisma.user.upsert({
      where: { matricNo: s.matricNo },
      update: {},
      create: {
        ...s, password, role: Role.STUDENT,
        department: 'Nursing Science', qrCode
      }
    })

    // Create print credit account
    const accountNo = `0${Math.floor(Math.random() * 9_000_000_000 + 1_000_000_000)}`
    await prisma.printCredit.upsert({
      where: { studentId: student.id },
      update: {},
      create: { studentId: student.id, balance: 500, accountNo, bankName: 'Wema Bank' }
    })
  }
  console.log('✅ Students seeded')

  // ── Books ─────────────────────────────────────────────────
  const books = [
    { title: 'Anatomy & Physiology', author: 'Tortora & Derrickson', level: Level.ND2, category: LibraryCategory.ANATOMY_PHYSIOLOGY },
    { title: 'Pharmacology Essentials', author: 'Rosenthal & Burchum', level: Level.ND3, category: LibraryCategory.PHARMACOLOGY },
    { title: 'Medical-Surgical Nursing', author: 'Lewis et al.', level: Level.ND3, category: LibraryCategory.CLINICAL_SKILLS },
    { title: 'Microbiology for Nurses', author: 'Pelczar & Chan', level: Level.ND2, category: LibraryCategory.MICROBIOLOGY },
    { title: 'Fundamentals of Nursing', author: 'Potter & Perry', level: Level.ND1, category: LibraryCategory.NURSING_ETHICS_PROFESSIONALISM },
    { title: 'Clinical Nursing Skills', author: 'Smith & Duell', level: Level.HND1, category: LibraryCategory.CLINICAL_SKILLS },
  ]

  for (const b of books) {
    const existing = await prisma.book.findFirst({ where: { title: b.title } })
    if (!existing) {
      await prisma.book.create({
        data: {
          ...b,
          department: 'Nursing Science',
          filePath: `/uploads/books/placeholder_${b.title.replace(/\s/g, '_').toLowerCase()}.pdf`,
          fileSize: BigInt(Math.floor(Math.random() * 20_000_000 + 5_000_000)),
          uploadedById: admin.id,
          isFeatured: b.level === Level.ND2
        }
      })
    }
  }
  console.log('✅ Books seeded')

  // ── Flashcard Decks ───────────────────────────────────────
  const decks = [
    { title: 'Computer Applications & Nursing Informatics', icon: '💻', category: 'Technology' },
    { title: 'Pharmacology & Drug Administration', icon: '💊', category: LibraryCategory.PHARMACOLOGY },
    { title: 'Anatomy & Physiology', icon: '🫀', category: LibraryCategory.ANATOMY_PHYSIOLOGY },
    { title: 'Medical-Surgical Nursing', icon: '🩺', category: LibraryCategory.CLINICAL_SKILLS },
    { title: 'Community Health Nursing', icon: '🏘️', category: 'Community' },
    { title: 'Nursing Ethics & Professionalism', icon: '⚖️', category: 'Ethics' },
    { title: 'Infection Control (HAIs)', icon: '🦠', category: 'Infection Control' },
    { title: 'Mental Health Nursing', icon: '🧠', category: 'Mental Health' },
  ]

  for (const d of decks) {
    const deck = await prisma.flashcardDeck.upsert({
      where: { id: d.title.substring(0, 8) },
      update: {},
      create: { ...d }
    }).catch(async () => {
      return await prisma.flashcardDeck.create({ data: { ...d } })
    })

    // Add sample cards for first deck
    if (d.title.includes('Informatics')) {
      const cards = [
        { front: 'Nursing Informatics', back: 'A specialty that integrates nursing science with information management and analytical sciences to manage and communicate data, information, and knowledge in nursing practice.', order: 1 },
        { front: 'Electronic Health Record (EHR)', back: 'A digital version of a patient\'s paper chart. EHRs are real-time, patient-centred records that make information available instantly and securely to authorised users.', order: 2 },
        { front: 'Telehealth', back: 'The use of electronic information and telecommunications technologies to support long-distance clinical healthcare, patient and professional health-related education, and public health.', order: 3 },
        { front: 'Clinical Decision Support System (CDSS)', back: 'A health information technology system that is designed to assist physicians and other health professionals with clinical decision-making tasks, such as determining a diagnosis or recommending a treatment.', order: 4 },
      ]
      for (const c of cards) {
        const exists = await prisma.flashcard.findFirst({ where: { deckId: deck.id, front: c.front } })
        if (!exists) await prisma.flashcard.create({ data: { ...c, deckId: deck.id } })
      }
    }
  }
  console.log('✅ Flashcard decks seeded')

  // ── Simulation Cases ──────────────────────────────────────
  const cases = [
    {
      title: 'Pediatric Malaria Emergency',
      specialty: 'Pediatrics',
      difficulty: 'hard',
      patientName: 'Lema Boruu',
      patientAge: 4,
      scenario: 'A 4-year-old male presents with 5 days of fever. Father reports yellow skin for 2 days. BP 85/55, HR 142, RR 44, Temp 39.4°C, SpO2 93%, Pain 6/10. Hepatosplenomegaly on exam. Working diagnosis: severe P. falciparum malaria. Critical stock-out of IV fluids.',
      vitals: { bp: '85/55', hr: 142, rr: 44, temp: 39.4, spo2: 93, pain: 6 },
      expectedActions: ['IV access', 'artesunate IV', 'fluid resuscitation', 'blood glucose check', 'blood culture', 'malaria RDT'],
      xpReward: 500
    },
    {
      title: 'Post-Operative Care',
      specialty: 'Surgical',
      difficulty: 'medium',
      patientName: 'Mrs. Ngozi Eze',
      patientAge: 45,
      scenario: 'Patient 6 hours post appendectomy. Reports pain 7/10. BP 130/85, HR 88, Temp 37.8°C. Wound site shows mild redness. Patient anxious about going home.',
      vitals: { bp: '130/85', hr: 88, rr: 18, temp: 37.8, spo2: 98, pain: 7 },
      expectedActions: ['pain assessment', 'wound inspection', 'analgesia administration', 'patient education', 'ambulation'],
      xpReward: 300
    }
  ]

  for (const c of cases) {
    const exists = await prisma.simulationCase.findFirst({ where: { title: c.title } })
    if (!exists) await prisma.simulationCase.create({ data: c })
  }
  console.log('✅ Simulation cases seeded')

  // ── Announcements ─────────────────────────────────────────
  const announcements = [
    { title: 'Welcome to CampusOS!', body: 'Your new digital campus portal is live. Access results, books, attendance, and more — all from your phone.', target: 'ALL', isPinned: true },
    { title: 'Exam Timetable Released', body: '2nd Semester examinations begin May 12. Check your personalised timetable under Results.', target: 'STUDENTS', isPinned: false },
    { title: 'ICT Lab Extended Hours', body: 'The computer lab will be open 7am–11pm daily during the exam period.', target: 'ALL', isPinned: false },
    { title: 'New Library Resources', body: 'Medical-Surgical Nursing 10th Edition and 5 other titles have been added to the E-Library.', target: 'STUDENTS', isPinned: false },
  ]

  for (const a of announcements) {
    const exists = await prisma.announcement.findFirst({ where: { title: a.title } })
    if (!exists) {
      await prisma.announcement.create({
        data: { ...a, target: a.target as AnnouncementTarget, createdById: admin.id }
      })
    }
  }
  console.log('✅ Announcements seeded')

  console.log('\n🎉 Seeding complete!')
  console.log('\n📋 Default credentials:')
  if (DEMO) {
    console.log('   Super Admin  staffId: ADMIN001 / password: Admin123!')
    console.log('   Lecturer     staffId: LEC001 / password: Lecturer123!')
    console.log('   Student      matricNo: NSG/2022/001 / password: Student123!')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
