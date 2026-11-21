import React, { useEffect, useState } from 'react';
import { MessageSquare, PlusCircle, Edit2, Trash2, Eye, Lock } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../store/LanguageContext';
import {
  SectionHeader, Field, TextInput, TextArea, Select, PrimaryButton, GhostButton,
  IconButton, Banner, StatusPill, Modal,
} from './ui';

interface Template {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  channel: 'WHATSAPP' | 'INTERNAL';
  bodyAr: string;
  bodyEn: string;
  variables: string | null;
  isSystem: boolean;
  isActive: boolean;
  _count: { messages: number };
}

const emptyForm = {
  code: '',
  nameAr: '',
  nameEn: '',
  channel: 'WHATSAPP',
  bodyAr: '',
  bodyEn: '',
};

/** Sample values so a preview reads like a real message. */
const SAMPLE: Record<string, string> = {
  customerName: 'محمد العتيبي',
  vehicle: 'تويوتا كامري',
  plateNumber: 'ر ب ح 1234',
  jobNumber: 'WRK-20261117-0001',
  cost: '1,250',
  status: 'مكتمل',
  planName: 'الباقة الذهبية',
  endDate: '2027-11-17',
  subscriptionNumber: 'SUB-20261117-0001',
  documentTitle: 'وثيقة التأمين',
  expiryDate: '2026-12-31',
};

