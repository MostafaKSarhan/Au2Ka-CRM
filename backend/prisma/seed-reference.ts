/**
 * Phase 2 — R0 reference data.
 *
 * Safe to run more than once: everything here is matched on a natural key and
 * created only when missing, so it never touches existing operational data.
 * Run with: npm run prisma:seed:ref
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SAUDI_CITIES: Array<[string, string]> = [
  ['الرياض', 'Riyadh'],
  ['جدة', 'Jeddah'],
  ['مكة المكرمة', 'Makkah'],
  ['المدينة المنورة', 'Madinah'],
  ['الدمام', 'Dammam'],
  ['الخبر', 'Khobar'],
  ['الظهران', 'Dhahran'],
  ['الطائف', 'Taif'],
  ['تبوك', 'Tabuk'],
  ['بريدة', 'Buraydah'],
  ['خميس مشيط', 'Khamis Mushait'],
  ['أبها', 'Abha'],
  ['حائل', 'Hail'],
  ['نجران', 'Najran'],
  ['جازان', 'Jazan'],
  ['ينبع', 'Yanbu'],
  ['الجبيل', 'Jubail'],
  ['القطيف', 'Qatif'],
  ['الأحساء', 'Al-Ahsa'],
  ['عرعر', 'Arar'],
  ['سكاكا', 'Sakaka'],
];

/** Brand name in Arabic/English, then its common models. */
const BRANDS: Array<{ ar: string; en: string; models: Array<[string, string]> }> = [
  {
    ar: 'تويوتا',
    en: 'Toyota',
    models: [
      ['كامري', 'Camry'],
      ['كورولا', 'Corolla'],
      ['لاند كروزر', 'Land Cruiser'],
      ['هايلكس', 'Hilux'],
      ['برادو', 'Prado'],
      ['يارس', 'Yaris'],
      ['أفالون', 'Avalon'],
      ['راف فور', 'RAV4'],
    ],
  },
  {
    ar: 'هيونداي',
    en: 'Hyundai',
    models: [
      ['النترا', 'Elantra'],
      ['سوناتا', 'Sonata'],
      ['أكسنت', 'Accent'],
      ['توسان', 'Tucson'],
      ['سنتافي', 'Santa Fe'],
      ['كريتا', 'Creta'],
    ],
  },
  {
    ar: 'كيا',
    en: 'Kia',
    models: [
      ['سيراتو', 'Cerato'],
      ['أوبتيما', 'Optima'],
      ['سبورتاج', 'Sportage'],
      ['سورينتو', 'Sorento'],
      ['ريو', 'Rio'],
      ['كارنفال', 'Carnival'],
    ],
  },
  {
    ar: 'نيسان',
    en: 'Nissan',
    models: [
      ['صني', 'Sunny'],
      ['ألتيما', 'Altima'],
      ['باترول', 'Patrol'],
      ['اكس تريل', 'X-Trail'],
      ['ماكسيما', 'Maxima'],
    ],
  },
  {
    ar: 'فورد',
    en: 'Ford',
    models: [
      ['تورس', 'Taurus'],
      ['اكسبلورر', 'Explorer'],
      ['ايدج', 'Edge'],
      ['إف 150', 'F-150'],
      ['ايكو سبورت', 'EcoSport'],
    ],
  },
  {
    ar: 'لكزس',
    en: 'Lexus',
    models: [
      ['إي إس', 'ES'],
      ['إل إكس', 'LX'],
      ['جي إكس', 'GX'],
      ['آر إكس', 'RX'],
      ['إن إكس', 'NX'],
    ],
  },
  {
    ar: 'مرسيدس',
    en: 'Mercedes-Benz',
    models: [
      ['سي كلاس', 'C-Class'],
      ['إي كلاس', 'E-Class'],
      ['إس كلاس', 'S-Class'],
      ['جي إل إي', 'GLE'],
      ['جي كلاس', 'G-Class'],
    ],
  },
  {
    ar: 'بي إم دبليو',
    en: 'BMW',
    models: [
      ['الفئة الثالثة', '3 Series'],
      ['الفئة الخامسة', '5 Series'],
      ['الفئة السابعة', '7 Series'],
      ['إكس 5', 'X5'],
      ['إكس 6', 'X6'],
    ],
  },
  {
    ar: 'أودي',
    en: 'Audi',
    models: [
      ['إيه 4', 'A4'],
      ['إيه 6', 'A6'],
      ['كيو 5', 'Q5'],
      ['كيو 7', 'Q7'],
    ],
  },
  {
    ar: 'هوندا',
    en: 'Honda',
    models: [
      ['أكورد', 'Accord'],
      ['سيفيك', 'Civic'],
      ['سي آر في', 'CR-V'],
      ['بايلوت', 'Pilot'],
    ],
  },
  {
    ar: 'شيفروليه',
    en: 'Chevrolet',
    models: [
      ['ماليبو', 'Malibu'],
      ['تاهو', 'Tahoe'],
      ['سوبربان', 'Suburban'],
      ['كابتيفا', 'Captiva'],
      ['سلفرادو', 'Silverado'],
    ],
  },
  {
    ar: 'جي إم سي',
    en: 'GMC',
    models: [
      ['يوكن', 'Yukon'],
      ['سييرا', 'Sierra'],
      ['اكاديا', 'Acadia'],
      ['تيرين', 'Terrain'],
    ],
  },
  {
    ar: 'مازدا',
    en: 'Mazda',
    models: [
      ['مازدا 3', 'Mazda 3'],
      ['مازدا 6', 'Mazda 6'],
      ['سي اكس 5', 'CX-5'],
      ['سي اكس 9', 'CX-9'],
    ],
  },
];

