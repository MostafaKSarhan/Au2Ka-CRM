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
  // طلبات الانضمام تشير إلى العميل الذي أُنشئ منها، فحذف العملاء قبلها
  // يصطدم بالمفتاح الأجنبي ويوقف التنظيف في منتصفه.
  'joinRequest',
  'vehicle', 'customer',
];

for (const model of order) {
  const res = await prisma[model].deleteMany({});
  if (res.count) console.log(`${model}: ${res.count}`);
}

// إعدادات الربط لا تُمسّ.
//
// كانت تُحذف هنا يوم كانت قيمًا تجريبية يكتبها من يجرّب. وقد صارت
// إعدادات تشغيل حقيقية: معرّف رقم واتساب ورمز الـ webhook وربط القوالب،
// والرقم الضريبي وبيانات المنشأة عند هيئة الزكاة. وحذفها هنا يعني أن
// التنظيف الذي يسبق التسليم مباشرةً يهدم الربط الذي استغرق إعداده يومًا
// كاملًا — ولا يكتشف أحد ذلك إلا حين لا تصل أول رسالة.
//
// وهي ليست بيانات اختبار أصلًا: لا يولّدها الاستعمال، بل تُدخَل مرة
// واحدة بيد من يربط. فتبقى، وتُراجَع يوم التسليم لا تُمحى.
await prisma.part.updateMany({ data: { quantity: 0 } });
await prisma.branch.deleteMany({ where: { deletedAt: { not: null } } });

const wa = await prisma.whatsAppSettings.findFirst();
const zatca = await prisma.zatcaSettings.findFirst();

const left = {
  parts: await prisma.part.count(),
  inspectionItems: await prisma.inspectionItem.count(),
  templates: await prisma.messageTemplate.count(),
  linkedTemplates: await prisma.messageTemplate.count({
    where: { metaTemplateName: { not: null } },
  }),
  plans: await prisma.plan.count(),
  branches: await prisma.branch.count(),
  cities: await prisma.city.count(),
  models: await prisma.vehicleModel.count(),
  workingDays: await prisma.workingDay.count(),
  customers: await prisma.customer.count(),
  jobCards: await prisma.jobCard.count(),
  invoices: await prisma.invoice.count(),
  joinRequests: await prisma.joinRequest.count(),
};
console.log('المتبقي:', JSON.stringify(left));
console.log('ربط واتساب محفوظ :', wa ? `رقم ${wa.phoneNumberId || '—'}، مفعّل ${wa.isEnabled}` : 'لا');
console.log('إعدادات الزكاة   :', zatca ? `الرقم الضريبي ${zatca.vatNumber || '—'}` : 'لا');
await prisma.$disconnect();