export function TemplatesTab() {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ title: string; text: string } | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/messaging/templates');
      setTemplates(res.data.templates || []);
    } catch {
      setMsg('❌ ' + t('md_loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setMsg('');
    setShowForm(true);
  }

  function openEdit(tpl: Template) {
    setEditing(tpl);
    setForm({
      code: tpl.code,
      nameAr: tpl.nameAr,
      nameEn: tpl.nameEn,
      channel: tpl.channel,
      bodyAr: tpl.bodyAr,
      bodyEn: tpl.bodyEn,
    });
    setMsg('');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      if (editing) {
        const payload: any = { ...form };
        // A system template's code is what the triggers look for.
        if (editing.isSystem) delete payload.code;
        await api.put(`/messaging/templates/${editing.id}`, payload);
        setMsg('✅ ' + t('msg_templateUpdated'));
      } else {
        await api.post('/messaging/templates', form);
        setMsg('✅ ' + t('msg_templateAdded'));
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditing(null);
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(tpl: Template) {
    try {
      await api.put(`/messaging/templates/${tpl.id}`, { isActive: !tpl.isActive });
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    }
  }

  async function handleDelete(tpl: Template) {
    if (!confirm(`${t('md_confirmDelete')} "${isAr ? tpl.nameAr : tpl.nameEn}"؟`)) return;
    try {
      await api.delete(`/messaging/templates/${tpl.id}`);
      setMsg('✅ ' + t('msg_templateDeleted'));
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_deleteFailed')));
    }
  }

  async function handlePreview(tpl: Template) {
    try {
      const res = await api.post(`/messaging/templates/${tpl.id}/preview`, {
        lang,
        values: SAMPLE,
      });
      setPreview({ title: isAr ? tpl.nameAr : tpl.nameEn, text: res.data.preview });
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_loadFailed')));
    }
  }

  const editingVariables: string[] = (() => {
    if (!editing?.variables) return [];
    try {
      return JSON.parse(editing.variables);
    } catch {
      return [];
    }
  })();

  return (
    <div className="glass-panel space-y-4 rounded-xl p-5">
      <SectionHeader
        icon={MessageSquare}
        title={t('msg_templates')}
        subtitle={t('msg_templatesHint')}
        action={
          <PrimaryButton onClick={openAdd}>
            <PlusCircle size={16} /> {t('msg_addTemplate')}
          </PrimaryButton>
        }
      />

      <Banner message={msg} />

      {loading ? (
        <p className="py-8 text-center text-sm text-zinc-500">{t('loading')}</p>
      ) : templates.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">{t('msg_noTemplates')}</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {templates.map(tpl => (
            <div
              key={tpl.id}
              className={`rounded-xl border p-4 ${
                tpl.isActive ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-900 bg-zinc-950/60 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-white">
                    {isAr ? tpl.nameAr : tpl.nameEn}
                    {tpl.isSystem && (
                      <span title={t('msg_systemTemplate')}>
                        <Lock size={11} className="text-amber-500" />
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-[11px] text-primary-text">{tpl.code}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton onClick={() => handlePreview(tpl)} title={t('msg_preview')}>
                    <Eye size={14} />
                  </IconButton>
                  <IconButton onClick={() => openEdit(tpl)} title={t('edit')}>
                    <Edit2 size={14} />
                  </IconButton>
                  {!tpl.isSystem && (
                    <IconButton tone="danger" onClick={() => handleDelete(tpl)} title={t('delete')}>
                      <Trash2 size={14} />
                    </IconButton>
                  )}
                </div>
              </div>

              <p className="mt-2 line-clamp-3 whitespace-pre-line rounded-lg border border-zinc-800 bg-zinc-950/50 p-2 text-[11px] leading-relaxed text-zinc-400">
                {isAr ? tpl.bodyAr : tpl.bodyEn}
              </p>

              <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-2.5 text-[11px]">
                <span className="text-zinc-500">
                  {tpl.channel === 'WHATSAPP' ? t('msg_channelWhatsApp') : t('msg_channelInternal')} ·{' '}
                  {tpl._count.messages} {t('msg_sentCount')}
                </span>
                <button onClick={() => handleToggle(tpl)} className="cursor-pointer">
                  <StatusPill active={tpl.isActive} activeText={t('md_active')} inactiveText={t('md_inactive')} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal
          title={editing ? t('msg_editTemplate') : t('msg_addTemplate')}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-3">
            {editing?.isSystem && (
              <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] font-semibold text-amber-400">
                {t('msg_systemTemplateHint')}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('msg_code')} hint={t('msg_codeHint')}>
                <TextInput
                  required
                  disabled={!!editing?.isSystem}
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="JOB_COMPLETED"
                />
              </Field>
              <Field label={t('msg_channel')}>
                <Select value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })}>
                  <option value="WHATSAPP">{t('msg_channelWhatsApp')}</option>
                  <option value="INTERNAL">{t('msg_channelInternal')}</option>
                </Select>
              </Field>
              <Field label={t('md_nameAr')}>
                <TextInput required value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} />
              </Field>
              <Field label={t('md_nameEn')}>
                <TextInput required value={form.nameEn} onChange={e => setForm({ ...form, nameEn: e.target.value })} />
              </Field>
            </div>

            {editingVariables.length > 0 && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5">
                <p className="mb-1.5 text-[11px] font-semibold text-zinc-400">{t('msg_variables')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {editingVariables.map(v => (
                    <code key={v} className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                      {`{{${v}}}`}
                    </code>
                  ))}
                </div>
              </div>
            )}

            <Field label={t('msg_bodyAr')} hint={t('msg_bodyHint')}>
              <TextArea required rows={5} value={form.bodyAr} onChange={e => setForm({ ...form, bodyAr: e.target.value })} />
            </Field>
            <Field label={t('msg_bodyEn')} hint={t('msg_bodyHint')}>
              <TextArea required rows={5} value={form.bodyEn} onChange={e => setForm({ ...form, bodyEn: e.target.value })} />
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

      {preview && (
        <Modal title={`${t('msg_preview')} — ${preview.title}`} onClose={() => setPreview(null)}>
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-500">{t('msg_previewHint')}</p>
            <div className="whitespace-pre-line rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm leading-relaxed text-zinc-200">
              {preview.text}
            </div>
            <GhostButton onClick={() => setPreview(null)} className="w-full">
              {t('close')}
            </GhostButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
