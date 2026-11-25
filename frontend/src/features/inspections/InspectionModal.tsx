import React, { useEffect, useMemo, useState } from 'react';
import { X, ClipboardCheck, Check, AlertTriangle, AlertOctagon, Minus, Save, Gauge } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../store/LanguageContext';
import { Field, TextInput, TextArea, PrimaryButton, GhostButton, Banner } from '../admin/ui';

type Rating = 'NOT_CHECKED' | 'OK' | 'NEEDS_ATTENTION' | 'CRITICAL';

interface Row {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  category: string | null;
  rating: Rating;
  note: string;
}

const RATING_META: Record<Rating, { icon: React.ElementType; className: string; key: string }> = {
  OK: { icon: Check, className: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400', key: 'insp_ok' },
  NEEDS_ATTENTION: {
    icon: AlertTriangle,
    className: 'border-amber-500/40 bg-amber-500/15 text-amber-400',
    key: 'insp_attention',
  },
  CRITICAL: { icon: AlertOctagon, className: 'border-red-500/40 bg-red-500/15 text-red-400', key: 'insp_critical' },
  NOT_CHECKED: { icon: Minus, className: 'border-zinc-700 bg-zinc-800/60 text-zinc-500', key: 'insp_notChecked' },
};

const ORDER: Rating[] = ['OK', 'NEEDS_ATTENTION', 'CRITICAL', 'NOT_CHECKED'];

/** M2 — the structured inspection form, filled on the job card. */
export function InspectionModal({ jobCardId, onClose }: { jobCardId: string; onClose: () => void }) {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';

  const [rows, setRows] = useState<Row[]>([]);
  const [jobNumber, setJobNumber] = useState('');
  const [mileage, setMileage] = useState('');
  const [summaryAr, setSummaryAr] = useState('');
  const [summaryEn, setSummaryEn] = useState('');
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    load();
  }, [jobCardId]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/inspections/job-card/${jobCardId}`);
      setRows(res.data.items || []);
      setJobNumber(res.data.jobNumber || '');
      setMileage(res.data.inspection?.mileage ? String(res.data.inspection.mileage) : '');
      setSummaryAr(res.data.inspection?.summaryAr || '');
      setSummaryEn(res.data.inspection?.summaryEn || '');
      setCompletedAt(res.data.inspection?.completedAt || null);
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_loadFailed')));
    } finally {
      setLoading(false);
    }
  }

  function setRating(id: string, rating: Rating) {
    setRows(rows.map(r => (r.id === id ? { ...r, rating } : r)));
  }

  function setNote(id: string, note: string) {
    setRows(rows.map(r => (r.id === id ? { ...r, note } : r)));
  }

  // Mirrors the server's scoring so the technician sees it move as they work.
  const score = useMemo(() => {
    const weights: Record<string, number> = { OK: 100, NEEDS_ATTENTION: 55, CRITICAL: 0 };
    const scored = rows.filter(r => r.rating !== 'NOT_CHECKED');
    if (scored.length === 0) return 0;
    return Math.round(scored.reduce((sum, r) => sum + (weights[r.rating] ?? 0), 0) / scored.length);
  }, [rows]);

  const checked = rows.filter(r => r.rating !== 'NOT_CHECKED').length;

  const scoreTone =
    score >= 80 ? 'text-emerald-400' : score >= 55 ? 'text-amber-400' : 'text-red-400';

  async function save(complete: boolean) {
    setSaving(true);
    setMsg('');
    try {
      const res = await api.put(`/inspections/job-card/${jobCardId}`, {
        mileage: mileage ? Number(mileage) : null,
        summaryAr: summaryAr.trim() || null,
        summaryEn: summaryEn.trim() || null,
        complete,
        results: rows.map(r => ({ itemId: r.id, rating: r.rating, note: r.note.trim() || null })),
      });
      setCompletedAt(res.data.inspection?.completedAt || null);
      setMsg('✅ ' + (complete ? t('insp_completed') : t('insp_saved')));
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  // Keeps the form in the order the workshop grouped its checklist.
  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of rows) {
      const key = row.category || t('insp_uncategorised');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return [...map.entries()];
  }, [rows, lang]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
      <div className={`mx-auto w-full max-w-3xl ${isAr ? 'text-right' : 'text-left'}`}>
        <div className="glass-panel sticky top-0 z-10 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-primary/15 p-2 text-primary-text">
              <ClipboardCheck size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">{t('insp_title')}</h2>
              <p className="font-mono text-[11px] text-zinc-500">{jobNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-[10px] text-zinc-500">{t('insp_healthScore')}</p>
              <p className={`text-xl font-black ${scoreTone}`}>{score}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-zinc-500">{t('insp_checkedCount')}</p>
              <p className="text-xl font-black text-white">
                {checked}/{rows.length}
              </p>
            </div>
            <button onClick={onClose} className="cursor-pointer p-1.5 text-zinc-400 transition hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="space-y-4 pb-10">
          <Banner message={msg} />

          {completedAt && (
            <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-[11px] font-bold text-emerald-400">
              {t('insp_alreadyCompleted')} {new Date(completedAt).toISOString().slice(0, 10)}
            </p>
          )}

          <div className="glass-panel rounded-xl p-4">
            <Field label={t('insp_mileageAtInspection')}>
              <div className="relative">
                <Gauge size={15} className="absolute top-1/2 -translate-y-1/2 text-zinc-600 start-3" />
                <TextInput
                  type="number"
                  min={0}
                  value={mileage}
                  onChange={e => setMileage(e.target.value)}
                  className="ps-9"
                />
              </div>
            </Field>
          </div>

          {loading ? (
            <p className="py-16 text-center text-sm text-zinc-500">{t('loading')}</p>
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-sm text-zinc-500">{t('insp_noItemsYet')}</p>
          ) : (
            grouped.map(([category, groupRows]) => (
              <div key={category} className="glass-panel space-y-2 rounded-xl p-4">
                <h3 className="border-b border-zinc-800 pb-2 text-sm font-bold text-primary-text">{category}</h3>
                {groupRows.map(row => (
                  <div key={row.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white">
                        {isAr ? row.nameAr : row.nameEn}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {ORDER.map(rating => {
                          const meta = RATING_META[rating];
                          const Icon = meta.icon;
                          const active = row.rating === rating;
                          return (
                            <button
                              key={rating}
                              onClick={() => setRating(row.id, rating)}
                              className={`flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition ${
                                active ? meta.className : 'border-zinc-800 bg-zinc-900 text-zinc-600 hover:text-zinc-300'
                              }`}
                            >
                              <Icon size={11} /> {t(meta.key)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {row.rating !== 'NOT_CHECKED' && row.rating !== 'OK' && (
                      <TextInput
                        value={row.note}
                        onChange={e => setNote(row.id, e.target.value)}
                        placeholder={t('insp_notePlaceholder')}
                        className="mt-2 !py-1.5 text-xs"
                      />
                    )}
                  </div>
                ))}
              </div>
            ))
          )}

          <div className="glass-panel space-y-3 rounded-xl p-4">
            <h3 className="border-b border-zinc-800 pb-2 text-sm font-bold text-white">
              {t('insp_summary')}
            </h3>
            <Field label={t('insp_summaryAr')} hint={t('insp_summaryHint')}>
              <TextArea rows={3} value={summaryAr} onChange={e => setSummaryAr(e.target.value)} />
            </Field>
            <Field label={t('insp_summaryEn')} hint={t('insp_summaryHint')}>
              <TextArea rows={3} value={summaryEn} onChange={e => setSummaryEn(e.target.value)} />
            </Field>
          </div>

          <div className="glass-panel flex flex-wrap gap-2 rounded-xl p-4">
            <GhostButton onClick={() => save(false)} disabled={saving || loading} className="flex-1">
              <Save size={15} /> {t('insp_saveDraft')}
            </GhostButton>
            <PrimaryButton onClick={() => save(true)} disabled={saving || loading || checked === 0} className="flex-1">
              <ClipboardCheck size={15} /> {t('insp_complete')}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}
