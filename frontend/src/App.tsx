import React, { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { LoginView } from './features/auth/LoginView';
import { DashboardView } from './features/dashboard/DashboardView';
import { CustomersView } from './features/customers/CustomersView';
import { VehiclesView } from './features/vehicles/VehiclesView';
import { JobCardsView } from './features/jobCards/JobCardsView';
import { SettingsView } from './features/settings/SettingsView';
import { ReportsView } from './features/reports/ReportsView';
import { Shield, LayoutDashboard, Users, Car, Wrench, Settings, LogOut, User, Menu, X, BarChart4 } from 'lucide-react';

export default function App() {
  const { isAuthenticated, initialize, user, logout } = useAuthStore();
  const isTechnician = user?.role === 'TECHNICIAN';
  const [activeTab, setActiveTab] = useState<'dashboard' | 'customers' | 'vehicles' | 'jobCards' | 'settings' | 'reports'>(
    isTechnician ? 'jobCards' : 'dashboard'
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    initialize();
  }, []);

  // When user role is resolved after initialization, redirect technician to jobCards
  useEffect(() => {
    if (user?.role === 'TECHNICIAN') {
      setActiveTab('jobCards');
    }
  }, [user?.role]);

  if (!isAuthenticated) {
    return <LoginView />;
  }

  const allMenuItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, roles: ['ADMIN', 'RECEPTION'] },
    { id: 'customers', label: 'معلومات العملاء', icon: Users, roles: ['ADMIN', 'RECEPTION'] },
    { id: 'vehicles', label: 'معلومات السيارات', icon: Car, roles: ['ADMIN', 'RECEPTION'] },
    { id: 'jobCards', label: 'كروت استقبال السيارات', icon: Wrench, roles: ['ADMIN', 'RECEPTION', 'TECHNICIAN'] },
    { id: 'reports', label: 'التقارير والإحصائيات', icon: BarChart4, roles: ['ADMIN', 'RECEPTION'] },
    { id: 'settings', label: 'الإعدادات والمستخدمين', icon: Settings, roles: ['ADMIN'] },
  ];

  const menuItems = allMenuItems.filter(item => item.roles.includes(user?.role || ''));

  return (
    <div className="flex min-h-screen bg-background text-zinc-100 relative overflow-hidden" dir="rtl">
      {/* Mobile/Tablet Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)} 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Layout */}
      <aside 
        className={`fixed inset-y-0 z-50 w-64 border-l border-zinc-900 bg-zinc-950 flex flex-col justify-between transition-all duration-300 lg:static lg:right-auto ${
          isSidebarOpen ? 'right-0' : '-right-64'
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
            <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-center">
              <p className="text-[11px] font-bold text-amber-400">🔧 وضع الفني</p>
              <p className="text-[10px] text-amber-300/70 mt-0.5">صلاحية: كروت الاستقبال فقط</p>
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
                  {user.role === 'ADMIN' ? 'مدير النظام' : user.role === 'RECEPTION' ? 'موظف استقبال' : 'فني صيانة'}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="text-zinc-500 hover:text-red-400 transition rotate-180 cursor-pointer"
              title="تسجيل الخروج"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 border-b border-zinc-900 flex items-center justify-between px-6 bg-zinc-950/60 backdrop-blur-md">
          {/* Mobile/Tablet hamburger & logo trigger */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="p-1.5 text-zinc-400 hover:text-white lg:hidden cursor-pointer"
              aria-label="فتح القائمة"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <Shield size={20} className="text-primary" />
              <span className="font-black text-base text-white">Au<span className="text-primary">2</span>Ka</span>
            </div>
          </div>

          {/* User Role Tag */}
          <div className="mr-auto flex items-center gap-3">
            <span className="rounded-md bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-xs font-bold text-zinc-400">
              دور المستخدم: <span className="text-primary">
                {user?.role === 'ADMIN' ? 'مدير النظام' : user?.role === 'RECEPTION' ? 'استقبال' : 'فني'}
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
          {activeTab === 'reports' && !isTechnician && <ReportsView />}
          {activeTab === 'settings' && !isTechnician && <SettingsView />}
        </main>
      </div>
    </div>
  );
}
