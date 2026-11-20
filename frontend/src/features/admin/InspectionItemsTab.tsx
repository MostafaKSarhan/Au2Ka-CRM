import React, { useEffect, useState } from 'react';
import { ClipboardCheck, PlusCircle, Edit2, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../store/LanguageContext';
import {
  SectionHeader, Field, TextInput, PrimaryButton, GhostButton,
  IconButton, Banner, StatusPill, Modal, TableShell,
} from './ui';

interface Item {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  category: string | null;
  sortOrder: number;
  isActive: boolean;
}

const emptyForm = { code: '', nameAr: '', nameEn: '', category: '', sortOrder: '0' };

export function InspectionItemsTab() {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';

  const [items, setItems] = useState<Item[]>([]);
  const [max, setMax] = useState(25);
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
      const res = await api.get('/inspections/items');
      setItems(res.data.items || []);
      setMax(res.data.max || 25);
    } catch {
      setMsg('❌ ' + t('md_loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  const activeCount = items.filter(i => i.isActive).length;

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm, sortOrder: String(items.length + 1) });
    setMsg('');
    setShowForm(true);
  }

  function openEdit(item: Item) {
    setEditingId(item.id);
    setForm({
      code: item.code,
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      category: item.category || '',
      sortOrder: String(item.sortOrder),
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
        category: form.category.trim() || null,
        sortOrder: Number(form.sortOrder),
      };
      if (editingId) {
        await api.put(`/inspections/items/${editingId}`, payload);
        setMsg('✅ ' + t('insp_itemUpdated'));
      } else {
        await api.post('/inspections/items', payload);
        setMsg('✅ ' + t('insp_itemAdded'));
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

  async function handleToggle(item: Item) {
    try {
      await api.put(`/inspections/items/${item.id}`, { isActive: !item.isActive });
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    }
  }

  async function handleDelete(item: Item) {
    if (!confirm(`${t('md_confirmDelete')} "${isAr ? item.nameAr : item.nameEn}"؟`)) return;
    try {
      await api.delete(`/inspections/items/${item.id}`);
      setMsg('✅ ' + t('insp_itemDeleted'));
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_deleteFailed')));
    }
  }

  /** Swaps an item's position with its neighbour. */
  async function move(item: Item, direction: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = sorted.findIndex(i => i.id === item.id);
    const neighbour = sorted[index + direction];
    if (!neighbour) return;

    try {
      await Promise.all([
        api.put(`/inspections/items/${item.id}`, { sortOrder: neighbour.sortOrder }),
        api.put(`/inspections/items/${neighbour.id}`, { sortOrder: item.sortOrder }),
      ]);
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    }
  }

  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="glass-panel space-y-4 rounded-xl p-5">
      <SectionHeader
        icon={ClipboardCheck}
        title={t('insp_checklist')}
        subtitle={`${t('insp_checklistHint')} — ${activeCount}/${max}`}
        action={
          <PrimaryButton onClick={openAdd} disabled={activeCount >= max}>
            <PlusCircle size={16} /> {t('insp_addItem')}
          </PrimaryButton>
        }
      />

      <Banner message={msg} />

      <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-amber-400/90">
        {t('insp_pendingApproval')}
      </p>

      <TableShell
        headers={['#', t('md_code'), t('md_nameAr'), t('md_nameEn'), t('insp_category'), t('md_status'), t('actions')]}
        loading={loading}
        loadingText={t('loading')}
        isEmpty={sorted.length === 0}
        empty={t('insp_noItems')}
      >
        {sorted.map((item, index) => (
          <tr key={item.id} className="border-b border-zinc-900 transition hover:bg-zinc-900/40">
            <td className="px-3 py-2.5">
              <div className="flex items-center gap-1">
                <span className="w-5 font-mono text-xs text-zinc-600">{index + 1}</span>
                <div className="flex flex-col">
                  <button
                    onClick={() => move(item, -1)}
                    disabled={index === 0}
                    className="cursor-pointer text-zinc-600 transition hover:text-primary disabled:opacity-25"
                  >
                    <ArrowUp size={11} />
                  </button>
                  <button
                    onClick={() => move(item, 1)}
                    disabled={index === sorted.length - 1}
                    className="cursor-pointer text-zinc-600 transition hover:text-primary disabled:opacity-25"
                  >
                    <ArrowDown size={11} />
                  </button>
                </div>
              </div>
            </td>
            <td className="px-3 py-2.5 font-mono text-[11px] text-primary">{item.code}</td>
            <td className="px-3 py-2.5 font-semibold text-white">{item.nameAr}</td>
            <td className="px-3 py-2.5 text-zinc-400">{item.nameEn}</td>
            <td className="px-3 py-2.5 text-xs text-zinc-500">{item.category || '—'}</td>
            <td className="px-3 py-2.5">
              <button onClick={() => handleToggle(item)} className="cursor-pointer">
                <StatusPill active={item.isActive} activeText={t('md_active')} inactiveText={t('md_inactive')} />
              </button>
            </td>
            <td className="px-3 py-2.5">
              <div className="flex items-center gap-1">
                <IconButton onClick={() => openEdit(item)} title={t('edit')}>
                  <Edit2 size={15} />
                </IconButton>
                <IconButton tone="danger" onClick={() => handleDelete(item)} title={t('delete')}>
                  <Trash2 size={15} />
                </IconButton>
              </div>
            </td>
          </tr>
        ))}
      </TableShell>

      {showForm && (
        <Modal title={editingId ? t('insp_editItem') : t('insp_addItem')} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('md_code')} hint={t('insp_codeHint')}>
                <TextInput
                  required
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="BRAKE_PADS"
                />
              </Field>
              <Field label={t('insp_category')}>
                <TextInput value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
              </Field>
              <Field label={t('md_nameAr')}>
                <TextInput required value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} />
              </Field>
              <Field label={t('md_nameEn')}>
                <TextInput required value={form.nameEn} onChange={e => setForm({ ...form, nameEn: e.target.value })} />
              </Field>
            </div>
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
