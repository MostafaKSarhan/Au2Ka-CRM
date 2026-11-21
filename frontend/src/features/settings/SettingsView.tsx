import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { User, Shield, LogOut, Phone, Save, Users } from 'lucide-react';
import { useTranslation } from '../../store/LanguageContext';

export function SettingsView() {
  const { user, logout } = useAuthStore();
  const { lang, t } = useTranslation();
  const isAdmin = user?.role === 'ADMIN';
  const isRtl = lang === 'ar';

  const ROLE_LABELS: Record<string, string> = {
    ADMIN: t('role_ADMIN'),
    RECEPTION: t('role_RECEPTION'),
    TECHNICIAN: t('role_TECHNICIAN'),
  };

  const ROLE_COLORS: Record<string, string> = {
    ADMIN: 'bg-red-500/10 text-red-400 border-red-500/20',
    RECEPTION: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    TECHNICIAN: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };

  // WhatsApp settings
  const [whatsappNumber, setWhatsappNumber] = useState('201015657091');
  const [saveSuccess, setSaveSuccess] = useState(false);


  useEffect(() => {
    const savedNum = localStorage.getItem('whatsappNumber');
    if (savedNum) setWhatsappNumber(savedNum);
  }, []);

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem('whatsappNumber', whatsappNumber.trim());
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  }

  return (
    <div className={`space-y-6 ${isRtl ? 'text-right' : 'text-left'}`}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">{t('settingsTitle')}</h1>
        <p className="text-sm text-zinc-400">{t('settingsSubtitle')}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Profile Card */}
        <div className="glass-panel rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-zinc-800 pb-2">{lang === 'ar' ? 'ملف المستخدم الحالي' : 'Current User Profile'}</h2>
          {user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`rounded-full bg-primary/20 p-4 text-primary-text ${isRtl ? 'ml-2' : 'mr-2'}`}>
                  <User size={32} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">{user.firstName} {user.lastName}</h3>
                  <p className="text-sm text-zinc-400 font-mono">{user.mobileNumber}</p>
                </div>
              </div>

              <div className="bg-zinc-900/60 rounded-lg p-3 border border-zinc-800 flex items-center justify-between text-sm">
                <span className="text-zinc-500 font-semibold">{t('userRoleLabel')}</span>
                <span className={`rounded border px-2 py-0.5 text-xs font-bold ${ROLE_COLORS[user.role] || ''}`}>
                  {ROLE_LABELS[user.role] || user.role}
                </span>
              </div>

              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-600/90 hover:bg-red-700 py-2.5 text-sm font-semibold text-white transition mt-4 cursor-pointer"
              >
                <LogOut size={16} /> {t('logout')}
              </button>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">{lang === 'ar' ? 'غير مسجل دخول' : 'Not logged in'}</p>
          )}
        </div>

        {/* WhatsApp & Invoice Settings */}
        <div className="glass-panel rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-zinc-800 pb-2 flex items-center gap-2">
            <Phone size={18} className="text-emerald-500" /> {t('whatsappSettingsHeader')}
          </h2>
          <form onSubmit={handleSaveSettings} className={`space-y-4 ${isRtl ? 'text-right' : 'text-left'}`}>
            {saveSuccess && (
              <div className="rounded bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs text-emerald-400 font-bold">
                ✓ {t('settingsSaved')}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">{t('whatsappNumLabel')}</label>
              <input
                type="text"
                required
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder={t('whatsappNumPlaceholder')}
                className="w-full rounded bg-zinc-900 border border-zinc-800 p-2.5 text-sm text-white focus:outline-none font-mono text-left"
                style={{ direction: 'ltr' }}
              />
              <span className="block text-[10px] text-zinc-500 mt-1">{lang === 'ar' ? 'اكتب الرقم مباشرة متضمناً كود الدولة بدون أصفار أو رمز (+) في البداية.' : 'Write the number directly including the country code without zeros or (+) at the beginning.'}</span>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 rounded bg-emerald-600 hover:bg-emerald-700 py-2 text-xs font-bold text-white transition cursor-pointer"
            >
              <Save size={14} /> {t('saveSettingsBtn')}
            </button>
          </form>
        </div>
      </div>

      {/* إدارة الموظفين انتقلت إلى «البيانات الأساسية ← الموظفون»، حيث تضعها
          ورقة طلبات العميل مع الفروع والموديلات والقطع، ومعها بحث وفلترة
          بالفرع والصلاحية. شاشة واحدة بدل شاشتين تتفرّقان مع الوقت. */}
      {isAdmin && (
        <div className="glass-panel rounded-xl p-6">
          <h2 className="mb-2 flex items-center gap-2 border-b border-zinc-800 pb-2 text-lg font-bold text-white">
            <Users size={20} className="text-primary-text" /> {t("usersTab")}
          </h2>
          <p className="text-sm text-zinc-400">
            {lang === "ar"
              ? "إضافة الموظفين وتعديلهم وحذفهم والبحث عنهم صارت في: البيانات الأساسية ← الموظفون."
              : "Adding, editing, deleting and searching employees now lives in: Master data → Employees."}
          </p>
        </div>
      )}

      {/* Roles details */}
      <div className="glass-panel rounded-xl p-6">
        <h2 className="text-lg font-bold text-white border-b border-zinc-800 pb-2 mb-4 flex items-center gap-2">
          <Shield size={18} className="text-accent" /> {lang === 'ar' ? 'جدول صلاحيات الموظفين بالورشة' : 'Workshop Employees Permissions'}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3 text-xs text-zinc-400">
          <div className="p-3 bg-zinc-900/40 rounded border border-zinc-800">
            <p className="font-semibold text-white text-xs">{lang === 'ar' ? 'صلاحية مدير النظام (Admin)' : 'System Admin (Admin)'}</p>
            <p className="text-xs text-zinc-500 mt-1">{lang === 'ar' ? 'له كامل الصلاحيات لإدارة العملاء، تسجيل وتعديل بيانات السيارات، فتح كروت العمل، وتحديث الحالات وحذف البيانات.' : 'Has full access permissions to manage customers, vehicles, create job cards, and delete records.'}</p>
          </div>
          <div className="p-3 bg-zinc-900/40 rounded border border-zinc-800">
            <p className="font-semibold text-white text-xs">{lang === 'ar' ? 'صلاحية الاستقبال (Reception)' : 'Receptionist (Reception)'}</p>
            <p className="text-xs text-zinc-500 mt-1">{lang === 'ar' ? 'مخصص لاستقبال سيارات العملاء، تعبئة بيانات المالك، تسجيل مواصفات السيارة واللوحة، وتصوير الهيكل الخارجي وحفظ كرت الاستقبال.' : 'Dedicated to customer intake, owner registrations, specifying vehicles details, and photographing body condition.'}</p>
          </div>
          <div className="p-3 bg-zinc-900/40 rounded border border-zinc-800">
            <p className="font-semibold text-white text-xs">{lang === 'ar' ? 'صلاحية فني الصيانة (Technician)' : 'Maintenance Tech (Technician)'}</p>
            <p className="text-xs text-zinc-500 mt-1">{lang === 'ar' ? 'عرض كروت العمل النشطة، وتعبئة الفحص الفني الأولي للأعطال، وتحديد القطع المطلوبة للإصلاح وملاحظات الصيانة.' : 'Review active job cards, complete initial technical inspection, choose repairs required, and log remarks.'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
