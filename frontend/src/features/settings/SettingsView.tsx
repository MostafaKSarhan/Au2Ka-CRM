import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';
import { User, Shield, LogOut, Phone, Save, UserPlus, Trash2, Eye, EyeOff, RefreshCw, Users, Edit2 } from 'lucide-react';
import { useTranslation } from '../../store/LanguageContext';

export function SettingsView() {
  const { user, logout } = useAuthStore();
  const { lang, t } = useTranslation();
  const isAdmin = user?.role === 'ADMIN';

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

  // Users management
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [userMsg, setUserMsg] = useState('');
  const [userForm, setUserForm] = useState({
    firstName: '',
    lastName: '',
    mobileNumber: '',
    password: '',
    role: 'TECHNICIAN',
    branchId: '',
  });
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    const savedNum = localStorage.getItem('whatsappNumber');
    if (savedNum) setWhatsappNumber(savedNum);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
      loadBranches();
    }
  }, [isAdmin]);

  async function loadBranches() {
    try {
      const res = await api.get('/branches');
      setBranches(res.data.branches || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch (e) {
      console.error(e);
    } finally {
      setUsersLoading(false);
    }
  }

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem('whatsappNumber', whatsappNumber.trim());
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setUserMsg('');
    try {
      await api.post('/users', { ...userForm, branchId: userForm.branchId || null });
      setUserMsg(lang === 'ar' ? '✅ تم إضافة المستخدم بنجاح' : '✅ User added successfully');
      setUserForm({ firstName: '', lastName: '', mobileNumber: '', password: '', role: 'TECHNICIAN', branchId: '' });
      setShowAddUser(false);
      loadUsers();
    } catch (err: any) {
      setUserMsg('❌ ' + (err.response?.data?.message || (lang === 'ar' ? 'فشل إضافة المستخدم' : 'Failed to add user')));
    }
  }

  function handleEditUser(u: any) {
    setEditingUserId(u.id);
    setShowAddUser(false);
    setUserForm({
      firstName: u.firstName,
      lastName: u.lastName,
      mobileNumber: u.mobileNumber || '',
      password: '',
      role: u.role,
      branchId: u.branchId || '',
    });
    setUserMsg('');
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUserId) return;
    setUserMsg('');
    try {
      const payload: any = { ...userForm, branchId: userForm.branchId || null };
      if (!payload.password) delete payload.password;
      await api.put(`/users/${editingUserId}`, payload);
      setUserMsg(lang === 'ar' ? '✅ تم تحديث المستخدم بنجاح' : '✅ User updated successfully');
      setEditingUserId(null);
      setUserForm({ firstName: '', lastName: '', mobileNumber: '', password: '', role: 'TECHNICIAN', branchId: '' });
      loadUsers();
    } catch (err: any) {
      setUserMsg('❌ ' + (err.response?.data?.message || (lang === 'ar' ? 'فشل تحديث المستخدم' : 'Failed to update user')));
    }
  }

  async function handleToggleStatus(u: any) {
    try {
      await api.put(`/users/${u.id}`, { status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
      loadUsers();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDeleteUser(u: any) {
    const confirmMsg = lang === 'ar' 
      ? `هل أنت متأكد من حذف المستخدم "${u.firstName} ${u.lastName}"؟`
      : `Are you sure you want to delete user "${u.firstName} ${u.lastName}"?`;
    if (!confirm(confirmMsg)) return;
    try {
      await api.delete(`/users/${u.id}`);
      setUserMsg(lang === 'ar' ? '✅ تم حذف المستخدم' : '✅ User deleted');
      loadUsers();
    } catch (err: any) {
      setUserMsg('❌ ' + (err.response?.data?.message || (lang === 'ar' ? 'فشل الحذف' : 'Deletion failed')));
    }
  }

  const isRtl = lang === 'ar';

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
                <div className={`rounded-full bg-primary/20 p-4 text-primary ${isRtl ? 'ml-2' : 'mr-2'}`}>
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

      {/* ─── Users Management (ADMIN only) ─── */}
      {isAdmin && (
        <div className="glass-panel rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users size={20} className="text-primary" /> {t('usersTab')}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={loadUsers}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition cursor-pointer"
                title={lang === 'ar' ? 'تحديث القائمة' : 'Refresh List'}
              >
                <RefreshCw size={15} />
              </button>
              <button
                onClick={() => { setShowAddUser(!showAddUser); setEditingUserId(null); setUserMsg(''); setUserForm({ firstName: '', lastName: '', mobileNumber: '', password: '', role: 'TECHNICIAN', branchId: '' }); }}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded transition cursor-pointer ${
                  showAddUser ? 'bg-zinc-700 text-zinc-300' : 'bg-primary hover:bg-primary-hover text-white'
                }`}
              >
                <UserPlus size={14} />
                {showAddUser ? t('cancel') : t('addUser')}
              </button>
            </div>
          </div>

          {/* Status Message */}
          {userMsg && (
            <p className={`text-xs font-semibold px-3 py-2 rounded ${
              userMsg.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>{userMsg}</p>
          )}

          {/* Add / Edit User Form */}
          {(showAddUser || editingUserId) && (
            <form onSubmit={editingUserId ? handleUpdateUser : handleAddUser} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
              <p className="text-sm font-bold text-amber-400">{editingUserId ? (lang === 'ar' ? '✏️ تعديل بيانات المستخدم' : '✏️ Edit User Details') : (lang === 'ar' ? '📝 بيانات المستخدم الجديد' : '📝 New User Details')}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">{t('firstName')} *</label>
                  <input
                    type="text"
                    required
                    value={userForm.firstName}
                    onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                    placeholder={lang === 'ar' ? 'مثال: أحمد' : 'e.g. Ahmad'}
                    className="w-full rounded bg-zinc-800 border border-zinc-700 p-2.5 text-sm text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">{t('lastName')} *</label>
                  <input
                    type="text"
                    required
                    value={userForm.lastName}
                    onChange={(e) => setUserForm({ ...userForm, lastName: e.target.value })}
                    placeholder={lang === 'ar' ? 'مثال: محمد' : 'e.g. Mohammad'}
                    className="w-full rounded bg-zinc-800 border border-zinc-700 p-2.5 text-sm text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">{lang === 'ar' ? 'رقم الجوال (تسجيل الدخول) *' : 'Mobile Number (Login) *'}</label>
                <input
                  type="tel"
                  required
                  value={userForm.mobileNumber}
                  onChange={(e) => setUserForm({ ...userForm, mobileNumber: e.target.value })}
                  placeholder="e.g. 0500000001"
                  className="w-full rounded bg-zinc-800 border border-zinc-700 p-2.5 text-sm text-white focus:outline-none focus:border-primary font-mono"
                  style={{ direction: 'ltr' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">{t('password')} {editingUserId ? (lang === 'ar' ? '(اتركه فارغاً إن لم ترد التغيير)' : '(Leave blank to keep current)') : '*'}</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required={!editingUserId}
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      placeholder={editingUserId ? '••••••••' : (lang === 'ar' ? '6 أحرف على الأقل' : '6 characters minimum')}
                      className={`w-full rounded bg-zinc-800 border border-zinc-700 p-2.5 text-sm text-white focus:outline-none focus:border-primary ${isRtl ? 'pl-10 pr-3' : 'pr-10 pl-3'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer ${isRtl ? 'left-2.5' : 'right-2.5'}`}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">{t('userRoleLabel')} *</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full rounded bg-zinc-800 border border-zinc-700 p-2.5 text-sm text-white focus:outline-none focus:border-primary"
                  >
                    <option value="TECHNICIAN">{t('technicianRole')}</option>
                    <option value="RECEPTION">{t('receptionRole')}</option>
                    <option value="ADMIN">{t('adminRole')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t('md_branch')}</label>
                <select
                  value={userForm.branchId}
                  onChange={(e) => setUserForm({ ...userForm, branchId: e.target.value })}
                  className="w-full rounded bg-zinc-800 border border-zinc-700 p-2.5 text-sm text-white focus:outline-none focus:border-primary"
                >
                  <option value="">{t('md_noBranch')}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {(lang === 'ar' ? b.nameAr : b.nameEn) + ' — ' + (lang === 'ar' ? b.city?.nameAr : b.city?.nameEn)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-primary hover:bg-primary-hover py-2.5 text-sm font-bold text-white transition cursor-pointer"
                >
                  {editingUserId ? t('saveChanges') : t('createUserBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingUserId(null); setShowAddUser(false); setUserForm({ firstName: '', lastName: '', mobileNumber: '', password: '', role: 'TECHNICIAN', branchId: '' }); }}
                  className="rounded-lg bg-zinc-700 hover:bg-zinc-600 px-4 py-2 text-sm font-bold text-zinc-300 transition cursor-pointer"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          )}

          {/* Users Table */}
          {usersLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-sm text-zinc-500 py-6">{lang === 'ar' ? 'لا يوجد مستخدمون مسجلون.' : 'No registered users.'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className={`w-full text-sm ${isRtl ? 'text-right' : 'text-left'}`}>
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                    <th className="py-2 pr-2 font-semibold">{t('userName')}</th>
                    <th className="py-2 font-semibold">{t('mobileNumber')}</th>
                    <th className="py-2 font-semibold">{t('userRoleLabel')}</th>
                    <th className="py-2 font-semibold">{t('md_branch')}</th>
                    <th className="py-2 font-semibold">{t('userStatus')}</th>
                    <th className="py-2 font-semibold text-center">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-zinc-900/30 transition">
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-2">
                          <div className="rounded-full bg-zinc-800 p-1.5 text-zinc-400">
                            <User size={13} />
                          </div>
                          <span className="font-semibold text-white">{u.firstName} {u.lastName}</span>
                          {u.id === user?.id && (
                            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold">{lang === 'ar' ? 'أنت' : 'You'}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-zinc-400 font-mono text-xs" style={{ direction: 'ltr' }}>{u.mobileNumber}</td>
                      <td className="py-3">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${ROLE_COLORS[u.role] || ''}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-zinc-400">
                        {u.branch ? (lang === 'ar' ? u.branch.nameAr : u.branch.nameEn) : <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => u.id !== user?.id && handleToggleStatus(u)}
                          disabled={u.id === user?.id}
                          className={`text-[11px] font-bold px-2 py-0.5 rounded border cursor-pointer transition ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-zinc-700/50 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                          title={u.status === 'ACTIVE' ? (lang === 'ar' ? 'اضغط لتعطيل الحساب' : 'Click to deactivate account') : (lang === 'ar' ? 'اضغط لتفعيل الحساب' : 'Click to activate account')}
                        >
                          {u.status === 'ACTIVE' ? (lang === 'ar' ? '● نشط' : '● Active') : (lang === 'ar' ? '○ معطل' : '○ Inactive')}
                        </button>
                      </td>
                      <td className="py-3 text-center flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEditUser(u)}
                          className="text-zinc-600 hover:text-accent transition p-1.5 rounded hover:bg-accent/10 cursor-pointer"
                          title={lang === 'ar' ? 'تعديل المستخدم' : 'Edit User'}
                        >
                          <Edit2 size={14} />
                        </button>
                        {u.id !== user?.id && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="text-zinc-600 hover:text-red-400 transition p-1.5 rounded hover:bg-red-500/10 cursor-pointer"
                            title={lang === 'ar' ? 'حذف المستخدم' : 'Delete User'}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
