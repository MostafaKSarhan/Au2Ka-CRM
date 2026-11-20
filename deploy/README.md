# النشر — Au2Ka CRM

## أين يعمل النظام الآن

النظام منشور على **خادم FaslaTech** على `au2ka.fasla.cloud`، وهذا ترتيب مؤقت
يستمر حتى سداد كامل مستحقات المشروع، ثم يُنقل إلى خادم العميل بعد تأكيد
الاستلام. التفصيل في [الاستضافة-والتسليم.md](../docs/الاستضافة-والتسليم.md).

النقل نفسه لا يحتاج أي تعديل في الكود: الواجهة تنادي نفس العنوان الذي
قُدِّمت منه، فيكفي تغيير اسم النطاق في ملف nginx وإعادة تشغيل الخطوات
نفسها على الخادم الجديد.

## ما في هذا المجلد

| الملف | الغرض |
|---|---|
| `deploy.sh` | النشر كاملًا: نسخة احتياطية، سحب الكود، تثبيت، تحديث المخطط، بناء، إعادة تشغيل |
| `nginx/au2ka.fasla.cloud.conf` | الموقع: يقدّم الواجهة ويمرّر `/api/` و `/uploads/` للباكند |
| `nginx/au2ka-api.fasla.cloud.conf` | نطاق مستقل للـ API — اختياري، غير مستخدم في الإعداد الافتراضي |
| `systemd/au2ka-api.service` | خدمة الباكند، تعمل من `dist/` لا من `ts-node` |
| `.env.production.example` | قالب بيئة الإنتاج — يُنسخ إلى `backend/.env` ويُملأ على الخادم |

## متطلبات الخادم

- Ubuntu 22.04 أو أحدث
- Node.js 20 أو أحدث، و npm
- MariaDB 10.6 أو أحدث (أو MySQL 8)
- nginx، و certbot لشهادة HTTPS
- `mysqldump` متاح في PATH (يستخدمه زر النسخة الاحتياطية داخل النظام)

## أول تركيب

```bash
# 1) الكود
sudo mkdir -p /var/www/faslatech && cd /var/www/faslatech
sudo git clone https://github.com/MostafaKSarhan/Au2Ka-CRM.git
sudo chown -R www-data:www-data Au2Ka-CRM
cd Au2Ka-CRM
```

```bash
# 2) قاعدة البيانات ومستخدم خاص بالتطبيق (لا root)
sudo mysql -e "CREATE DATABASE au2ka_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'au2ka'@'127.0.0.1' IDENTIFIED BY 'كلمة-مرور-قوية';"
sudo mysql -e "GRANT ALL PRIVILEGES ON au2ka_crm.* TO 'au2ka'@'127.0.0.1'; FLUSH PRIVILEGES;"
```

```bash
# 3) ملف البيئة — صلاحياته 600، ومفتاح JWT يُولَّد ولا يُنسخ
sudo install -o www-data -g www-data -m 600 deploy/.env.production.example backend/.env
openssl rand -base64 48        # ضع الناتج في JWT_SECRET
sudo -u www-data nano backend/.env
```

```bash
# 4) الحزم والمخطط والبناء
sudo -u www-data npm ci --prefix backend
sudo -u www-data npx --prefix backend prisma generate
sudo -u www-data npx --prefix backend prisma db push
sudo -u www-data npm run build --prefix backend
sudo -u www-data npm ci --prefix frontend
sudo -u www-data npm run build --prefix frontend
```

> المشروع بلا مجلد `prisma/migrations`، فتحديث المخطط دائمًا بـ `prisma db push`
> لا بـ `migrate deploy`.

```bash
# 5) البيانات المرجعية ثم مستخدمو النظام
sudo -u www-data npm run prisma:seed:ref --prefix backend
```

`prisma:seed:ref` يزرع البيانات المرجعية فقط (المدن، الفرع الرئيسي، كتالوج
الموديلات، قطع الغيار، الباقات، بنود الفحص، قوالب الرسائل) وهو قابل لإعادة
التشغيل بلا تكرار.

> **لا تشغّل `npm run prisma:seed` على الإنتاج.** هذا بذر التطوير: يمسح جدول
> المستخدمين ويزرع ثلاثة حسابات بكلمات مرور معروفة. أنشئ حساب المدير الأول
> يدويًا، أو شغّله مرة واحدة على نظام فارغ ثم غيّر كلمات المرور فورًا قبل أن
> يصل أحد إلى الموقع.

```bash
# 6) الخدمة
sudo cp deploy/systemd/au2ka-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now au2ka-api
sudo systemctl status au2ka-api
```

```bash
# 7) nginx و HTTPS
sudo cp deploy/nginx/au2ka.fasla.cloud.conf /etc/nginx/sites-available/au2ka
sudo ln -s /etc/nginx/sites-available/au2ka /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d au2ka.fasla.cloud
```

شهادة HTTPS ليست رفاهية هنا: تطبيق الجوال (PWA) لا يُثبَّت ولا يعمل عامل
الخدمة إلا على HTTPS، وكاميرا رفع الصور كذلك.

## التحديث بعد ذلك

```bash
cd /var/www/faslatech/Au2Ka-CRM && sudo -u www-data bash deploy/deploy.sh
```

السكربت يأخذ نسخة احتياطية مضغوطة قبل أي تغيير ويضعها في `../backups/`.

## التحقق بعد النشر

```bash
API_URL=https://au2ka.fasla.cloud WEB_URL=https://au2ka.fasla.cloud \
  npm run check:system --prefix backend
```

107 تحقق على النظام المنشور فعلًا. **ينشئ بيانات اختبار**، فيُشغَّل قبل تسليم
النظام للعميل، ثم:

```bash
npm run check:reset --prefix backend     # يمسح بيانات الاختبار ويبقي المرجعية
```

## النسخ الاحتياطي الدوري

داخل النظام زر لتنزيل نسخة كاملة من لوحة التحكم (للمدير فقط). وعلى الخادم،
نسخة يومية تلقائية:

```bash
sudo crontab -e
# 0 3 * * * cd /var/www/faslatech/Au2Ka-CRM && MYSQL_PWD='...' mysqldump -u au2ka --single-transaction au2ka_crm | gzip > /var/www/faslatech/backups/daily-$(date +\%F).sql.gz
```

## النقل إلى خادم العميل لاحقًا

1. نسخة احتياطية كاملة من الخادم الحالي.
2. تنفيذ خطوات «أول تركيب» أعلاه على خادم العميل بنطاقه هو.
3. استيراد النسخة الاحتياطية بدل البذر: `gunzip < backup.sql.gz | mysql -u au2ka au2ka_crm`.
4. تغيير `server_name` في ملف nginx إلى نطاق العميل وإصدار شهادته.
5. تشغيل `check:system` على الخادم الجديد، ثم `check:reset`.
6. تحديث رابط الـ Webhook في Meta ليشير للنطاق الجديد.
7. إبقاء الخادم القديم يعمل أيامًا للطوارئ، ثم إيقافه.

لا شيء في الكود يحمل اسم نطاق، فلا توجد خطوة ثامنة.
