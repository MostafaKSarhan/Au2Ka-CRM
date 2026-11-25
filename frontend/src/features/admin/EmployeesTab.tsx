import React, { useEffect, useState } from 'react';
import { Users, PlusCircle, Edit2, Trash2, Power } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../store/LanguageContext';
import {
  SectionHeader, Field, TextInput, Select, PrimaryButton, GhostButton,
  IconButton, Banner, StatusPill, Modal, TableShell, SearchBox,
} from './ui';
import { SearchableSelect } from '../../components/SearchableSelect';

/**
 * الموظفون والفنيون — إضافة وتعديل وحذف وبحث، وكل موظف مرتبط بفرعه.
 *
 * الشاشة هنا مع باقي البيانات الأساسية لأن ورقة طلبات العميل تضع الموظفين
 * في نفس القائمة مع الفروع والموديلات والقطع، لا في الإعدادات.
 */

interface Branch {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
}

interface Employee {
  id: string;
  mobileNumber: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'RECEPTION' | 'TECHNICIAN';
  status: 'ACTIVE' | 'INACTIVE';
  branchId: string | null;
  branch: Branch | null;
}

/** رسالة الخطأ كما يرسلها الباكند، إن وُجدت. */
function apiMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { data?: { message?: string } } })?.response;
  return response?.data?.message || fallback;
}

const emptyForm = {
  firstName: '',
  lastName: '',
  mobileNumber: '',
  password: '',
  role: 'TECHNICIAN' as Employee['role'],
  branchId: '',
};

