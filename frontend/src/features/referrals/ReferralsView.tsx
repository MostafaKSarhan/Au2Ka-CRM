import React, { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Gift, Users, Crown, Coins, Search, Link2, Copy, Settings2, Plus, Minus, Wallet, Trophy,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/LanguageContext';
import {
  Field, TextInput, Select, PrimaryButton, GhostButton, Banner, Modal, TableShell,
} from '../admin/ui';

interface Referral {
  id: string;
  code: string;
  status: 'PENDING' | 'REGISTERED' | 'COMPLETED' | 'EXPIRED';
  registeredAt: string | null;
  firstVisitAt: string | null;
  referrerReward: number;
  referredReward: number;
  referrer: { id: string; fullName: string; mobileNumber: string; tier: string };
  referred: { id: string; fullName: string; mobileNumber: string } | null;
}

const TIER_STYLES: Record<string, string> = {
  REGULAR: 'border-zinc-700 bg-zinc-800/60 text-zinc-400',
  SILVER: 'border-slate-400/30 bg-slate-400/10 text-slate-300',
  GOLD: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
  PLATINUM: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'border-zinc-700 bg-zinc-800/60 text-zinc-500',
  REGISTERED: 'border-sky-500/25 bg-sky-500/10 text-sky-400',
  COMPLETED: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
  EXPIRED: 'border-red-500/25 bg-red-500/10 text-red-400',
};

export function ReferralsView() {
  const { lang, t } = useTranslation();
  const { user } = useAuthStore();
  const isAr = lang === 'ar';
  const isAdmin = user?.role === 'ADMIN';

  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [report, setReport] = useState<any | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<any>({});
  const [showLink, setShowLink] = useState(false);
  const [linkForm, setLinkForm] = useState({ code: '', referredId: '' });
  const [codeFor, setCodeFor] = useState<any | null>(null);
  const [wallet, setWallet] = useState<any | null>(null);
  const [adjustForm, setAdjustForm] = useState({ points: '', reasonAr: '', reasonEn: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [search, status]);

  useEffect(() => {
    loadAux();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '50' };
      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;

      const [listRes, reportRes] = await Promise.all([
        api.get('/referrals', { params }),
        api.get('/referrals/report'),
      ]);
      setReferrals(listRes.data.referrals || []);
      setReport(reportRes.data);
    } catch {
      setMsg('❌ ' + t('md_loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function loadAux() {
    try {
      const [custRes, setRes] = await Promise.all([
        api.get('/customers', { params: { limit: '100' } }),
        api.get('/referrals/settings'),
      ]);
      setCustomers(custRes.data.customers || []);
      setSettings(setRes.data.settings);
    } catch {
      /* optional */
    }
  }

  function openSettings() {
    setSettingsForm({
      rewardType: settings?.rewardType || 'POINTS',
      referrerPoints: String(settings?.referrerPoints ?? 100),
      referredPoints: String(settings?.referredPoints ?? 50),
      pointValue: String(settings?.pointValue ?? 1),
      pointsPerRiyal: String(settings?.pointsPerRiyal ?? 0),
      tierBasis: settings?.tierBasis || 'SPEND',
      silverThreshold: String(settings?.silverThreshold ?? 1000),
      goldThreshold: String(settings?.goldThreshold ?? 5000),
      platinumThreshold: String(settings?.platinumThreshold ?? 15000),
    });
    setMsg('');
    setShowSettings(true);
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/referrals/settings', {
        rewardType: settingsForm.rewardType,
        referrerPoints: Number(settingsForm.referrerPoints),
        referredPoints: Number(settingsForm.referredPoints),
        pointValue: Number(settingsForm.pointValue),
        pointsPerRiyal: Number(settingsForm.pointsPerRiyal),
        tierBasis: settingsForm.tierBasis,
        silverThreshold: Number(settingsForm.silverThreshold),
        goldThreshold: Number(settingsForm.goldThreshold),
        platinumThreshold: Number(settingsForm.platinumThreshold),
      });
      setSettings(res.data.settings);
      setMsg('✅ ' + t('ref_settingsSaved'));
      setShowSettings(false);
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function submitLink(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/referrals/link', linkForm);
      setMsg('✅ ' + t('ref_linked'));
      setShowLink(false);
      setLinkForm({ code: '', referredId: '' });
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function openCode(customerId: string) {
    try {
      const res = await api.get(`/referrals/customer/${customerId}/code`);
      const customer = customers.find(c => c.id === customerId);
      setCodeFor({ ...res.data, customerName: customer?.fullName || '' });
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_loadFailed')));
    }
  }

  async function openWallet(customerId: string) {
    try {
      const res = await api.get(`/referrals/customer/${customerId}/wallet`);
      setWallet(res.data);
      setAdjustForm({ points: '', reasonAr: '', reasonEn: '' });
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_loadFailed')));
    }
  }

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet) return;
    setSaving(true);
    try {
      await api.post(`/referrals/customer/${wallet.customer.id}/adjust`, {
        points: Number(adjustForm.points),
        reasonAr: adjustForm.reasonAr,
        reasonEn: adjustForm.reasonEn || adjustForm.reasonAr,
      });
      setMsg('✅ ' + t('ref_adjusted'));
      openWallet(wallet.customer.id);
      setAdjustForm({ points: '', reasonAr: '', reasonEn: '' });
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  const shareUrl = codeFor ? `${window.location.origin}/?ref=${codeFor.code}` : '';

  const statusLabel: Record<string, string> = {
    PENDING: t('ref_statusPending'),
    REGISTERED: t('ref_statusRegistered'),
    COMPLETED: t('ref_statusCompleted'),
    EXPIRED: t('ref_statusExpired'),
  };

  const tierLabel: Record<string, string> = {
    REGULAR: t('ref_tierRegular'),
    SILVER: t('ref_tierSilver'),
    GOLD: t('ref_tierGold'),
    PLATINUM: t('ref_tierPlatinum'),
  };

  return (
    <div className={`space-y-6 ${isAr ? 'text-right' : 'text-left'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{t('referrals')}</h1>
          <p className="text-sm text-zinc-400">{t('ref_subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrimaryButton onClick={() => setShowLink(true)}>
            <Link2 size={16} /> {t('ref_link')}
          </PrimaryButton>
          {isAdmin && (
            <GhostButton onClick={openSettings}>
              <Settings2 size={15} /> {t('ref_settings')}
            </GhostButton>
          )}
        </div>
      </div>

      <Banner message={msg} />

      {report && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={Users}
            label={t('ref_statCompleted')}
            value={report.byStatus?.COMPLETED || 0}
            tone="emerald"
          />
          <Stat
            icon={Gift}
            label={t('ref_statPending')}
            value={(report.byStatus?.REGISTERED || 0) + (report.byStatus?.PENDING || 0)}
            tone="sky"
          />
          <Stat icon={Crown} label={t('ref_statPlatinum')} value={report.tiers?.PLATINUM || 0} tone="amber" />
          <Stat
            icon={Coins}
            label={t('ref_statPoints')}
            value={`${report.outstandingPoints} (${report.outstandingValue} ${t('sub_currency')})`}
            tone="primary"
          />
        </div>
      )}

      {/* Top referrers */}
      {report?.topReferrers?.length > 0 && (
        <div className="glass-panel rounded-xl p-5">
          <h2 className="mb-3 flex items-center gap-2 border-b border-zinc-800 pb-2 text-sm font-bold text-white">
            <Trophy size={16} className="text-amber-400" /> {t('ref_topReferrers')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {report.topReferrers.map((r: any, i: number) => (
              <button
                key={r.customer?.id || i}
                onClick={() => r.customer && openCode(r.customer.id)}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs transition hover:border-primary/40"
              >
                <span className="font-bold text-amber-400">#{i + 1}</span>
                <span className="font-semibold text-white">{r.customer?.fullName || '—'}</span>
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                  {r.count} {t('ref_broughtIn')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Customers: code + wallet */}
      <div className="glass-panel space-y-3 rounded-xl p-5">
        <h2 className="border-b border-zinc-800 pb-2 text-sm font-bold text-white">
          {t('ref_customerWallets')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {customers.slice(0, 30).map(c => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2.5 py-1.5 text-xs"
            >
              <span className="font-semibold text-white">{c.fullName}</span>
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${TIER_STYLES[c.tier || 'REGULAR']}`}>
                {tierLabel[c.tier || 'REGULAR']}
              </span>
              <span className="font-mono text-[10px] text-amber-400">{c.pointsBalance ?? 0}</span>
              <button
                onClick={() => openCode(c.id)}
                className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-zinc-500 transition hover:bg-zinc-800 hover:text-primary-text"
                title={t('ref_showCode')}
              >
                <Gift size={14} />
              </button>
              <button
                onClick={() => openWallet(c.id)}
                className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-zinc-500 transition hover:bg-zinc-800 hover:text-primary-text"
                title={t('ref_wallet')}
              >
                <Wallet size={14} />
              </button>
            </div>
          ))}
          {customers.length === 0 && <p className="text-sm text-zinc-500">{t('ref_noCustomers')}</p>}
        </div>
      </div>

      {/* Referrals list */}
      <div className="glass-panel space-y-4 rounded-xl p-5">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 text-zinc-600 start-3" />
            <TextInput
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('ref_search')}
              className="ps-9"
            />
          </div>
          <Select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">{t('sub_allStatuses')}</option>
            <option value="REGISTERED">{t('ref_statusRegistered')}</option>
            <option value="COMPLETED">{t('ref_statusCompleted')}</option>
            <option value="EXPIRED">{t('ref_statusExpired')}</option>
          </Select>
        </div>

        <TableShell
          headers={[t('ref_referrer'), t('ref_referred'), t('md_code'), t('ref_firstVisit'), t('ref_reward'), t('md_status')]}
          loading={loading}
          loadingText={t('loading')}
          isEmpty={referrals.length === 0}
          empty={t('ref_none')}
        >
          {referrals.map(r => (
            <tr key={r.id} className="border-b border-zinc-900 transition hover:bg-zinc-900/40">
              <td className="px-3 py-2.5">
                <span className="font-semibold text-white">{r.referrer.fullName}</span>
                <span className={`ms-2 rounded border px-1.5 py-0.5 text-[10px] font-bold ${TIER_STYLES[r.referrer.tier]}`}>
                  {tierLabel[r.referrer.tier]}
                </span>
              </td>
              <td className="px-3 py-2.5 text-zinc-300">{r.referred?.fullName || '—'}</td>
              <td className="px-3 py-2.5 font-mono text-xs text-primary-text">{r.code}</td>
              <td className="px-3 py-2.5 font-mono text-[11px] text-zinc-500" dir="ltr">
                {r.firstVisitAt ? r.firstVisitAt.slice(0, 10) : '—'}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-amber-400">
                {r.referrerReward > 0 ? `+${r.referrerReward}` : '—'}
              </td>
              <td className="px-3 py-2.5">
                <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLES[r.status]}`}>
                  {statusLabel[r.status]}
                </span>
              </td>
            </tr>
          ))}
        </TableShell>
      </div>

      <p className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-[11px] leading-relaxed text-zinc-500">
        {t('ref_scopeNote')}
      </p>

      {/* Reward rule */}
      {showSettings && (
        <Modal title={t('ref_settings')} onClose={() => setShowSettings(false)}>
          <form onSubmit={saveSettings} className="space-y-3">
            <Field label={t('ref_rewardType')}>
              <Select
                value={settingsForm.rewardType}
                onChange={e => setSettingsForm({ ...settingsForm, rewardType: e.target.value })}
              >
                <option value="POINTS">{t('ref_rewardPoints')}</option>
                <option value="DISCOUNT">{t('ref_rewardDiscount')}</option>
                <option value="FREE_SERVICE">{t('ref_rewardFreeService')}</option>
              </Select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('ref_referrerPoints')}>
                <TextInput
                  type="number"
                  min={0}
                  value={settingsForm.referrerPoints}
                  onChange={e => setSettingsForm({ ...settingsForm, referrerPoints: e.target.value })}
                />
              </Field>
              <Field label={t('ref_referredPoints')}>
                <TextInput
                  type="number"
                  min={0}
                  value={settingsForm.referredPoints}
                  onChange={e => setSettingsForm({ ...settingsForm, referredPoints: e.target.value })}
                />
              </Field>
              <Field label={t('ref_pointValue')} hint={t('ref_pointValueHint')}>
                <TextInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={settingsForm.pointValue}
                  onChange={e => setSettingsForm({ ...settingsForm, pointValue: e.target.value })}
                />
              </Field>
              <Field label={t('ref_pointsPerRiyal')} hint={t('ref_pointsPerRiyalHint')}>
                <TextInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={settingsForm.pointsPerRiyal}
                  onChange={e => setSettingsForm({ ...settingsForm, pointsPerRiyal: e.target.value })}
                />
              </Field>
            </div>

            <Field label={t('ref_tierBasis')}>
              <Select
                value={settingsForm.tierBasis}
                onChange={e => setSettingsForm({ ...settingsForm, tierBasis: e.target.value })}
              >
                <option value="SPEND">{t('ref_basisSpend')}</option>
                <option value="SUBSCRIPTION">{t('ref_basisSubscription')}</option>
              </Select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('ref_silverThreshold')} hint={t('ref_thresholdHint')}>
                <TextInput
                  type="number"
                  min={0}
                  value={settingsForm.silverThreshold}
                  onChange={e => setSettingsForm({ ...settingsForm, silverThreshold: e.target.value })}
                />
              </Field>
              <Field label={t('ref_goldThreshold')}>
                <TextInput
                  type="number"
                  min={0}
                  value={settingsForm.goldThreshold}
                  onChange={e => setSettingsForm({ ...settingsForm, goldThreshold: e.target.value })}
                />
              </Field>
              <Field label={t('ref_platinumThreshold')}>
                <TextInput
                  type="number"
                  min={0}
                  value={settingsForm.platinumThreshold}
                  onChange={e => setSettingsForm({ ...settingsForm, platinumThreshold: e.target.value })}
                />
              </Field>
            </div>

            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={saving} className="flex-1">
                {saving ? t('loading') : t('save')}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setShowSettings(false)}>
                {t('cancel')}
              </GhostButton>
            </div>
          </form>
        </Modal>
      )}

      {/* Link a new customer to a code */}
      {showLink && (
        <Modal title={t('ref_link')} onClose={() => setShowLink(false)}>
          <form onSubmit={submitLink} className="space-y-3">
            <p className="text-[11px] leading-relaxed text-zinc-500">{t('ref_linkHint')}</p>
            <Field label={t('ref_code')}>
              <TextInput
                required
                value={linkForm.code}
                onChange={e => setLinkForm({ ...linkForm, code: e.target.value.toUpperCase() })}
                placeholder="A7K2PQ"
              />
            </Field>
            <Field label={t('ref_newCustomer')}>
              <Select
                required
                value={linkForm.referredId}
                onChange={e => setLinkForm({ ...linkForm, referredId: e.target.value })}
              >
                <option value="">{t('sub_selectCustomer')}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} — {c.mobileNumber}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={saving} className="flex-1">
                {saving ? t('loading') : t('save')}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setShowLink(false)}>
                {t('cancel')}
              </GhostButton>
            </div>
          </form>
        </Modal>
      )}

      {/* Referral code + QR */}
      {codeFor && (
        <Modal title={`${t('ref_showCode')} — ${codeFor.customerName}`} onClose={() => setCodeFor(null)}>
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-center">
              <p className="text-[11px] text-zinc-500">{t('ref_code')}</p>
              <p className="font-mono text-3xl font-black tracking-widest text-primary-text">{codeFor.code}</p>
            </div>

            <div className="flex justify-center rounded-xl bg-white p-4">
              <QRCodeCanvas value={shareUrl} size={160} level="M" />
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
              <p className="break-all font-mono text-[11px] text-zinc-400" dir="ltr">
                {shareUrl}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                <p className="text-[11px] text-zinc-500">{t('ref_statCompleted')}</p>
                <p className="text-lg font-bold text-emerald-400">{codeFor.counts.completed}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                <p className="text-[11px] text-zinc-500">{t('ref_statPending')}</p>
                <p className="text-lg font-bold text-sky-400">{codeFor.counts.pending}</p>
              </div>
            </div>

            <PrimaryButton
              onClick={() => {
                navigator.clipboard?.writeText(shareUrl);
                setMsg('✅ ' + t('vf_linkCopied'));
              }}
              className="w-full"
            >
              <Copy size={15} /> {t('vf_copyLink')}
            </PrimaryButton>
          </div>
        </Modal>
      )}

      {/* Points wallet */}
      {wallet && (
        <Modal title={`${t('ref_wallet')} — ${wallet.customer.fullName}`} onClose={() => setWallet(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-2">
                <p className="text-[10px] text-zinc-500">{t('ref_balance')}</p>
                <p className="text-lg font-bold text-amber-400">{wallet.customer.pointsBalance}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-2">
                <p className="text-[10px] text-zinc-500">{t('ref_value')}</p>
                <p className="text-lg font-bold text-emerald-400">{wallet.valueInRiyals}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-2">
                <p className="text-[10px] text-zinc-500">{t('ref_tier')}</p>
                <p className={`text-sm font-bold ${TIER_STYLES[wallet.customer.tier].split(' ').pop()}`}>
                  {tierLabel[wallet.customer.tier]}
                </p>
              </div>
            </div>

            {isAdmin && (
              <form onSubmit={submitAdjust} className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <p className="text-[11px] font-bold text-zinc-400">{t('ref_adjust')}</p>
                <div className="flex gap-2">
                  <TextInput
                    type="number"
                    required
                    value={adjustForm.points}
                    onChange={e => setAdjustForm({ ...adjustForm, points: e.target.value })}
                    placeholder="+50 / -50"
                    className="w-28"
                  />
                  <TextInput
                    required
                    value={adjustForm.reasonAr}
                    onChange={e => setAdjustForm({ ...adjustForm, reasonAr: e.target.value })}
                    placeholder={t('ref_adjustReason')}
                  />
                  <GhostButton type="submit" disabled={saving} className="!px-3">
                    {Number(adjustForm.points) < 0 ? <Minus size={14} /> : <Plus size={14} />}
                  </GhostButton>
                </div>
              </form>
            )}

            {wallet.entries.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">{t('ref_noEntries')}</p>
            ) : (
              <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                {wallet.entries.map((e: any) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-zinc-300">{isAr ? e.reasonAr : e.reasonEn}</p>
                      <p className="font-mono text-[10px] text-zinc-600" dir="ltr">
                        {e.createdAt.slice(0, 10)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-mono text-sm font-bold ${
                        e.points > 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {e.points > 0 ? '+' : ''}
                      {e.points}
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

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  tone: 'emerald' | 'sky' | 'amber' | 'primary';
}) {
  const tones: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    sky: 'text-sky-400 bg-sky-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    primary: 'text-primary-text bg-primary/10',
  };
  return (
    <div className="glass-panel flex items-center gap-3 rounded-xl p-4">
      <span className={`rounded-lg p-2.5 ${tones[tone]}`}>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-zinc-500">{label}</p>
        <p className="truncate text-base font-bold text-white">{value}</p>
      </div>
    </div>
  );
}
