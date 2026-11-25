import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { useTranslation } from './store/LanguageContext';
import { LoginView } from './features/auth/LoginView';
import { PwaBanner } from './features/pwa/PwaBanner';
import { NotificationBell } from './features/messaging/NotificationBell';
import { UserPlus, Globe, Shield, LayoutDashboard, Users, Car, Wrench, Settings, LogOut, User, Menu, X, BarChart4, Database, BadgeCheck, MessageSquare, FileBarChart, CalendarDays, Gift, Boxes, Receipt as ReceiptIcon } from 'lucide-react';

/**
 * كل شاشة تُحمَّل عند فتحها لا عند فتح النظام.
 *
 * كانت الحزمة ملفًا واحدًا يقارب 1.4 ميجابايت يحمّله الموظف كاملًا قبل أن
 * يرى شاشة الدخول: مكتبة الرسوم البيانية ومكتبة تصوير الكروت ورموز QR
 * وكل الشاشات الأربع عشرة. والنظام يُستعمل على تابلت داخل الورشة، وعلى
 * شبكة الجوال كان ذلك انتظارًا بلا سبب.
 */
const DashboardView = lazy(() => import('./features/dashboard/DashboardView').then(m => ({ default: m.DashboardView })));
const CustomersView = lazy(() => import('./features/customers/CustomersView').then(m => ({ default: m.CustomersView })));
const VehiclesView = lazy(() => import('./features/vehicles/VehiclesView').then(m => ({ default: m.VehiclesView })));
const JobCardsView = lazy(() => import('./features/jobCards/JobCardsView').then(m => ({ default: m.JobCardsView })));
const SettingsView = lazy(() => import('./features/settings/SettingsView').then(m => ({ default: m.SettingsView })));
const ReportsView = lazy(() => import('./features/reports/ReportsView').then(m => ({ default: m.ReportsView })));
const MasterDataView = lazy(() => import('./features/admin/MasterDataView').then(m => ({ default: m.MasterDataView })));
const SubscriptionsView = lazy(() => import('./features/subscriptions/SubscriptionsView').then(m => ({ default: m.SubscriptionsView })));
const PublicVehicleFile = lazy(() => import('./features/vehicleFile/PublicVehicleFile').then(m => ({ default: m.PublicVehicleFile })));
const CustomerPortal = lazy(() => import('./features/portal/CustomerPortal').then(m => ({ default: m.CustomerPortal })));
const MessagesView = lazy(() => import('./features/messaging/MessagesView').then(m => ({ default: m.MessagesView })));
const MonthlyReportsView = lazy(() => import('./features/inspections/MonthlyReportsView').then(m => ({ default: m.MonthlyReportsView })));
const AppointmentsView = lazy(() => import('./features/appointments/AppointmentsView').then(m => ({ default: m.AppointmentsView })));
const ReferralsView = lazy(() => import('./features/referrals/ReferralsView').then(m => ({ default: m.ReferralsView })));
const JoinRequestsView = lazy(() => import('./features/joinRequests/JoinRequestsView').then(m => ({ default: m.JoinRequestsView })));
const InventoryView = lazy(() => import('./features/inventory/InventoryView').then(m => ({ default: m.InventoryView })));
const InvoicesView = lazy(() => import('./features/zatca/InvoicesView').then(m => ({ default: m.InvoicesView })));

/** ما يظهر بينما تُجلب الشاشة — ومضة قصيرة لا شاشة فارغة. */
function ScreenLoading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-primary" />
    </div>
  );
}

