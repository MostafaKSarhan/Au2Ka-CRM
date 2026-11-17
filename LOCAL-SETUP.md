# تشغيل Au2Ka CRM محليًا

> ملف محلي للتوثيق فقط — غير مرفوع على الجت.

## المتطلبات الموجودة على الجهاز
- Node.js v26
- MariaDB 11.4 المحمولة في `C:\Users\dell\php-stack` (لا توجد خدمة MySQL مثبّتة)

## 1. قاعدة البيانات
```
C:\Users\dell\php-stack\start-db.bat      # تشغيل  (stop-db.bat للإيقاف)
```
- المضيف `127.0.0.1:3306` — المستخدم `root` — كلمة المرور `root`
- اسم القاعدة: `au2ka_crm` (تم إنشاؤها بـ utf8mb4)

## 2. الباك إند (منفذ 5000)
```
cd C:\Au2ka\backend
npm install
npm install-scripts approve prisma @prisma/client @prisma/engines
npx prisma generate
npx prisma db push          # المشروع لا يحتوي مجلد migrations
npm run prisma:seed         # المستخدمون التجريبيون (يحذف المستخدمين الحاليين)
npm run prisma:seed:ref     # بيانات المرحلة الثانية: الدول والمدن والفروع والموديلات والقطع
npm run dev
```
`prisma:seed:ref` آمن للتكرار — بيضيف الناقص بس ومبيمسحش حاجة.

### النسخ الاحتياطي
زر "تنزيل نسخة احتياطية" في لوحة التحكم بيشغّل `mysqldump`. لو مش موجود في الـ PATH
على الخادم، اضبط المتغير `MYSQLDUMP_PATH` في `.env` على مساره الكامل.
ملف `backend/.env` غير مرفوع على الجت (موجود في `.gitignore`) — تم إنشاؤه محليًا،
وهناك نسخة نموذجية منه في `backend/.env.example`.

## 3. الفرونت إند (منفذ 5173)
```
cd C:\Au2ka\frontend
npm install
npm run dev
```
عنوان الـ API مكتوب داخل `frontend/src/lib/api.ts`: على localhost يستخدم
`http://localhost:5000` تلقائيًا، وفي غير ذلك `https://api-crm.au2ka.cloud`.

## 4. حسابات الدخول التجريبية (من `prisma/seed.ts`)
| الدور | رقم الجوال | كلمة المرور |
|---|---|---|
| مدير النظام | 0500000001 | admin123 |
| استقبال | 0500000002 | reception123 |
| فني | 0500000003 | tech123 |
