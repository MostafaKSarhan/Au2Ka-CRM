# تشغيل Au2Ka كاملًا على جهاز واحد — قاعدة البيانات ثم الباكند ثم الواجهة.
#
#   .\start.bat
#
# السكربت لا يفترض أن شيئًا جاهز: يفحص كل خطوة ويفعل الناقص فقط، فتشغيله
# مرة ثانية لا يعيد التثبيت ولا يمسح بيانات.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

function Step($text) { Write-Host "==> $text" -ForegroundColor Cyan }
function Ok($text)   { Write-Host "    $text" -ForegroundColor Green }
function Warn($text) { Write-Host "    $text" -ForegroundColor Yellow }
function Die($text)  { Write-Host "!!! $text" -ForegroundColor Red; exit 1 }

function Test-Port($port) {
  $client = New-Object Net.Sockets.TcpClient
  try { $client.Connect('127.0.0.1', $port); return $true }
  catch { return $false }
  finally { $client.Dispose() }
}

function Wait-Port($port, $seconds, $what) {
  for ($i = 0; $i -lt $seconds; $i++) {
    if (Test-Port $port) { return }
    Start-Sleep -Seconds 1
  }
  Die "$what لم يستجب على المنفذ $port خلال $seconds ثانية"
}

# npm و npx يقبلان --prefix لكنهما لا يغيّران مجلد العمل، و Prisma يبحث عن
# المخطط في مجلد العمل وحده: بدون هذا يفشل db push بصمت ويظن السكربت أنه نجح.
function Invoke-InBackend($command, $arguments) {
  Push-Location (Join-Path $root 'backend')
  try {
    & $command @arguments
    if ($LASTEXITCODE -ne 0) { Die "فشل: $command $($arguments -join ' ')" }
  } finally { Pop-Location }
}

Write-Host ""
Write-Host "  Au2Ka — تشغيل محلي" -ForegroundColor White
Write-Host "  $root"
Write-Host ""

# ---------------------------------------------------------------- Node
Step "فحص Node.js"
try { $nodeVersion = (node --version) } catch { Die "Node.js غير مثبّت. حمّله من https://nodejs.org" }
Ok "Node $nodeVersion"