export function EmployeesTab() {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [search, roleFilter, branchFilter]);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      if (roleFilter) params.role = roleFilter;
      if (branchFilter) params.branchId = branchFilter;

      const [userRes, branchRes] = await Promise.all([
        api.get('/users', { params }),
        api.get('/branches'),
      ]);
      setEmployees(userRes.data.users || []);
      setBranches(branchRes.data.branches || []);
    } catch {
      setMsg('❌ ' + t('md_loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setMsg('');
    setShowForm(true);
  }

  function openEdit(employee: Employee) {
    setEditingId(employee.id);
    setForm({
      firstName: employee.firstName,
      lastName: employee.lastName,
      mobileNumber: employee.mobileNumber,
      password: '',
      role: employee.role,
      branchId: employee.branchId || '',
    });
    setMsg('');
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        mobileNumber: form.mobileNumber.trim(),
        role: form.role,
        branchId: form.branchId || null,
      };

      if (editingId) {
        // كلمة مرور فارغة تعني «اترك الحالية كما هي»، لا «امسحها».
        if (form.password.trim()) payload.password = form.password.trim();
        await api.put(`/users/${editingId}`, payload);
        setMsg('✅ ' + t('md_employeeUpdated'));
      } else {
        payload.password = form.password.trim();
        await api.post('/users', payload);
        setMsg('✅ ' + t('md_employeeAdded'));
      }

      setShowForm(false);
      await load();
    } catch (err) {
      setMsg('❌ ' + apiMessage(err, t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(employee: Employee) {
    try {
      await api.put(`/users/${employee.id}`, {
        status: employee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      await load();
    } catch (err) {
      setMsg('❌ ' + apiMessage(err, t('md_saveFailed')));
    }
  }

  async function remove(employee: Employee) {
    const name = `${employee.firstName} ${employee.lastName}`;
    if (!window.confirm(t('md_confirmDeleteEmployee').replace('{name}', name))) return;

    try {
      await api.delete(`/users/${employee.id}`);
      setMsg('✅ ' + t('md_employeeDeleted'));
      await load();
    } catch (err) {
      setMsg('❌ ' + apiMessage(err, t('md_deleteFailed')));
    }
  }

  const roleLabel: Record<Employee['role'], string> = {
    ADMIN: t('adminRole'),
    RECEPTION: t('receptionRole'),
    TECHNICIAN: t('technicianRole'),
  };

  const canSave =
    form.firstName.trim().length >= 2 &&
    form.lastName.trim().length >= 2 &&
    form.mobileNumber.trim().length > 0 &&
    (editingId ? true : form.password.trim().length >= 6);

  return (
    <div className="glass-panel space-y-4 rounded-xl p-5">
      <SectionHeader
        icon={Users}
        title={t('md_employees')}
        subtitle={t('md_employeesHint')}
        action={
          <PrimaryButton onClick={openAdd}>
            <PlusCircle size={16} /> {t('md_addEmployee')}
          </PrimaryButton>
        }
      />

      <Banner message={msg} />

      <div className="grid gap-3 sm:grid-cols-4">
        <SearchBox
          className="sm:col-span-2"
          value={search}
          onChange={setSearch}
          placeholder={t('md_searchEmployee')}
        />
        <Select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">{t('md_allRoles')}</option>
          <option value="ADMIN">{t('adminRole')}</option>
          <option value="RECEPTION">{t('receptionRole')}</option>
          <option value="TECHNICIAN">{t('technicianRole')}</option>
        </Select>
        <SearchableSelect
          value={branchFilter}
          placeholder={t('md_allBranches')}
          onChange={setBranchFilter}
          options={[
            { value: '', label: t('md_allBranches') },
            ...branches.map(b => ({ value: b.id, label: isAr ? b.nameAr : b.nameEn })),
          ]}
        />
      </div>

      <TableShell
        headers={[
          t('md_employeeName'),
          t('md_mobile'),
          t('userRoleLabel'),
          t('md_branch'),
          t('md_status'),
          t('actions'),
        ]}
        loading={loading}
        loadingText={t('loading')}
        isEmpty={employees.length === 0}
        empty={t('md_noEmployees')}
      >
        {employees.map(e => (
          <tr key={e.id} className="border-b border-zinc-900 transition hover:bg-zinc-900/40">
            <td className="px-3 py-2.5 font-semibold text-white">
              {e.firstName} {e.lastName}
            </td>
            <td className="px-3 py-2.5 font-mono text-xs text-zinc-300" dir="ltr">
              {e.mobileNumber}
            </td>
            <td className="px-3 py-2.5 text-zinc-300">{roleLabel[e.role]}</td>
            <td className="px-3 py-2.5 text-zinc-300">
              {e.branch ? (isAr ? e.branch.nameAr : e.branch.nameEn) : (
                <span className="text-zinc-600">{t('md_noBranch')}</span>
              )}
            </td>
            <td className="px-3 py-2.5">
              <StatusPill
                active={e.status === 'ACTIVE'}
                activeText={t('md_active')}
                inactiveText={t('md_inactive')}
              />
            </td>
            <td className="px-3 py-2.5">
              <div className="flex items-center gap-1">
                <IconButton title={t('edit')} onClick={() => openEdit(e)}>
                  <Edit2 size={14} />
                </IconButton>
                <IconButton
                  title={e.status === 'ACTIVE' ? t('md_setInactive') : t('md_setActive')}
                  onClick={() => toggleStatus(e)}
                >
                  <Power size={14} />
                </IconButton>
                <IconButton title={t('delete')} tone="danger" onClick={() => remove(e)}>
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </td>
          </tr>
        ))}
      </TableShell>

      {showForm && (
        <Modal
          title={editingId ? t('md_editEmployee') : t('md_addEmployee')}
          onClose={() => setShowForm(false)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('md_firstName')} required>
            <TextInput
              value={form.firstName}
              onChange={e => setForm({ ...form, firstName: e.target.value })}
            />
          </Field>
          <Field label={t('md_lastName')} required>
            <TextInput
              value={form.lastName}
              onChange={e => setForm({ ...form, lastName: e.target.value })}
            />
          </Field>
          <Field label={t('md_mobile')} required>
            <TextInput
              dir="ltr"
              value={form.mobileNumber}
              onChange={e => setForm({ ...form, mobileNumber: e.target.value })}
              placeholder="05xxxxxxxx"
            />
          </Field>
          <Field
            label={t('md_password')}
            required={!editingId}
            hint={editingId ? t('md_passwordKeepHint') : t('md_passwordHint')}
          >
            <TextInput
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder={editingId ? '••••••' : ''}
            />
          </Field>
          <Field label={t('userRoleLabel')} required>
            <Select
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value as Employee['role'] })}
            >
              <option value="TECHNICIAN">{t('technicianRole')}</option>
              <option value="RECEPTION">{t('receptionRole')}</option>
              <option value="ADMIN">{t('adminRole')}</option>
            </Select>
          </Field>
          <Field label={t('md_branch')} hint={t('md_branchHint')}>
            <SearchableSelect
              value={form.branchId}
              placeholder={t('md_noBranch')}
              onChange={val => setForm({ ...form, branchId: val })}
              options={[
                { value: '', label: t('md_noBranch') },
                ...branches.map(b => ({ value: b.id, label: isAr ? b.nameAr : b.nameEn })),
              ]}
            />
            </Field>
          </div>

          <div className="mt-4 flex justify-end gap-2 border-t border-zinc-800 pt-4">
            <GhostButton onClick={() => setShowForm(false)}>{t('cancel')}</GhostButton>
            <PrimaryButton onClick={save} disabled={!canSave || saving}>
              {saving ? t('md_savingNow') : t('save')}
            </PrimaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
