import React, { useEffect, useState } from 'react';
import { UserPlus, Check, X, Gift, Phone, Car, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../store/LanguageContext';
import { dateTimeLocal } from '../../lib/datetime';
import { SearchableSelect } from '../../components/SearchableSelect';

/**
 * طلبات الانضمام — شاشة الاستقبال.
 *
 * الطلب ليس عميلًا بعد. الموظف يراجع الاسم والجوال وبيانات السيارة، ثم
 * يعتمد فيُنشأ العميل وسيارته ويُربط كود الإحالة إن وُجد، أو يرفض.
 */

interface JoinRequest {
  id: string;
  fullName: string;
  mobileNumber: string;
  brand: string | null;
  model: string | null;
  plateNumber: string | null;
  note: string | null;
  referralCode: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewedAt: string | null;
  rejectReason: string | null;
  alreadyCustomer: string | null;
  customer: { id: string; fullName: string } | null;
  reviewedBy: { firstName: string; lastName: string } | null;
}

interface Branch {
  id: string;
  nameAr: string;
  nameEn: string;
}

export function JoinRequestsView() {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';

  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [status, setStatus] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [branchFor, setBranchFor] = useState<Record<string, string>>({});

  useEffect(() => {
    load();
  }, [status]);

  async function load() {
    setLoading(true);
    try {
      const [reqRes, branchRes] = await Promise.all([
        api.get('/join-requests', { params: { status } }),
        api.get('/branches'),
      ]);
      setRequests(reqRes.data.requests || []);
      setBranches(branchRes.data.branches || []);
    } catch {
      setMsg('❌ ' + t('md_loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function approve(r: JoinRequest) {
    setBusyId(r.id);
    setMsg('');
    try {
      const res = await api.post(`/join-requests/${r.id}/approve`, {
        branchId: branchFor[r.id] || null,
      });
      setMsg('✅ ' + res.data.message);
      await load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(r: JoinRequest) {
    const reason = window.prompt(t('jr_rejectPrompt'));
    if (reason === null) return;

    setBusyId(r.id);
    try {
      await api.post(`/join-requests/${r.id}/reject`, { reason });
      setMsg('✅ ' + t('jr_rejected'));
      await load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setBusyId(null);
    }
  }

  const statusLabel: Record<string, string> = {
    PENDING: t('jr_pending'),
    APPROVED: t('jr_approved'),
    REJECTED: t('jr_rejected_s'),
  };
  const statusStyle: Record<string, string> = {
    PENDING: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
    APPROVED: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
    REJECTED: 'border-zinc-700 bg-zinc-800/60 text-zinc-400',
  };

  return (
    <div className={`space-y-6 ${isAr ? 'text-right' : 'text-left'}`}>
      <div>
        <h1 className="text-2xl font-black text-white">{t('jr_title')}</h1>
        <p className="mt-1 text-sm text-zinc-400">{t('jr_subtitle')}</p>
      </div>

      {msg && (
        <p className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-sm font-semibold text-white">
          {msg}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
              status === s
                ? 'border-primary bg-primary text-white'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white'
            }`}
          >
            {s === 'ALL' ? t('jr_all') : statusLabel[s]}
          </button>
        ))}
        <button
          onClick={load}
          title={t('jr_refresh')}
          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-zinc-500">{t('loading')}</p>
      ) : requests.length === 0 ? (
        <div className="glass-panel rounded-xl p-10 text-center">
          <UserPlus size={28} className="mx-auto text-zinc-700" />
          <p className="mt-3 text-sm text-zinc-500">{t('jr_empty')}</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {requests.map(r => (
            <div key={r.id} className="glass-panel space-y-3 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-white">{r.fullName}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-zinc-400" dir="ltr">
                    <Phone size={12} /> {r.mobileNumber}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 text-[11px] font-bold ${statusStyle[r.status]}`}
                >
                  {statusLabel[r.status]}
                </span>
              </div>

              {(r.brand || r.model || r.plateNumber) && (
                <p className="flex items-center gap-1.5 text-xs text-zinc-300">
                  <Car size={13} className="text-zinc-500" />
                  {[r.brand, r.model].filter(Boolean).join(' ')}
                  {r.plateNumber && (
                    <span className="font-mono text-primary-text"> — {r.plateNumber}</span>
                  )}
                </p>
              )}

              {r.referralCode && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <Gift size={13} /> {t('jr_viaReferral')}{' '}
                  <b className="font-mono">{r.referralCode}</b>
                </p>
              )}

              {r.alreadyCustomer && r.status === 'PENDING' && (
                <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-[11px] font-bold text-amber-400">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  {t('jr_alreadyCustomer').replace('{name}', r.alreadyCustomer)}
                </p>
              )}

              <p className="text-[11px] text-zinc-600" dir="ltr">
                {dateTimeLocal(r.createdAt)}
              </p>

              {r.status === 'PENDING' ? (
                <div className="space-y-2 border-t border-zinc-800 pt-3">
                  <SearchableSelect
                    value={branchFor[r.id] || ''}
                    placeholder={t('jr_assignBranch')}
                    onChange={val => setBranchFor({ ...branchFor, [r.id]: val })}
                    options={[
                      { value: '', label: t('md_noBranch') },
                      ...branches.map(b => ({ value: b.id, label: isAr ? b.nameAr : b.nameEn })),
                    ]}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={busyId === r.id}
                      onClick={() => approve(r)}
                      className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-bold text-white transition hover:bg-primary-hover disabled:opacity-50"
                    >
                      <Check size={14} /> {t('jr_approve')}
                    </button>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => reject(r)}
                      className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 py-2 text-xs font-bold text-zinc-300 transition hover:text-white disabled:opacity-50"
                    >
                      <X size={14} /> {t('jr_reject')}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="border-t border-zinc-800 pt-2 text-[11px] text-zinc-500">
                  {r.status === 'APPROVED' && r.customer
                    ? t('jr_becameCustomer').replace('{name}', r.customer.fullName)
                    : r.rejectReason || t('jr_noReason')}
                  {r.reviewedBy && ` — ${r.reviewedBy.firstName} ${r.reviewedBy.lastName}`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