export default function App() {
  const { isAuthenticated, initialize, user, logout } = useAuthStore();
  const { lang, setLang, t } = useTranslation();
  const isTechnician = user?.role === 'TECHNICIAN';
  const [activeTab, setActiveTab] = useState<'dashboard' | 'customers' | 'vehicles' | 'jobCards' | 'settings' | 'reports' | 'masterData' | 'subscriptions' | 'messages' | 'monthlyReports' | 'appointments' | 'referrals' | 'inventory' | 'invoices' | 'joinRequests'>(
    isTechnician ? 'jobCards' : 'dashboard'
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // M3 and M7 — the shared vehicle file and the customer portal both open
  // without a staff login, so they are matched before anything else and the
  // staff session is never initialised for them.
  const params = new URLSearchParams(window.location.search);
  const shareToken = params.get('file');
  const isPortal = params.get('portal') === '1';
  const referralCode = params.get('ref');

  useEffect(() => {
    if (!shareToken && !isPortal) initialize();
  }, [shareToken, isPortal]);

  // When user role is resolved after initialization, redirect technician to jobCards
  useEffect(() => {
    if (user?.role === 'TECHNICIAN') {
      setActiveTab('jobCards');
    }
  }, [user?.role]);

  if (shareToken) {
    return (
      <Suspense fallback={<ScreenLoading />}>
        <PublicVehicleFile token={shareToken} />
      </Suspense>
    );
  }

  // A referral link lands on the portal too — the code is shown to the
  // customer so reception can record who referred them.
  if (isPortal || referralCode) {
    return (
      <Suspense fallback={<ScreenLoading />}>
        <CustomerPortal />
      </Suspense>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  const allMenuItems = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard, roles: ['ADMIN', 'RECEPTION'] },
    { id: 'customers', label: t('customers'), icon: Users, roles: ['ADMIN', 'RECEPTION'] },
    { id: 'vehicles', label: t('vehicles'), icon: Car, roles: ['ADMIN', 'RECEPTION'] },
    { id: 'jobCards', label: t('jobCards'), icon: Wrench, roles: ['ADMIN', 'RECEPTION', 'TECHNICIAN'] },
    { id: 'appointments', label: t('appointments'), icon: CalendarDays, roles: ['ADMIN', 'RECEPTION'] },
    { id: 'subscriptions', label: t('subscriptions'), icon: BadgeCheck, roles: ['ADMIN', 'RECEPTION'] },
    { id: 'invoices', label: t('invoices'), icon: ReceiptIcon, roles: ['ADMIN', 'RECEPTION'] },
    { id: 'inventory', label: t('inventory'), icon: Boxes, roles: ['ADMIN', 'RECEPTION', 'TECHNICIAN'] },
    { id: 'referrals', label: t('referrals'), icon: Gift, roles: ['ADMIN', 'RECEPTION'] },
    { id: 'joinRequests', label: t('jr_title'), icon: UserPlus, roles: ['ADMIN', 'RECEPTION'] },
    { id: 'messages', label: t('messages'), icon: MessageSquare, roles: ['ADMIN', 'RECEPTION'] },
    { id: 'monthlyReports', label: t('monthlyReports'), icon: FileBarChart, roles: ['ADMIN', 'RECEPTION'] },
    { id: 'reports', label: t('reports'), icon: BarChart4, roles: ['ADMIN', 'RECEPTION'] },
    { id: 'masterData', label: t('masterData'), icon: Database, roles: ['ADMIN'] },
    { id: 'settings', label: t('settings'), icon: Settings, roles: ['ADMIN'] },
  ];

  const menuItems = allMenuItems.filter(item => item.roles.includes(user?.role || ''));

  return (
    <div 
      className="flex min-h-screen bg-background text-zinc-100 relative overflow-hidden" 
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Mobile/Tablet Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)} 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Layout */}
      <aside 
        className={`fixed inset-y-0 z-50 w-64 bg-zinc-950 flex flex-col justify-between transition-all duration-300 lg:static ${
          lang === 'ar' 
            ? `border-l border-zinc-900 lg:right-auto ${isSidebarOpen ? 'right-0' : '-right-64'}`
            : `border-r border-zinc-900 lg:left-auto ${isSidebarOpen ? 'left-0' : '-left-64'}`
        }`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/20 p-2 text-primary-text">
                <Shield size={22} />
              </div>
              <span className="font-black tracking-wider text-xl">Au<span className="text-primary-text">2</span>Ka</span>
            </div>
            {/* Close button for mobile/tablet */}
            <button 
              onClick={() => setIsSidebarOpen(false)} 
              className="p-1 text-zinc-400 hover:text-white lg:hidden cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Technician notice badge */}
          {isTechnician && (
            <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-center">
              <p className="text-[11px] font-bold text-amber-400">{t('techMode')}</p>
              <p className="text-[10px] text-amber-300/70 mt-0.5">{t('techScope')}</p>
            </div>
          )}

          <nav className="mt-8 space-y-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setIsSidebarOpen(false); // Auto close on navigation
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                    activeTab === item.id
                      ? 'bg-primary text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Footer Profile in Sidebar */}
        {user && (
          <div className="p-4 border-t border-zinc-900/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-full bg-zinc-900 p-2 text-zinc-400">
                <User size={16} />
              </div>
              <div className="overflow-hidden text-right">
                <p className="text-xs font-bold text-white truncate">{user.firstName} {user.lastName}</p>
                <p className="text-[10px] text-zinc-500 truncate">
                  {user.role === 'ADMIN' ? t('adminRole') : user.role === 'RECEPTION' ? t('receptionRole') : t('technicianRole')}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className={`text-zinc-500 hover:text-red-400 transition cursor-pointer ${lang === 'ar' ? 'rotate-180' : ''}`}
              title={t('logout')}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <PwaBanner />

        {/* backdrop-blur creates a stacking context, so the header needs its own
            z-index for the notifications dropdown to sit above the page. */}
        <header className="relative z-30 h-16 border-b border-zinc-900 flex items-center justify-between px-6 bg-zinc-950/60 backdrop-blur-md">
          {/* Mobile/Tablet hamburger & logo trigger */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="p-1.5 text-zinc-400 hover:text-white lg:hidden cursor-pointer"
              aria-label="Menu"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <Shield size={20} className="text-primary-text" />
              <span className="font-black text-base text-white">Au<span className="text-primary-text">2</span>Ka</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* In-system alerts (M6) */}
            <NotificationBell />

            {/* Language Switcher */}
            <button
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold text-zinc-300 hover:text-white cursor-pointer transition"
            >
              <Globe size={13} /> {lang === 'ar' ? 'English' : 'العربية'}
            </button>

            {/* User Role Tag */}
            <span className="rounded-md bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-xs font-bold text-zinc-400">
              {t('userRole')}: <span className="text-primary-text">
                {user?.role === 'ADMIN' ? t('adminRole') : user?.role === 'RECEPTION' ? t('receptionShort') : t('technicianShort')}
              </span>
            </span>
          </div>
        </header>

        {/* Dynamic Inner Page Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <Suspense fallback={<ScreenLoading />}>
          {activeTab === 'dashboard' && !isTechnician && <DashboardView onNavigate={(tab) => setActiveTab(tab)} />}
          {activeTab === 'customers' && !isTechnician && <CustomersView />}
          {activeTab === 'vehicles' && !isTechnician && <VehiclesView />}
          {activeTab === 'jobCards' && <JobCardsView />}
          {activeTab === 'appointments' && !isTechnician && <AppointmentsView />}
          {activeTab === 'subscriptions' && !isTechnician && <SubscriptionsView />}
          {activeTab === 'invoices' && !isTechnician && <InvoicesView />}
          {activeTab === 'inventory' && <InventoryView />}
          {activeTab === 'referrals' && !isTechnician && <ReferralsView />}
          {activeTab === 'joinRequests' && !isTechnician && <JoinRequestsView />}
          {activeTab === 'messages' && !isTechnician && <MessagesView />}
          {activeTab === 'monthlyReports' && !isTechnician && <MonthlyReportsView />}
          {activeTab === 'reports' && !isTechnician && <ReportsView />}
          {activeTab === 'masterData' && user?.role === 'ADMIN' && <MasterDataView />}
          {activeTab === 'settings' && !isTechnician && <SettingsView />}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