const PART_CATEGORIES: Array<{
  partNumber: string;
  nameAr: string;
  nameEn: string;
  category: string;
  sellPrice: number;
  purchasePrice: number;
}> = [
  { partNumber: 'OIL-5W30-4L', nameAr: 'زيت محرك 5W-30 أربعة لتر', nameEn: 'Engine Oil 5W-30 4L', category: 'زيوت وسوائل', purchasePrice: 85, sellPrice: 120 },
  { partNumber: 'FLT-OIL-STD', nameAr: 'فلتر زيت', nameEn: 'Oil Filter', category: 'فلاتر', purchasePrice: 18, sellPrice: 35 },
  { partNumber: 'FLT-AIR-STD', nameAr: 'فلتر هواء', nameEn: 'Air Filter', category: 'فلاتر', purchasePrice: 25, sellPrice: 50 },
  { partNumber: 'FLT-AC-STD', nameAr: 'فلتر مكيف', nameEn: 'Cabin Filter', category: 'فلاتر', purchasePrice: 22, sellPrice: 45 },
  { partNumber: 'BRK-PAD-FRT', nameAr: 'طقم فحمات أمامي', nameEn: 'Front Brake Pads', category: 'فرامل', purchasePrice: 120, sellPrice: 220 },
  { partNumber: 'BRK-PAD-RER', nameAr: 'طقم فحمات خلفي', nameEn: 'Rear Brake Pads', category: 'فرامل', purchasePrice: 110, sellPrice: 200 },
  { partNumber: 'BAT-70AH', nameAr: 'بطارية 70 أمبير', nameEn: 'Battery 70Ah', category: 'كهرباء', purchasePrice: 230, sellPrice: 350 },
  { partNumber: 'SPK-PLG-SET', nameAr: 'طقم بوجيهات', nameEn: 'Spark Plug Set', category: 'كهرباء', purchasePrice: 90, sellPrice: 160 },
  { partNumber: 'COOL-GRN-4L', nameAr: 'ماء رديتر أربعة لتر', nameEn: 'Coolant 4L', category: 'زيوت وسوائل', purchasePrice: 30, sellPrice: 60 },
  { partNumber: 'WPR-BLD-PAIR', nameAr: 'مساحات زجاج (طقم)', nameEn: 'Wiper Blades (Pair)', category: 'إكسسوارات', purchasePrice: 35, sellPrice: 70 },
];

/** Starter annual plans for M1 — the workshop edits prices and perks later. */
const PLANS = [
  {
    nameAr: 'الباقة الفضية',
    nameEn: 'Silver Plan',
    descriptionAr: 'صيانة دورية أساسية لسيارة واحدة طوال السنة',
    descriptionEn: 'Basic annual maintenance cover for one vehicle',
    price: 1500,
    durationMonths: 12,
    freeVisits: 2,
    discountPercent: 5,
    benefitsAr: 'زيارتان مجانيتان\nخصم 5% على باقي الفواتير\nتقرير فني شهري',
    benefitsEn: 'Two free visits\n5% off other invoices\nMonthly technical report',
  },
  {
    nameAr: 'الباقة الذهبية',
    nameEn: 'Gold Plan',
    descriptionAr: 'الأكثر طلبًا — تغطية أوسع وأولوية في المواعيد',
    descriptionEn: 'Most popular — wider cover and booking priority',
    price: 2800,
    durationMonths: 12,
    freeVisits: 4,
    discountPercent: 10,
    benefitsAr: 'أربع زيارات مجانية\nخصم 10% على باقي الفواتير\nأولوية في حجز المواعيد\nتقرير فني شهري',
    benefitsEn: 'Four free visits\n10% off other invoices\nPriority booking\nMonthly technical report',
  },
  {
    nameAr: 'الباقة البلاتينية',
    nameEn: 'Platinum Plan',
    descriptionAr: 'تغطية كاملة وخدمة مميزة طوال السنة',
    descriptionEn: 'Full cover and premium service all year',
    price: 4500,
    durationMonths: 12,
    freeVisits: 6,
    discountPercent: 15,
    benefitsAr: 'ست زيارات مجانية\nخصم 15% على باقي الفواتير\nأولوية قصوى في المواعيد\nتقرير فني شهري\nملف كامل للسيارة',
    benefitsEn: 'Six free visits\n15% off other invoices\nTop booking priority\nMonthly technical report\nFull vehicle file',
  },
];

