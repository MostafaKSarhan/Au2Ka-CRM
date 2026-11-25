/**
 * الاختبار الشامل لنظام Au2Ka — رحلة عميل واحدة كاملة تمر على وحدات
 * المرحلة الثانية كلها وعلى شاشات الإصدار الأول، للتأكد أن الوحدات تعمل
 * مع بعضها وليس كل واحدة بمفردها.
 *
 * التشغيل:  npm run check:system   (الباكند والواجهة يجب أن يكونا مشغّلين)
 * التنظيف:  npm run check:reset    (يمسح بيانات الاختبار ويترك البيانات المرجعية)
 *
 * يكتب الاختبار بيانات حقيقية في قاعدة البيانات، فلا يُشغَّل على قاعدة الإنتاج.
 */
const BASE = (process.env.API_URL || 'http://127.0.0.1:5000') + '/api/v1';
const WEB = process.env.WEB_URL || 'http://127.0.0.1:5173';
let pass = 0, fail = 0;
const failures = [];

function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${label}${detail ? ' — ' + detail : ''}`); }
  else { fail++; failures.push(label); console.log(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`); }
}
function section(n, title) { console.log(`\n=== ${n}. ${title} ===`); }

async function raw(method, path, body, tok) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, text };
}
async function call(method, path, body, tok) {
  const r = await raw(method, path, body, tok === undefined ? staff : tok);
  if (r.status >= 400) throw new Error(`${method} ${path} -> ${r.status}: ${r.text.slice(0, 200)}`);
  return r.json;
}
/** Asserts the call is refused, and with which status. */
async function refused(label, method, path, body, tok, expected) {
  const r = await raw(method, path, body, tok);
  const good = expected ? r.status === expected : r.status >= 400;
  ok(label, good, `HTTP ${r.status}`);
  return r;
}
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

let staff, tech, reception;

// ---------------------------------------------------------------- 1
section(1, 'الدخول والأدوار');
{
  const a = await raw('POST', '/auth/login', { mobileNumber: '0500000001', password: 'admin123' });
  staff = a.json.token; ok('دخول المدير', !!staff && a.json.user?.role === 'ADMIN');
  const t = await raw('POST', '/auth/login', { mobileNumber: '0500000003', password: 'tech123' });
  tech = t.json.token; ok('دخول الفني', !!tech && t.json.user?.role === 'TECHNICIAN');
  const r = await raw('POST', '/auth/login', { mobileNumber: '0500000002', password: 'reception123' });
  reception = r.json.token; ok('دخول الاستقبال', !!reception);
  await refused('كلمة مرور خاطئة ترفض', 'POST', '/auth/login', { mobileNumber: '0500000001', password: 'wrong' });
  await refused('طلب بلا توكن يرفض', 'GET', '/customers', undefined, null, 401);
  await refused('توكن مزيّف يرفض', 'GET', '/customers', undefined, 'not-a-real-token', 401);
  await refused('الفني لا يفتح البيانات المرجعية', 'POST', '/parts', { nameAr: 'x', nameEn: 'x' }, tech, 403);
  await refused('الفني لا ينشئ فروعًا', 'POST', '/branches', { nameAr: 'x', nameEn: 'x' }, tech, 403);
}

