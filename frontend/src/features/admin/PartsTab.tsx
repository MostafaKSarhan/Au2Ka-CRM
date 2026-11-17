import React, { useEffect, useState } from 'react';
import { Wrench, PlusCircle, Edit2, Trash2, Search, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../store/LanguageContext';
import {
  SectionHeader, Field, TextInput, TextArea, Select, PrimaryButton, GhostButton,
  IconButton, Banner, Modal, TableShell,
} from './ui';

interface Part {
  id: string;
  partNumber: string;
  nameAr: string;
  nameEn: string;
  category: string | null;
  unit: string;
  purchasePrice: string;
  sellPrice: string;
  quantity: number;
  reorderLevel: number;
  location: string | null;
  notes: string | null;
  isActive: boolean;
}

const emptyForm = {
  partNumber: '',
  nameAr: '',
  nameEn: '',
  category: '',
  unit: 'PCS',
  purchasePrice: '0',
  sellPrice: '0',
  quantity: '0',
  reorderLevel: '0',
  location: '',
  notes: '',
};

export function PartsTab() {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';

  const [parts, setParts] = useState<Part[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [search, category, lowStockOnly, page]);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (search.trim()) params.search = search.trim();
      if (category) params.category = category;
      if (lowStockOnly) params.lowStock = 'true';

      const [partRes, catRes] = await Promise.all([
        api.get('/parts', { params }),
        api.get('/parts/categories'),
      ]);
      setParts(partRes.data.parts || []);
      setTotalPages(partRes.data.pagination?.pages || 1);
      setCategories(catRes.data.categories || []);
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

  function openEdit(p: Part) {
    setEditingId(p.id);
    setForm({
      partNumber: p.partNumber,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      category: p.category || '',
      unit: p.unit,
      purchasePrice: String(p.purchasePrice),
      sellPrice: String(p.sellPrice),
      quantity: String(p.quantity),
      reorderLevel: String(p.reorderLevel),
      location: p.location || '',
      notes: p.notes || '',
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
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
        purchasePrice: Number(form.purchasePrice),
        sellPrice: Number(form.sellPrice),
        quantity: Number(form.quantity),
        reorderLevel: Number(form.reorderLevel),
      };
      if (editingId) {
        await api.put(`/parts/${editingId}`, payload);
        setMsg('✅ ' + t('md_partUpdated'));
      } else {
        await api.post('/parts', payload);
        setMsg('✅ ' + t('md_partAdded'));
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

  async function handleDelete(p: Part) {
    const name = isAr ? p.nameAr : p.nameEn;
    if (!confirm(`${t('md_confirmDelete')} "${name}"؟`)) return;
    try {
      await api.delete(`/parts/${p.id}`);
      setMsg('✅ ' + t('md_partDeleted'));
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_deleteFailed')));
    }
  }

  return (
    <div className="glass-panel space-y-4 rounded-xl p-5">
      <SectionHeader
        icon={Wrench}
        title={t('md_parts')}
        subtitle={t('md_partsHint')}
        action={
          <PrimaryButton onClick={openAdd}>
            <PlusCircle size={16} /> {t('md_addPart')}
          </PrimaryButton>
        }
      />

      <Banner message={msg} />

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="relative sm:col-span-2">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 text-zinc-600 start-3" />
          <TextInput
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('md_searchPart')}
            className="ps-9"
          />
        </div>
        <Select
          value={category}
          onChange={e => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('md_allCategories')}</option>
          {categories.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <label className="flex w-fit cursor-pointer items-center gap-2 text-xs font-semibold text-zinc-400">
        <input
          type="checkbox"
          checked={lowStockOnly}
          onChange={e => {
            setLowStockOnly(e.target.checked);
            setPage(1);
          }}
          className="cursor-pointer accent-red-600"
        />
        <AlertTriangle size={14} className="text-amber-500" />
        {t('md_lowStockOnly')}
      </label>

      <TableShell
        headers={[t('md_partNumber'), t('md_nameAr'), t('md_category'), t('md_purchasePrice'), t('md_sellPrice'), t('md_quantity'), t('actions')]}
        loading={loading}
        loadingText={t('loading')}
        isEmpty={parts.length === 0}
        empty={t('md_noParts')}
      >
        {parts.map(p => {
          const low = p.quantity <= p.reorderLevel;
          return (
            <tr key={p.id} className="border-b border-zinc-900 transition hover:bg-zinc-900/40">
              <td className="px-3 py-2.5 font-mono text-xs text-primary">{p.partNumber}</td>
              <td className="px-3 py-2.5">
                <span className="font-semibold text-white">{p.nameAr}</span>
                <span className="block text-[11px] text-zinc-600">{p.nameEn}</span>
              </td>
              <td className="px-3 py-2.5 text-zinc-400">{p.category || '—'}</td>
              <td className="px-3 py-2.5 font-mono text-xs text-zinc-400">{p.purchasePrice}</td>
              <td className="px-3 py-2.5 font-mono text-xs text-emerald-400">{p.sellPrice}</td>
              <td className="px-3 py-2.5">
                <span className={`font-mono text-xs font-bold ${low ? 'text-amber-400' : 'text-zinc-300'}`}>
                  {p.quantity} {p.unit}
                </span>
                {low && (
                  <span className="block text-[10px] font-bold text-amber-500">
                    {t('md_reorderAt')} {p.reorderLevel}
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1">
                  <IconButton onClick={() => openEdit(p)} title={t('edit')}>
                    <Edit2 size={15} />
                  </IconButton>
                  <IconButton tone="danger" onClick={() => handleDelete(p)} title={t('delete')}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </td>
            </tr>
          );
        })}
      </TableShell>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <GhostButton disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {isAr ? 'السابق' : 'Previous'}
          </GhostButton>
          <span className="text-xs text-zinc-500">
            {page} / {totalPages}
          </span>
          <GhostButton disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            {isAr ? 'التالي' : 'Next'}
          </GhostButton>
        </div>
      )}

      {showForm && (
        <Modal title={editingId ? t('md_editPart') : t('md_addPart')} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('md_partNumber')} hint={t('md_partNumberHint')}>
                <TextInput
                  required
                  value={form.partNumber}
                  onChange={e => setForm({ ...form, partNumber: e.target.value.toUpperCase() })}
                  placeholder="OIL-5W30-4L"
                />
              </Field>
              <Field label={t('md_category')}>
                <TextInput
                  list="part-categories"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                />
                <datalist id="part-categories">
                  {categories.map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label={t('md_nameAr')}>
                <TextInput required value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} />
              </Field>
              <Field label={t('md_nameEn')}>
                <TextInput required value={form.nameEn} onChange={e => setForm({ ...form, nameEn: e.target.value })} />
              </Field>
              <Field label={t('md_purchasePrice')}>
                <TextInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.purchasePrice}
                  onChange={e => setForm({ ...form, purchasePrice: e.target.value })}
                />
              </Field>
              <Field label={t('md_sellPrice')}>
                <TextInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.sellPrice}
                  onChange={e => setForm({ ...form, sellPrice: e.target.value })}
                />
              </Field>
              <Field label={t('md_quantity')}>
                <TextInput
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: e.target.value })}
                />
              </Field>
              <Field label={t('md_reorderLevel')} hint={t('md_reorderHint')}>
                <TextInput
                  type="number"
                  min={0}
                  value={form.reorderLevel}
                  onChange={e => setForm({ ...form, reorderLevel: e.target.value })}
                />
              </Field>
              <Field label={t('md_unit')}>
                <Select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                  <option value="PCS">{isAr ? 'قطعة' : 'Piece'}</option>
                  <option value="LTR">{isAr ? 'لتر' : 'Litre'}</option>
                  <option value="SET">{isAr ? 'طقم' : 'Set'}</option>
                  <option value="MTR">{isAr ? 'متر' : 'Metre'}</option>
                </Select>
              </Field>
              <Field label={t('md_location')}>
                <TextInput value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              </Field>
            </div>

            <Field label={t('md_notes')}>
              <TextArea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
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
