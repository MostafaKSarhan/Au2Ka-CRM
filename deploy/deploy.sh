#!/usr/bin/env bash
#
# نشر Au2Ka CRM — يُشغَّل على الخادم من داخل مجلد المشروع.
#
#   cd /var/www/faslatech/Au2Ka-CRM && sudo -u www-data bash deploy/deploy.sh
#
# ما يفعله: يأخذ نسخة احتياطية، يسحب آخر كود، يثبّت الحزم، يحدّث مخطط
# قاعدة البيانات، يبني الطرفين، ثم يعيد تشغيل الخدمة.
#
# المشروع بلا مجلد prisma/migrations، فتحديث المخطط بـ `prisma db push`
# لا بـ `migrate deploy`. وكل أعمدة المرحلة الثانية اختيارية، فالبيانات
# القائمة لا تتأثر — والنسخة الاحتياطية أول خطوة على أي حال.

set -euo pipefail

BRANCH="${BRANCH:-main}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/../backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"

cd "$ROOT"
echo "==> المشروع: $ROOT (الفرع $BRANCH)"

# 1) نسخة احتياطية قبل أي شيء
echo "==> نسخة احتياطية لقاعدة البيانات"
mkdir -p "$BACKUP_DIR"
DB_URL="$(grep -E '^DATABASE_URL=' backend/.env | head -1 | cut -d= -f2- | tr -d '"')"
if [[ -n "$DB_URL" ]]; then
  # mysql://user:pass@host:port/db
  DB_USER="$(sed -E 's|^mysql://([^:]+):.*|\1|' <<<"$DB_URL")"
  DB_PASS="$(sed -E 's|^mysql://[^:]+:([^@]*)@.*|\1|' <<<"$DB_URL")"
  DB_HOST="$(sed -E 's|^mysql://[^@]+@([^:/]+).*|\1|' <<<"$DB_URL")"
  DB_NAME="$(sed -E 's|.*/([^/?]+)(\?.*)?$|\1|' <<<"$DB_URL")"
  # كلمة المرور عبر البيئة لا عبر سطر الأوامر، حتى لا تظهر في قائمة العمليات
  MYSQL_PWD="$DB_PASS" mysqldump -h "$DB_HOST" -u "$DB_USER" \
    --single-transaction --routines --default-character-set=utf8mb4 \
    "$DB_NAME" | gzip > "$BACKUP_DIR/au2ka-$STAMP.sql.gz"
  echo "    حُفظت في $BACKUP_DIR/au2ka-$STAMP.sql.gz"
else
  echo "!!! لم يُقرأ DATABASE_URL من backend/.env — توقّف" >&2
  exit 1
fi

# 2) الكود
echo "==> سحب الكود"
git fetch --all --prune
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

# 3) الباكند
echo "==> الباكند: الحزم والمخطط والبناء"
npm ci --prefix backend --omit=dev --include=dev
npx --prefix backend prisma generate
npx --prefix backend prisma db push
npm run build --prefix backend

# 4) البيانات المرجعية (قابل لإعادة التشغيل، لا يكرّر ولا يمسح)
echo "==> البيانات المرجعية"
npm run prisma:seed:ref --prefix backend

# 5) الواجهة
echo "==> الواجهة: الحزم والبناء"
npm ci --prefix frontend
npm run build --prefix frontend

# 6) التشغيل
echo "==> إعادة تشغيل الخدمة"
sudo systemctl restart au2ka-api
sleep 3
sudo systemctl is-active --quiet au2ka-api && echo "    الخدمة تعمل" || {
  echo "!!! الخدمة لم تعمل — journalctl -u au2ka-api -n 50" >&2
  exit 1
}

# 7) تحقق سريع
echo "==> فحص الصحة"
curl -fsS http://127.0.0.1:5123/health && echo

echo "==> تم. للتحقق الشامل بعد النشر:"
echo "    API_URL=https://au2ka.fasla.cloud WEB_URL=https://au2ka.fasla.cloud \\"
echo "      npm run check:system --prefix backend"
echo "    (يكتب بيانات اختبار — شغّله قبل تسليم النظام للعميل، ثم check:reset)"