/** M6 — the wording the system sends by itself. The workshop edits the text. */
const TEMPLATES = [
  {
    code: 'JOB_WAITING_APPROVAL',
    nameAr: 'بانتظار موافقة العميل',
    nameEn: 'Waiting for customer approval',
    channel: 'WHATSAPP' as const,
    bodyAr:
      'مرحباً {{customerName}}،\nسيارتكم {{vehicle}} ({{plateNumber}}) انتهى فحصها الفني في ورشة Au2Ka.\nرقم الكرت: {{jobNumber}}\nالتكلفة التقديرية: {{cost}} ريال\nنرجو تأكيد الموافقة على البدء في الإصلاح.',
    bodyEn:
      'Hello {{customerName}},\nThe inspection of your {{vehicle}} ({{plateNumber}}) is complete at Au2Ka.\nJob card: {{jobNumber}}\nEstimated cost: {{cost}} SAR\nPlease confirm so we can start the repair.',
    variables: '["customerName","vehicle","plateNumber","jobNumber","cost","status"]',
  },
  {
    code: 'JOB_COMPLETED',
    nameAr: 'اكتمل الإصلاح',
    nameEn: 'Repair completed',
    channel: 'WHATSAPP' as const,
    bodyAr:
      'مرحباً {{customerName}}،\nيسرّنا إبلاغكم بانتهاء العمل على سيارتكم {{vehicle}} ({{plateNumber}}).\nرقم الكرت: {{jobNumber}}\nالسيارة جاهزة للاستلام في أي وقت خلال ساعات العمل.',
    bodyEn:
      'Hello {{customerName}},\nWork on your {{vehicle}} ({{plateNumber}}) is now complete.\nJob card: {{jobNumber}}\nThe vehicle is ready for collection during working hours.',
    variables: '["customerName","vehicle","plateNumber","jobNumber","cost","status"]',
  },
  {
    code: 'JOB_DELIVERED',
    nameAr: 'تم تسليم السيارة',
    nameEn: 'Vehicle delivered',
    channel: 'WHATSAPP' as const,
    bodyAr:
      'شكراً لثقتكم بنا {{customerName}}.\nتم تسليم سيارتكم {{vehicle}} ({{plateNumber}}) بموجب الكرت {{jobNumber}}.\nنتمنى لكم قيادة آمنة، ونسعد بخدمتكم دائماً.',
    bodyEn:
      'Thank you for your trust, {{customerName}}.\nYour {{vehicle}} ({{plateNumber}}) has been delivered under job card {{jobNumber}}.\nDrive safely — we are always glad to serve you.',
    variables: '["customerName","vehicle","plateNumber","jobNumber","status"]',
  },
  {
    code: 'SUBSCRIPTION_EXPIRING',
    nameAr: 'قرب انتهاء الاشتراك',
    nameEn: 'Subscription expiring',
    channel: 'WHATSAPP' as const,
    bodyAr:
      'مرحباً {{customerName}}،\nاشتراككم في {{planName}} ينتهي بتاريخ {{endDate}}.\nيسعدنا تجديده لكم للاستمرار في الاستفادة من الزيارات المجانية وخصومات الصيانة.',
    bodyEn:
      'Hello {{customerName}},\nYour {{planName}} subscription ends on {{endDate}}.\nWe would be glad to renew it so you keep your free visits and service discounts.',
    variables: '["customerName","planName","endDate","subscriptionNumber"]',
  },
  {
    code: 'DOCUMENT_EXPIRING',
    nameAr: 'قرب انتهاء مستند السيارة',
    nameEn: 'Vehicle document expiring',
    channel: 'WHATSAPP' as const,
    bodyAr:
      'تنبيه ودّي {{customerName}}،\n{{documentTitle}} الخاص بسيارتكم ({{plateNumber}}) ينتهي بتاريخ {{expiryDate}}.\nننصح بتجديده في وقته تفادياً للمخالفات.',
    bodyEn:
      'A friendly reminder, {{customerName}}.\nThe {{documentTitle}} for your vehicle ({{plateNumber}}) expires on {{expiryDate}}.\nWe recommend renewing it in good time.',
    variables: '["customerName","documentTitle","plateNumber","expiryDate"]',
  },
];

