import React from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Gauge, Wrench, Receipt, Camera, FileText, Clock, AlertTriangle, ShieldCheck, BadgeCheck,
} from 'lucide-react';
import { UPLOADS_BASE_URL } from '../../lib/api';
import { useTranslation } from '../../store/LanguageContext';

export interface VehicleFile {
  vehicle: any;
  subscription: any;
  summary: {
    visits: number;
    firstVisit: string | null;
    lastVisit: string | null;
    totalSpent: number;
    partsReplaced: number;
    currentMileage: number;
    averageKmPerMonth: number | null;
    photoCount: number;
  };
  timeline: Array<any>;
  costs: Array<{ year: number; jobCards: number; parts: number; total: number; cumulative: number }>;
  mileageSeries: Array<{ date: string; mileage: number; source: string }>;
  replacements: Array<any>;
  documents: Array<any>;
  photos: Array<any>;
  jobCards: Array<any>;
}

const DOC_LABELS: Record<string, { ar: string; en: string }> = {
  REGISTRATION: { ar: 'استمارة السيارة', en: 'Registration' },
  INSURANCE: { ar: 'وثيقة التأمين', en: 'Insurance' },
  PERIODIC_INSPECTION: { ar: 'الفحص الدوري', en: 'Periodic inspection' },
  OTHER: { ar: 'مستند آخر', en: 'Other document' },
};

function fmtDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * The vehicle file itself (M3). Shared by the staff screen and the customer's
 * public link, so both always show exactly the same picture.
 */
