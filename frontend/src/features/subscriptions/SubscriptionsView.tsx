import React, { useEffect, useState } from 'react';
import {
  BadgeCheck, PlusCircle, Search, RefreshCw, AlertTriangle, Trash2,
  Wallet, Users, Ticket, CalendarClock, X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/LanguageContext';
import {
  Field, TextInput, TextArea, Select, PrimaryButton, GhostButton,
  IconButton, Banner, Modal, TableShell,
} from '../admin/ui';

interface Subscription {
  id: string;
  subscriptionNumber: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  startDate: string;
  endDate: string;
  freeVisitsTotal: number;
  freeVisitsUsed: number;
  freeVisitsRemaining: number;
  discountPercent: string;
  paidAmount: string;
  paymentMethod: string | null;
  daysRemaining: number;
  hasStarted: boolean;
  customer: { id: string; fullName: string; mobileNumber: string };
  vehicle: { id: string; brand: string; model: string; plateNumber: string } | null;
  plan: { id: string; nameAr: string; nameEn: string; price: string; durationMonths: number };
}

interface Stats {
  counts: { active: number; expired: number; cancelled: number; total: number };
  revenue: string | number;
  freeVisits: { total: number; used: number; remaining: number };
  byPlan: Array<{ planId: string; count: number; plan: { nameAr: string; nameEn: string } | null }>;
  expiringSoon: Subscription[];
}

const emptyForm = {
  customerId: '',
  vehicleId: '',
  planId: '',
  paidAmount: '',
  paymentMethod: 'CASH',
  paymentNote: '',
  notes: '',
};

export function SubscriptionsView() {
  const { lang, t } = useTranslation();
  const { user } = useAuthStore();
  const isAr = lang === 'ar';
  const isAdmin = user?.role === 'ADMIN';

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [renewing, setRenewing] = useState<Subscription | null>(null);

  useEffect(() => {
    load();
  }, [search, status, expiringOnly, page]);

  useEffect(() => {
    loadLookups();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;
      if (expiringOnly) params.expiringInDays = '30';

      const [listRes, statsRes] = await Promise.all([
        api.get('/subscriptions', { params }),
        api.get('/subscriptions/stats'),
      ]);
      setSubs(listRes.data.subscriptions || []);
      setTotalPages(listRes.data.pagination?.pages || 1);
      setStats(statsRes.data);
    } catch {
      setMsg('❌ ' + t('md_loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function loadLookups() {
    try {
      const [planRes, custRes] = await Promise.all([
        api.get('/plans', { params: { activeOnly: 'true' } }),
        api.get('/customers', { params: { limit: '100' } }),
      ]);
      setPlans(planRes.data.plans || []);
      setCustomers(custRes.data.customers || []);
    } catch (e) {
      console.error(e);
    }
  }

  // The vehicle list is scoped to the chosen customer.
  useEffect(() => {
    const customer = customers.find(c => c.id === form.customerId);
    setVehicles(customer?.vehicles || []);
    setForm(f => ({ ...f, vehicleId: '' }));
  }, [form.customerId, customers]);

  function openAdd() {
    setForm({ ...emptyForm, planId: plans[0]?.id || '' });
    setMsg('');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await api.post('/subscriptions', {
        customerId: form.customerId,
        vehicleId: form.vehicleId || null,
        planId: form.planId,
        paidAmount: form.paidAmount ? Number(form.paidAmount) : 0,
        paymentMethod: form.paymentMethod || null,
        paymentNote: form.paymentNote.trim() || null,
        notes: form.notes.trim() || null,
      });
      setMsg('✅ ' + t('sub_added'));
      setShowForm(false);
      setForm(emptyForm);
      load();
      loadLookups();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function handleRenew(e: React.FormEvent) {
    e.preventDefault();
    if (!renewing) return;
    setSaving(true);
    setMsg('');
    try {
      await api.post(`/subscriptions/${renewing.id}/renew`, {
        paidAmount: form.paidAmount ? Number(form.paidAmount) : 0,
        paymentMethod: form.paymentMethod || null,
        ...(form.planId && form.planId !== renewing.plan.id ? { planId: form.planId } : {}),
      });
      setMsg('✅ ' + t('sub_renewed'));
      setRenewing(null);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(s: Subscription) {
    if (!confirm(`${t('sub_confirmCancel')} ${s.subscriptionNumber}؟`)) return;
    try {
      await api.put(`/subscriptions/${s.id}`, { status: 'CANCELLED' });
      setMsg('✅ ' + t('sub_cancelled'));
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    }
  }

  async function handleDelete(s: Subscription) {
    if (!confirm(`${t('md_confirmDelete')} ${s.subscriptionNumber}؟`)) return;
    try {
      await api.delete(`/subscriptions/${s.id}`);
      setMsg('✅ ' + t('sub_deleted'));
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_deleteFailed')));
    }
  }

  async function openDetail(s: Subscription) {
    try {
      const res = await api.get(`/subscriptions/${s.id}`);
      setDetail(res.data.subscription);
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_loadFailed')));
    }
  }

  function statusPill(s: Subscription) {
    if (s.status === 'ACTIVE' && !s.hasStarted) {
      return (
        <span className="rounded border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[11px] font-bold text-sky-400">
          {t('sub_notStarted')}
        </span>
      );
    }
    const map: Record<string, string> = {
      ACTIVE: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
      EXPIRED: 'border-zinc-700 bg-zinc-800/60 text-zinc-500',
      CANCELLED: 'border-red-500/20 bg-red-500/10 text-red-400',
    };
    const label: Record<string, string> = {
      ACTIVE: t('sub_statusActive'),
      EXPIRED: t('sub_statusExpired'),
      CANCELLED: t('sub_statusCancelled'),
    };
    return (
      <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${map[s.status]}`}>
        {label[s.status]}
      </span>
    );
  }

  const selectedPlan = plans.find(p => p.id === form.planId);

  return (
    <div className={`space-y-6 ${isAr ? 'text-right' : 'text-left'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{t('subscriptions')}</h1>
          <p className="text-sm text-zinc-400">{t('sub_subtitle')}</p>
        </div>
        <PrimaryButton onClick={openAdd} disabled={plans.length === 0}>
          <PlusCircle size={16} /> {t('sub_add')}
        </PrimaryButton>
      </div>

      <Banner message={msg} />

      {/* Summary */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Users} label={t('sub_statActive')} value={stats.counts.active} tone="emerald" />
          <StatCard
            icon={Wallet}
            label={t('sub_statRevenue')}
            value={`${Number(stats.revenue).toLocaleString()} ${t('sub_currency')}`}
            tone="primary"
          />
          <StatCard
            icon={Ticket}
            label={t('sub_statFreeVisits')}
            value={`${stats.freeVisits.remaining} / ${stats.freeVisits.total}`}
            tone="sky"
          />
          <StatCard
            icon={CalendarClock}
            label={t('sub_statExpiring')}
            value={stats.expiringSoon.length}
            tone="amber"
          />
        </div>
      )}

      {/* Expiry warnings */}
      {stats && stats.expiringSoon.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-amber-400">
            <AlertTriangle size={17} />
            <h2 className="text-sm font-bold">{t('sub_expiringTitle')}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.expiringSoon.slice(0, 8).map(s => (
              <button
                key={s.id}
                onClick={() => {
                  setRenewing(s);
                  setForm({ ...emptyForm, planId: s.plan.id, paidAmount: String(s.plan.price) });
                }}
                className="cursor-pointer rounded-lg border border-amber-500/20 bg-zinc-900/70 px-3 py-1.5 text-xs transition hover:border-amber-500/50"
              >
                <span className="font-bold text-white">{s.customer.fullName}</span>
                <span className="ms-2 text-amber-400">
                  {s.daysRemaining} {t('sub_daysLeft')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass-panel space-y-4 rounded-xl p-5">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 text-zinc-600 start-3" />
            <TextInput
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t('sub_search')}
              className="ps-9"
            />
          </div>
          <Select
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('sub_allStatuses')}</option>
            <option value="ACTIVE">{t('sub_statusActive')}</option>
            <option value="EXPIRED">{t('sub_statusExpired')}</option>
            <option value="CANCELLED">{t('sub_statusCancelled')}</option>
          </Select>
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs font-semibold text-zinc-400">
          <input
            type="checkbox"
            checked={expiringOnly}
            onChange={e => {
              setExpiringOnly(e.target.checked);
              setPage(1);
            }}
            className="cursor-pointer accent-red-600"
          />
          <CalendarClock size={14} className="text-amber-500" />
          {t('sub_expiringFilter')}
        </label>

        <TableShell
          headers={[
            t('sub_number'), t('sub_customer'), t('sub_plan'), t('sub_vehicle'),
            t('sub_period'), t('sub_visitsBalance'), t('sub_paid'), t('md_status'), t('actions'),
          ]}
          loading={loading}
          loadingText={t('loading')}
          isEmpty={subs.length === 0}
          empty={t('sub_none')}
        >
          {subs.map(s => (
            <tr key={s.id} className="border-b border-zinc-900 transition hover:bg-zinc-900/40">
              <td className="px-3 py-2.5">
                <button
                  onClick={() => openDetail(s)}
                  className="cursor-pointer font-mono text-xs text-primary hover:underline"
                >
                  {s.subscriptionNumber}
                </button>
              </td>
              <td className="px-3 py-2.5">
                <span className="font-semibold text-white">{s.customer.fullName}</span>
                <span className="block font-mono text-[11px] text-zinc-600" dir="ltr">
                  {s.customer.mobileNumber}
                </span>
              </td>
              <td className="px-3 py-2.5 text-zinc-400">{isAr ? s.plan.nameAr : s.plan.nameEn}</td>
              <td className="px-3 py-2.5 text-xs text-zinc-400">
                {s.vehicle ? s.vehicle.plateNumber : <span className="text-zinc-600">{t('sub_allVehicles')}</span>}
              </td>
              <td className="px-3 py-2.5 font-mono text-[11px] text-zinc-500" dir="ltr">
                {s.startDate.slice(0, 10)} → {s.endDate.slice(0, 10)}
                {s.status === 'ACTIVE' && s.hasStarted && (
                  <span className={`block ${s.daysRemaining <= 30 ? 'text-amber-400' : 'text-zinc-600'}`}>
                    {s.daysRemaining} {t('sub_daysLeft')}
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5">
                <span
                  className={`font-mono text-xs font-bold ${
                    s.freeVisitsRemaining > 0 ? 'text-emerald-400' : 'text-zinc-500'
                  }`}
                >
                  {s.freeVisitsRemaining} / {s.freeVisitsTotal}
                </span>
                {Number(s.discountPercent) > 0 && (
                  <span className="block text-[10px] text-zinc-500">
                    {t('sub_thenDiscount')} {Number(s.discountPercent)}%
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-zinc-300">{Number(s.paidAmount).toLocaleString()}</td>
              <td className="px-3 py-2.5">{statusPill(s)}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1">
                  <IconButton
                    onClick={() => {
                      setRenewing(s);
                      setForm({ ...emptyForm, planId: s.plan.id, paidAmount: String(s.plan.price) });
                    }}
                    title={t('sub_renew')}
                  >
                    <RefreshCw size={15} />
                  </IconButton>
                  {s.status === 'ACTIVE' && (
                    <IconButton tone="danger" onClick={() => handleCancel(s)} title={t('sub_cancel')}>
                      <X size={15} />
                    </IconButton>
                  )}
                  {isAdmin && (
                    <IconButton tone="danger" onClick={() => handleDelete(s)} title={t('delete')}>
                      <Trash2 size={15} />
                    </IconButton>
                  )}
                </div>
              </td>
            </tr>
          ))}
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
      </div>

      {/* New subscription */}
      {showForm && (
        <Modal title={t('sub_add')} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label={t('sub_customer')}>
              <Select required value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })}>
                <option value="">{t('sub_selectCustomer')}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} — {c.mobileNumber}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('sub_vehicle')} hint={t('sub_vehicleHint')}>
              <Select
                value={form.vehicleId}
                onChange={e => setForm({ ...form, vehicleId: e.target.value })}
                disabled={!form.customerId}
              >
                <option value="">{t('sub_allVehicles')}</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.brand} {v.model} — {v.plateNumber}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('sub_plan')}>
              <Select
                required
                value={form.planId}
                onChange={e => {
                  const p = plans.find(x => x.id === e.target.value);
                  setForm({ ...form, planId: e.target.value, paidAmount: p ? String(p.price) : form.paidAmount });
                }}
              >
                <option value="">{t('sub_selectPlan')}</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {(isAr ? p.nameAr : p.nameEn)} — {Number(p.price).toLocaleString()} {t('sub_currency')}
                  </option>
                ))}
              </Select>
            </Field>

            {selectedPlan && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-400">
                {t('sub_freeVisits')}: <b className="text-white">{selectedPlan.freeVisits}</b> ·{' '}
                {t('sub_discount')}: <b className="text-emerald-400">{Number(selectedPlan.discountPercent)}%</b> ·{' '}
                {t('sub_duration')}: <b className="text-white">{selectedPlan.durationMonths}</b> {t('sub_months')}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`${t('sub_paid')} (${t('sub_currency')})`} hint={t('sub_paidHint')}>
                <TextInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.paidAmount}
                  onChange={e => setForm({ ...form, paidAmount: e.target.value })}
                />
              </Field>
              <Field label={t('sub_paymentMethod')}>
                <Select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}>
                  <option value="CASH">{t('sub_payCash')}</option>
                  <option value="TRANSFER">{t('sub_payTransfer')}</option>
                  <option value="CARD">{t('sub_payCard')}</option>
                  <option value="OTHER">{t('sub_payOther')}</option>
                </Select>
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

      {/* Renewal */}
      {renewing && (
        <Modal title={`${t('sub_renew')} — ${renewing.subscriptionNumber}`} onClose={() => setRenewing(null)}>
          <form onSubmit={handleRenew} className="space-y-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-400">
              <p>
                {t('sub_customer')}: <b className="text-white">{renewing.customer.fullName}</b>
              </p>
              <p className="mt-1" dir="ltr">
                {t('sub_currentEnds')}: <b className="text-white">{renewing.endDate.slice(0, 10)}</b>
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">{t('sub_renewHint')}</p>
            </div>

            <Field label={t('sub_plan')}>
              <Select value={form.planId} onChange={e => setForm({ ...form, planId: e.target.value })}>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>
                    {(isAr ? p.nameAr : p.nameEn)} — {Number(p.price).toLocaleString()} {t('sub_currency')}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={`${t('sub_paid')} (${t('sub_currency')})`}>
                <TextInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.paidAmount}
                  onChange={e => setForm({ ...form, paidAmount: e.target.value })}
                />
              </Field>
              <Field label={t('sub_paymentMethod')}>
                <Select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })}>
                  <option value="CASH">{t('sub_payCash')}</option>
                  <option value="TRANSFER">{t('sub_payTransfer')}</option>
                  <option value="CARD">{t('sub_payCard')}</option>
                  <option value="OTHER">{t('sub_payOther')}</option>
                </Select>
              </Field>
            </div>

            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={saving} className="flex-1">
                {saving ? t('loading') : t('sub_renew')}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setRenewing(null)}>
                {t('cancel')}
              </GhostButton>
            </div>
          </form>
        </Modal>
      )}

      {/* Usage history */}
      {detail && (
        <Modal title={`${t('sub_usageTitle')} — ${detail.subscriptionNumber}`} onClose={() => setDetail(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                <p className="text-[11px] text-zinc-500">{t('sub_visitsBalance')}</p>
                <p className="text-lg font-bold text-white">
                  {detail.freeVisitsRemaining} / {detail.freeVisitsTotal}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                <p className="text-[11px] text-zinc-500">{t('sub_discount')}</p>
                <p className="text-lg font-bold text-emerald-400">{Number(detail.discountPercent)}%</p>
              </div>
            </div>

            {detail.usages?.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">{t('sub_noUsage')}</p>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {detail.usages.map((u: any) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-mono text-primary">{u.jobCard?.jobNumber}</span>
                      <span className="block text-[11px] text-zinc-500">{u.note}</span>
                    </div>
                    <span
                      className={`rounded border px-2 py-0.5 text-[10px] font-bold ${
                        u.type === 'FREE_VISIT'
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                          : 'border-sky-500/20 bg-sky-500/10 text-sky-400'
                      }`}
                    >
                      {u.type === 'FREE_VISIT' ? t('sub_freeVisit') : `${Number(u.discountPercent)}%`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  tone: 'emerald' | 'primary' | 'sky' | 'amber';
}) {
  const tones: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    primary: 'text-primary bg-primary/10',
    sky: 'text-sky-400 bg-sky-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
  };
  return (
    <div className="glass-panel flex items-center gap-3 rounded-xl p-4">
      <span className={`rounded-lg p-2.5 ${tones[tone]}`}>
        <Icon size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-zinc-500">{label}</p>
        <p className="truncate text-lg font-bold text-white">{value}</p>
      </div>
    </div>
  );
}