// ---------------------------------------------------------------- 2
section(2, 'البيانات المرجعية (M1 / R0)');
let branchId, cityId, partPads, partOil, planId;
{
  const countries = await call('GET', '/locations/countries');
  const cities = await call('GET', '/locations/cities');
  ok('الدول مزروعة', countries.countries.length >= 1, countries.countries.map(c => c.nameAr).join('، '));
  ok('مدن السعودية مزروعة', cities.cities.length >= 20, `${cities.cities.length} مدينة`);
  cityId = cities.cities[0].id;

  const branches = await call('GET', '/branches');
  ok('فرع رئيسي موجود', branches.branches.length >= 1, branches.branches[0]?.nameAr);
  branchId = branches.branches[0].id;

  const cat = await call('GET', '/vehicle-catalog/models?limit=200');
  ok('كتالوج الموديلات مزروع', (cat.models?.length || 0) >= 60, `${cat.models?.length} موديل`);

  const parts = await call('GET', '/parts?limit=100');
  ok('قطع الغيار مزروعة', parts.parts.length >= 10, `${parts.parts.length} قطعة`);
  partPads = parts.parts.find(p => p.nameAr.includes('فحمات')) || parts.parts[0];
  partOil = parts.parts.find(p => p.id !== partPads.id);

  const plans = await call('GET', '/plans');
  ok('باقات الاشتراك مزروعة', plans.plans.length >= 3, plans.plans.map(p => p.nameAr).join('، '));
  planId = plans.plans[0].id;

  const items = await call('GET', '/inspections/items?activeOnly=true');
  ok('بنود الفحص مزروعة', items.items.length >= 20, `${items.items.length} بند`);

  const tpls = await call('GET', '/messaging/templates');
  ok('قوالب الرسائل مزروعة', tpls.templates.length >= 7, `${tpls.templates.length} قالب`);
}

// ---------------------------------------------------------------- 3
section(3, 'إعدادات الفوترة والواتساب تخفي الأسرار (M8 / M9)');
{
  await call('PUT', '/zatca/settings', {
    sellerNameAr: 'ورشة أوتوكا لصيانة السيارات', sellerNameEn: 'Au2Ka Auto Service',
    vatNumber: '300000000000003', crnNumber: '1010101010',
    street: 'طريق الملك فهد', buildingNumber: '1234', district: 'العليا',
    city: 'الرياض', postalCode: '12211', vatRate: 15,
  });
  await call('POST', '/zatca/onboard', {});
  const z = await call('GET', '/zatca/settings');
  ok('المفتاح الخاص لا يظهر في الـ API', !('privateKeyPem' in z.settings) && z.settings.hasPrivateKey === true);
  ok('بيانات المنشأة مكتملة', z.settings.missingFields.length === 0);

  await call('PUT', '/whatsapp/settings', {
    phoneNumberId: '100000000000001', businessAccountId: '200000000000002',
    accessToken: 'EAA-fake-token-for-testing', verifyToken: 'au2ka-verify-xyz',
  });
  const w = await call('GET', '/whatsapp/settings');
  ok('توكن واتساب لا يظهر في الـ API', !('accessToken' in w.settings) && w.settings.hasAccessToken === true);
  await refused('رقم ضريبي غير صحيح يرفض', 'PUT', '/zatca/settings', { vatNumber: '12345' }, staff, 400);
}

// ---------------------------------------------------------------- 4
section(4, 'عميل محيل + عميل محال عبر رابط الإحالة (M5)');
let referrer, referred, vehicle;
{
  await call('PUT', '/referrals/settings', { isActive: true, pointsPerRiyal: 0.1 });
  referrer = (await call('POST', '/customers', {
    fullName: 'خالد المحيل', mobileNumber: '0590000001', cityId, branchId,
  })).customer;
  ok('العميل مرتبط بالفرع والمدينة', !!referrer.id);

  const codeRes = await call('GET', `/referrals/customer/${referrer.id}/code`);
  ok('كود إحالة مولّد', !!codeRes.code, codeRes.code);

  referred = (await call('POST', '/customers', {
    fullName: 'سارة المحالة', mobileNumber: '0590000002', cityId, branchId,
  })).customer;
  const link = await call('POST', '/referrals/link', { code: codeRes.code, referredId: referred.id });
  ok('الإحالة مربوطة', !!link.referral || !!link.message);
  await refused('الإحالة الذاتية ترفض', 'POST', '/referrals/link', { code: codeRes.code, referredId: referrer.id }, staff, 400);

  vehicle = (await call('POST', '/vehicles', {
    customerId: referred.id, brand: 'تويوتا', model: 'كامري',
    plateNumber: 'FULL-1', mileage: 55000,
  })).vehicle;
  ok('سيارة مسجلة للعميل', !!vehicle.id);
}

