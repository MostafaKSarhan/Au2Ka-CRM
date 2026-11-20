import React, { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Receipt, FileCode2, Send, Search, PlusCircle, X, Printer, Shield, CheckCircle2, Coins,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/LanguageContext';
import {
  Field, TextInput, Select, PrimaryButton, GhostButton, Banner, Modal, TableShell,
} from '../admin/ui';

interface Invoice {
  id: string;
  invoiceNumber: string;
  sequence: number;
  type: 'SIMPLIFIED' | 'STANDARD';
  status: string;
  issuedAt: string;
  buyerName: string | null;
  netAmount: string;
  vatAmount: string;
  totalAmount: string;
  reportedAt: string | null;
  customer: { id: string; fullName: string } | null;
  jobCard: { id: string; jobNumber: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'border-zinc-700 bg-zinc-800/60 text-zinc-500',
  SIGNED: 'border-sky-500/25 bg-sky-500/10 text-sky-400',
  REPORTED: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
  CLEARED: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
  FAILED: 'border-red-500/25 bg-red-500/10 text-red-400',
  CANCELLED: 'border-red-500/25 bg-red-500/10 text-red-400',
};

export function InvoicesView() {
  const { lang, t } = useTranslation();
  const { user } = useAuthStore();
  const isAr = lang === 'ar';
  const isAdmin = user?.role === 'ADMIN';

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [jobCards, setJobCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const [showIssue, setShowIssue] = useState(false);
  const [issueForm, setIssueForm] = useState({ jobCardId: '', type: 'SIMPLIFIED', buyerName: '', buyerVatNumber: '' });
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<any | null>(null);

  useEffect(() => {
    load();
  }, [search, status]);

  useEffect(() => {
    api
      .get('/job-cards', { params: { limit: '50' } })
      .then(res => setJobCards(res.data.jobCards || []))
      .catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '50' };
      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;

      const res = await api.get('/zatca/invoices', { params });
      setInvoices(res.data.invoices || []);
      setSummary(res.data.summary);
    } catch {
      setMsg('❌ ' + t('md_loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function issue(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const res = await api.post('/zatca/invoices', {
        jobCardId: issueForm.jobCardId || null,
        type: issueForm.type,
        buyerName: issueForm.buyerName.trim() || null,
        buyerVatNumber: issueForm.buyerVatNumber.trim() || null,
      });
      setMsg('✅ ' + res.data.message);
      setShowIssue(false);
      setIssueForm({ jobCardId: '', type: 'SIMPLIFIED', buyerName: '', buyerVatNumber: '' });
      load();
      openInvoice(res.data.invoice.id);
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function openInvoice(id: string) {
    try {
      const res = await api.get(`/zatca/invoices/${id}`);
      setOpen(res.data.invoice);
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_loadFailed')));
    }
  }

  async function submit(id: string) {
    try {
      const res = await api.post(`/zatca/invoices/${id}/submit`, {});
      setMsg('✅ ' + res.data.message);
      load();
      openInvoice(id);
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    }
  }

  async function downloadXml(invoice: any) {
    try {
      const res = await api.get(`/zatca/invoices/${invoice.id}/xml`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoice.invoiceNumber}.xml`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    }
  }

  const statusLabel: Record<string, string> = {
    DRAFT: t('zt_statusDraft'),
    SIGNED: t('zt_statusSigned'),
    REPORTED: t('zt_statusReported'),
    CLEARED: t('zt_statusCleared'),
    FAILED: t('zt_statusFailed'),
    CANCELLED: t('zt_statusCancelled'),
  };

  return (
    <div className={`space-y-6 ${isAr ? 'text-right' : 'text-left'}`}>
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{t('invoices')}</h1>
          <p className="text-sm text-zinc-400">{t('zt_invoicesSubtitle')}</p>
        </div>
        <PrimaryButton onClick={() => setShowIssue(true)}>
          <PlusCircle size={16} /> {t('zt_issue')}
        </PrimaryButton>
      </div>

      <div className="no-print">
        <Banner message={msg} />
      </div>

      {summary && (
        <div className="no-print grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Receipt} label={t('zt_statCount')} value={summary.count} tone="sky" />
          <Stat icon={Coins} label={t('zt_statNet')} value={`${Math.round(Number(summary.net)).toLocaleString()} ${t('sub_currency')}`} tone="primary" />
          <Stat icon={Coins} label={t('zt_statVat')} value={`${Math.round(Number(summary.vat)).toLocaleString()} ${t('sub_currency')}`} tone="amber" />
          <Stat icon={Coins} label={t('zt_statTotal')} value={`${Math.round(Number(summary.total)).toLocaleString()} ${t('sub_currency')}`} tone="emerald" />
        </div>
      )}

      <div className="no-print glass-panel space-y-4 rounded-xl p-5">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 text-zinc-600 start-3" />
            <TextInput
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('zt_search')}
              className="ps-9"
            />
          </div>
          <Select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">{t('sub_allStatuses')}</option>
            <option value="SIGNED">{t('zt_statusSigned')}</option>
            <option value="REPORTED">{t('zt_statusReported')}</option>
            <option value="CLEARED">{t('zt_statusCleared')}</option>
            <option value="FAILED">{t('zt_statusFailed')}</option>
          </Select>
        </div>

        <TableShell
          headers={[t('zt_number'), t('zt_type'), t('sub_customer'), t('zt_net'), t('zt_vat'), t('zt_total'), t('md_status'), t('actions')]}
          loading={loading}
          loadingText={t('loading')}
          isEmpty={invoices.length === 0}
          empty={t('zt_none')}
        >
          {invoices.map(inv => (
            <tr key={inv.id} className="border-b border-zinc-900 transition hover:bg-zinc-900/40">
              <td className="px-3 py-2.5">
                <button onClick={() => openInvoice(inv.id)} className="cursor-pointer font-mono text-xs text-primary hover:underline">
                  {inv.invoiceNumber}
                </button>
                <span className="block font-mono text-[10px] text-zinc-600" dir="ltr">
                  {inv.issuedAt.slice(0, 10)}
                </span>
              </td>
              <td className="px-3 py-2.5 text-[11px] text-zinc-400">
                {inv.type === 'SIMPLIFIED' ? t('zt_simplified') : t('zt_standard')}
              </td>
              <td className="px-3 py-2.5 text-zinc-300">
                {inv.buyerName || inv.customer?.fullName || '—'}
                {inv.jobCard && (
                  <span className="block font-mono text-[10px] text-primary">{inv.jobCard.jobNumber}</span>
                )}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-zinc-400">{Number(inv.netAmount).toLocaleString()}</td>
              <td className="px-3 py-2.5 font-mono text-xs text-amber-400">{Number(inv.vatAmount).toLocaleString()}</td>
              <td className="px-3 py-2.5 font-mono text-xs font-bold text-white">{Number(inv.totalAmount).toLocaleString()}</td>
              <td className="px-3 py-2.5">
                <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLES[inv.status]}`}>
                  {statusLabel[inv.status]}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <GhostButton onClick={() => openInvoice(inv.id)} className="!px-2.5 !py-1 text-[11px]">
                  {t('rep_open')}
                </GhostButton>
              </td>
            </tr>
          ))}
        </TableShell>
      </div>

      {showIssue && (
        <Modal title={t('zt_issue')} onClose={() => setShowIssue(false)}>
          <form onSubmit={issue} className="space-y-3">
            <Field label={t('vf_linkJobCard')} hint={t('zt_jobCardHint')}>
              <Select value={issueForm.jobCardId} onChange={e => setIssueForm({ ...issueForm, jobCardId: e.target.value })}>
                <option value="">{t('vf_noJobCard')}</option>
                {jobCards.map(jc => (
                  <option key={jc.id} value={jc.id}>
                    {jc.jobNumber} — {jc.customer?.fullName} ({jc.vehicle?.plateNumber})
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('zt_type')} hint={t('zt_typeHint')}>
              <Select value={issueForm.type} onChange={e => setIssueForm({ ...issueForm, type: e.target.value })}>
                <option value="SIMPLIFIED">{t('zt_simplified')}</option>
                <option value="STANDARD">{t('zt_standard')}</option>
              </Select>
            </Field>

            {issueForm.type === 'STANDARD' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('zt_buyerName')}>
                  <TextInput value={issueForm.buyerName} onChange={e => setIssueForm({ ...issueForm, buyerName: e.target.value })} />
                </Field>
                <Field label={t('zt_buyerVat')} hint={t('zt_vatNumberHint')}>
                  <TextInput
                    required
                    value={issueForm.buyerVatNumber}
                    onChange={e => setIssueForm({ ...issueForm, buyerVatNumber: e.target.value.replace(/\D/g, '') })}
                    maxLength={15}
                    dir="ltr"
                  />
                </Field>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={saving} className="flex-1">
                {saving ? t('loading') : t('zt_issue')}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setShowIssue(false)}>
                {t('cancel')}
              </GhostButton>
            </div>
          </form>
        </Modal>
      )}

      {open && (
        <InvoiceDocument
          invoice={open}
          onClose={() => setOpen(null)}
          onSubmit={isAdmin ? () => submit(open.id) : undefined}
          onDownload={() => downloadXml(open)}
        />
      )}
    </div>
  );
}

/** The printed invoice, with the ZATCA QR the customer scans. */
function InvoiceDocument({
  invoice,
  onClose,
  onSubmit,
  onDownload,
}: {
  invoice: any;
  onClose: () => void;
  onSubmit?: () => void;
  onDownload: () => void;
}) {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className={`mx-auto w-full max-w-2xl ${isAr ? 'text-right' : 'text-left'}`}>
        <div className="no-print mb-3 flex flex-wrap items-center justify-end gap-2">
          {onSubmit && !['REPORTED', 'CLEARED'].includes(invoice.status) && (
            <GhostButton onClick={onSubmit} className="!px-3 !py-1.5 text-xs">
              <Send size={14} /> {t('zt_submit')}
            </GhostButton>
          )}
          <GhostButton onClick={onDownload} className="!px-3 !py-1.5 text-xs">
            <FileCode2 size={14} /> {t('zt_downloadXml')}
          </GhostButton>
          <GhostButton onClick={() => window.print()} className="!px-3 !py-1.5 text-xs">
            <Printer size={14} /> {t('vf_print')}
          </GhostButton>
          <button onClick={onClose} className="cursor-pointer p-1.5 text-zinc-400 transition hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="glass-panel space-y-5 rounded-xl p-6">
          <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-primary/20 p-2 text-primary">
                <Shield size={22} />
              </span>
              <div>
                <p className="text-xl font-black tracking-wider text-white">
                  Au<span className="text-primary">2</span>Ka
                </p>
                <p className="text-[11px] text-zinc-500">
                  {invoice.type === 'SIMPLIFIED' ? t('zt_simplified') : t('zt_standard')}
                </p>
              </div>
            </div>
            <div className={isAr ? 'text-left' : 'text-right'}>
              <p className="font-mono text-sm font-bold text-white">{invoice.invoiceNumber}</p>
              <p className="font-mono text-[11px] text-zinc-500" dir="ltr">
                {invoice.issuedAt.slice(0, 19).replace('T', ' ')}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-[11px] text-zinc-500">{t('zt_buyerName')}</p>
              <p className="text-sm font-bold text-white">
                {invoice.buyerName || invoice.customer?.fullName || '—'}
              </p>
              {invoice.buyerVatNumber && (
                <p className="font-mono text-[11px] text-zinc-500" dir="ltr">
                  {invoice.buyerVatNumber}
                </p>
              )}
            </div>
            {invoice.jobCard && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <p className="text-[11px] text-zinc-500">{t('vf_linkJobCard')}</p>
                <p className="font-mono text-sm font-bold text-primary">{invoice.jobCard.jobNumber}</p>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-[11px] text-zinc-500">
                  <th className="px-2 py-1.5 text-start font-semibold">{t('zt_item')}</th>
                  <th className="px-2 py-1.5 text-start font-semibold">{t('inv_quantity')}</th>
                  <th className="px-2 py-1.5 text-start font-semibold">{t('vf_unitPrice')}</th>
                  <th className="px-2 py-1.5 text-start font-semibold">{t('zt_net')}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines?.map((l: any, i: number) => (
                  <tr key={i} className="border-b border-zinc-900">
                    <td className="px-2 py-2 text-zinc-200">{l.nameAr}</td>
                    <td className="px-2 py-2 font-mono text-xs text-zinc-400">{l.quantity}</td>
                    <td className="px-2 py-2 font-mono text-xs text-zinc-400">{Number(l.unitPrice).toFixed(2)}</td>
                    <td className="px-2 py-2 font-mono text-xs text-zinc-300">{Number(l.net).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1 border-t border-zinc-800 pt-3 text-sm">
            <Row label={t('zt_net')} value={Number(invoice.netAmount).toFixed(2)} />
            <Row label={`${t('zt_vat')} (${Number(invoice.vatRate)}%)`} value={Number(invoice.vatAmount).toFixed(2)} />
            <Row label={t('zt_total')} value={Number(invoice.totalAmount).toFixed(2)} bold />
          </div>

          {invoice.qrCode && (
            <div className="flex flex-col items-center gap-2 border-t border-zinc-800 pt-4">
              <div className="rounded-xl bg-white p-3">
                <QRCodeCanvas value={invoice.qrCode} size={150} level="M" />
              </div>
              <p className="text-[10px] text-zinc-600">{t('zt_qrHint')}</p>
            </div>
          )}

          {invoice.status && (
            <div className="no-print flex flex-wrap items-center justify-center gap-2 border-t border-zinc-800 pt-3 text-[11px]">
              <span className={`rounded border px-2 py-0.5 font-bold ${STATUS_STYLES[invoice.status]}`}>
                {invoice.status}
              </span>
              {invoice.signature && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 size={11} /> {t('zt_stamped')}
                </span>
              )}
              {invoice.reportedAt && (
                <span className="font-mono text-zinc-500" dir="ltr">
                  {invoice.reportedAt.slice(0, 16).replace('T', ' ')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? 'font-bold text-white' : 'text-zinc-400'}>{label}</span>
      <span className={`font-mono ${bold ? 'text-base font-bold text-primary' : 'text-zinc-300'}`}>{value}</span>
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
  tone: 'sky' | 'primary' | 'amber' | 'emerald';
}) {
  const tones: Record<string, string> = {
    sky: 'text-sky-400 bg-sky-500/10',
    primary: 'text-primary bg-primary/10',
    amber: 'text-amber-400 bg-amber-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
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
