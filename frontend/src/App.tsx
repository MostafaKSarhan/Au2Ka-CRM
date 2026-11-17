import React, { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { useTranslation } from './store/LanguageContext';
import { LoginView } from './features/auth/LoginView';
import { DashboardView } from './features/dashboard/DashboardView';
import { CustomersView } from './features/customers/CustomersView';
import { VehiclesView } from './features/vehicles/VehiclesView';
import { JobCardsView } from './features/jobCards/JobCardsView';
import { SettingsView } from './features/settings/SettingsView';
import { ReportsView } from './features/reports/ReportsView';
import { MasterDataView } from './features/admin/MasterDataView';
import { SubscriptionsView } from './features/subscriptions/SubscriptionsView';
import { PublicVehicleFile } from './features/vehicleFile/PublicVehicleFile';
import { CustomerPortal } from './features/portal/CustomerPortal';
import { MessagesView } from './features/messaging/MessagesView';
import { NotificationBell } from './features/messaging/NotificationBell';
import { MonthlyReportsView } from './features/inspections/MonthlyReportsView';
import { AppointmentsView } from './features/appointments/AppointmentsView';
import { ReferralsView } from './features/referrals/ReferralsView';
import { InventoryView } from './features/inventory/InventoryView';
import { Shield, LayoutDashboard, Users, Car, Wrench, Settings, LogOut, User, Menu, X, BarChart4, Database, BadgeCheck, MessageSquare, FileBarChart, CalendarDays, Gift, Boxes } from 'lucide-react';

export default function App() {
  const { isAuthenticated, initialize, user, logout } = useAuthStore();
  const { lang, setLang, t } = useTranslation();
  const isTechnician = user?.role === 'TECHNICIAN';
  const [activeTab, setActiveTab] = useState<'dashboard' | 'customers' | 'vehicles' | 'jobCards' | 'settings' | 'reports' | 'masterData' | 'subscriptions' | 'messages' | 'monthlyReports' | 'appointments' | 'referrals' | 'inventory'>(
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
    return <PublicVehicleFile token={shareToken} />;
  }

  // A referral link lands on the portal too — the code is shown to the
  // customer so reception can record who referred them.
  if (isPortal || referralCode) {
    return <CustomerPortal />;
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
    { id: 'inventory', label: t('inventory'), icon: Boxes, roles: ['ADMIN', 'RECEPTION', 'TECHNICIAN'] },
    { id: 'referrals', label: t('referrals'), icon: Gift, roles: ['ADMIN', 'RECEPTION'] },
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
              <div className="rounded-lg bg-primary/20 p-2 text-primary">
                <Shield size={22} />
              </div>
              <span className="font-black tracking-wider text-xl">Au<span className="text-primary">2</span>Ka</span>
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
            <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-center text-right">
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
              <Shield size={20} className="text-primary" />
              <span className="font-black text-base text-white">Au<span className="text-primary">2</span>Ka</span>
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
              🌐 {lang === 'ar' ? 'English' : 'العربية'}
            </button>

            {/* User Role Tag */}
            <span className="rounded-md bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-xs font-bold text-zinc-400">
              {t('userRole')}: <span className="text-primary">
                {user?.role === 'ADMIN' ? t('adminRole') : user?.role === 'RECEPTION' ? t('receptionShort') : t('technicianShort')}
              </span>
            </span>
          </div>
        </header>

        {/* Dynamic Inner Page Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {activeTab === 'dashboard' && !isTechnician && <DashboardView onNavigate={(tab) => setActiveTab(tab)} />}
          {activeTab === 'customers' && !isTechnician && <CustomersView />}
          {activeTab === 'vehicles' && !isTechnician && <VehiclesView />}
          {activeTab === 'jobCards' && <JobCardsView />}
          {activeTab === 'appointments' && !isTechnician && <AppointmentsView />}
          {activeTab === 'subscriptions' && !isTechnician && <SubscriptionsView />}
          {activeTab === 'inventory' && <InventoryView />}
          {activeTab === 'referrals' && !isTechnician && <ReferralsView />}
          {activeTab === 'messages' && !isTechnician && <MessagesView />}
          {activeTab === 'monthlyReports' && !isTechnician && <MonthlyReportsView />}
          {activeTab === 'reports' && !isTechnician && <ReportsView />}
          {activeTab === 'masterData' && user?.role === 'ADMIN' && <MasterDataView />}
          {activeTab === 'settings' && !isTechnician && <SettingsView />}
        </main>
      </div>
    </div>
  );
}

