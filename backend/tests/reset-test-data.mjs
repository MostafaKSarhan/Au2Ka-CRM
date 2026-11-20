// يمسح بيانات الاختبار ويترك البيانات المرجعية كما هي
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const order = [
  'inspectionResult', 'inspection', 'monthlyReport',
  'pointsEntry', 'referral',
  'stockMovement', 'invoice',
  'subscriptionUsage', 'subscription',
  'vehiclePartReplacement', 'vehicleDocument', 'vehicleMileageLog',
  'appointment',
  'jobCardActivity', 'jobCardPhotos', 'jobCard',
  'outboundMessage', 'notification',
  'customerSession', 'customerOtp',
  'vehicle', 'customer',
];

for (const model of order) {
  const res = await prisma[model].deleteMany({});
  if (res.count) console.log(`${model}: ${res.count}`);
}

// الإعدادات الحساسة والمعدّلة أثناء الاختبار ترجع لحالتها الأولى
await prisma.zatcaSettings.deleteMany({});
await prisma.whatsAppSettings.deleteMany({});
await prisma.referralSettings.deleteMany({});
await prisma.part.updateMany({ data: { quantity: 0 } });
await prisma.branch.deleteMany({ where: { deletedAt: { not: null } } });

const left = {
  parts: await prisma.part.count(),
  inspectionItems: await prisma.inspectionItem.count(),
  templates: await prisma.messageTemplate.count(),
  plans: await prisma.plan.count(),
  branches: await prisma.branch.count(),
  cities: await prisma.city.count(),
  models: await prisma.vehicleModel.count(),
  workingDays: await prisma.workingDay.count(),
  customers: await prisma.customer.count(),
  jobCards: await prisma.jobCard.count(),
  invoices: await prisma.invoice.count(),
};
console.log('المتبقي:', JSON.stringify(left));
await prisma.$disconnect();
