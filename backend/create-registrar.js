// CampusOS — create/ensure the College Registrar account (REG001)
try { require('dotenv').config(); } catch (e) {}
const { PrismaClient } = require('@prisma/client');
let bcrypt;
try { bcrypt = require('bcryptjs'); } catch (e) { bcrypt = require('bcrypt'); }

const prisma = new PrismaClient();

(async () => {
  const pw = process.env.REGISTRAR_PASSWORD;
  if (!pw || pw.length < 10) {
    console.error('Set REGISTRAR_PASSWORD (min 10 chars) before running this script.');
    process.exit(1);
  }
  const hash = await bcrypt.hash(pw, 10);
  const user = await prisma.user.upsert({
    where: { staffId: 'REG001' },
    update: { role: 'REGISTRAR', isActive: true },
    create: {
      name: 'College Registrar',
      staffId: 'REG001',
      password: hash,
      role: 'REGISTRAR',
      isActive: true,
    },
  });
  const fresh = user.createdAt && (Date.now() - new Date(user.createdAt).getTime() < 10000);
  console.log('Registrar account ready:');
  console.log('  staffId :', user.staffId);
  console.log('  role    :', user.role);
  console.log('  id      :', user.id);
  console.log('  status  :', fresh ? 'newly created' : 'already existed (role+active ensured, password left untouched)');
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('FAILED to create registrar:', (e && e.message) ? e.message : e);
  try { await prisma.$disconnect(); } catch (x) {}
  process.exit(1);
});
