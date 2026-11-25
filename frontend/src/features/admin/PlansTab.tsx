import React, { useEffect, useState } from 'react';
import { BadgeCheck, PlusCircle, Edit2, Trash2, Users } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../store/LanguageContext';
import {
  SectionHeader, Field, TextInput, TextArea, PrimaryButton, GhostButton,
  IconButton, Banner, StatusPill, Modal,
} from './ui';

interface Plan {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  price: string;
  durationMonths: number;
  freeVisits: number;
  discountPercent: string;
  benefitsAr: string | null;
  benefitsEn: string | null;
  isActive: boolean;
  _count: { subscriptions: number };
}

const emptyForm = {
  nameAr: '',
  nameEn: '',
  descriptionAr: '',
  descriptionEn: '',
  price: '0',
  durationMonths: '12',
  freeVisits: '0',
  discountPercent: '0',
  benefitsAr: '',
  benefitsEn: '',
};

export function PlansTab() {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';

  const [plans, setPlans] = useState<Plan[]>([]);
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
      const res = await api.get('/plans');
      setPlans(res.data.plans || []);
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

  function openEdit(p: Plan) {
    setEditingId(p.id);
    setForm({
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      descriptionAr: p.descriptionAr || '',
      descriptionEn: p.descriptionEn || '',
      price: String(p.price),
      durationMonths: String(p.durationMonths),
      freeVisits: String(p.freeVisits),
      discountPercent: String(p.discountPercent),
      benefitsAr: p.benefitsAr || '',
      benefitsEn: p.benefitsEn || '',
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
        descriptionAr: form.descriptionAr.trim() || null,
        descriptionEn: form.descriptionEn.trim() || null,
        benefitsAr: form.benefitsAr.trim() || null,
        benefitsEn: form.benefitsEn.trim() || null,
        price: Number(form.price),
        durationMonths: Number(form.durationMonths),
        freeVisits: Number(form.freeVisits),
        discountPercent: Number(form.discountPercent),
      };
      if (editingId) {
        await api.put(`/plans/${editingId}`, payload);
        setMsg('✅ ' + t('sub_planUpdated'));
      } else {
        await api.post('/plans', payload);
        setMsg('✅ ' + t('sub_planAdded'));
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

  async function handleToggle(p: Plan) {
    try {
      await api.put(`/plans/${p.id}`, { isActive: !p.isActive });
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    }
  }

  async function handleDelete(p: Plan) {
    if (!confirm(`${t('md_confirmDelete')} "${isAr ? p.nameAr : p.nameEn}"؟`)) return;
    try {
      await api.delete(`/plans/${p.id}`);
      setMsg('✅ ' + t('sub_planDeleted'));
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_deleteFailed')));
    }
  }

  return (
    <div className="glass-panel space-y-4 rounded-xl p-5">
      <SectionHeader
        icon={BadgeCheck}
        title={t('sub_plans')}
        subtitle={t('sub_plansHint')}
        action={
          <PrimaryButton onClick={openAdd}>
            <PlusCircle size={16} /> {t('sub_addPlan')}
          </PrimaryButton>
        }
      />

      <Banner message={msg} />

      {loading ? (
        <p className="py-8 text-center text-sm text-zinc-500">{t('loading')}</p>
      ) : plans.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">{t('sub_noPlans')}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map(p => {
            const benefits = (isAr ? p.benefitsAr : p.benefitsEn)?.split('\n').filter(Boolean) || [];
            return (
              <div
                key={p.id}
                className={`flex flex-col rounded-xl border p-4 transition ${
                  p.isActive ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-900 bg-zinc-950/60 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-white">{isAr ? p.nameAr : p.nameEn}</h3>
                    <p className="text-[11px] text-zinc-500">{isAr ? p.nameEn : p.nameAr}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton onClick={() => openEdit(p)} title={t('edit')}>
                      <Edit2 size={14} />
                    </IconButton>
                    <IconButton tone="danger" onClick={() => handleDelete(p)} title={t('delete')}>
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>

                <div className="my-3 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-primary-text">{Number(p.price).toLocaleString()}</span>
                  <span className="text-xs text-zinc-500">
                    {t('sub_currency')} / {p.durationMonths} {t('sub_months')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-2 py-1.5">
                    <p className="text-[10px] text-zinc-500">{t('sub_freeVisits')}</p>
                    <p className="text-sm font-bold text-white">{p.freeVisits}</p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-2 py-1.5">
                    <p className="text-[10px] text-zinc-500">{t('sub_discount')}</p>
                    <p className="text-sm font-bold text-emerald-400">{Number(p.discountPercent)}%</p>
                  </div>
                </div>

                {benefits.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-zinc-400">
                        <span className="mt-0.5 text-emerald-500">✓</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-auto flex items-center justify-between border-t border-zinc-800 pt-3 text-[11px]">
                  <span className="flex items-center gap-1 text-zinc-500">
                    <Users size={12} /> {p._count.subscriptions} {t('sub_activeSubscribers')}
                  </span>
                  <button onClick={() => handleToggle(p)} className="cursor-pointer">
                    <StatusPill active={p.isActive} activeText={t('md_active')} inactiveText={t('md_inactive')} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal title={editingId ? t('sub_editPlan') : t('sub_addPlan')} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('md_nameAr')}>
                <TextInput required value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} />
              </Field>
              <Field label={t('md_nameEn')}>
                <TextInput required value={form.nameEn} onChange={e => setForm({ ...form, nameEn: e.target.value })} />
              </Field>
              <Field label={`${t('sub_price')} (${t('sub_currency')})`}>
                <TextInput
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })}
                />
              </Field>
              <Field label={t('sub_duration')} hint={t('sub_durationHint')}>
                <TextInput
                  type="number"
                  min={1}
                  max={120}
                  required
                  value={form.durationMonths}
                  onChange={e => setForm({ ...form, durationMonths: e.target.value })}
                />
              </Field>
              <Field label={t('sub_freeVisits')} hint={t('sub_freeVisitsHint')}>
                <TextInput
                  type="number"
                  min={0}
                  required
                  value={form.freeVisits}
                  onChange={e => setForm({ ...form, freeVisits: e.target.value })}
                />
              </Field>
              <Field label={`${t('sub_discount')} %`} hint={t('sub_discountHint')}>
                <TextInput
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  required
                  value={form.discountPercent}
                  onChange={e => setForm({ ...form, discountPercent: e.target.value })}
                />
              </Field>
            </div>

            <Field label={t('sub_benefitsAr')} hint={t('sub_benefitsHint')}>
              <TextArea rows={3} value={form.benefitsAr} onChange={e => setForm({ ...form, benefitsAr: e.target.value })} />
            </Field>
            <Field label={t('sub_benefitsEn')} hint={t('sub_benefitsHint')}>
              <TextArea rows={3} value={form.benefitsEn} onChange={e => setForm({ ...form, benefitsEn: e.target.value })} />
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
