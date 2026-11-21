import React, { useEffect, useState } from 'react';
import { Receipt, KeyRound, Save, ShieldCheck, AlertTriangle, Copy, Link2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../store/LanguageContext';
import { SectionHeader, Field, TextInput, Select, PrimaryButton, GhostButton, Banner } from './ui';

interface Settings {
  sellerNameAr: string | null;
  sellerNameEn: string | null;
  vatNumber: string | null;
  crnNumber: string | null;
  street: string | null;
  buildingNumber: string | null;
  district: string | null;
  city: string | null;
  postalCode: string | null;
  countryCode: string;
  environment: 'SANDBOX' | 'SIMULATION' | 'PRODUCTION';
  vatRate: string;
  isEnabled: boolean;
  onboardedAt: string | null;
  lastError: string | null;
  hasPrivateKey: boolean;
  hasComplianceCsid: boolean;
  hasProductionCsid: boolean;
  csrSubject: string | null;
  missingFields: string[];
}

const empty = {
  sellerNameAr: '', sellerNameEn: '', vatNumber: '', crnNumber: '',
  street: '', buildingNumber: '', district: '', city: '', postalCode: '',
  environment: 'SANDBOX', vatRate: '15',
  productionCsid: '', productionSecret: '',
};

export function ZatcaTab() {
  const { t } = useTranslation();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [chain, setChain] = useState<any | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/zatca/settings');
      const s: Settings = res.data.settings;
      setSettings(s);
      setForm({
        sellerNameAr: s.sellerNameAr || '',
        sellerNameEn: s.sellerNameEn || '',
        vatNumber: s.vatNumber || '',
        crnNumber: s.crnNumber || '',
        street: s.street || '',
        buildingNumber: s.buildingNumber || '',
        district: s.district || '',
        city: s.city || '',
        postalCode: s.postalCode || '',
        environment: s.environment,
        vatRate: String(s.vatRate),
        productionCsid: '',
        productionSecret: '',
      });
    } catch {
      setMsg('❌ ' + t('md_loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function save(extra: Record<string, unknown> = {}) {
    setSaving(true);
    setMsg('');
    try {
      const payload: any = {
        sellerNameAr: form.sellerNameAr.trim() || null,
        sellerNameEn: form.sellerNameEn.trim() || null,
        vatNumber: form.vatNumber.trim() || null,
        crnNumber: form.crnNumber.trim() || null,
        street: form.street.trim() || null,
        buildingNumber: form.buildingNumber.trim() || null,
        district: form.district.trim() || null,
        city: form.city.trim() || null,
        postalCode: form.postalCode.trim() || null,
        environment: form.environment,
        vatRate: Number(form.vatRate),
        ...extra,
      };
      // Empty means keep the stored secret, never erase it.
      if (form.productionCsid.trim()) payload.productionCsid = form.productionCsid.trim();
      if (form.productionSecret.trim()) payload.productionSecret = form.productionSecret.trim();

      const res = await api.put('/zatca/settings', payload);
      setSettings(res.data.settings);
      setForm(f => ({ ...f, productionCsid: '', productionSecret: '' }));
      setMsg('✅ ' + res.data.message);
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function onboard() {
    setSaving(true);
    try {
      const res = await api.post('/zatca/onboard', {});
      setMsg('✅ ' + res.data.message);
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function verifyChain() {
    try {
      const res = await api.get('/zatca/verify-chain');
      setChain(res.data);
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_loadFailed')));
    }
  }

  return (
    <div className="space-y-5">
      <Banner message={msg} />

      <div className="glass-panel space-y-4 rounded-xl p-5">
        <SectionHeader
          icon={Receipt}
          title={t('zt_title')}
          subtitle={t('zt_subtitle')}
          action={
            settings?.isEnabled ? (
              <span className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400">
                {t('wa_enabled')}
              </span>
            ) : (
              <span className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs font-bold text-zinc-500">
                {t('wa_disabled')}
              </span>
            )
          }
        />

        <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-amber-400/90">
          {t('zt_scopeNote')}
        </p>

        {loading ? (
          <p className="py-8 text-center text-sm text-zinc-500">{t('loading')}</p>
        ) : (
          <>
            {settings && settings.missingFields.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2.5 text-[11px] font-bold text-red-400">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                {t('zt_missing')}: {settings.missingFields.join('، ')}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('zt_sellerNameAr')}>
                <TextInput value={form.sellerNameAr} onChange={e => setForm({ ...form, sellerNameAr: e.target.value })} />
              </Field>
              <Field label={t('zt_sellerNameEn')}>
                <TextInput value={form.sellerNameEn} onChange={e => setForm({ ...form, sellerNameEn: e.target.value })} />
              </Field>
              <Field label={t('zt_vatNumber')} hint={t('zt_vatNumberHint')}>
                <TextInput
                  value={form.vatNumber}
                  onChange={e => setForm({ ...form, vatNumber: e.target.value.replace(/\D/g, '') })}
                  maxLength={15}
                  dir="ltr"
                />
              </Field>
              <Field label={t('zt_crnNumber')}>
                <TextInput value={form.crnNumber} onChange={e => setForm({ ...form, crnNumber: e.target.value })} dir="ltr" />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('zt_street')}>
                <TextInput value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} />
              </Field>
              <Field label={t('zt_buildingNumber')}>
                <TextInput value={form.buildingNumber} onChange={e => setForm({ ...form, buildingNumber: e.target.value })} dir="ltr" />
              </Field>
              <Field label={t('zt_district')}>
                <TextInput value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} />
              </Field>
              <Field label={t('md_city')}>
                <TextInput value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              </Field>
              <Field label={t('zt_postalCode')}>
                <TextInput value={form.postalCode} onChange={e => setForm({ ...form, postalCode: e.target.value })} dir="ltr" />
              </Field>
              <Field label={t('zt_vatRate')}>
                <TextInput
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.vatRate}
                  onChange={e => setForm({ ...form, vatRate: e.target.value })}
                />
              </Field>
            </div>

            <Field label={t('zt_environment')} hint={t('zt_environmentHint')}>
              <Select value={form.environment} onChange={e => setForm({ ...form, environment: e.target.value })}>
                <option value="SANDBOX">{t('zt_envSandbox')}</option>
                <option value="SIMULATION">{t('zt_envSimulation')}</option>
                <option value="PRODUCTION">{t('zt_envProduction')}</option>
              </Select>
            </Field>

            <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-3">
              <PrimaryButton onClick={() => save()} disabled={saving}>
                <Save size={15} /> {t('save')}
              </PrimaryButton>
              {settings?.isEnabled ? (
                <GhostButton onClick={() => save({ isEnabled: false })} disabled={saving}>
                  {t('wa_disable')}
                </GhostButton>
              ) : (
                <GhostButton onClick={() => save({ isEnabled: true })} disabled={saving}>
                  {t('wa_enable')}
                </GhostButton>
              )}
            </div>
          </>
        )}
      </div>

      {/* Onboarding */}
      <div className="glass-panel space-y-4 rounded-xl p-5">
        <SectionHeader icon={KeyRound} title={t('zt_onboarding')} subtitle={t('zt_onboardingHint')} />

        <div className="grid gap-2 sm:grid-cols-3">
          <StatusCell label={t('zt_stampKey')} ok={!!settings?.hasPrivateKey} t={t} />
          <StatusCell label={t('zt_complianceCsid')} ok={!!settings?.hasComplianceCsid} t={t} />
          <StatusCell label={t('zt_productionCsid')} ok={!!settings?.hasProductionCsid} t={t} />
        </div>

        {settings?.csrSubject && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
            <p className="mb-1 text-[11px] font-semibold text-zinc-400">{t('zt_csrSubject')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all font-mono text-[11px] text-zinc-400" dir="ltr">
                {settings.csrSubject}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(settings.csrSubject!);
                  setMsg('✅ ' + t('vf_linkCopied'));
                }}
                className="cursor-pointer rounded p-1.5 text-zinc-500 transition hover:text-primary-text"
              >
                <Copy size={14} />
              </button>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">{t('zt_csrHint')}</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t('zt_productionCsid')}
            hint={settings?.hasProductionCsid ? t('wa_tokenStored') : t('zt_csidHint')}
          >
            <TextInput
              type="password"
              value={form.productionCsid}
              onChange={e => setForm({ ...form, productionCsid: e.target.value })}
              placeholder={settings?.hasProductionCsid ? '••••••••' : ''}
              dir="ltr"
            />
          </Field>
          <Field label={t('zt_productionSecret')} hint={settings?.hasProductionCsid ? t('wa_tokenStored') : ''}>
            <TextInput
              type="password"
              value={form.productionSecret}
              onChange={e => setForm({ ...form, productionSecret: e.target.value })}
              placeholder={settings?.hasProductionCsid ? '••••••••' : ''}
              dir="ltr"
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <GhostButton onClick={onboard} disabled={saving || (settings?.missingFields.length ?? 1) > 0}>
            <KeyRound size={15} /> {t('zt_generateKey')}
          </GhostButton>
          <GhostButton onClick={() => save()} disabled={saving}>
            <Save size={15} /> {t('zt_saveCsid')}
          </GhostButton>
        </div>
      </div>

      {/* Chain integrity */}
      <div className="glass-panel space-y-3 rounded-xl p-5">
        <SectionHeader icon={Link2} title={t('zt_chainTitle')} subtitle={t('zt_chainHint')} />

        <GhostButton onClick={verifyChain}>
          <ShieldCheck size={15} /> {t('zt_verifyChain')}
        </GhostButton>

        {chain && (
          <div
            className={`rounded-lg border p-3 text-xs ${
              chain.intact
                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                : 'border-red-500/20 bg-red-500/5 text-red-400'
            }`}
          >
            <p className="font-bold">
              {chain.intact ? t('zt_chainIntact') : t('zt_chainBroken')} — {chain.count} {t('zt_invoices')}
            </p>
            {chain.problems?.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {chain.problems.map((p: string, i: number) => (
                  <li key={i}>• {p}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusCell({ label, ok, t }: { label: string; ok: boolean; t: (k: string) => string }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/50'
      }`}
    >
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className={`text-sm font-bold ${ok ? 'text-emerald-400' : 'text-zinc-600'}`}>
        {ok ? t('zt_ready') : t('zt_notReady')}
      </p>
    </div>
  );
}