async function main() {
  console.log('Seeding phase-2 reference data...');

  // ---- Country + cities -------------------------------------------------
  let country = await prisma.country.findFirst({ where: { code: 'SA', deletedAt: null } });
  if (!country) {
    country = await prisma.country.create({
      data: { code: 'SA', nameAr: 'المملكة العربية السعودية', nameEn: 'Saudi Arabia' },
    });
    console.log('  + country: Saudi Arabia');
  }

  for (const [nameAr, nameEn] of SAUDI_CITIES) {
    const existing = await prisma.city.findFirst({
      where: { countryId: country.id, nameEn, deletedAt: null },
    });
    if (!existing) {
      await prisma.city.create({ data: { countryId: country.id, nameAr, nameEn } });
    }
  }
  console.log(`  cities ready: ${SAUDI_CITIES.length}`);

  // ---- Default branch ---------------------------------------------------
  const riyadh = await prisma.city.findFirst({
    where: { countryId: country.id, nameEn: 'Riyadh', deletedAt: null },
  });

  let branch = await prisma.branch.findFirst({ where: { code: 'MAIN', deletedAt: null } });
  if (!branch && riyadh) {
    branch = await prisma.branch.create({
      data: {
        code: 'MAIN',
        nameAr: 'الفرع الرئيسي',
        nameEn: 'Main Branch',
        cityId: riyadh.id,
      },
    });
    console.log('  + branch: Main Branch');
  }

  // Existing staff and data keep working either way; attaching them to the
  // default branch just makes the new filters meaningful from day one.
  if (branch) {
    const [users, customers, jobCards] = await Promise.all([
      prisma.user.updateMany({ where: { branchId: null, deletedAt: null }, data: { branchId: branch.id } }),
      prisma.customer.updateMany({ where: { branchId: null, deletedAt: null }, data: { branchId: branch.id } }),
      prisma.jobCard.updateMany({ where: { branchId: null, deletedAt: null }, data: { branchId: branch.id } }),
    ]);
    console.log(`  attached to main branch — users: ${users.count}, customers: ${customers.count}, job cards: ${jobCards.count}`);
  }

  // ---- Vehicle catalogue ------------------------------------------------
  let modelCount = 0;
  for (const b of BRANDS) {
    let brand = await prisma.vehicleBrand.findFirst({ where: { nameEn: b.en, deletedAt: null } });
    if (!brand) {
      brand = await prisma.vehicleBrand.create({ data: { nameAr: b.ar, nameEn: b.en } });
    }

    for (const [nameAr, nameEn] of b.models) {
      const existing = await prisma.vehicleModel.findFirst({
        where: { brandId: brand.id, nameEn, deletedAt: null },
      });
      if (!existing) {
        await prisma.vehicleModel.create({ data: { brandId: brand.id, nameAr, nameEn } });
        modelCount++;
      }
    }
  }
  console.log(`  brands ready: ${BRANDS.length}, new models: ${modelCount}`);

  // ---- Starter parts catalogue -----------------------------------------
  let partCount = 0;
  for (const p of PART_CATEGORIES) {
    const existing = await prisma.part.findFirst({ where: { partNumber: p.partNumber, deletedAt: null } });
    if (!existing) {
      await prisma.part.create({ data: { ...p, unit: 'PCS', quantity: 0, reorderLevel: 5 } });
      partCount++;
    }
  }
  console.log(`  new parts: ${partCount}`);

  // ---- Annual plans (M1) ------------------------------------------------
  let planCount = 0;
  for (const p of PLANS) {
    const existing = await prisma.plan.findFirst({ where: { nameAr: p.nameAr, deletedAt: null } });
    if (!existing) {
      await prisma.plan.create({ data: p });
      planCount++;
    }
  }
  console.log(`  new plans: ${planCount}`);

  // ---- Message templates (M6) -------------------------------------------
  let templateCount = 0;
  for (const tpl of TEMPLATES) {
    const existing = await prisma.messageTemplate.findFirst({
      where: { code: tpl.code, deletedAt: null },
    });
    if (!existing) {
      // isSystem marks the templates the automatic triggers look up by code,
      // so the workshop can reword them but not delete or rename them.
      await prisma.messageTemplate.create({ data: { ...tpl, isSystem: true } });
      templateCount++;
    }
  }
  console.log(`  new message templates: ${templateCount}`);

  console.log('Reference data seeded.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
