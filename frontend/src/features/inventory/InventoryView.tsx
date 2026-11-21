import React, { useEffect, useState } from 'react';
import {
  Boxes, PackagePlus, PackageMinus, ClipboardList, AlertTriangle, TrendingUp,
  Coins, Search, Archive,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/LanguageContext';
import {
  Field, TextInput, Select, PrimaryButton, GhostButton, Banner, Modal, TableShell,
} from '../admin/ui';

interface Movement {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  balanceAfter: number;
  unitPrice: string | null;
  reasonAr: string;
  reasonEn: string;
  createdAt: string;
  part: { id: string; partNumber: string; nameAr: string; nameEn: string; unit: string };
  jobCard: { id: string; jobNumber: string } | null;
  createdBy: { firstName: string; lastName: string } | null;
}

const TYPE_STYLES: Record<string, string> = {
  IN: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
  OUT: 'border-primary/25 bg-primary/10 text-primary-text',
  ADJUSTMENT: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
};

export function InventoryView() {
  const { lang, t } = useTranslation();
  const { user } = useAuthStore();
  const isAr = lang === 'ar';
  const isAdmin = user?.role === 'ADMIN';

  const [report, setReport] = useState<any | null>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [jobCards, setJobCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [partFilter, setPartFilter] = useState('');

  const [showIntake, setShowIntake] = useState(false);
  const [intakeForm, setIntakeForm] = useState({ partId: '', quantity: '1', unitPrice: '', reference: '', note: '' });
  const [showIssue, setShowIssue] = useState(false);
  const [issueForm, setIssueForm] = useState({ partId: '', jobCardId: '', quantity: '1', unitPrice: '', warrantyMonths: '' });
  const [showCount, setShowCount] = useState(false);
  const [countForm, setCountForm] = useState({ partId: '', countedQuantity: '', note: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [typeFilter, partFilter]);

  useEffect(() => {
    loadAux();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '40' };
      if (typeFilter) params.type = typeFilter;
      if (partFilter) params.partId = partFilter;

      const [repRes, lowRes, movRes] = await Promise.all([
        api.get('/inventory/report'),
        api.get('/inventory/low-stock'),
        api.get('/inventory/movements', { params }),
      ]);
      setReport(repRes.data);
      setLowStock(lowRes.data.parts || []);
      setMovements(movRes.data.movements || []);
    } catch {
      setMsg('❌ ' + t('md_loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function loadAux() {
    try {
      const [partRes, jcRes] = await Promise.all([
        api.get('/parts', { params: { limit: '100' } }),
        api.get('/job-cards', { params: { limit: '50' } }),
      ]);
      setParts(partRes.data.parts || []);
      setJobCards(jcRes.data.jobCards || []);
    } catch {
      /* optional */
    }
  }

  async function submit(
    e: React.FormEvent,
    path: string,
    body: any,
    close: () => void,
  ) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const res = await api.post(`/inventory/${path}`, body);
      setMsg('✅ ' + res.data.message);
      close();
      load();
      loadAux();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  const selectedCountPart = parts.find(p => p.id === countForm.partId);

  const typeLabel: Record<string, string> = {
    IN: t('inv_typeIn'),
    OUT: t('inv_typeOut'),
    ADJUSTMENT: t('inv_typeAdjustment'),
  };

  return (
    <div className={`space-y-6 ${isAr ? 'text-right' : 'text-left'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{t('inventory')}</h1>
          <p className="text-sm text-zinc-400">{t('inv_subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrimaryButton onClick={() => setShowIntake(true)} disabled={parts.length === 0}>
            <PackagePlus size={16} /> {t('inv_intake')}
          </PrimaryButton>
          <GhostButton onClick={() => setShowIssue(true)} disabled={parts.length === 0}>
            <PackageMinus size={15} /> {t('inv_issue')}
          </GhostButton>
          {isAdmin && (
            <GhostButton onClick={() => setShowCount(true)} disabled={parts.length === 0}>
              <ClipboardList size={15} /> {t('inv_count')}
            </GhostButton>
          )}
        </div>
      </div>

      <Banner message={msg} />

      {report && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Boxes} label={t('inv_statUnits')} value={report.totals.units} tone="sky" />
          <Stat
            icon={Coins}
            label={t('inv_statValue')}
            value={`${report.totals.purchaseValue.toLocaleString()} ${t('sub_currency')}`}
            tone="primary"
          />
          <Stat
            icon={TrendingUp}
            label={t('inv_statProfit')}
            value={`${report.totals.expectedProfit.toLocaleString()} ${t('sub_currency')}`}
            tone="emerald"
          />
          <Stat icon={AlertTriangle} label={t('inv_statLow')} value={report.lowStock} tone="amber" />
        </div>
      )}

      {/* Reorder list */}
      {lowStock.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-amber-400">
            <AlertTriangle size={17} />
            <h2 className="text-sm font-bold">{t('inv_reorderTitle')}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  setIntakeForm({
                    partId: p.id,
                    quantity: String(Math.max(1, p.shortfall || 1)),
                    unitPrice: String(p.purchasePrice),
                    reference: '',
                    note: '',
                  });
                  setShowIntake(true);
                }}
                className="cursor-pointer rounded-lg border border-amber-500/20 bg-zinc-900/70 px-3 py-1.5 text-xs transition hover:border-amber-500/50"
              >
                <span className="font-bold text-white">{isAr ? p.nameAr : p.nameEn}</span>
                <span className="ms-2 font-mono text-amber-400">
                  {p.quantity}/{p.reorderLevel}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Most used / stagnant */}
      {report && (report.mostUsed.length > 0 || report.stagnant.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="glass-panel rounded-xl p-5">
            <h2 className="mb-3 flex items-center gap-2 border-b border-zinc-800 pb-2 text-sm font-bold text-white">
              <TrendingUp size={16} className="text-emerald-400" /> {t('inv_mostUsed')}
            </h2>
            {report.mostUsed.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-500">{t('inv_noUsage')}</p>
            ) : (
              <ul className="space-y-1.5">
                {report.mostUsed.map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300">{isAr ? p.nameAr : p.nameEn}</span>
                    <span className="font-mono font-bold text-emerald-400">{p.issued}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="glass-panel rounded-xl p-5">
            <h2 className="mb-3 flex items-center gap-2 border-b border-zinc-800 pb-2 text-sm font-bold text-white">
              <Archive size={16} className="text-zinc-500" /> {t('inv_stagnant')}
            </h2>
            {report.stagnant.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-500">{t('inv_noStagnant')}</p>
            ) : (
              <ul className="space-y-1.5">
                {report.stagnant.map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300">{isAr ? p.nameAr : p.nameEn}</span>
                    <span className="font-mono text-zinc-500">{p.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Movement ledger */}
      <div className="glass-panel space-y-4 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <h2 className="text-lg font-bold text-white">{t('inv_movements')}</h2>
          <div className="flex flex-wrap gap-2">
            <Select value={partFilter} onChange={e => setPartFilter(e.target.value)} className="!w-auto !py-1.5 text-xs">
              <option value="">{t('inv_allParts')}</option>
              {parts.map(p => (
                <option key={p.id} value={p.id}>
                  {isAr ? p.nameAr : p.nameEn}
                </option>
              ))}
            </Select>
            <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="!w-auto !py-1.5 text-xs">
              <option value="">{t('inv_allTypes')}</option>
              <option value="IN">{t('inv_typeIn')}</option>
              <option value="OUT">{t('inv_typeOut')}</option>
              <option value="ADJUSTMENT">{t('inv_typeAdjustment')}</option>
            </Select>
          </div>
        </div>

        <TableShell
          headers={[t('vf_part'), t('inv_type'), t('inv_quantity'), t('inv_balanceAfter'), t('inv_reason'), t('msg_when')]}
          loading={loading}
          loadingText={t('loading')}
          isEmpty={movements.length === 0}
          empty={t('inv_noMovements')}
        >
          {movements.map(m => (
            <tr key={m.id} className="border-b border-zinc-900 transition hover:bg-zinc-900/40">
              <td className="px-3 py-2.5">
                <span className="font-semibold text-white">{isAr ? m.part.nameAr : m.part.nameEn}</span>
                <span className="block font-mono text-[10px] text-zinc-600">{m.part.partNumber}</span>
              </td>
              <td className="px-3 py-2.5">
                <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${TYPE_STYLES[m.type]}`}>
                  {typeLabel[m.type]}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <span className={`font-mono text-sm font-bold ${m.quantity > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {m.quantity > 0 ? '+' : ''}
                  {m.quantity}
                </span>
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-zinc-300">{m.balanceAfter}</td>
              <td className="max-w-[220px] px-3 py-2.5">
                <span className="block truncate text-[11px] text-zinc-400">{isAr ? m.reasonAr : m.reasonEn}</span>
                {m.jobCard && <span className="font-mono text-[10px] text-primary-text">{m.jobCard.jobNumber}</span>}
              </td>
              <td className="px-3 py-2.5 font-mono text-[11px] text-zinc-500" dir="ltr">
                {m.createdAt.slice(0, 10)}
              </td>
            </tr>
          ))}
        </TableShell>
      </div>

      <p className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-[11px] leading-relaxed text-zinc-500">
        {t('inv_scopeNote')}
      </p>

      {/* Intake */}
      {showIntake && (
        <Modal title={t('inv_intake')} onClose={() => setShowIntake(false)}>
          <form
            onSubmit={e =>
              submit(
                e,
                'intake',
                {
                  partId: intakeForm.partId,
                  quantity: Number(intakeForm.quantity),
                  unitPrice: intakeForm.unitPrice ? Number(intakeForm.unitPrice) : null,
                  reference: intakeForm.reference.trim() || null,
                  note: intakeForm.note.trim() || null,
                },
                () => setShowIntake(false),
              )
            }
            className="space-y-3"
          >
            <Field label={t('vf_part')}>
              <Select
                required
                value={intakeForm.partId}
                onChange={e => {
                  const p = parts.find(x => x.id === e.target.value);
                  setIntakeForm({ ...intakeForm, partId: e.target.value, unitPrice: p ? String(p.purchasePrice) : '' });
                }}
              >
                <option value="">{t('inv_selectPart')}</option>
                {parts.map(p => (
                  <option key={p.id} value={p.id}>
                    {(isAr ? p.nameAr : p.nameEn)} — {p.partNumber} ({p.quantity})
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('inv_quantity')}>
                <TextInput
                  type="number"
                  min={1}
                  required
                  value={intakeForm.quantity}
                  onChange={e => setIntakeForm({ ...intakeForm, quantity: e.target.value })}
                />
              </Field>
              <Field label={t('md_purchasePrice')} hint={t('inv_priceHint')}>
                <TextInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={intakeForm.unitPrice}
                  onChange={e => setIntakeForm({ ...intakeForm, unitPrice: e.target.value })}
                />
              </Field>
            </div>
            <Field label={t('inv_reference')} hint={t('inv_referenceHint')}>
              <TextInput value={intakeForm.reference} onChange={e => setIntakeForm({ ...intakeForm, reference: e.target.value })} />
            </Field>
            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={saving} className="flex-1">
                {saving ? t('loading') : t('save')}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setShowIntake(false)}>
                {t('cancel')}
              </GhostButton>
            </div>
          </form>
        </Modal>
      )}

      {/* Issue to a job card */}
      {showIssue && (
        <Modal title={t('inv_issue')} onClose={() => setShowIssue(false)}>
          <form
            onSubmit={e =>
              submit(
                e,
                'issue',
                {
                  partId: issueForm.partId,
                  jobCardId: issueForm.jobCardId,
                  quantity: Number(issueForm.quantity),
                  unitPrice: issueForm.unitPrice ? Number(issueForm.unitPrice) : null,
                  warrantyMonths: issueForm.warrantyMonths ? Number(issueForm.warrantyMonths) : null,
                },
                () => setShowIssue(false),
              )
            }
            className="space-y-3"
          >
            <p className="text-[11px] leading-relaxed text-zinc-500">{t('inv_issueHint')}</p>

            <Field label={t('vf_part')}>
              <Select
                required
                value={issueForm.partId}
                onChange={e => {
                  const p = parts.find(x => x.id === e.target.value);
                  setIssueForm({ ...issueForm, partId: e.target.value, unitPrice: p ? String(p.sellPrice) : '' });
                }}
              >
                <option value="">{t('inv_selectPart')}</option>
                {parts.map(p => (
                  <option key={p.id} value={p.id}>
                    {(isAr ? p.nameAr : p.nameEn)} — {t('md_quantity')}: {p.quantity}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('vf_linkJobCard')}>
              <Select
                required
                value={issueForm.jobCardId}
                onChange={e => setIssueForm({ ...issueForm, jobCardId: e.target.value })}
              >
                <option value="">{t('inv_selectJobCard')}</option>
                {jobCards.map(jc => (
                  <option key={jc.id} value={jc.id}>
                    {jc.jobNumber} — {jc.customer?.fullName} ({jc.vehicle?.plateNumber})
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('inv_quantity')}>
                <TextInput
                  type="number"
                  min={1}
                  required
                  value={issueForm.quantity}
                  onChange={e => setIssueForm({ ...issueForm, quantity: e.target.value })}
                />
              </Field>
              <Field label={t('vf_unitPrice')}>
                <TextInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={issueForm.unitPrice}
                  onChange={e => setIssueForm({ ...issueForm, unitPrice: e.target.value })}
                />
              </Field>
              <Field label={t('vf_warrantyMonths')}>
                <TextInput
                  type="number"
                  min={0}
                  value={issueForm.warrantyMonths}
                  onChange={e => setIssueForm({ ...issueForm, warrantyMonths: e.target.value })}
                />
              </Field>
            </div>

            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={saving} className="flex-1">
                {saving ? t('loading') : t('save')}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setShowIssue(false)}>
                {t('cancel')}
              </GhostButton>
            </div>
          </form>
        </Modal>
      )}

      {/* Stock count */}
      {showCount && (
        <Modal title={t('inv_count')} onClose={() => setShowCount(false)}>
          <form
            onSubmit={e =>
              submit(
                e,
                'stock-count',
                {
                  partId: countForm.partId,
                  countedQuantity: Number(countForm.countedQuantity),
                  note: countForm.note,
                },
                () => setShowCount(false),
              )
            }
            className="space-y-3"
          >
            <p className="text-[11px] leading-relaxed text-zinc-500">{t('inv_countHint')}</p>

            <Field label={t('vf_part')}>
              <Select
                required
                value={countForm.partId}
                onChange={e => setCountForm({ ...countForm, partId: e.target.value })}
              >
                <option value="">{t('inv_selectPart')}</option>
                {parts.map(p => (
                  <option key={p.id} value={p.id}>
                    {(isAr ? p.nameAr : p.nameEn)} — {t('inv_bookBalance')}: {p.quantity}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={t('inv_countedQuantity')}
              hint={selectedCountPart ? `${t('inv_bookBalance')}: ${selectedCountPart.quantity}` : undefined}
            >
              <TextInput
                type="number"
                min={0}
                required
                value={countForm.countedQuantity}
                onChange={e => setCountForm({ ...countForm, countedQuantity: e.target.value })}
              />
            </Field>

            <Field label={t('inv_countReason')}>
              <TextInput
                required
                value={countForm.note}
                onChange={e => setCountForm({ ...countForm, note: e.target.value })}
                placeholder={t('inv_countReasonPlaceholder')}
              />
            </Field>

            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={saving} className="flex-1">
                {saving ? t('loading') : t('save')}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setShowCount(false)}>
                {t('cancel')}
              </GhostButton>
            </div>
          </form>
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
  tone: 'sky' | 'primary' | 'emerald' | 'amber';
}) {
  const tones: Record<string, string> = {
    sky: 'text-sky-400 bg-sky-500/10',
    primary: 'text-primary-text bg-primary/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
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
