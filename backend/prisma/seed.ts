// يحمّل backend/.env صراحةً: سكربتات البذر تعمل خارج الخادم، ولا تمر
// على dotenv.config() الموجود في server.ts، فكانت تفشل على خادم النشر
// بـ "Environment variable not found: DATABASE_URL" بينما تعمل محليًا
// بالمصادفة عبر التحميل الضمني في عميل Prisma.
import 'dotenv/config';

import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean existing data in order
  await prisma.jobCardActivity.deleteMany({});
  await prisma.user.deleteMany({});

  const adminPassword = await bcrypt.hash('admin123', 10);
  const receptionPassword = await bcrypt.hash('reception123', 10);
  const techPassword = await bcrypt.hash('tech123', 10);

  // Create admin
  await prisma.user.create({
    data: {
      mobileNumber: '0500000001',
      passwordHash: adminPassword,
      firstName: 'System',
      lastName: 'Admin',
      role: Role.ADMIN,
      status: 'ACTIVE'
    }
  });

  // Create reception
  await prisma.user.create({
    data: {
      mobileNumber: '0500000002',
      passwordHash: receptionPassword,
      firstName: 'John',
      lastName: 'Receptionist',
      role: Role.RECEPTION,
      status: 'ACTIVE'
    }
  });

  // Create technician
  await prisma.user.create({
    data: {
      mobileNumber: '0500000003',
      passwordHash: techPassword,
      firstName: 'Dave',
      lastName: 'Technician',
      role: Role.TECHNICIAN,
      status: 'ACTIVE'
    }
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