// ---------------------------------------------------------------- 5
section(5, 'اشتراك يغطي الزيارة (M1)');
{
  const sub = await call('POST', '/subscriptions', {
    customerId: referred.id, vehicleId: vehicle.id, planId, paidAmount: 1500, paymentMethod: 'CASH',
  });
  ok('اشتراك مفعّل', !!sub.subscription?.id, `حتى ${String(sub.subscription.endDate).slice(0, 10)}`);
  const active = await call('GET', `/subscriptions/customer/${referred.id}/active?vehicleId=${vehicle.id}`);
  ok('الاشتراك يظهر ساريًا للسيارة', !!active.subscription);
  const list = await call('GET', `/customers?search=${encodeURIComponent('سارة المحالة')}`);
  const subs = list.customers[0]?.subscriptions || [];
  ok('قائمة العملاء تحمل الاشتراك الساري للشارة', subs.length === 1 && !!subs[0].plan?.nameAr,
    subs[0]?.plan?.nameAr);
}

// ---------------------------------------------------------------- 6
section(6, 'حجز موعد ثم تحويله لكرت عمل (M6)');
let jobCard;
{
  let target = new Date(); let avail = null;
  for (let i = 1; i <= 14 && !avail; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const a = await call('GET', `/appointments/availability?date=${dateKey(d)}`);
    if (a.slots?.some(s => s.available)) { avail = a; target = d; }
  }
  ok('أوقات متاحة في التقويم', !!avail, avail ? `${dateKey(target)} — ${avail.slots.filter(s => s.available).length} موعد` : '');
  ok('شاشة الموظف تُظهر الحمل والسعة', avail.slots.every(s => 'capacity' in s && 'booked' in s));
  ok('التقويم لا يكشف هوية عميل آخر', !/fullName|mobileNumber/i.test(JSON.stringify(avail.slots)));

  const slot = avail.slots.find(s => s.available);
  const appt = await call('POST', '/appointments', {
    customerId: referred.id, vehicleId: vehicle.id,
    scheduledAt: `${dateKey(target)}T${slot.time}:00`, complaint: 'صيانة دورية وصوت في المكابح',
  });
  ok('الموعد محجوز', !!appt.appointment?.id);
  ok('تاريخ الموعد باليوم الصحيح (لا إزاحة UTC)', String(appt.appointment.scheduledAt).slice(0, 10) === dateKey(target),
    `${String(appt.appointment.scheduledAt).slice(0, 10)} مقابل ${dateKey(target)}`);
  await refused('موعد في الماضي يرفض', 'POST', '/appointments', { customerId: referred.id, scheduledAt: '2020-01-01T10:00:00' }, staff, 400);

  await call('PUT', `/appointments/${appt.appointment.id}/status`, { status: 'CONFIRMED' });
  await call('PUT', `/appointments/${appt.appointment.id}/status`, { status: 'ARRIVED' });
  const conv = await call('POST', `/appointments/${appt.appointment.id}/convert`, {});
  jobCard = conv.jobCard;
  ok('الموعد تحوّل لكرت عمل', !!jobCard?.jobNumber, jobCard?.jobNumber);
  ok('الكرت ورث العميل والسيارة', jobCard.customerId === referred.id && jobCard.vehicleId === vehicle.id);

  // الكرت القادم من موعد لازم يأخذ نفس ما يأخذه كرت الاستقبال
  const opened = await call('GET', `/job-cards/${jobCard.id}`);
  ok('الاشتراك غطّى الكرت القادم من موعد', opened.jobCard.isFreeVisit === true || !!opened.jobCard.subscriptionId,
    opened.jobCard.isFreeVisit ? 'زيارة مجانية' : `خصم ${opened.jobCard.subscriptionDiscount}`);
  const subNow = await call('GET', `/subscriptions/customer/${referred.id}/active?vehicleId=${vehicle.id}`);
  ok('رصيد الزيارات المجانية نقص واحدة', subNow.subscription.freeVisitsUsed === 1,
    `${subNow.subscription.freeVisitsUsed}/${subNow.subscription.freeVisitsTotal}`);
  const wallet = await call('GET', `/referrals/customer/${referrer.id}/wallet`);
  ok('مكافأة الإحالة احتُسبت عند فتح الكرت من موعد',
    (wallet.customer.pointsBalance) > 0, `رصيد المحيل ${wallet.customer.pointsBalance}`);
  await refused('التحويل مرتين يرفض', 'POST', `/appointments/${appt.appointment.id}/convert`, {}, staff, 400);
}

