import React, { useEffect, useState } from 'react';
import {
  MessageCircle, ShieldCheck, Link2, Save, AlertTriangle, CheckCircle2, Copy, Lock,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../store/LanguageContext';
import {
  SectionHeader, Field, TextInput, Select, PrimaryButton, GhostButton, Banner, Modal, TableShell,
} from './ui';

interface Settings {
  phoneNumberId: string | null;
  businessAccountId: string | null;
  apiVersion: string;
  displayNumber: string | null;
  isEnabled: boolean;
  lastVerifiedAt: string | null;
  lastError: string | null;
  hasAccessToken: boolean;
  accessTokenFromEnv: boolean;
  hasWebhookVerifyToken: boolean;
}

interface Template {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  channel: string;
  variables: string | null;
  metaTemplateName: string | null;
  metaLanguage: string | null;
  metaStatus: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
}

const META_STATUS_STYLES: Record<string, string> = {
  NOT_SUBMITTED: 'border-zinc-700 bg-zinc-800/60 text-zinc-500',
  PENDING: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
  APPROVED: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
  REJECTED: 'border-red-500/25 bg-red-500/10 text-red-400',
};

export function WhatsAppTab() {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';

  const [settings, setSettings] = useState<Settings | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [form, setForm] = useState({
    phoneNumberId: '',
    businessAccountId: '',
    accessToken: '',
    apiVersion: 'v21.0',
    webhookVerifyToken: '',
  });

  const [linking, setLinking] = useState<Template | null>(null);
  const [linkForm, setLinkForm] = useState({ metaTemplateName: '', metaLanguage: 'ar', metaStatus: 'PENDING' });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [setRes, tplRes] = await Promise.all([
        api.get('/whatsapp/settings'),
        api.get('/messaging/templates'),
      ]);
      const s: Settings = setRes.data.settings;
      setSettings(s);
      setForm(f => ({
        ...f,
        phoneNumberId: s.phoneNumberId || '',
        businessAccountId: s.businessAccountId || '',
        apiVersion: s.apiVersion || 'v21.0',
        accessToken: '',
        webhookVerifyToken: '',
      }));
      setTemplates((tplRes.data.templates || []).filter((x: Template) => x.channel === 'WHATSAPP'));
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
        phoneNumberId: form.phoneNumberId.trim() || null,
        businessAccountId: form.businessAccountId.trim() || null,
        apiVersion: form.apiVersion,
        ...extra,
      };
      // An empty box means "keep what is stored", never "erase it".
      if (form.accessToken.trim()) payload.accessToken = form.accessToken.trim();
      if (form.webhookVerifyToken.trim()) payload.webhookVerifyToken = form.webhookVerifyToken.trim();

      const res = await api.put('/whatsapp/settings', payload);
      setSettings(res.data.settings);
      setForm(f => ({ ...f, accessToken: '', webhookVerifyToken: '' }));
      setMsg('✅ ' + res.data.message);
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function verify() {
    setSaving(true);
    setMsg('');
    try {
      const res = await api.post('/whatsapp/verify', {});
      setMsg('✅ ' + res.data.message);
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('wa_verifyFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function submitLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linking) return;
    setSaving(true);
    try {
      await api.put(`/whatsapp/templates/${linking.id}/meta`, {
        metaTemplateName: linkForm.metaTemplateName.trim() || null,
        metaLanguage: linkForm.metaLanguage.trim() || 'ar',
        metaStatus: linkForm.metaStatus,
      });
      setMsg('✅ ' + t('wa_templateLinked'));
      setLinking(null);
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  const webhookUrl = `${window.location.origin.replace(/:\d+$/, ':5000')}/api/v1/webhooks/whatsapp`;

  const statusLabel: Record<string, string> = {
    NOT_SUBMITTED: t('wa_statusNotSubmitted'),
    PENDING: t('wa_statusPending'),
    APPROVED: t('wa_statusApproved'),
    REJECTED: t('wa_statusRejected'),
  };

  return (
    <div className="space-y-5">
      <Banner message={msg} />

      <div className="glass-panel space-y-4 rounded-xl p-5">
        <SectionHeader
          icon={MessageCircle}
          title={t('wa_title')}
          subtitle={t('wa_subtitle')}
          action={
            settings?.isEnabled ? (
              <span className="flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400">
                <CheckCircle2 size={14} /> {t('wa_enabled')}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs font-bold text-zinc-500">
                {t('wa_disabled')}
              </span>
            )
          }
        />

        <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] leading-relaxed text-amber-400/90">
          {t('wa_scopeNote')}
        </p>

        {loading ? (
          <p className="py-8 text-center text-sm text-zinc-500">{t('loading')}</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('wa_phoneNumberId')} hint={t('wa_phoneNumberIdHint')}>
                <TextInput
                  value={form.phoneNumberId}
                  onChange={e => setForm({ ...form, phoneNumberId: e.target.value })}
                  placeholder="1234567890"
                  dir="ltr"
                />
              </Field>
              <Field label={t('wa_businessAccountId')}>
                <TextInput
                  value={form.businessAccountId}
                  onChange={e => setForm({ ...form, businessAccountId: e.target.value })}
                  dir="ltr"
                />
              </Field>
            </div>

            <Field
              label={t('wa_accessToken')}
              hint={
                settings?.accessTokenFromEnv
                  ? t('wa_tokenFromEnv')
                  : settings?.hasAccessToken
                    ? t('wa_tokenStored')
                    : t('wa_tokenHint')
              }
            >
              <div className="relative">
                <Lock size={14} className="absolute top-1/2 -translate-y-1/2 text-zinc-600 start-3" />
                <TextInput
                  type="password"
                  value={form.accessToken}
                  onChange={e => setForm({ ...form, accessToken: e.target.value })}
                  placeholder={settings?.hasAccessToken ? '••••••••••••' : ''}
                  disabled={settings?.accessTokenFromEnv}
                  className="ps-9"
                  dir="ltr"
                />
              </div>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('wa_apiVersion')}>
                <Select value={form.apiVersion} onChange={e => setForm({ ...form, apiVersion: e.target.value })}>
                  <option value="v21.0">v21.0</option>
                  <option value="v20.0">v20.0</option>
                  <option value="v19.0">v19.0</option>
                </Select>
              </Field>
              <Field
                label={t('wa_verifyToken')}
                hint={settings?.hasWebhookVerifyToken ? t('wa_tokenStored') : t('wa_verifyTokenHint')}
              >
                <TextInput
                  type="password"
                  value={form.webhookVerifyToken}
                  onChange={e => setForm({ ...form, webhookVerifyToken: e.target.value })}
                  placeholder={settings?.hasWebhookVerifyToken ? '••••••••' : ''}
                  dir="ltr"
                />
              </Field>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <p className="mb-1 text-[11px] font-semibold text-zinc-400">{t('wa_webhookUrl')}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all font-mono text-[11px] text-zinc-400" dir="ltr">
                  {webhookUrl}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(webhookUrl);
                    setMsg('✅ ' + t('vf_linkCopied'));
                  }}
                  className="cursor-pointer rounded p-1.5 text-zinc-500 transition hover:text-primary-text"
                >
                  <Copy size={14} />
                </button>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">{t('wa_webhookHint')}</p>
            </div>

            {settings?.lastError && (
              <p className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2.5 text-[11px] text-red-400">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                {settings.lastError}
              </p>
            )}

            {settings?.lastVerifiedAt && (
              <p className="text-[11px] text-zinc-500">
                {t('wa_lastVerified')}:{' '}
                <span className="font-mono" dir="ltr">
                  {settings.lastVerifiedAt.slice(0, 16).replace('T', ' ')}
                </span>
                {settings.displayNumber && ` · ${settings.displayNumber}`}
              </p>
            )}

            <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-3">
              <PrimaryButton onClick={() => save()} disabled={saving}>
                <Save size={15} /> {t('save')}
              </PrimaryButton>
              <GhostButton onClick={verify} disabled={saving || !settings?.phoneNumberId}>
                <ShieldCheck size={15} /> {t('wa_verify')}
              </GhostButton>
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

      <div className="glass-panel space-y-4 rounded-xl p-5">
        <SectionHeader icon={Link2} title={t('wa_templateLinks')} subtitle={t('wa_templateLinksHint')} />

        <TableShell
          headers={[t('msg_code'), t('md_nameAr'), t('wa_metaName'), t('wa_metaLanguage'), t('wa_metaStatus'), t('actions')]}
          loading={loading}
          loadingText={t('loading')}
          isEmpty={templates.length === 0}
          empty={t('msg_noTemplates')}
        >
          {templates.map(tpl => (
            <tr key={tpl.id} className="border-b border-zinc-900 transition hover:bg-zinc-900/40">
              <td className="px-3 py-2.5 font-mono text-[11px] text-primary-text">{tpl.code}</td>
              <td className="px-3 py-2.5 font-semibold text-white">{isAr ? tpl.nameAr : tpl.nameEn}</td>
              <td className="px-3 py-2.5 font-mono text-xs text-zinc-400" dir="ltr">
                {tpl.metaTemplateName || <span className="text-zinc-600">—</span>}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-zinc-400">{tpl.metaLanguage || '—'}</td>
              <td className="px-3 py-2.5">
                <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${META_STATUS_STYLES[tpl.metaStatus]}`}>
                  {statusLabel[tpl.metaStatus]}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <GhostButton
                  onClick={() => {
                    setLinking(tpl);
                    setLinkForm({
                      metaTemplateName: tpl.metaTemplateName || '',
                      metaLanguage: tpl.metaLanguage || 'ar',
                      metaStatus: tpl.metaStatus === 'NOT_SUBMITTED' ? 'PENDING' : tpl.metaStatus,
                    });
                  }}
                  className="!px-2.5 !py-1 text-[11px]"
                >
                  {t('wa_link')}
                </GhostButton>
              </td>
            </tr>
          ))}
        </TableShell>
      </div>

      {linking && (
        <Modal title={`${t('wa_link')} — ${isAr ? linking.nameAr : linking.nameEn}`} onClose={() => setLinking(null)}>
          <form onSubmit={submitLink} className="space-y-3">
            <p className="text-[11px] leading-relaxed text-zinc-500">{t('wa_linkHint')}</p>

            <Field label={t('wa_metaName')} hint={t('wa_metaNameHint')}>
              <TextInput
                value={linkForm.metaTemplateName}
                onChange={e => setLinkForm({ ...linkForm, metaTemplateName: e.target.value })}
                placeholder="job_completed_ar"
                dir="ltr"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('wa_metaLanguage')}>
                <TextInput
                  value={linkForm.metaLanguage}
                  onChange={e => setLinkForm({ ...linkForm, metaLanguage: e.target.value })}
                  placeholder="ar"
                  dir="ltr"
                />
              </Field>
              <Field label={t('wa_metaStatus')}>
                <Select value={linkForm.metaStatus} onChange={e => setLinkForm({ ...linkForm, metaStatus: e.target.value })}>
                  <option value="NOT_SUBMITTED">{t('wa_statusNotSubmitted')}</option>
                  <option value="PENDING">{t('wa_statusPending')}</option>
                  <option value="APPROVED">{t('wa_statusApproved')}</option>
                  <option value="REJECTED">{t('wa_statusRejected')}</option>
                </Select>
              </Field>
            </div>

            {linking.variables && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5">
                <p className="mb-1.5 text-[11px] font-semibold text-zinc-400">{t('wa_variableOrder')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(() => {
                    try {
                      return JSON.parse(linking.variables).map((v: string, i: number) => (
                        <code key={v} className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                          {`{{${i + 1}}}`} = {v}
                        </code>
                      ));
                    } catch {
                      return null;
                    }
                  })()}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={saving} className="flex-1">
                {saving ? t('loading') : t('save')}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setLinking(null)}>
                {t('cancel')}
              </GhostButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
