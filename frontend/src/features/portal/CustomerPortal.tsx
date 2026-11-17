import React, { useEffect, useState } from 'react';
import {
  Shield, Phone, KeyRound, LogOut, Car, Wrench, FileBarChart, CalendarDays,
  BadgeCheck, Gift, Clock, ChevronLeft, ChevronRight, X, Check, AlertTriangle,
  AlertOctagon, Gauge, Receipt,
} from 'lucide-react';
import { portalApi, getPortalToken, setPortalToken } from './portalApi';
import { useTranslation } from '../../store/LanguageContext';

type Tab = 'home' | 'cards' | 'booking' | 'reports';

const STATUS_LABELS: Record<string, { ar: string; en: string; tone: string }> = {
  RECEIVED: { ar: 'تم الاستلام', en: 'Received', tone: 'border-sky-500/25 bg-sky-500/10 text-sky-400' },
  INSPECTION: { ar: 'قيد الفحص', en: 'Under inspection', tone: 'border-amber-500/25 bg-amber-500/10 text-amber-400' },
  WAITING_APPROVAL: { ar: 'بانتظار موافقتك', en: 'Awaiting your approval', tone: 'border-primary/25 bg-primary/10 text-primary' },
  IN_PROGRESS: { ar: 'تحت الإصلاح', en: 'Being repaired', tone: 'border-amber-500/25 bg-amber-500/10 text-amber-400' },
  COMPLETED: { ar: 'جاهزة للاستلام', en: 'Ready for collection', tone: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400' },
  DELIVERED: { ar: 'تم التسليم', en: 'Delivered', tone: 'border-zinc-700 bg-zinc-800/60 text-zinc-400' },
};

/** M7 — the customer's own portal. No staff navigation, no staff token. */
export function CustomerPortal() {
  const { lang, setLang, t } = useTranslation();
  const isAr = lang === 'ar';

  const [token, setToken] = useState<string | null>(getPortalToken());
  const [tab, setTab] = useState<Tab>('home');

  if (!token) {
    return <PortalLogin onSignedIn={setToken} />;
  }

  async function signOut() {
    try {
      await portalApi.post('/auth/logout', {});
    } catch {
      /* the local session goes either way */
    }
    setPortalToken(null);
    setToken(null);
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
    { id: 'home', label: t('pt_home'), icon: Car },
    { id: 'cards', label: t('pt_myCards'), icon: Wrench },
    { id: 'booking', label: t('pt_booking'), icon: CalendarDays },
    { id: 'reports', label: t('pt_reports'), icon: FileBarChart },
  ];

  return (
    <div className="min-h-screen bg-background text-zinc-100" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="sticky top-0 z-30 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-primary/20 p-2 text-primary">
              <Shield size={18} />
            </span>
            <div>
              <p className="text-lg font-black tracking-wider">
                Au<span className="text-primary">2</span>Ka
              </p>
              <p className="text-[10px] text-zinc-500">{t('pt_title')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(isAr ? 'en' : 'ar')}
              className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-[11px] font-bold text-zinc-300"
            >
              {isAr ? 'EN' : 'ع'}
            </button>
            <button
              onClick={signOut}
              className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 transition hover:text-red-400"
              title={t('logout')}
            >
              <LogOut size={15} className={isAr ? 'rotate-180' : ''} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-4 pb-24">
        {tab === 'home' && <PortalHome />}
        {tab === 'cards' && <PortalCards />}
        {tab === 'booking' && <PortalBooking />}
        {tab === 'reports' && <PortalReports />}
      </main>

      {/* Bottom bar — this portal is used on a phone first */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-900 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl">
          {tabs.map(item => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex flex-1 cursor-pointer flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold transition ${
                  active ? 'text-primary' : 'text-zinc-500'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/** Sign-in by mobile number and a one-time code — no password. */
function PortalLogin({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const { lang, setLang, t } = useTranslation();
  const isAr = lang === 'ar';

  const [step, setStep] = useState<'mobile' | 'code'>('mobile');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (window.location.search.includes('portal-expired')) {
      setError(t('pt_sessionExpired'));
    }
  }, []);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await portalApi.post('/auth/request-otp', { mobileNumber: mobile.trim() });
      setInfo(t('pt_codeSent'));
      setStep('code');
    } catch (err: any) {
      setError(err.response?.data?.message || t('pt_codeFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await portalApi.post('/auth/verify-otp', {
        mobileNumber: mobile.trim(),
        code: code.trim(),
      });
      setPortalToken(res.data.token);
      onSignedIn(res.data.token);
    } catch (err: any) {
      setError(err.response?.data?.message || t('pt_codeFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background p-4 text-zinc-100"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="glass-panel w-full max-w-sm space-y-5 rounded-2xl p-6">
        <div className="text-center">
          <span className="inline-flex rounded-xl bg-primary/20 p-3 text-primary">
            <Shield size={26} />
          </span>
          <h1 className="mt-3 text-2xl font-black tracking-wider">
            Au<span className="text-primary">2</span>Ka
          </h1>
          <p className="mt-1 text-xs text-zinc-400">{t('pt_loginSubtitle')}</p>
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs font-bold text-red-400">
            {error}
          </p>
        )}
        {info && step === 'code' && (
          <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs font-bold text-emerald-400">
            {info}
          </p>
        )}

        {step === 'mobile' ? (
          <form onSubmit={requestCode} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-400">
                {t('pt_mobile')}
              </label>
              <div className="relative">
                <Phone size={15} className="absolute top-1/2 -translate-y-1/2 text-zinc-600 start-3" />
                <input
                  type="tel"
                  required
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 py-2.5 ps-9 pe-3 text-sm text-white outline-none focus:border-primary/60"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-bold text-white transition hover:bg-primary-hover disabled:opacity-50"
            >
              {busy ? t('loading') : t('pt_sendCode')}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-400">
                {t('pt_code')}
              </label>
              <div className="relative">
                <KeyRound size={15} className="absolute top-1/2 -translate-y-1/2 text-zinc-600 start-3" />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="------"
                  dir="ltr"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 py-2.5 ps-9 pe-3 text-center font-mono text-lg tracking-[0.5em] text-white outline-none focus:border-primary/60"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-bold text-white transition hover:bg-primary-hover disabled:opacity-50"
            >
              {busy ? t('loading') : t('pt_signIn')}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('mobile');
                setCode('');
                setError('');
              }}
              className="w-full cursor-pointer text-xs text-zinc-500 transition hover:text-white"
            >
              {t('pt_changeNumber')}
            </button>
          </form>
        )}

        <button
          onClick={() => setLang(isAr ? 'en' : 'ar')}
          className="w-full cursor-pointer text-[11px] text-zinc-600 transition hover:text-zinc-300"
        >
          {isAr ? 'English' : 'العربية'}
        </button>
      </div>
    </div>
  );
}

function PortalHome() {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';
  const [data, setData] = useState<any | null>(null);
  const [file, setFile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalApi
      .get('/me')
      .then(res => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  async function openFile(vehicleId: string) {
    try {
      const res = await portalApi.get(`/vehicles/${vehicleId}/file`);
      setFile(res.data);
    } catch {
      /* ignore */
    }
  }

  if (loading) return <p className="py-16 text-center text-sm text-zinc-500">{t('loading')}</p>;
  if (!data) return <p className="py-16 text-center text-sm text-zinc-500">{t('md_loadFailed')}</p>;

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-xl p-5">
        <p className="text-xs text-zinc-500">{t('pt_welcome')}</p>
        <h2 className="text-xl font-bold text-white">{data.customer.fullName}</h2>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
            <p className="flex items-center gap-1 text-[11px] text-zinc-500">
              <Gift size={12} /> {t('ref_balance')}
            </p>
            <p className="text-lg font-bold text-amber-400">
              {data.customer.pointsBalance}
              <span className="ms-1 text-[11px] font-normal text-zinc-500">
                ≈ {data.pointsValue} {t('sub_currency')}
              </span>
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
            <p className="flex items-center gap-1 text-[11px] text-zinc-500">
              <Wrench size={12} /> {t('pt_openCards')}
            </p>
            <p className="text-lg font-bold text-white">{data.openCards}</p>
          </div>
        </div>

        {data.subscription && (
          <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-400">
              <BadgeCheck size={14} />
              {isAr ? data.subscription.plan?.nameAr : data.subscription.plan?.nameEn}
            </p>
            <p className="mt-1 text-[11px] text-zinc-400">
              {t('sub_visitsBalance')}: {data.subscription.freeVisitsRemaining}/
              {data.subscription.freeVisitsTotal} · {t('sub_currentEnds')}{' '}
              <span dir="ltr">{data.subscription.endDate.slice(0, 10)}</span>
            </p>
          </div>
        )}

        {data.nextAppointment && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-xs">
            <Clock size={14} className="shrink-0 text-sky-400" />
            <span className="text-zinc-300">
              {t('pt_nextAppointment')}:{' '}
              <span className="font-bold text-white" dir="ltr">
                {data.nextAppointment.scheduledAt.slice(0, 10)}{' '}
                {new Date(data.nextAppointment.scheduledAt).toTimeString().slice(0, 5)}
              </span>
            </span>
          </div>
        )}

        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-center">
          <p className="text-[11px] text-zinc-500">{t('pt_yourReferralCode')}</p>
          <p className="font-mono text-xl font-black tracking-widest text-primary">
            {data.referralCode}
          </p>
          <p className="mt-1 text-[10px] text-zinc-600">{t('pt_referralHint')}</p>
        </div>
      </div>

      <div className="glass-panel space-y-2 rounded-xl p-5">
        <h3 className="border-b border-zinc-800 pb-2 text-sm font-bold text-white">
          {t('pt_myVehicles')}
        </h3>
        {data.customer.vehicles.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-500">{t('pt_noVehicles')}</p>
        ) : (
          data.customer.vehicles.map((v: any) => (
            <button
              key={v.id}
              onClick={() => openFile(v.id)}
              className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-start transition hover:border-primary/40"
            >
              <div>
                <p className="text-sm font-bold text-white">
                  {v.brand} {v.model}
                </p>
                <p className="font-mono text-[11px] text-primary" dir="ltr">
                  {v.plateNumber}
                </p>
              </div>
              <div className="text-end">
                <p className="font-mono text-xs text-zinc-400">{v.mileage.toLocaleString()}</p>
                <p className="text-[10px] text-zinc-600">{t('vf_km')}</p>
              </div>
            </button>
          ))
        )}
      </div>

      {file && <VehicleFileSheet file={file} onClose={() => setFile(null)} />}
    </div>
  );
}

function VehicleFileSheet({ file, onClose }: { file: any; onClose: () => void }) {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-2xl space-y-4 pb-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{t('vf_title')}</h2>
          <button onClick={onClose} className="cursor-pointer p-1.5 text-zinc-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="glass-panel rounded-xl p-5">
          <h3 className="text-xl font-bold text-white">
            {file.vehicle.brand} {file.vehicle.model}
          </h3>
          <p className="font-mono text-sm text-primary" dir="ltr">
            {file.vehicle.plateNumber}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric icon={Clock} label={t('vf_visits')} value={file.summary.visits} />
            <Metric icon={Gauge} label={t('vf_currentMileage')} value={file.summary.currentMileage.toLocaleString()} />
            <Metric
              icon={Receipt}
              label={t('vf_totalSpent')}
              value={Math.round(file.summary.totalSpent).toLocaleString()}
            />
            <Metric icon={Wrench} label={t('vf_partsReplaced')} value={file.summary.partsReplaced} />
          </div>
        </div>

        {file.documents.length > 0 && (
          <div className="glass-panel space-y-2 rounded-xl p-5">
            <h3 className="border-b border-zinc-800 pb-2 text-sm font-bold text-white">
              {t('vf_documents')}
            </h3>
            {file.documents.map((d: any) => {
              const days = d.daysUntilExpiry;
              const expired = days != null && days < 0;
              const soon = days != null && days >= 0 && days <= 30;
              return (
                <div
                  key={d.id}
                  className={`rounded-lg border p-2.5 text-xs ${
                    expired
                      ? 'border-red-500/25 bg-red-500/5'
                      : soon
                        ? 'border-amber-500/25 bg-amber-500/5'
                        : 'border-zinc-800 bg-zinc-900/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white">{d.title || d.type}</span>
                    {(expired || soon) && (
                      <span className={`text-[10px] font-bold ${expired ? 'text-red-400' : 'text-amber-400'}`}>
                        {expired ? t('vf_expired') : `${days} ${t('vf_daysToExpiry')}`}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-zinc-500" dir="ltr">
                    {d.expiryDate ? d.expiryDate.slice(0, 10) : '—'}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {file.replacements.length > 0 && (
          <div className="glass-panel space-y-2 rounded-xl p-5">
            <h3 className="border-b border-zinc-800 pb-2 text-sm font-bold text-white">
              {t('vf_replacedParts')}
            </h3>
            {file.replacements.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5 text-xs">
                <div>
                  <p className="font-bold text-white">{r.partName}</p>
                  <p className="font-mono text-[10px] text-zinc-500" dir="ltr">
                    {r.replacedAt.slice(0, 10)}
                  </p>
                </div>
                {r.warranty === 'ACTIVE' && (
                  <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    {t('vf_warranty')} {r.warrantyDaysLeft} {t('vf_daysLeft')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="glass-panel space-y-2 rounded-xl p-5">
          <h3 className="border-b border-zinc-800 pb-2 text-sm font-bold text-white">
            {t('vf_timeline')}
          </h3>
          {file.timeline.slice(0, 15).map((entry: any) => (
            <div key={`${entry.kind}-${entry.id}`} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white">{entry.title}</span>
                <span className="font-mono text-[10px] text-zinc-500" dir="ltr">
                  {String(entry.date).slice(0, 10)}
                </span>
              </div>
              {entry.detail && <p className="mt-1 line-clamp-2 text-[11px] text-zinc-400">{entry.detail}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PortalCards() {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalApi
      .get('/job-cards')
      .then(res => setCards(res.data.jobCards || []))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="py-16 text-center text-sm text-zinc-500">{t('loading')}</p>;
  if (cards.length === 0)
    return <p className="py-16 text-center text-sm text-zinc-500">{t('pt_noCards')}</p>;

  return (
    <div className="space-y-3">
      {cards.map(c => {
        const status = STATUS_LABELS[c.status];
        return (
          <div key={c.id} className="glass-panel rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm font-bold text-primary">{c.jobNumber}</span>
              <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${status?.tone}`}>
                {isAr ? status?.ar : status?.en}
              </span>
            </div>

            <p className="mt-2 text-sm text-white">
              {c.vehicle.brand} {c.vehicle.model}
              <span className="ms-2 font-mono text-xs text-zinc-500" dir="ltr">
                {c.vehicle.plateNumber}
              </span>
            </p>
            <p className="mt-1 text-xs text-zinc-400">{c.customerComplaint}</p>

            {c.requiredRepairs && (
              <p className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-2 text-[11px] text-zinc-400">
                {c.requiredRepairs}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-2 text-[11px]">
              <span className="font-mono text-zinc-500" dir="ltr">
                {c.entryDate.slice(0, 10)}
              </span>
              <div className="flex items-center gap-2">
                {c.isFreeVisit && (
                  <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 font-bold text-emerald-400">
                    {t('sub_badgeFreeVisit')}
                  </span>
                )}
                {c.subscriptionDiscount && (
                  <span className="rounded border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 font-bold text-sky-400">
                    {t('sub_badgeDiscount')} {Number(c.subscriptionDiscount)}%
                  </span>
                )}
                {c.estimatedCost && (
                  <span className="font-mono font-bold text-white">
                    {Math.round(Number(c.estimatedCost)).toLocaleString()} {t('sub_currency')}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PortalBooking() {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';

  const today = new Date();
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const [date, setDate] = useState(key(today));
  const [plan, setPlan] = useState<any | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [complaint, setComplaint] = useState('');
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    portalApi.get('/me').then(res => setVehicles(res.data.customer.vehicles || [])).catch(() => {});
    loadAppointments();
  }, []);

  useEffect(() => {
    portalApi
      .get('/availability', { params: { date } })
      .then(res => setPlan(res.data))
      .catch(() => setPlan(null));
  }, [date]);

  function loadAppointments() {
    portalApi
      .get('/appointments')
      .then(res => setAppointments(res.data.appointments || []))
      .catch(() => {});
  }

  async function book() {
    if (!chosen) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await portalApi.post('/appointments', {
        vehicleId: vehicleId || null,
        scheduledAt: `${date}T${chosen}:00`,
        complaint: complaint.trim() || null,
      });
      setMsg('✅ ' + res.data.message + ' — ' + res.data.appointment.reference);
      setChosen('');
      setComplaint('');
      loadAppointments();
      const refreshed = await portalApi.get('/availability', { params: { date } });
      setPlan(refreshed.data);
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    if (!confirm(t('pt_confirmCancel'))) return;
    try {
      await portalApi.post(`/appointments/${id}/cancel`, {});
      setMsg('✅ ' + t('appt_cancelled'));
      loadAppointments();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    }
  }

  function shift(days: number) {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + days);
    if (d < new Date(key(today) + 'T00:00:00')) return;
    setDate(key(d));
  }

  const Prev = isAr ? ChevronRight : ChevronLeft;
  const Next = isAr ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-4">
      {msg && (
        <p
          className={`rounded-lg border p-2.5 text-xs font-bold ${
            msg.startsWith('❌')
              ? 'border-red-500/20 bg-red-500/10 text-red-400'
              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
          }`}
        >
          {msg}
        </p>
      )}

      <div className="glass-panel space-y-4 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">{t('pt_pickSlot')}</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-1)} className="cursor-pointer rounded p-1.5 text-zinc-400 hover:text-white">
              <Prev size={16} />
            </button>
            <span className="font-mono text-xs text-zinc-300" dir="ltr">
              {date}
            </span>
            <button onClick={() => shift(1)} className="cursor-pointer rounded p-1.5 text-zinc-400 hover:text-white">
              <Next size={16} />
            </button>
          </div>
        </div>

        {!plan ? (
          <p className="py-6 text-center text-xs text-zinc-500">{t('loading')}</p>
        ) : !plan.isOpen ? (
          <p className="flex items-center justify-center gap-2 py-6 text-center text-xs text-amber-400">
            <AlertTriangle size={14} />
            {plan.reason === 'HOLIDAY' ? t('appt_holidayClosed') : t('appt_weeklyClosed')}
          </p>
        ) : (
          <>
            {plan.isSubscriber && (
              <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-[11px] font-bold text-emerald-400">
                <BadgeCheck size={11} className="inline" /> {t('pt_subscriberPriority')}
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {plan.slots.map((s: any) => (
                <button
                  key={s.time}
                  onClick={() => s.available && setChosen(s.time)}
                  disabled={!s.available}
                  className={`rounded-lg border py-2 font-mono text-sm font-bold transition ${
                    chosen === s.time
                      ? 'border-primary bg-primary text-white'
                      : s.available
                        ? 'cursor-pointer border-zinc-800 bg-zinc-900/60 text-white hover:border-primary/50'
                        : 'cursor-not-allowed border-zinc-900 bg-zinc-950/60 text-zinc-700'
                  }`}
                  dir="ltr"
                >
                  {s.time}
                </button>
              ))}
            </div>
          </>
        )}

        {chosen && (
          <div className="space-y-3 border-t border-zinc-800 pt-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-400">{t('sub_vehicle')}</label>
              <select
                value={vehicleId}
                onChange={e => setVehicleId(e.target.value)}
                className="w-full cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
              >
                <option value="">{t('appt_noVehicle')}</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.brand} {v.model} — {v.plateNumber}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-400">{t('appt_complaint')}</label>
              <textarea
                rows={2}
                value={complaint}
                onChange={e => setComplaint(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm text-white outline-none focus:border-primary/60"
              />
            </div>
            <button
              onClick={book}
              disabled={busy}
              className="w-full cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-bold text-white transition hover:bg-primary-hover disabled:opacity-50"
            >
              {busy ? t('loading') : `${t('appt_book')} — ${date} ${chosen}`}
            </button>
          </div>
        )}
      </div>

      <div className="glass-panel space-y-2 rounded-xl p-5">
        <h2 className="border-b border-zinc-800 pb-2 text-sm font-bold text-white">
          {t('pt_myAppointments')}
        </h2>
        {appointments.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-500">{t('appt_none')}</p>
        ) : (
          appointments.map(a => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div>
                <p className="font-mono text-sm font-bold text-white" dir="ltr">
                  {a.scheduledAt.slice(0, 10)} {new Date(a.scheduledAt).toTimeString().slice(0, 5)}
                </p>
                <p className="font-mono text-[10px] text-zinc-600">{a.reference}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400">
                  {a.status === 'BOOKED'
                    ? t('appt_booked_s')
                    : a.status === 'CONFIRMED'
                      ? t('appt_confirmed')
                      : a.status === 'CANCELLED'
                        ? t('appt_cancelled')
                        : a.status === 'CONVERTED'
                          ? t('appt_convertedStatus')
                          : a.status}
                </span>
                {['BOOKED', 'CONFIRMED'].includes(a.status) && (
                  <button
                    onClick={() => cancel(a.id)}
                    className="cursor-pointer rounded p-1 text-zinc-500 transition hover:text-red-400"
                    title={t('appt_cancel')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PortalReports() {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';
  const [reports, setReports] = useState<any[]>([]);
  const [open, setOpen] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const months = isAr
    ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  useEffect(() => {
    portalApi
      .get('/reports')
      .then(res => setReports(res.data.reports || []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  async function openReport(id: string) {
    try {
      const res = await portalApi.get(`/reports/${id}`);
      setOpen(res.data.report);
    } catch {
      /* ignore */
    }
  }

  if (loading) return <p className="py-16 text-center text-sm text-zinc-500">{t('loading')}</p>;
  if (reports.length === 0)
    return <p className="py-16 text-center text-sm text-zinc-500">{t('pt_noReports')}</p>;

  const ratingMeta: Record<string, { icon: React.ElementType; tone: string; key: string }> = {
    OK: { icon: Check, tone: 'text-emerald-400', key: 'insp_ok' },
    NEEDS_ATTENTION: { icon: AlertTriangle, tone: 'text-amber-400', key: 'insp_attention' },
    CRITICAL: { icon: AlertOctagon, tone: 'text-red-400', key: 'insp_critical' },
  };

  return (
    <div className="space-y-3">
      {reports.map(r => (
        <button
          key={r.id}
          onClick={() => openReport(r.id)}
          className="glass-panel flex w-full cursor-pointer items-center justify-between rounded-xl p-4 text-start transition hover:border-primary/30"
        >
          <div>
            <p className="text-sm font-bold text-white">
              {months[r.month - 1]} {r.year}
            </p>
            <p className="text-[11px] text-zinc-500">
              {r.vehicle.brand} {r.vehicle.model} — {r.vehicle.plateNumber}
            </p>
          </div>
          {r.healthScore != null && (
            <span
              className={`rounded-lg border px-3 py-1.5 text-lg font-black ${
                r.healthScore >= 80
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                  : r.healthScore >= 55
                    ? 'border-amber-500/25 bg-amber-500/10 text-amber-400'
                    : 'border-red-500/25 bg-red-500/10 text-red-400'
              }`}
            >
              {r.healthScore}
            </span>
          )}
        </button>
      ))}

      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-2xl space-y-4 pb-10">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {months[open.month - 1]} {open.year}
              </h2>
              <button onClick={() => setOpen(null)} className="cursor-pointer p-1.5 text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="glass-panel space-y-4 rounded-xl p-5">
              <p className="text-sm font-bold text-white">
                {open.vehicle.brand} {open.vehicle.model}
                <span className="ms-2 font-mono text-xs text-primary" dir="ltr">
                  {open.vehicle.plateNumber}
                </span>
              </p>

              {open.healthScore != null && (
                <div
                  className={`rounded-xl border p-4 text-center ${
                    open.healthScore >= 80
                      ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                      : open.healthScore >= 55
                        ? 'border-amber-500/25 bg-amber-500/10 text-amber-400'
                        : 'border-red-500/25 bg-red-500/10 text-red-400'
                  }`}
                >
                  <p className="text-[11px] opacity-80">{t('insp_healthScore')}</p>
                  <p className="text-4xl font-black">{open.healthScore}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                <Metric icon={Clock} label={t('vf_visits')} value={open.visits} />
                <Metric
                  icon={Receipt}
                  label={t('vf_totalSpent')}
                  value={Math.round(Number(open.totalCost)).toLocaleString()}
                />
                <Metric icon={Wrench} label={t('vf_partsReplaced')} value={open.partsReplaced} />
              </div>

              {open.findings?.length > 0 && (
                <div>
                  <h3 className="mb-2 border-b border-zinc-800 pb-2 text-sm font-bold text-white">
                    {t('rep_findings')}
                  </h3>
                  <ul className="space-y-1.5">
                    {open.findings.map((f: any, i: number) => {
                      const meta = ratingMeta[f.rating];
                      if (!meta) return null;
                      const Icon = meta.icon;
                      return (
                        <li key={i} className="flex items-start gap-2 text-xs">
                          <Icon size={13} className={`mt-0.5 shrink-0 ${meta.tone}`} />
                          <span className="text-zinc-300">
                            {isAr ? f.nameAr : f.nameEn}
                            {f.note && <span className="block text-[11px] text-zinc-500">{f.note}</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="mb-2 border-b border-zinc-800 pb-2 text-sm font-bold text-white">
                  {t('rep_recommendations')}
                </h3>
                <p className="whitespace-pre-line text-xs leading-relaxed text-zinc-300">
                  {isAr ? open.recommendationsAr : open.recommendationsEn}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-2 text-center">
      <Icon size={13} className="mx-auto text-zinc-500" />
      <p className="mt-0.5 text-[10px] text-zinc-500">{label}</p>
      <p className="text-sm font-bold text-white">{value}</p>
    </div>
  );
}
