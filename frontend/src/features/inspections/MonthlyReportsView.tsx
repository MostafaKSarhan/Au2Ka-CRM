import React, { useEffect, useState } from 'react';
import {
  FileBarChart, RefreshCw, Printer, Send, Search, Shield, Gauge, Receipt, Wrench, X, Check,
  AlertTriangle, AlertOctagon,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../store/LanguageContext';
import { TextInput, Select, PrimaryButton, GhostButton, Banner, TableShell } from '../admin/ui';

interface Report {
  id: string;
  year: number;
  month: number;
  visits: number;
  totalCost: string;
  partsReplaced: number;
  startMileage: number | null;
  endMileage: number | null;
  healthScore: number | null;
  band: 'GOOD' | 'FAIR' | 'POOR' | null;
  sentAt: string | null;
  generatedAt: string;
  vehicle: { id: string; brand: string; model: string; plateNumber: string };
  customer: { id: string; fullName: string; mobileNumber: string };
}

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const BAND_TONE: Record<string, string> = {
  GOOD: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
  FAIR: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
  POOR: 'border-red-500/25 bg-red-500/10 text-red-400',
};

export function MonthlyReportsView() {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';
  const months = isAr ? MONTHS_AR : MONTHS_EN;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [search, setSearch] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState<any | null>(null);

  useEffect(() => {
    load();
  }, [year, month]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/monthly-reports', {
        params: { year: String(year), month: String(month), limit: '100' },
      });
      setReports(res.data.reports || []);
    } catch {
      setMsg('❌ ' + t('md_loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setMsg('');
    try {
      const res = await api.post('/monthly-reports/generate', { year, month });
      const s = res.data.summary;
      setMsg(`✅ ${res.data.message} — ${s.created} ${t('rep_created')} · ${s.updated} ${t('rep_updated')}`);
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setGenerating(false);
    }
  }

  async function openReport(r: Report) {
    try {
      const res = await api.get(`/monthly-reports/${r.id}`);
      setOpen(res.data.report);
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_loadFailed')));
    }
  }

  async function markSent(id: string) {
    try {
      await api.post(`/monthly-reports/${id}/sent`, {});
      setMsg('✅ ' + t('rep_marked'));
      load();
      if (open?.id === id) setOpen({ ...open, sentAt: new Date().toISOString() });
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    }
  }

  const filtered = search.trim()
    ? reports.filter(
        r =>
          r.customer.fullName.includes(search.trim()) ||
          r.vehicle.plateNumber.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : reports;

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className={`space-y-6 ${isAr ? 'text-right' : 'text-left'}`}>
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{t('monthlyReports')}</h1>
          <p className="text-sm text-zinc-400">{t('rep_subtitle')}</p>
        </div>
        <PrimaryButton onClick={generate} disabled={generating}>
          <RefreshCw size={16} className={generating ? 'animate-spin' : ''} /> {t('rep_generate')}
        </PrimaryButton>
      </div>

      <div className="no-print">
        <Banner message={msg} />
      </div>

      <div className="no-print glass-panel space-y-4 rounded-xl p-5">
        <div className="grid gap-2 sm:grid-cols-4">
          <Select value={month} onChange={e => setMonth(Number(e.target.value))}>
            {months.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </Select>
          <Select value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <div className="relative sm:col-span-2">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 text-zinc-600 start-3" />
            <TextInput
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('rep_search')}
              className="ps-9"
            />
          </div>
        </div>

        <TableShell
          headers={[t('sub_customer'), t('sub_vehicle'), t('vf_visits'), t('rep_mileage'), t('vf_totalSpent'), t('insp_healthScore'), t('md_status'), t('actions')]}
          loading={loading}
          loadingText={t('loading')}
          isEmpty={filtered.length === 0}
          empty={t('rep_none')}
        >
          {filtered.map(r => (
            <tr key={r.id} className="border-b border-zinc-900 transition hover:bg-zinc-900/40">
              <td className="px-3 py-2.5">
                <button onClick={() => openReport(r)} className="cursor-pointer font-semibold text-white hover:text-primary-text">
                  {r.customer.fullName}
                </button>
                <span className="block font-mono text-[11px] text-zinc-600" dir="ltr">
                  {r.customer.mobileNumber}
                </span>
              </td>
              <td className="px-3 py-2.5 text-xs text-zinc-400">
                {r.vehicle.brand} {r.vehicle.model}
                <span className="block font-mono text-[11px] text-primary-text">{r.vehicle.plateNumber}</span>
              </td>
              <td className="px-3 py-2.5 text-sm text-zinc-300">{r.visits}</td>
              <td className="px-3 py-2.5 font-mono text-[11px] text-zinc-500">
                {r.startMileage != null && r.endMileage != null
                  ? `${(r.endMileage - r.startMileage).toLocaleString()} ${t('vf_km')}`
                  : '—'}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-zinc-300">
                {Math.round(Number(r.totalCost)).toLocaleString()}
              </td>
              <td className="px-3 py-2.5">
                {r.healthScore != null ? (
                  <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${BAND_TONE[r.band || 'FAIR']}`}>
                    {r.healthScore}
                  </span>
                ) : (
                  <span className="text-[11px] text-zinc-600">—</span>
                )}
              </td>
              <td className="px-3 py-2.5">
                {r.sentAt ? (
                  <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                    {t('rep_sent')}
                  </span>
                ) : (
                  <span className="rounded border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[11px] font-bold text-zinc-500">
                    {t('rep_notSent')}
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5">
                <GhostButton onClick={() => openReport(r)} className="!px-2.5 !py-1 text-[11px]">
                  {t('rep_open')}
                </GhostButton>
              </td>
            </tr>
          ))}
        </TableShell>
      </div>

      {open && (
        <ReportDocument
          report={open}
          monthName={months[open.month - 1]}
          onClose={() => setOpen(null)}
          onMarkSent={() => markSent(open.id)}
        />
      )}
    </div>
  );
}

/** The printable report, laid out in the workshop's identity. */
function ReportDocument({
  report,
  monthName,
  onClose,
  onMarkSent,
}: {
  report: any;
  monthName: string;
  onClose: () => void;
  onMarkSent: () => void;
}) {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';

  const recommendations = (isAr ? report.recommendationsAr : report.recommendationsEn) || '';
  const distance =
    report.startMileage != null && report.endMileage != null
      ? report.endMileage - report.startMileage
      : null;

  const ratingMeta: Record<string, { icon: React.ElementType; tone: string; key: string }> = {
    OK: { icon: Check, tone: 'text-emerald-400', key: 'insp_ok' },
    NEEDS_ATTENTION: { icon: AlertTriangle, tone: 'text-amber-400', key: 'insp_attention' },
    CRITICAL: { icon: AlertOctagon, tone: 'text-red-400', key: 'insp_critical' },
  };

  const bandLabel: Record<string, string> = {
    GOOD: t('rep_bandGood'),
    FAIR: t('rep_bandFair'),
    POOR: t('rep_bandPoor'),
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className={`mx-auto w-full max-w-3xl ${isAr ? 'text-right' : 'text-left'}`}>
        <div className="no-print mb-3 flex flex-wrap items-center justify-end gap-2">
          {!report.sentAt && (
            <GhostButton onClick={onMarkSent} className="!px-3 !py-1.5 text-xs">
              <Send size={14} /> {t('rep_markSent')}
            </GhostButton>
          )}
          <GhostButton onClick={() => window.print()} className="!px-3 !py-1.5 text-xs">
            <Printer size={14} /> {t('vf_print')}
          </GhostButton>
          <button onClick={onClose} className="cursor-pointer p-1.5 text-zinc-400 transition hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="glass-panel space-y-5 rounded-xl p-6">
          {/* Header in the workshop's identity */}
          <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-primary/20 p-2 text-primary-text">
                <Shield size={22} />
              </span>
              <div>
                <p className="text-xl font-black tracking-wider text-white">
                  Au<span className="text-primary-text">2</span>Ka
                </p>
                <p className="text-[11px] text-zinc-500">{t('rep_docTitle')}</p>
              </div>
            </div>
            <div className={isAr ? 'text-left' : 'text-right'}>
              <p className="text-sm font-bold text-white">
                {monthName} {report.year}
              </p>
              <p className="font-mono text-[11px] text-zinc-500" dir="ltr">
                {new Date(report.generatedAt).toISOString().slice(0, 10)}
              </p>
            </div>
          </div>

          {/* Who and what */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-[11px] text-zinc-500">{t('vf_owner')}</p>
              <p className="text-sm font-bold text-white">{report.customer?.fullName}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-[11px] text-zinc-500">{t('sub_vehicle')}</p>
              <p className="text-sm font-bold text-white">
                {report.vehicle?.brand} {report.vehicle?.model}
                <span className="ms-2 font-mono text-primary-text">{report.vehicle?.plateNumber}</span>
              </p>
            </div>
          </div>

          {/* Health */}
          {report.healthScore != null && (
            <div className={`rounded-xl border p-4 text-center ${BAND_TONE[report.band || 'FAIR']}`}>
              <p className="text-[11px] opacity-80">{t('insp_healthScore')}</p>
              <p className="text-4xl font-black">{report.healthScore}</p>
              <p className="mt-1 text-xs font-bold">{bandLabel[report.band || 'FAIR']}</p>
            </div>
          )}

          {/* The month in numbers */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Cell icon={FileBarChart} label={t('vf_visits')} value={report.visits} />
            <Cell
              icon={Gauge}
              label={t('rep_mileage')}
              value={distance != null ? `${distance.toLocaleString()}` : '—'}
            />
            <Cell
              icon={Receipt}
              label={t('vf_totalSpent')}
              value={Math.round(Number(report.totalCost)).toLocaleString()}
            />
            <Cell icon={Wrench} label={t('vf_partsReplaced')} value={report.partsReplaced} />
          </div>

          {/* What we found */}
          {report.findings?.length > 0 && (
            <div>
              <h3 className="mb-2 border-b border-zinc-800 pb-2 text-sm font-bold text-white">
                {t('rep_findings')}
              </h3>
              <ul className="space-y-1.5">
                {report.findings.map((f: any, i: number) => {
                  const meta = ratingMeta[f.rating];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  return (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <Icon size={13} className={`mt-0.5 shrink-0 ${meta.tone}`} />
                      <span className="text-zinc-300">
                        {isAr ? f.nameAr : f.nameEn}
                        <span className={`ms-2 font-bold ${meta.tone}`}>{t(meta.key)}</span>
                        {f.note && <span className="block text-[11px] text-zinc-500">{f.note}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Plain-language advice */}
          <div>
            <h3 className="mb-2 border-b border-zinc-800 pb-2 text-sm font-bold text-white">
              {t('rep_recommendations')}
            </h3>
            <p className="whitespace-pre-line text-xs leading-relaxed text-zinc-300">{recommendations}</p>
          </div>

          <p className="border-t border-zinc-800 pt-3 text-center text-[10px] text-zinc-600">
            {t('vf_publicFooter')}
          </p>
        </div>
      </div>
    </div>
  );
}

function Cell({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5 text-center">
      <Icon size={14} className="mx-auto text-zinc-500" />
      <p className="mt-1 text-[10px] text-zinc-500">{label}</p>
      <p className="text-base font-bold text-white">{value}</p>
    </div>
  );
}
