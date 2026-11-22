import React, { useEffect, useState } from 'react';
import { Car, PlusCircle, Edit2, Trash2, Tag, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../store/LanguageContext';
import {
  SectionHeader, Field, TextInput, Select, PrimaryButton, GhostButton,
  IconButton, Banner, StatusPill, Modal, TableShell,
} from './ui';
import { SearchableSelect } from '../../components/SearchableSelect';

interface Brand {
  id: string;
  nameAr: string;
  nameEn: string;
  isActive: boolean;
  _count: { models: number };
}

interface Model {
  id: string;
  brandId: string;
  nameAr: string;
  nameEn: string;
  yearFrom: number | null;
  yearTo: number | null;
  isActive: boolean;
  brand: { id: string; nameAr: string; nameEn: string };
  _count: { vehicles: number };
}

const emptyBrand = { nameAr: '', nameEn: '' };
const emptyModel = { brandId: '', nameAr: '', nameEn: '', yearFrom: '', yearTo: '' };

export function VehicleModelsTab() {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';

  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [search, setSearch] = useState('');

  const [brandModal, setBrandModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<string | null>(null);
  const [brandForm, setBrandForm] = useState(emptyBrand);

  const [modelModal, setModelModal] = useState(false);
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [modelForm, setModelForm] = useState(emptyModel);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [filterBrand, search]);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterBrand) params.brandId = filterBrand;
      if (search.trim()) params.search = search.trim();

      const [brandRes, modelRes] = await Promise.all([
        api.get('/vehicle-catalog/brands'),
        api.get('/vehicle-catalog/models', { params }),
      ]);
      setBrands(brandRes.data.brands || []);
      setModels(modelRes.data.models || []);
    } catch {
      setMsg('❌ ' + t('md_loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  // ---------------- Brands ----------------
  async function submitBrand(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      if (editingBrand) {
        await api.put(`/vehicle-catalog/brands/${editingBrand}`, brandForm);
        setMsg('✅ ' + t('md_brandUpdated'));
      } else {
        await api.post('/vehicle-catalog/brands', brandForm);
        setMsg('✅ ' + t('md_brandAdded'));
      }
      setBrandModal(false);
      setBrandForm(emptyBrand);
      setEditingBrand(null);
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function deleteBrand(b: Brand) {
    const name = isAr ? b.nameAr : b.nameEn;
    if (!confirm(`${t('md_confirmDelete')} "${name}"؟`)) return;
    try {
      await api.delete(`/vehicle-catalog/brands/${b.id}`);
      setMsg('✅ ' + t('md_brandDeleted'));
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_deleteFailed')));
    }
  }

  // ---------------- Models ----------------
  function openAddModel() {
    setEditingModel(null);
    setModelForm({ ...emptyModel, brandId: filterBrand || brands[0]?.id || '' });
    setMsg('');
    setModelModal(true);
  }

  function openEditModel(m: Model) {
    setEditingModel(m.id);
    setModelForm({
      brandId: m.brandId,
      nameAr: m.nameAr,
      nameEn: m.nameEn,
      yearFrom: m.yearFrom ? String(m.yearFrom) : '',
      yearTo: m.yearTo ? String(m.yearTo) : '',
    });
    setMsg('');
    setModelModal(true);
  }

  async function submitModel(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const payload = {
        ...modelForm,
        yearFrom: modelForm.yearFrom ? Number(modelForm.yearFrom) : null,
        yearTo: modelForm.yearTo ? Number(modelForm.yearTo) : null,
      };
      if (editingModel) {
        await api.put(`/vehicle-catalog/models/${editingModel}`, payload);
        setMsg('✅ ' + t('md_modelUpdated'));
      } else {
        await api.post('/vehicle-catalog/models', payload);
        setMsg('✅ ' + t('md_modelAdded'));
      }
      setModelModal(false);
      setModelForm(emptyModel);
      setEditingModel(null);
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function deleteModel(m: Model) {
    const name = isAr ? m.nameAr : m.nameEn;
    if (!confirm(`${t('md_confirmDelete')} "${name}"؟`)) return;
    try {
      await api.delete(`/vehicle-catalog/models/${m.id}`);
      setMsg('✅ ' + t('md_modelDeleted'));
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_deleteFailed')));
    }
  }

  return (
    <div className="space-y-5">
      <Banner message={msg} />

      {/* Brands */}
      <div className="glass-panel space-y-4 rounded-xl p-5">
        <SectionHeader
          icon={Tag}
          title={t('md_brands')}
          subtitle={t('md_brandsHint')}
          action={
            <PrimaryButton
              onClick={() => {
                setEditingBrand(null);
                setBrandForm(emptyBrand);
                setBrandModal(true);
              }}
            >
              <PlusCircle size={16} /> {t('md_addBrand')}
            </PrimaryButton>
          }
        />

        <div className="flex flex-wrap gap-2">
          {loading && brands.length === 0 && <p className="text-sm text-zinc-500">{t('loading')}</p>}
          {brands.map(b => (
            <div
              key={b.id}
              className={`group flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
                filterBrand === b.id
                  ? 'border-primary/50 bg-primary/10 text-white'
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-300'
              }`}
            >
              <button
                onClick={() => setFilterBrand(filterBrand === b.id ? '' : b.id)}
                className="cursor-pointer font-semibold"
              >
                {isAr ? b.nameAr : b.nameEn}
                <span className="ms-1.5 text-[11px] text-zinc-500">({b._count.models})</span>
              </button>
              <span className="flex items-center opacity-0 transition group-hover:opacity-100">
                <IconButton
                  onClick={() => {
                    setEditingBrand(b.id);
                    setBrandForm({ nameAr: b.nameAr, nameEn: b.nameEn });
                    setBrandModal(true);
                  }}
                  title={t('edit')}
                >
                  <Edit2 size={13} />
                </IconButton>
                <IconButton tone="danger" onClick={() => deleteBrand(b)} title={t('delete')}>
                  <Trash2 size={13} />
                </IconButton>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Models */}
      <div className="glass-panel space-y-4 rounded-xl p-5">
        <SectionHeader
          icon={Car}
          title={t('md_models')}
          subtitle={t('md_modelsHint')}
          action={
            <PrimaryButton onClick={openAddModel} disabled={brands.length === 0}>
              <PlusCircle size={16} /> {t('md_addModel')}
            </PrimaryButton>
          }
        />

        <div className="relative">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 text-zinc-600 start-3" />
          <TextInput
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('md_searchModel')}
            className="ps-9"
          />
        </div>

        <TableShell
          headers={[t('md_brand'), t('md_nameAr'), t('md_nameEn'), t('md_years'), t('md_vehiclesShort'), t('md_status'), t('actions')]}
          loading={loading}
          loadingText={t('loading')}
          isEmpty={models.length === 0}
          empty={t('md_noModels')}
        >
          {models.map(m => (
            <tr key={m.id} className="border-b border-zinc-900 transition hover:bg-zinc-900/40">
              <td className="px-3 py-2.5 text-zinc-400">{isAr ? m.brand?.nameAr : m.brand?.nameEn}</td>
              <td className="px-3 py-2.5 font-semibold text-white">{m.nameAr}</td>
              <td className="px-3 py-2.5 text-zinc-400">{m.nameEn}</td>
              <td className="px-3 py-2.5 font-mono text-xs text-zinc-500">
                {m.yearFrom || m.yearTo ? `${m.yearFrom || '—'} → ${m.yearTo || '—'}` : '—'}
              </td>
              <td className="px-3 py-2.5 text-xs text-zinc-500">{m._count.vehicles}</td>
              <td className="px-3 py-2.5">
                <StatusPill active={m.isActive} activeText={t('md_active')} inactiveText={t('md_inactive')} />
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1">
                  <IconButton onClick={() => openEditModel(m)} title={t('edit')}>
                    <Edit2 size={15} />
                  </IconButton>
                  <IconButton tone="danger" onClick={() => deleteModel(m)} title={t('delete')}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
      </div>

      {brandModal && (
        <Modal title={editingBrand ? t('md_editBrand') : t('md_addBrand')} onClose={() => setBrandModal(false)}>
          <form onSubmit={submitBrand} className="space-y-3">
            <Field label={t('md_nameAr')}>
              <TextInput required value={brandForm.nameAr} onChange={e => setBrandForm({ ...brandForm, nameAr: e.target.value })} />
            </Field>
            <Field label={t('md_nameEn')}>
              <TextInput required value={brandForm.nameEn} onChange={e => setBrandForm({ ...brandForm, nameEn: e.target.value })} />
            </Field>
            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={saving} className="flex-1">
                {saving ? t('loading') : t('save')}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setBrandModal(false)}>
                {t('cancel')}
              </GhostButton>
            </div>
          </form>
        </Modal>
      )}

      {modelModal && (
        <Modal title={editingModel ? t('md_editModel') : t('md_addModel')} onClose={() => setModelModal(false)}>
          <form onSubmit={submitModel} className="space-y-3">
            <Field label={t('md_brand')}>
              <SearchableSelect
                value={modelForm.brandId}
                placeholder={t('md_selectBrand')}
                onChange={val => setModelForm({ ...modelForm, brandId: val })}
                options={brands.map(b => ({ value: b.id, label: isAr ? b.nameAr : b.nameEn }))}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('md_nameAr')}>
                <TextInput required value={modelForm.nameAr} onChange={e => setModelForm({ ...modelForm, nameAr: e.target.value })} />
              </Field>
              <Field label={t('md_nameEn')}>
                <TextInput required value={modelForm.nameEn} onChange={e => setModelForm({ ...modelForm, nameEn: e.target.value })} />
              </Field>
              <Field label={t('md_yearFrom')}>
                <TextInput
                  type="number"
                  min={1900}
                  max={2100}
                  value={modelForm.yearFrom}
                  onChange={e => setModelForm({ ...modelForm, yearFrom: e.target.value })}
                />
              </Field>
              <Field label={t('md_yearTo')}>
                <TextInput
                  type="number"
                  min={1900}
                  max={2100}
                  value={modelForm.yearTo}
                  onChange={e => setModelForm({ ...modelForm, yearTo: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={saving} className="flex-1">
                {saving ? t('loading') : t('save')}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setModelModal(false)}>
                {t('cancel')}
              </GhostButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
