/**
 * بيانات عرض واقعية لورشة سعودية — لاجتماع تقديم النظام.
 *
 * تمرّ عبر الـ API لا عبر قاعدة البيانات مباشرة، فيعمل معها كل منطق
 * النظام كما يعمل في التشغيل الحقيقي: الاشتراك يخصم الزيارة، صرف القطعة
 * ينقص المخزون ويظهر في ملف السيارة، تغيّر الحالة يجدول رسالة للعميل،
 * التسليم يصرف النقاط ويرفع مستوى العميل، والفاتورة تُبنى من الكرت.
 * بيانات مزروعة بـ INSERT مباشر تبدو صحيحة في الجداول وتنهار أول ما
 * يُفتح أي تقرير.
 *
 * التشغيل:
 *   API_URL=https://au2ka.faslacloud.com \
 *   ADMIN_MOBILE=05xxxxxxxx ADMIN_PASSWORD=... \
 *   npm run demo:seed --prefix backend
 *
 * المسح بعد الاجتماع:  npm run check:reset --prefix backend
 */

const BASE = (process.env.API_URL || 'http://127.0.0.1:5000') + '/api/v1';
const MOBILE = process.env.ADMIN_MOBILE || '0500000001';
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

let token = '';

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 180)}`);
  return JSON.parse(text);
}

/** يتجاهل الفشل: خطوة تجميلية لا تستحق إيقاف الزرع كله. */
async function soft(label, fn) {
  try { return await fn(); } catch (e) { console.log(`   (تخطّي ${label}: ${String(e.message).slice(0, 70)})`); return null; }
}

const pad = n => String(n).padStart(2, '0');
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// عملاء الورشة. لكل واحد سيارة وحالة مختلفة، حتى تمتلئ لوحة الكروت
// بكل مراحلها بدل أن تتكدس الكروت في عمود واحد.
const PEOPLE = [
  { name: 'عبدالله الشهري',  mobile: '0551000101', brand: 'تويوتا',  model: 'لاند كروزر', plate: 'أ ب ج 4521', km: 68000, complaint: 'صيانة دورية وتغيير زيت', cost: 850,  stage: 'DELIVERED' },
  { name: 'محمد العتيبي',    mobile: '0551000102', brand: 'تويوتا',  model: 'كامري',      plate: 'د هـ و 1198', km: 112000, complaint: 'صوت في المكابح الأمامية', cost: 1450, stage: 'IN_PROGRESS' },
  { name: 'سارة القحطاني',   mobile: '0551000103', brand: 'هيونداي', model: 'سوناتا',     plate: 'ر ز س 7734', km: 41000, complaint: 'المكيف لا يبرّد',          cost: 1200, stage: 'INSPECTION' },
  { name: 'فهد الدوسري',     mobile: '0551000104', brand: 'تويوتا',  model: 'هايلكس',     plate: 'ص ض ط 2290', km: 158000, complaint: 'اهتزاز في المقود عند السرعة', cost: 2100, stage: 'WAITING_APPROVAL' },
  { name: 'نورة الحربي',     mobile: '0551000105', brand: 'هيونداي', model: 'النترا',     plate: 'ع غ ف 5512', km: 23000, complaint: 'فحص شامل قبل السفر',      cost: 600,  stage: 'COMPLETED' },
  { name: 'سلطان الغامدي',   mobile: '0551000106', brand: 'نيسان',   model: 'باترول',     plate: 'ق ك ل 8801', km: 97000, complaint: 'تغيير فحمات وزيت جير',    cost: 1900, stage: 'RECEIVED' },
  { name: 'خالد الزهراني',   mobile: '0551000107', brand: 'هوندا',   model: 'أكورد',      plate: 'م ن هـ 3345', km: 76000, complaint: 'صيانة دورية',            cost: 740,  stage: 'DELIVERED' },
  { name: 'ريم المالكي',     mobile: '0551000108', brand: 'كيا',     model: 'سبورتاج',    plate: 'و ي أ 6627', km: 15000, complaint: 'أول زيارة — فحص وتغيير زيت', cost: 520, stage: 'DELIVERED' },
];

const CHAIN = ['INSPECTION', 'WAITING_APPROVAL', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED'];

(async () => {
  console.log(`زرع بيانات العرض على ${BASE}\n`);

  token = (await call('POST', '/auth/login', { mobileNumber: MOBILE, password: PASSWORD })).token;
  console.log('1. تم الدخول');

  const cities = (await call('GET', '/locations/cities')).cities;
  const branches = (await call('GET', '/branches')).branches;
  const parts = (await call('GET', '/parts?limit=100')).parts;
  const plans = (await call('GET', '/plans')).plans;
  const riyadh = cities.find(c => c.nameAr === 'الرياض') || cities[0];
  const branch = branches[0];
  console.log(`   المرجع: ${cities.length} مدينة، ${parts.length} قطعة، ${plans.length} باقات`);

  // مخزون افتتاحي حتى تظهر شاشة المخزون بأرصدة وحركة لا صفرًا
  console.log('2. إدخال مخزون افتتاحي');
  for (const [i, part] of parts.slice(0, 8).entries()) {
    await soft('إدخال', () => call('POST', '/inventory/intake', {
      partId: part.id, quantity: 12 + i * 4, unitPrice: 60 + i * 25, reference: `PO-2026-${1000 + i}`,
    }));
  }

  console.log('3. العملاء والسيارات');
  const made = [];
  for (const p of PEOPLE) {
    const customer = (await call('POST', '/customers', {
      fullName: p.name, mobileNumber: p.mobile, cityId: riyadh.id, branchId: branch.id,
    })).customer;

    const vehicle = (await call('POST', '/vehicles', {
      customerId: customer.id, brand: p.brand, model: p.model, plateNumber: p.plate, mileage: p.km,
    })).vehicle;

    made.push({ ...p, customer, vehicle, jobCard: null });
    console.log(`   ${p.name} — ${p.brand} ${p.model} — ${p.plate}`);
  }

  // حدود المستويات ومعدل النقاط. بالقيم الافتراضية (1000/5000/15000) يبقى
  // كل عملاء العرض في «عادي»، فلا تظهر الميزة التي سأل عنها العميل أصلًا.
  // هذه الحدود مع الإنفاق أدناه تُظهر الدرجات الأربع كلها على الشاشة.
  await soft('إعداد المستويات', () => call('PUT', '/referrals/settings', {
    isActive: true, silverThreshold: 500, goldThreshold: 3000,
    platinumThreshold: 8000, pointsPerRiyal: 0.1,
  }));

  // اشتراك لعميلين، فتظهر شارة المشترك وتُخصم الزيارة المجانية عند فتح الكرت
  console.log('4. اشتراكات');
  for (const target of [made[0], made[4]]) {
    await soft('اشتراك', () => call('POST', '/subscriptions', {
      customerId: target.customer.id, vehicleId: target.vehicle.id,
      planId: plans[0].id, paidAmount: Number(plans[0].price), paymentMethod: 'CASH',
    }));
  }

  // إحالة: خالد أحال ريم. الربط قبل فتح الكرت لا بعده — المكافأة تُصرف
  // عند أول زيارة، فإن فُتح الكرت أولًا رفض النظام الربط ولم تظهر النقاط.
  console.log('5. إحالة بين عميلين');
  await soft('إحالة', async () => {
    const code = (await call('GET', `/referrals/customer/${made[6].customer.id}/code`)).code;
    return call('POST', '/referrals/link', { code, referredId: made[7].customer.id });
  });

  console.log('6. فتح كروت العمل');
  for (const m of made) {
    m.jobCard = (await call('POST', '/job-cards', {
      customerId: m.customer.id, vehicleId: m.vehicle.id,
      customerComplaint: m.complaint, estimatedCost: m.cost, mileage: m.km,
    })).jobCard;
    console.log(`   ${m.jobCard.jobNumber} — ${m.name}`);
  }

  console.log('7. فحص فني وصرف قطع');
  for (const m of made.slice(0, 5)) {
    await soft('فحص', async () => {
      const form = await call('GET', `/inspections/job-card/${m.jobCard.id}`);
      const results = form.items.map((item, idx) => ({
        itemId: item.id,
        rating: idx === 0 && m.stage === 'WAITING_APPROVAL' ? 'CRITICAL'
              : idx < 2 ? 'NEEDS_ATTENTION' : 'OK',
        noteAr: idx === 0 && m.stage === 'WAITING_APPROVAL' ? 'يحتاج استبدالًا فوريًا' : null,
      }));
      return call('PUT', `/inspections/job-card/${m.jobCard.id}`, { results, mileage: m.km, complete: true });
    });

    await soft('صرف قطعة', () => call('POST', '/inventory/issue', {
      partId: parts[made.indexOf(m) % 6].id, jobCardId: m.jobCard.id, quantity: 2, warrantyMonths: 12,
    }));
  }

  console.log('8. تحريك الكروت إلى مراحلها');
  for (const m of made) {
    if (m.stage === 'RECEIVED') continue;
    const upto = CHAIN.indexOf(m.stage);
    for (let i = 0; i <= upto; i++) {
      await soft(`حالة ${CHAIN[i]}`, () => call('PUT', `/job-cards/${m.jobCard.id}`, { status: CHAIN[i] }));
    }
  }

  // زيارات سابقة لعميلين: سيارة بتاريخ زيارة واحدة تجعل «ملف السيارة»
  // والتقرير الشهري يبدوان فارغين، والمستويات لا تتجاوز الدرجة الأولى.
  console.log('9. سجل زيارات سابقة');
  const HISTORY = [
    { who: 0, visits: [['تغيير زيت وفلاتر', 1800], ['إصلاح نظام التبريد', 2400], ['صيانة 60 ألف كم', 3200]] },
    { who: 6, visits: [['تغيير إطارات وميزان', 1500], ['صيانة دورية', 2000]] },
  ];
  for (const h of HISTORY) {
    const m = made[h.who];
    for (const [complaint, cost] of h.visits) {
      await soft('زيارة سابقة', async () => {
        const jc = (await call('POST', '/job-cards', {
          customerId: m.customer.id, vehicleId: m.vehicle.id,
          customerComplaint: complaint, estimatedCost: cost, mileage: m.km,
        })).jobCard;
        for (const st of CHAIN) await call('PUT', `/job-cards/${jc.id}`, { status: st });
      });
    }
    console.log(`   ${m.name}: ${h.visits.length} زيارات سابقة`);
  }

  console.log('10. مواعيد قادمة');
  let booked = 0;
  for (let day = 1; day <= 10 && booked < 4; day++) {
    const d = new Date(); d.setDate(d.getDate() + day);
    const avail = await soft('إتاحة', () => call('GET', `/appointments/availability?date=${dateKey(d)}`));
    if (!avail?.slots?.length) continue;
    for (const slot of avail.slots.filter(s => s.available).slice(0, 2)) {
      if (booked >= 4) break;
      const m = made[(booked + 2) % made.length];
      const ok = await soft('حجز', () => call('POST', '/appointments', {
        customerId: m.customer.id, vehicleId: m.vehicle.id,
        scheduledAt: `${dateKey(d)}T${slot.time}:00`,
        complaint: ['صيانة دورية', 'فحص قبل السفر', 'تغيير زيت وفلاتر', 'فحص المكيف'][booked % 4],
      }));
      if (ok) booked++;
    }
  }
  console.log(`   ${booked} مواعيد`);

  console.log('11. فواتير إلكترونية للكروت المسلّمة');
  await soft('إعداد الفوترة', () => call('PUT', '/zatca/settings', {
    sellerNameAr: 'ورشة أوتوكا لصيانة السيارات', sellerNameEn: 'Au2Ka Auto Service',
    vatNumber: '300000000000003', crnNumber: '1010101010',
    street: 'طريق الملك فهد', buildingNumber: '1234', district: 'العليا',
    city: 'الرياض', postalCode: '12211', vatRate: 15,
  }));
  await soft('مفتاح الختم', () => call('POST', '/zatca/onboard', {}));
  let invoices = 0;
  for (const m of made.filter(x => x.stage === 'DELIVERED')) {
    const inv = await soft('فاتورة', () => call('POST', '/zatca/invoices', { jobCardId: m.jobCard.id, type: 'SIMPLIFIED' }));
    if (inv) invoices++;
  }
  console.log(`   ${invoices} فواتير`);

  console.log('12. تقارير شهرية');
  const now = new Date();
  await soft('تقرير', () => call('POST', '/monthly-reports/generate', { year: now.getFullYear(), month: now.getMonth() + 1 }));

  // ملخص يطابق ما ستعرضه الشاشات
  const stats = (await call('GET', '/dashboard/stats')).data.stats;
  const ref = await call('GET', '/referrals/report');
  const board = (await call('GET', '/job-cards?limit=100')).jobCards || [];
  const byStatus = board.reduce((acc, c) => ({ ...acc, [c.status]: (acc[c.status] || 0) + 1 }), {});

  console.log('\n— جاهز —');
  console.log(`عملاء: ${stats.totalCustomers.count} | سيارات: ${stats.totalVehicles.count} | كروت: ${stats.totalJobCards.count}`);
  console.log(`الكروت على اللوحة: ${JSON.stringify(byStatus)}`);
  console.log(`مستويات العملاء: ${JSON.stringify(ref.tiers || {})}`);
  console.log('\nللمسح بعد الاجتماع:  npm run check:reset --prefix backend');
})().catch(e => { console.error('\nتوقف الزرع:', e.message); process.exit(1); });