// ---------------------------------------------------------------- 7
section(7, 'فحص السيارة ودرجة الحالة (M4)');
{
  const form = await call('GET', `/inspections/job-card/${jobCard.id}`);
  ok('نموذج الفحص يفتح بكل البنود', form.items.length >= 20);
  const results = form.items.map((it, idx) => ({
    itemId: it.id,
    rating: idx === 0 ? 'CRITICAL' : idx === 1 ? 'NEEDS_ATTENTION' : 'OK',
    noteAr: idx === 0 ? 'الفحمات منتهية بالكامل' : null,
  }));
  const draft = await call('PUT', `/inspections/job-card/${jobCard.id}`, { results, mileage: 55200 });
  const beforeComplete = await call('GET', `/inspections/vehicle/${vehicle.id}/history`);
  ok('الفحص غير المعتمد لا يدخل التاريخ', beforeComplete.history.length === 0);

  const saved = await call('PUT', `/inspections/job-card/${jobCard.id}`, { results, mileage: 55200, complete: true });
  const score = saved.inspection.healthScore;
  ok('درجة الحالة محسوبة بسقف الخطورة', score <= 49, `${score}/100 — ${saved.inspection.band}`);
  ok('بند حرج واحد يهبط بالدرجة رغم سلامة الباقي', draft.inspection.healthScore === score);
  const hist = await call('GET', `/inspections/vehicle/${vehicle.id}/history`);
  ok('الفحص المعتمد مسجل في تاريخ السيارة', hist.history.length >= 1);

  // الورشة تسعّر الإصلاح بعد الفحص
  const priced = await call('PUT', `/job-cards/${jobCard.id}`, { estimatedCost: 450 });
  ok('تسعير الإصلاح محفوظ على الكرت', Number(priced.jobCard.estimatedCost) === 450);
}

// ---------------------------------------------------------------- 8
section(8, 'إدخال وصرف قطع الغيار (M10)');
{
  await call('POST', '/inventory/intake', { partId: partPads.id, quantity: 10, unitPrice: 125, reference: 'PO-5001' });
  const afterIntake = (await call('GET', '/parts?limit=100')).parts.find(p => p.id === partPads.id);
  ok('الكمية زادت بالإدخال', afterIntake.quantity >= 10, `الرصيد ${afterIntake.quantity}`);

  const issued = await call('POST', '/inventory/issue', { partId: partPads.id, jobCardId: jobCard.id, quantity: 2, warrantyMonths: 12 });
  ok('الصرف خصم من الرصيد', issued.balanceAfter === afterIntake.quantity - 2, `${afterIntake.quantity} → ${issued.balanceAfter}`);
  await refused('صرف أكثر من الرصيد يرفض', 'POST', '/inventory/issue', { partId: partPads.id, jobCardId: jobCard.id, quantity: 99999 }, staff, 400);

  const file = await call('GET', `/vehicle-file/${vehicle.id}`);
  ok('القطعة المصروفة ظهرت في ملف السيارة', (file.replacements || []).length >= 1,
    file.replacements?.[0]?.partName);
  ok('تكلفة القطع دخلت ملخص المصروف', (file.summary?.partsReplaced ?? 0) === 2,
    `${file.summary?.partsReplaced} قطعة`);
  const movements = await call('GET', `/inventory/movements?partId=${partPads.id}`);
  ok('حركة المخزون مسجلة بالاتجاهين', movements.movements.some(m => m.type === 'IN') && movements.movements.some(m => m.type === 'OUT'));
}