# ---------------------------------------------------------------- قاعدة البيانات
Step "قاعدة البيانات على المنفذ 3306"
if (Test-Port 3306) {
  Ok "تعمل بالفعل"
} else {
  # AU2KA_DB_START يشير لسكربت تشغيل قاعدة البيانات على هذا الجهاز.
  # على جهاز التطوير الحالي هي MariaDB محمولة لا خدمة مثبّتة.
  $dbStart = $env:AU2KA_DB_START
  if (-not $dbStart) { $dbStart = "$env:USERPROFILE\php-stack\start-db.bat" }

  if (Test-Path $dbStart) {
    Warn "لا تعمل — تشغيل $dbStart"
    Start-Process -FilePath $dbStart -WindowStyle Minimized
    Wait-Port 3306 30 "قاعدة البيانات"
    Ok "عملت"
  } else {
    Die @"
قاعدة البيانات لا تعمل ولم أجد سكربت تشغيلها.
شغّل MariaDB/MySQL يدويًا على 127.0.0.1:3306، أو اضبط المسار:
  `$env:AU2KA_DB_START = 'C:\path\to\start-db.bat'
"@
  }
}

# ---------------------------------------------------------------- ملف البيئة
Step "ملف إعدادات الباكند"
$envFile = Join-Path $root 'backend\.env'
if (Test-Path $envFile) {
  Ok "backend\.env موجود"
} else {
  Warn "backend\.env غير موجود — إنشاؤه بإعدادات التطوير"
  $secret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
  @"
DATABASE_URL="mysql://root:root@127.0.0.1:3306/au2ka_crm"
JWT_SECRET="$secret"
PORT=5000
HOST=0.0.0.0
NODE_ENV=development
"@ | Set-Content -Path $envFile -Encoding utf8
  Ok "أُنشئ بمفتاح جلسات جديد"
}

# ---------------------------------------------------------------- الحزم
Step "حزم الباكند"
if (Test-Path (Join-Path $root 'backend\node_modules\@prisma\client')) {
  Ok "مثبّتة"
} else {
  Warn "تثبيت (يأخذ دقائق أول مرة)"
  npm install --prefix "$root\backend"
  # npm هنا يمنع سكربتات التثبيت افتراضيًا، و Prisma يحتاجها لتحميل محركه
  npm install-scripts approve prisma '@prisma/client' '@prisma/engines' --prefix "$root\backend" 2>$null
  npm install --prefix "$root\backend"
}

Step "حزم الواجهة"
if (Test-Path (Join-Path $root 'frontend\node_modules\vite')) {
  Ok "مثبّتة"
} else {
  Warn "تثبيت"
  npm install --prefix "$root\frontend"
}

# ---------------------------------------------------------------- المخطط والبيانات
Step "مخطط قاعدة البيانات"
# توليد عميل Prisma يستبدل ملف محرك الاستعلام، والباكند العامل يمسك هذا الملف
# فيفشل الاستبدال بـ EPERM. وما دام الباكند يعمل فالعميل مولّد أصلًا.
if (Test-Port 5000) {
  Warn "الباكند يعمل — تخطّي توليد عميل Prisma"
} else {
  Invoke-InBackend 'npx' @('prisma', 'generate')
}

# المشروع بلا prisma/migrations، فالتحديث دائمًا db push لا migrate.
# --skip-generate لا يلمس ملف المحرك، فيعمل والباكند شغّال.
Invoke-InBackend 'npx' @('prisma', 'db', 'push', '--skip-generate')
Ok "محدّث"

Step "بيانات الدخول والبيانات المرجعية"
$usersJs = @'
const { PrismaClient } = require('@prisma/client');
new PrismaClient().user.count().then(n => { console.log(n); process.exit(0); })
  .catch(() => { console.log(0); process.exit(0); });
'@
$probe = Join-Path $root 'backend\_probe.tmp.js'
Set-Content -Path $probe -Value $usersJs -Encoding utf8
Push-Location "$root\backend"
$userCount = (node _probe.tmp.js | Select-Object -Last 1).Trim()
Pop-Location
Remove-Item $probe -Force

if ($userCount -eq '0') {
  Warn "لا يوجد مستخدمون — زرع حسابات التجربة"
  npm run prisma:seed --prefix "$root\backend"
} else {
  Ok "$userCount مستخدم موجود (لم يُمَس)"
}
npm run prisma:seed:ref --prefix "$root\backend"

# ---------------------------------------------------------------- التشغيل
Step "تشغيل الباكند على 5000"
if (Test-Port 5000) {
  Ok "يعمل بالفعل"
} else {
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "title Au2Ka API & npm run dev --prefix `"$root\backend`""
  Wait-Port 5000 60 "الباكند"
  Ok "عمل"
}

Step "تشغيل الواجهة على 5173"
if (Test-Port 5173) {
  Ok "تعمل بالفعل"
} else {
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "title Au2Ka Web & npm run dev --prefix `"$root\frontend`""
  Wait-Port 5173 60 "الواجهة"
  Ok "عملت"
}

Write-Host ""
Write-Host "  النظام يعمل" -ForegroundColor Green
Write-Host ""
Write-Host "  لوحة التحكم    http://localhost:5173"
Write-Host "  بوابة العميل   http://localhost:5173/?portal=1"
Write-Host "  الـ API        http://localhost:5000"
Write-Host ""
Write-Host "  الدخول:" -ForegroundColor White
Write-Host "    مدير النظام   0500000001   admin123"
Write-Host "    الاستقبال     0500000002   reception123"
Write-Host "    فني           0500000003   tech123"
Write-Host ""
Write-Host "  للإيقاف: أغلق نافذتي Au2Ka API و Au2Ka Web" -ForegroundColor DarkGray
Write-Host ""

Start-Process 'http://localhost:5173'