export function VehicleFileContent({ file, readOnly }: { file: VehicleFile; readOnly?: boolean }) {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';

  const v = file.vehicle;
  const s = file.summary;

  const mileageData = file.mileageSeries.map(m => ({
    date: fmtDate(m.date),
    mileage: m.mileage,
  }));

  const costData = file.costs.map(c => ({
    year: String(c.year),
    [t('vf_chartJobCards')]: Math.round(c.jobCards),
    [t('vf_chartParts')]: Math.round(c.parts),
    [t('vf_chartCumulative')]: Math.round(c.cumulative),
  }));

  return (
    <div className={`space-y-5 ${isAr ? 'text-right' : 'text-left'}`}>
      {/* Header */}
      <div className="glass-panel rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-white">
              {v.brand} {v.model}
              {file.subscription && (
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                  <BadgeCheck size={12} />
                  {t('sub_badge')}
                </span>
              )}
            </h2>
            <p className="mt-1 font-mono text-sm text-primary" dir="ltr">
              {v.plateNumber}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {t('vf_owner')}: {v.customer?.fullName || '—'} · {t('vf_inSystemSince')}{' '}
              <span dir="ltr">{fmtDate(v.createdAt)}</span>
            </p>
          </div>

          {file.subscription && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs">
              <p className="font-bold text-emerald-400">
                {isAr ? file.subscription.plan?.nameAr : file.subscription.plan?.nameEn}
              </p>
              <p className="mt-0.5 text-zinc-400">
                {t('sub_visitsBalance')}: {file.subscription.freeVisitsRemaining} ·{' '}
                {t('sub_currentEnds')} <span dir="ltr">{fmtDate(file.subscription.endDate)}</span>
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Metric icon={Clock} label={t('vf_visits')} value={s.visits} />
          <Metric icon={Gauge} label={t('vf_currentMileage')} value={s.currentMileage.toLocaleString()} />
          <Metric icon={Receipt} label={t('vf_totalSpent')} value={`${Math.round(s.totalSpent).toLocaleString()} ${t('sub_currency')}`} />
          <Metric icon={Wrench} label={t('vf_partsReplaced')} value={s.partsReplaced} />
          <Metric
            icon={Gauge}
            label={t('vf_avgPerMonth')}
            value={s.averageKmPerMonth != null ? `${s.averageKmPerMonth.toLocaleString()} ${t('vf_km')}` : '—'}
          />
        </div>

        <p className="mt-3 text-[11px] text-zinc-600">{t('vf_scopeNote')}</p>
      </div>

      {/* Documents */}
      <Panel icon={FileText} title={t('vf_documents')}>
        {file.documents.length === 0 ? (
          <Empty text={t('vf_noDocuments')} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {file.documents.map(d => {
              const days = d.daysUntilExpiry;
              const expired = days != null && days < 0;
              const soon = days != null && days >= 0 && days <= 30;
              return (
                <div
                  key={d.id}
                  className={`rounded-lg border p-3 ${
                    expired
                      ? 'border-red-500/25 bg-red-500/5'
                      : soon
                        ? 'border-amber-500/25 bg-amber-500/5'
                        : 'border-zinc-800 bg-zinc-900/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-white">
                        {d.title || (isAr ? DOC_LABELS[d.type]?.ar : DOC_LABELS[d.type]?.en) || d.type}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {isAr ? DOC_LABELS[d.type]?.ar : DOC_LABELS[d.type]?.en}
                        {d.documentNumber && ` · ${d.documentNumber}`}
                      </p>
                    </div>
                    {(expired || soon) && (
                      <span
                        className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold ${
                          expired
                            ? 'border-red-500/25 bg-red-500/10 text-red-400'
                            : 'border-amber-500/25 bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        <AlertTriangle size={10} className="inline" />{' '}
                        {expired ? t('vf_expired') : `${days} ${t('vf_daysToExpiry')}`}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 font-mono text-[11px] text-zinc-500" dir="ltr">
                    {fmtDate(d.issueDate)} → {fmtDate(d.expiryDate)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Mileage */}
      <Panel icon={Gauge} title={t('vf_mileageHistory')}>
        {mileageData.length < 2 ? (
          <Empty text={t('vf_notEnoughMileage')} />
        ) : (
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mileageData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} width={60} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#f8fafc' }}
                />
                <Line type="monotone" dataKey="mileage" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} name={t('vf_km')} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      {/* Costs */}
      <Panel icon={Receipt} title={t('vf_costsByYear')}>
        {costData.length === 0 ? (
          <Empty text={t('vf_noCosts')} />
        ) : (
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="year" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} width={70} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#f8fafc' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey={t('vf_chartJobCards')} stackId="a" fill="#dc2626" />
                <Bar dataKey={t('vf_chartParts')} stackId="a" fill="#0f2c59" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      {/* Replaced parts */}
      <Panel icon={Wrench} title={t('vf_replacedParts')}>
        {file.replacements.length === 0 ? (
          <Empty text={t('vf_noParts')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                  <th className="px-3 py-2 text-start font-semibold">{t('vf_part')}</th>
                  <th className="px-3 py-2 text-start font-semibold">{t('vf_replacedAt')}</th>
                  <th className="px-3 py-2 text-start font-semibold">{t('vf_atMileage')}</th>
                  <th className="px-3 py-2 text-start font-semibold">{t('vf_cost')}</th>
                  <th className="px-3 py-2 text-start font-semibold">{t('vf_warranty')}</th>
                </tr>
              </thead>
              <tbody>
                {file.replacements.map(r => (
                  <tr key={r.id} className="border-b border-zinc-900">
                    <td className="px-3 py-2.5">
                      <span className="font-semibold text-white">{r.partName}</span>
                      {r.partNumber && (
                        <span className="block font-mono text-[11px] text-zinc-600">{r.partNumber}</span>
                      )}
                      {r.quantity > 1 && (
                        <span className="block text-[11px] text-zinc-500">× {r.quantity}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-zinc-400" dir="ltr">
                      {fmtDate(r.replacedAt)}
                      {r.jobCard?.jobNumber && (
                        <span className="block text-[10px] text-primary">{r.jobCard.jobNumber}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-zinc-400">
                      {r.mileageAtReplacement != null ? r.mileageAtReplacement.toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-zinc-300">
                      {Math.round(r.total).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.warranty === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1 rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          <ShieldCheck size={10} /> {r.warrantyDaysLeft} {t('vf_daysLeft')}
                        </span>
                      ) : r.warranty === 'EXPIRED' ? (
                        <span className="rounded border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                          {t('vf_warrantyExpired')}
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Timeline */}
      <Panel icon={Clock} title={t('vf_timeline')}>
        {file.timeline.length === 0 ? (
          <Empty text={t('vf_noTimeline')} />
        ) : (
          <ol className="relative space-y-3 border-zinc-800 ps-4 border-s">
            {file.timeline.map(entry => (
              <li key={`${entry.kind}-${entry.id}`} className="relative">
                <span
                  className={`absolute top-2 h-2 w-2 rounded-full ${isAr ? '-right-[21px]' : '-left-[21px]'} ${
                    entry.kind === 'JOB_CARD'
                      ? 'bg-primary'
                      : entry.kind === 'PART'
                        ? 'bg-sky-500'
                        : 'bg-amber-500'
                  }`}
                />
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-white">{entry.title}</span>
                    <span className="font-mono text-[11px] text-zinc-500" dir="ltr">
                      {fmtDate(entry.date)}
                    </span>
                  </div>
                  {entry.detail && (
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{entry.detail}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={`rounded border px-1.5 py-0.5 font-bold ${
                        entry.kind === 'JOB_CARD'
                          ? 'border-primary/25 bg-primary/10 text-primary'
                          : entry.kind === 'PART'
                            ? 'border-sky-500/25 bg-sky-500/10 text-sky-400'
                            : 'border-amber-500/25 bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {entry.kind === 'JOB_CARD'
                        ? t('vf_kindVisit')
                        : entry.kind === 'PART'
                          ? t('vf_kindPart')
                          : t('vf_kindDocument')}
                    </span>
                    {entry.amount != null && entry.amount > 0 && (
                      <span className="text-zinc-400">
                        {Math.round(entry.amount).toLocaleString()} {t('sub_currency')}
                      </span>
                    )}
                    {entry.mileage != null && (
                      <span className="text-zinc-500">
                        {entry.mileage.toLocaleString()} {t('vf_km')}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      {/* Photo archive */}
      <Panel icon={Camera} title={`${t('vf_photoArchive')} (${file.photos.length})`}>
        {file.photos.length === 0 ? (
          <Empty text={t('vf_noPhotos')} />
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {file.photos.map(p => (
              <a
                key={p.id}
                href={`${UPLOADS_BASE_URL}${p.filePath}`}
                target="_blank"
                rel="noreferrer"
                className="group relative overflow-hidden rounded-lg border border-zinc-800"
              >
                <img
                  src={`${UPLOADS_BASE_URL}${p.filePath}`}
                  alt={p.jobNumber}
                  loading="lazy"
                  className="h-24 w-full object-cover transition group-hover:scale-105"
                />
                <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-center font-mono text-[9px] text-zinc-300">
                  {fmtDate(p.uploadedAt)}
                </span>
              </a>
            ))}
          </div>
        )}
      </Panel>

      {readOnly && <p className="pb-4 text-center text-[11px] text-zinc-600">{t('vf_publicFooter')}</p>}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
      <p className="flex items-center gap-1 text-[11px] text-zinc-500">
        <Icon size={12} /> {label}
      </p>
      <p className="mt-0.5 truncate text-base font-bold text-white">{value}</p>
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel space-y-3 rounded-xl p-5">
      <h3 className="flex items-center gap-2 border-b border-zinc-800 pb-2 text-base font-bold text-white">
        <span className="rounded-lg bg-primary/15 p-1.5 text-primary">
          <Icon size={16} />
        </span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-zinc-500">{text}</p>;
}