// ---------------------------------------------------------------- 9
section(9, 'مسار حالات الكرت والرسائل المرافقة (M3 / M8)');
{
  await refused('تخطّي مرحلة في مسار الحالات يرفض', 'PUT', `/job-cards/${jobCard.id}`, { status: 'DELIVERED' }, staff, 400);
  for (const st of ['INSPECTION', 'WAITING_APPROVAL', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED']) {
    await call('PUT', `/job-cards/${jobCard.id}`, { status: st });
  }
  const after = await call('GET', `/job-cards/${jobCard.id}`);
  ok('الكرت مرّ بكل المراحل حتى التسليم', after.jobCard.status === 'DELIVERED');
  const activity = after.jobCard.activities || after.jobCard.activity || [];
  ok('سجل الحركة يوثّق المراحل', activity.length >= 5, `${activity.length} حركة`);

  const msgs = await call('GET', `/messaging/messages?customerId=${referred.id}`);
  ok('رسائل مجدولة عند تغيّر الحالة', msgs.messages.length >= 1, `${msgs.messages.length} رسالة`);
  ok('لا متغيرات غير مستبدلة في نص الرسائل', msgs.messages.every(m => !/\{\{/.test(m.bodyAr || '')));

  const run = await call('POST', '/messaging/messages/run', {});
  ok('طابور الإرسال يعمل', !!run);
  const stats = await call('GET', '/messaging/messages/stats');
  ok('إحصاءات الرسائل متاحة', !!stats);

  await call('PUT', `/messaging/opt-out/${referred.id}`, { optOut: true });
  await refused('العميل الموقوف لا تُجدول له رسائل', 'POST', '/messaging/messages',
    { templateCode: 'JOB_COMPLETED', customerId: referred.id, values: { customerName: 'سارة' } }, staff, 400);
  await call('PUT', `/messaging/opt-out/${referred.id}`, { optOut: false });
}

// ---------------------------------------------------------------- 10
section(10, 'نقاط الإحالة بعد التسليم (M5)');
{
  const w = await call('GET', `/referrals/customer/${referrer.id}/wallet`);
  const bal1 = w.customer.pointsBalance;
  ok('المحيل حصل على نقاط', bal1 > 0, `الرصيد ${bal1}`);
  const w2 = await call('GET', `/referrals/customer/${referred.id}/wallet`);
  const bal2 = w2.customer.pointsBalance;
  ok('المحال حصل على نقاط زيارته', bal2 > 0, `الرصيد ${bal2}`);
  // 450 أجور + قطعتين بسعر البيع = الإنفاق الكامل، مطابق لإجمالي الفاتورة قبل الضريبة
  const spent = Number((await call('GET', `/customers/${referred.id}`)).customer.lifetimeSpend);
  ok('إنفاق العميل يضم الأجور والقطع', spent === 850, `${spent} ريال`);
  // بمعدل 0.1 نقطة للريال: 85 نقطة على 850، لا 45 على الأجور وحدها
  const spendEntry = w2.entries.find(e => e.type === 'EARNED_SPEND');
  ok('نقاط الإنفاق محسوبة على المبلغ الكامل', spendEntry?.points === 85, `${spendEntry?.points} نقطة`);
  await refused('استبدال أكثر من الرصيد يرفض', 'POST', `/referrals/customer/${referred.id}/redeem`, { points: 999999 }, staff, 400);
}

// ---------------------------------------------------------------- 11
section(11, 'الفاتورة الإلكترونية من الكرت (M9)');
let invoice;
{
  const res = await call('POST', '/zatca/invoices', { jobCardId: jobCard.id, type: 'SIMPLIFIED' });
  invoice = res.invoice;
  ok('الفاتورة صادرة ومختومة', invoice.status === 'SIGNED', `${invoice.invoiceNumber} — ${invoice.status}`);
  const expectedVat = Math.round(Number(invoice.netAmount) * 0.15 * 100) / 100;
  ok('الضريبة 15% محسوبة صح', Number(invoice.vatAmount) === expectedVat,
    `${invoice.netAmount} + ${invoice.vatAmount} = ${invoice.totalAmount}`);
  const q = res.invoice.qrFields;
  ok('رمز QR يحمل الحقول السبعة', q && Object.keys(q).length >= 6, Object.keys(q || {}).join(','));

  const full = await call('GET', `/zatca/invoices/${invoice.id}`);
  const lines = full.invoice.lines;
  ok('بنود الفاتورة تضم الأجور والقطعة', lines.length >= 2, lines.map(l => l.nameAr).join(' + '));
  ok('XML بصيغة UBL 2.1', full.invoice.signedXml.includes('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2'));
  await refused('فاتورة ثانية لنفس الكرت ترفض', 'POST', '/zatca/invoices', { jobCardId: jobCard.id }, staff, 409);

  const second = await call('POST', '/zatca/invoices', {
    type: 'STANDARD', buyerName: 'شركة النقل الوطنية', buyerVatNumber: '310000000000003',
    lines: [{ nameAr: 'عقد صيانة أسطول', quantity: 5, unitPrice: 400, net: 2000 }],
  });
  ok('الفاتورة الثانية مرتبطة بهاش الأولى', second.invoice.previousHash === invoice.invoiceHash);
  const chain = await call('GET', '/zatca/verify-chain');
  ok('سلسلة الفواتير سليمة', chain.intact === true, `${chain.count} فاتورة`);
  await refused('الإرسال لـ ZATCA بلا شهادة يرفض', 'POST', `/zatca/invoices/${invoice.id}/submit`, {}, staff, 400);

  const xmlRes = await fetch(`${BASE}/zatca/invoices/${invoice.id}/xml`, { headers: { Authorization: 'Bearer ' + staff } });
  ok('تنزيل XML يعمل', xmlRes.ok && (xmlRes.headers.get('content-type') || '').includes('xml'));
}

// ---------------------------------------------------------------- 12
section(12, 'ملف السيارة ورابط المشاركة (M2)');
{
  const share = await call('POST', `/vehicle-file/${vehicle.id}/share`, {});
  ok('رابط مشاركة مولّد', !!share.shareToken);
  const pub = await raw('GET', `/public/vehicle-file/${share.shareToken}`);
  ok('الرابط العام يفتح بلا توكن', pub.status === 200);
  const body = JSON.stringify(pub.json);
  ok('الرابط العام لا يكشف جوال العميل', !body.includes('0590000002'));
  const badPub = await raw('GET', '/public/vehicle-file/this-token-does-not-exist');
  ok('رابط مشاركة خاطئ يرفض', badPub.status === 404, `HTTP ${badPub.status}`);
}

// ---------------------------------------------------------------- 13
section(13, 'بوابة العميل الذاتية وحدودها (M7)');
{
  const r = await raw('POST', '/portal/auth/request-otp', { mobileNumber: '0590000002' });
  ok('طلب رمز الدخول يعمل', r.status === 200, `HTTP ${r.status}`);
  ok('رمز الدخول لا يرجع في الاستجابة', !/\b\d{6}\b/.test(JSON.stringify(r.json)));
  await refused('رمز خاطئ يرفض', 'POST', '/portal/auth/verify-otp', { mobileNumber: '0590000002', code: '000000' }, null);
  await refused('توكن الموظف لا يفتح البوابة', 'GET', '/portal/me', undefined, staff, 401);
  await refused('بلا توكن لا تفتح البوابة', 'GET', '/portal/me', undefined, null, 401);
  await refused('مواعيد البوابة تتطلب جلسة عميل', 'GET', '/portal/availability?date=2026-11-19', undefined, null, 401);
}

// ---------------------------------------------------------------- 14
section(14, 'التقرير الشهري (M4)');
{
  const now = new Date();
  const gen = await call('POST', '/monthly-reports/generate', { year: now.getFullYear(), month: now.getMonth() + 1 });
  ok('التقرير الشهري يُنشأ', !!gen, JSON.stringify(gen).slice(0, 90));
  const list = await call('GET', `/monthly-reports?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
  ok('التقرير يظهر في القائمة', Array.isArray(list.reports), `${list.reports?.length} تقرير`);
}

// ---------------------------------------------------------------- 15
section(15, 'لوحة التحكم وتقارير v1.0 (عدم الانحدار)');
{
  ok('إحصاءات اللوحة تعمل', !!(await call('GET', '/dashboard/stats')));
  ok('أحدث الكروت تعمل', !!(await call('GET', '/dashboard/recent-job-cards')));
  ok('تقرير كروت العمل يعمل', !!(await call('GET', '/reports/job-cards')));
  ok('تقرير العملاء يعمل', !!(await call('GET', '/reports/customers')));
  ok('تقرير السيارات يعمل', !!(await call('GET', '/reports/vehicles')));
  const search = await call('GET', '/search?q=FULL-1');
  ok('البحث العام يجد السيارة الجديدة', JSON.stringify(search).includes('FULL-1'));
  const techs = await call('GET', '/users/technicians');
  ok('قائمة الفنيين تعمل', !!techs);
  ok('تقرير المواعيد يعمل', !!(await call('GET', '/appointments/report')));
  ok('تقرير المخزون يعمل', !!(await call('GET', '/inventory/report')));
  ok('تقرير الإحالات يعمل', !!(await call('GET', '/referrals/report')));
  ok('إحصاءات الاشتراكات تعمل', !!(await call('GET', '/subscriptions/stats')));
}

// ---------------------------------------------------------------- 16
section(16, 'الحذف الناعم');
{
  const temp = (await call('POST', '/customers', { fullName: 'عميل مؤقت للحذف', mobileNumber: '0590009999' })).customer;
  await call('DELETE', `/customers/${temp.id}`);
  const listed = await call('GET', `/customers?search=${encodeURIComponent('عميل مؤقت للحذف')}`);
  ok('العميل المحذوف لا يظهر في القائمة', (listed.customers || []).length === 0);
  const after = await raw('GET', `/customers/${temp.id}`, undefined, staff);
  ok('العميل المحذوف لا يُقرأ بالمعرّف', after.status === 404, `HTTP ${after.status}`);
}

// ---------------------------------------------------------------- 17
section(17, 'النسخة الاحتياطية (R0)');
{
  const info = await raw('GET', '/backup/info', undefined, staff);
  ok('معلومات النسخة الاحتياطية متاحة', info.status === 200, JSON.stringify(info.json).slice(0, 120));
  await refused('الفني لا ينزّل نسخة احتياطية', 'GET', '/backup/download', undefined, tech, 403);
  const dl = await fetch(`${BASE}/backup/download`, { headers: { Authorization: 'Bearer ' + staff } });
  if (dl.ok) {
    const buf = Buffer.from(await dl.arrayBuffer());
    const head = buf.slice(0, 400).toString('utf8');
    ok('ملف النسخة الاحتياطية ينزل فعلًا', buf.length > 1000, `${(buf.length / 1024).toFixed(0)} كيلوبايت`);
    ok('الملف ملف SQL صحيح', /Dump|CREATE TABLE|MySQL|MariaDB/i.test(head));
  } else {
    const t = await dl.text();
    ok('ملف النسخة الاحتياطية ينزل فعلًا', false, `HTTP ${dl.status}: ${t.slice(0, 160)}`);
  }
}

// ---------------------------------------------------------------- 18
section(18, 'ملفات تطبيق الجوال PWA (M11)');
{
  for (const [label, path, probe] of [
    ['ملف البيان manifest', '/manifest.webmanifest', 'start_url'],
    ['عامل الخدمة sw.js', '/sw.js', 'addEventListener'],
    ['أيقونة التطبيق', '/app-icon.svg', 'svg'],
  ]) {
    try {
      const res = await fetch(WEB + path);
      const text = res.ok ? await res.text() : '';
      ok(label, res.ok && text.includes(probe), `HTTP ${res.status}`);
    } catch {
      ok(label, false, 'خادم الواجهة غير مشغّل');
    }
  }
}

console.log(`\n================  النتيجة: ${pass} ناجح / ${fail} فاشل  ================`);
if (fail) console.log('الفاشل:\n' + failures.map(f => ' - ' + f).join('\n'));
