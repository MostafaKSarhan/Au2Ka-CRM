import React, { useEffect, useState } from 'react';
import { Building2, PlusCircle, Edit2, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../store/LanguageContext';
import {
  SectionHeader, Field, TextInput, TextArea, Select, PrimaryButton, GhostButton,
  IconButton, Banner, StatusPill, Modal, TableShell,
} from './ui';

interface City {
  id: string;
  nameAr: string;
  nameEn: string;
  country: { id: string; code: string; nameAr: string; nameEn: string };
}

interface Branch {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  cityId: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  city: City;
  _count: { users: number; customers: number; jobCards: number };
}

const emptyForm = { code: '', nameAr: '', nameEn: '', cityId: '', address: '', phone: '' };

export function BranchesTab() {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';

  const [branches, setBranches] = useState<Branch[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [branchRes, cityRes] = await Promise.all([
        api.get('/branches'),
        api.get('/locations/cities'),
      ]);
      setBranches(branchRes.data.branches || []);
      setCities(cityRes.data.cities || []);
    } catch (e) {
      setMsg('❌ ' + t('md_loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm, cityId: cities[0]?.id || '' });
    setMsg('');
    setShowForm(true);
  }

  function openEdit(b: Branch) {
    setEditingId(b.id);
    setForm({
      code: b.code,
      nameAr: b.nameAr,
      nameEn: b.nameEn,
      cityId: b.cityId,
      address: b.address || '',
      phone: b.phone || '',
    });
    setMsg('');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const payload = {
        ...form,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
      };
      if (editingId) {
        await api.put(`/branches/${editingId}`, payload);
        setMsg('✅ ' + t('md_branchUpdated'));
      } else {
        await api.post('/branches', payload);
        setMsg('✅ ' + t('md_branchAdded'));
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(b: Branch) {
    try {
      await api.put(`/branches/${b.id}`, { isActive: !b.isActive });
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    }
  }

  async function handleDelete(b: Branch) {
    const name = isAr ? b.nameAr : b.nameEn;
    if (!confirm(`${t('md_confirmDelete')} "${name}"؟`)) return;
    try {
      await api.delete(`/branches/${b.id}`);
      setMsg('✅ ' + t('md_branchDeleted'));
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_deleteFailed')));
    }
  }

  return (
    <div className="glass-panel space-y-4 rounded-xl p-5">
      <SectionHeader
        icon={Building2}
        title={t('md_branches')}
        subtitle={t('md_branchesHint')}
        action={
          <PrimaryButton onClick={openAdd} disabled={cities.length === 0}>
            <PlusCircle size={16} /> {t('md_addBranch')}
          </PrimaryButton>
        }
      />

      <Banner message={msg} />

      <TableShell
        headers={[t('md_code'), t('md_nameAr'), t('md_nameEn'), t('md_city'), t('md_phone'), t('md_linked'), t('md_status'), t('actions')]}
        loading={loading}
        loadingText={t('loading')}
        isEmpty={branches.length === 0}
        empty={t('md_noBranches')}
      >
        {branches.map(b => (
          <tr key={b.id} className="border-b border-zinc-900 transition hover:bg-zinc-900/40">
            <td className="px-3 py-2.5 font-mono text-xs text-primary">{b.code}</td>
            <td className="px-3 py-2.5 font-semibold text-white">{b.nameAr}</td>
            <td className="px-3 py-2.5 text-zinc-400">{b.nameEn}</td>
            <td className="px-3 py-2.5 text-zinc-400">
              {isAr ? b.city?.nameAr : b.city?.nameEn}
              <span className="block text-[11px] text-zinc-600">
                {isAr ? b.city?.country?.nameAr : b.city?.country?.nameEn}
              </span>
            </td>
            <td className="px-3 py-2.5 font-mono text-xs text-zinc-400">{b.phone || '—'}</td>
            <td className="px-3 py-2.5 text-[11px] text-zinc-500">
              {t('md_employeesShort')}: {b._count.users} · {t('md_jobCardsShort')}: {b._count.jobCards}
            </td>
            <td className="px-3 py-2.5">
              <button onClick={() => handleToggle(b)} className="cursor-pointer">
                <StatusPill active={b.isActive} activeText={t('md_active')} inactiveText={t('md_inactive')} />
              </button>
            </td>
            <td className="px-3 py-2.5">
              <div className="flex items-center gap-1">
                <IconButton onClick={() => openEdit(b)} title={t('edit')}>
                  <Edit2 size={15} />
                </IconButton>
                <IconButton tone="danger" onClick={() => handleDelete(b)} title={t('delete')}>
                  <Trash2 size={15} />
                </IconButton>
              </div>
            </td>
          </tr>
        ))}
      </TableShell>

      {showForm && (
        <Modal title={editingId ? t('md_editBranch') : t('md_addBranch')} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('md_code')} hint={t('md_codeHint')}>
                <TextInput
                  required
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="RYD-01"
                />
              </Field>
              <Field label={t('md_phone')}>
                <TextInput
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="0112345678"
                />
              </Field>
              <Field label={t('md_nameAr')}>
                <TextInput required value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} />
              </Field>
              <Field label={t('md_nameEn')}>
                <TextInput required value={form.nameEn} onChange={e => setForm({ ...form, nameEn: e.target.value })} />
              </Field>
            </div>

            <Field label={t('md_city')}>
              <Select required value={form.cityId} onChange={e => setForm({ ...form, cityId: e.target.value })}>
                <option value="">{t('md_selectCity')}</option>
                {cities.map(c => (
                  <option key={c.id} value={c.id}>
                    {(isAr ? c.nameAr : c.nameEn) + ' — ' + (isAr ? c.country.nameAr : c.country.nameEn)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('md_address')}>
              <TextArea rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </Field>

            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={saving} className="flex-1">
                {saving ? t('loading') : t('save')}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setShowForm(false)}>
                {t('cancel')}
              </GhostButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
