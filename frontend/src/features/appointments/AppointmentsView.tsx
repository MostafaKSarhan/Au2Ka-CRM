import React, { useEffect, useState } from 'react';
import {
  CalendarDays, PlusCircle, Clock, Check, X, UserCheck, Wrench, RefreshCw,
  BadgeCheck, CalendarClock, AlertTriangle, ChevronRight, ChevronLeft,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../store/LanguageContext';
import {
  Field, TextInput, TextArea, Select, PrimaryButton, GhostButton, IconButton, Banner, Modal,
} from '../admin/ui';

interface Slot {
  time: string;
  booked: number;
  capacity: number;
  available: boolean;
  subscribersOnly: boolean;
}

interface Appointment {
  id: string;
  reference: string;
  scheduledAt: string;
  status: 'BOOKED' | 'CONFIRMED' | 'ARRIVED' | 'CONVERTED' | 'CANCELLED' | 'NO_SHOW';
  isSubscriber: boolean;
  complaint: string | null;
  customer: { id: string; fullName: string; mobileNumber: string };
  vehicle: { id: string; brand: string; model: string; plateNumber: string } | null;
  jobCard: { id: string; jobNumber: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  BOOKED: 'border-sky-500/25 bg-sky-500/10 text-sky-400',
  CONFIRMED: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
  ARRIVED: 'border-primary/25 bg-primary/10 text-primary',
  CONVERTED: 'border-zinc-700 bg-zinc-800/60 text-zinc-400',
  CANCELLED: 'border-red-500/25 bg-red-500/10 text-red-400',
  NO_SHOW: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function AppointmentsView() {
  const { lang, t } = useTranslation();
  const { user } = useAuthStore();
  const isAr = lang === 'ar';
  const isAdmin = user?.role === 'ADMIN';

  const [date, setDate] = useState(todayKey());
  const [plan, setPlan] = useState<any | null>(null);
  const [week, setWeek] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [report, setReport] = useState<any | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const [showBook, setShowBook] = useState(false);
  const [bookForm, setBookForm] = useState({ customerId: '', vehicleId: '', time: '', complaint: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [newSlot, setNewSlot] = useState({ date: todayKey(), time: '' });

  useEffect(() => {
    load();
  }, [date]);

  useEffect(() => {
    loadCustomers();
    loadReport();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [planRes, listRes, weekRes] = await Promise.all([
        api.get('/appointments/availability', { params: { date } }),
        api.get('/appointments', { params: { date, limit: '100' } }),
        api.get('/appointments/week', { params: { from: date } }),
      ]);
      setPlan(planRes.data);
      setAppointments(listRes.data.appointments || []);
      setWeek(weekRes.data.days || []);
    } catch {
      setMsg('❌ ' + t('md_loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomers() {
    try {
      const res = await api.get('/customers', { params: { limit: '100' } });
      setCustomers(res.data.customers || []);
    } catch {
      /* the picker is optional here */
    }
  }

  async function loadReport() {
    try {
      const res = await api.get('/appointments/report');
      setReport(res.data);
    } catch {
      /* the report is a summary, not the main task */
    }
  }

  const vehicles = customers.find(c => c.id === bookForm.customerId)?.vehicles || [];

  function openBook(time: string) {
    setBookForm({ customerId: '', vehicleId: '', time, complaint: '', notes: '' });
    setMsg('');
    setShowBook(true);
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await api.post('/appointments', {
        customerId: bookForm.customerId,
        vehicleId: bookForm.vehicleId || null,
        scheduledAt: `${date}T${bookForm.time}:00`,
        complaint: bookForm.complaint.trim() || null,
        notes: bookForm.notes.trim() || null,
      });
      setMsg('✅ ' + t('appt_booked'));
      setShowBook(false);
      load();
      loadReport();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(appt: Appointment, status: string) {
    try {
      await api.put(`/appointments/${appt.id}/status`, { status });
      setMsg('✅ ' + t('appt_statusUpdated'));
      load();
      loadReport();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    }
  }

  async function convert(appt: Appointment) {
    try {
      const res = await api.post(`/appointments/${appt.id}/convert`, {});
      setMsg('✅ ' + t('appt_converted') + ' ' + res.data.jobCard.jobNumber);
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    }
  }

  async function submitReschedule(e: React.FormEvent) {
    e.preventDefault();
    if (!rescheduling) return;
    setSaving(true);
    try {
      await api.put(`/appointments/${rescheduling.id}/reschedule`, {
        scheduledAt: `${newSlot.date}T${newSlot.time}:00`,
      });
      setMsg('✅ ' + t('appt_rescheduled'));
      setRescheduling(null);
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function runReminders() {
    try {
      const res = await api.post('/appointments/reminders/run', {});
      setMsg(`✅ ${t('appt_remindersQueued')}: ${res.data.queued}`);
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    }
  }

  function shiftDate(days: number) {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + days);
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }

  const statusLabel: Record<string, string> = {
    BOOKED: t('appt_booked_s'),
    CONFIRMED: t('appt_confirmed'),
    ARRIVED: t('appt_arrived'),
    CONVERTED: t('appt_convertedStatus'),
    CANCELLED: t('appt_cancelled'),
    NO_SHOW: t('appt_noShow'),
  };

  const Prev = isAr ? ChevronRight : ChevronLeft;
  const Next = isAr ? ChevronLeft : ChevronRight;

  return (
    <div className={`space-y-6 ${isAr ? 'text-right' : 'text-left'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{t('appointments')}</h1>
          <p className="text-sm text-zinc-400">{t('appt_subtitle')}</p>
        </div>
        {isAdmin && (
          <GhostButton onClick={runReminders}>
            <CalendarClock size={15} /> {t('appt_runReminders')}
          </GhostButton>
        )}
      </div>

      <Banner message={msg} />

      {report && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={CalendarDays} label={t('appt_statTotal')} value={report.total} tone="sky" />
          <Stat icon={BadgeCheck} label={t('appt_statSubscribers')} value={report.subscribers} tone="emerald" />
          <Stat icon={Wrench} label={t('appt_statOccupancy')} value={`${report.occupancyRate}%`} tone="primary" />
          <Stat
            icon={UserCheck}
            label={t('appt_statPunctuality')}
            value={report.punctualityRate != null ? `${report.punctualityRate}%` : '—'}
            tone="amber"
          />
        </div>
      )}

      {/* Week strip */}
      <div className="glass-panel rounded-xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">{t('appt_weekView')}</h2>
          <div className="flex items-center gap-1">
            <IconButton onClick={() => shiftDate(-7)} title={t('appt_prevWeek')}>
              <Prev size={16} />
            </IconButton>
            <IconButton onClick={() => setDate(todayKey())} title={t('appt_today')}>
              <RefreshCw size={14} />
            </IconButton>
            <IconButton onClick={() => shiftDate(7)} title={t('appt_nextWeek')}>
              <Next size={16} />
            </IconButton>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {week.map(d => {
            const load = d.capacity > 0 ? Math.round((d.booked / d.capacity) * 100) : 0;
            const active = d.date === date;
            return (
              <button
                key={d.date}
                onClick={() => setDate(d.date)}
                className={`cursor-pointer rounded-lg border p-2 text-center transition ${
                  active
                    ? 'border-primary/50 bg-primary/10'
                    : d.isOpen
                      ? 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                      : 'border-zinc-900 bg-zinc-950/60'
                }`}
              >
                <p className="text-[10px] text-zinc-500">{d.date.slice(5)}</p>
                {d.isOpen ? (
                  <>
                    <p className="text-sm font-bold text-white">
                      {d.booked}/{d.capacity}
                    </p>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={`h-full ${load >= 100 ? 'bg-red-500' : load >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, load)}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-[10px] font-bold text-zinc-600">{t('appt_closed')}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day slots */}
      <div className="glass-panel space-y-4 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-primary/15 p-2 text-primary">
              <Clock size={18} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">{t('appt_daySlots')}</h2>
              {plan?.isOpen && (
                <p className="text-xs text-zinc-500">
                  {t('appt_capacity')}: {plan.booked}/{plan.capacity}
                  {plan.reservedForSubscribers > 0 &&
                    ` · ${t('appt_reserved')}: ${plan.reservedForSubscribers}`}
                </p>
              )}
            </div>
          </div>
          <TextInput type="date" value={date} onChange={e => setDate(e.target.value)} className="!w-auto" />
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-zinc-500">{t('loading')}</p>
        ) : !plan?.isOpen ? (
          <p className="flex items-center justify-center gap-2 py-8 text-center text-sm text-amber-400">
            <AlertTriangle size={16} />
            {plan?.reason === 'HOLIDAY' ? t('appt_holidayClosed') : t('appt_weeklyClosed')}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
            {plan.slots.map((s: Slot) => (
              <button
                key={s.time}
                onClick={() => s.available && openBook(s.time)}
                disabled={!s.available}
                title={s.subscribersOnly ? t('appt_subscribersOnly') : undefined}
                className={`rounded-lg border px-2 py-2.5 text-center transition ${
                  s.available
                    ? 'cursor-pointer border-zinc-800 bg-zinc-900/60 hover:border-primary/50 hover:bg-primary/5'
                    : s.subscribersOnly
                      ? 'cursor-not-allowed border-emerald-500/25 bg-emerald-500/5 opacity-70'
                      : 'cursor-not-allowed border-zinc-900 bg-zinc-950/60 opacity-50'
                }`}
              >
                <p className="font-mono text-sm font-bold text-white" dir="ltr">
                  {s.time}
                </p>
                <p className="text-[10px] text-zinc-500">
                  {s.subscribersOnly ? (
                    <span className="text-emerald-400">{t('appt_forSubscribers')}</span>
                  ) : (
                    `${s.booked}/${s.capacity}`
                  )}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* The day's bookings */}
      <div className="glass-panel space-y-3 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <h2 className="text-lg font-bold text-white">{t('appt_dayList')}</h2>
          <PrimaryButton
            onClick={() => openBook(plan?.slots?.find((s: Slot) => s.available)?.time || '09:00')}
            disabled={!plan?.isOpen}
          >
            <PlusCircle size={16} /> {t('appt_book')}
          </PrimaryButton>
        </div>

        {appointments.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">{t('appt_none')}</p>
        ) : (
          <div className="space-y-2">
            {appointments.map(a => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <p className="font-mono text-sm font-bold text-primary" dir="ltr">
                      {new Date(a.scheduledAt).toTimeString().slice(0, 5)}
                    </p>
                    <p className="font-mono text-[10px] text-zinc-600">{a.reference}</p>
                  </div>
                  <div>
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-white">
                      {a.customer.fullName}
                      {a.isSubscriber && (
                        <span className="inline-flex items-center gap-0.5 rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                          <BadgeCheck size={10} /> {t('sub_badge')}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {a.vehicle ? `${a.vehicle.brand} ${a.vehicle.model} — ${a.vehicle.plateNumber}` : t('appt_noVehicle')}
                      {a.complaint && ` · ${a.complaint}`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLES[a.status]}`}>
                    {statusLabel[a.status]}
                  </span>

                  {a.jobCard && (
                    <span className="font-mono text-[11px] text-primary">{a.jobCard.jobNumber}</span>
                  )}

                  {a.status === 'BOOKED' && (
                    <IconButton onClick={() => setStatus(a, 'CONFIRMED')} title={t('appt_confirm')}>
                      <Check size={15} />
                    </IconButton>
                  )}
                  {(a.status === 'BOOKED' || a.status === 'CONFIRMED') && (
                    <>
                      <IconButton onClick={() => setStatus(a, 'ARRIVED')} title={t('appt_markArrived')}>
                        <UserCheck size={15} />
                      </IconButton>
                      <IconButton
                        onClick={() => {
                          setRescheduling(a);
                          setNewSlot({ date, time: new Date(a.scheduledAt).toTimeString().slice(0, 5) });
                        }}
                        title={t('appt_reschedule')}
                      >
                        <CalendarClock size={15} />
                      </IconButton>
                      <IconButton tone="danger" onClick={() => setStatus(a, 'NO_SHOW')} title={t('appt_noShow')}>
                        <AlertTriangle size={15} />
                      </IconButton>
                      <IconButton tone="danger" onClick={() => setStatus(a, 'CANCELLED')} title={t('appt_cancel')}>
                        <X size={15} />
                      </IconButton>
                    </>
                  )}
                  {a.status === 'ARRIVED' && (
                    <button
                      onClick={() => convert(a)}
                      className="flex cursor-pointer items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-primary-hover"
                    >
                      <Wrench size={12} /> {t('appt_convert')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Book */}
      {showBook && (
        <Modal title={t('appt_book')} onClose={() => setShowBook(false)}>
          <form onSubmit={submitBooking} className="space-y-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5 text-center">
              <p className="font-mono text-sm font-bold text-primary" dir="ltr">
                {date} — {bookForm.time}
              </p>
            </div>

            <Field label={t('sub_customer')}>
              <Select
                required
                value={bookForm.customerId}
                onChange={e => setBookForm({ ...bookForm, customerId: e.target.value, vehicleId: '' })}
              >
                <option value="">{t('sub_selectCustomer')}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} — {c.mobileNumber}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('sub_vehicle')} hint={t('appt_vehicleHint')}>
              <Select
                value={bookForm.vehicleId}
                onChange={e => setBookForm({ ...bookForm, vehicleId: e.target.value })}
                disabled={!bookForm.customerId}
              >
                <option value="">{t('appt_noVehicle')}</option>
                {vehicles.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.brand} {v.model} — {v.plateNumber}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('appt_time')}>
              <Select required value={bookForm.time} onChange={e => setBookForm({ ...bookForm, time: e.target.value })}>
                {plan?.slots
                  ?.filter((s: Slot) => s.available || s.time === bookForm.time)
                  .map((s: Slot) => (
                    <option key={s.time} value={s.time}>
                      {s.time}
                    </option>
                  ))}
              </Select>
            </Field>

            <Field label={t('appt_complaint')}>
              <TextArea
                rows={2}
                value={bookForm.complaint}
                onChange={e => setBookForm({ ...bookForm, complaint: e.target.value })}
              />
            </Field>

            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={saving} className="flex-1">
                {saving ? t('loading') : t('appt_book')}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setShowBook(false)}>
                {t('cancel')}
              </GhostButton>
            </div>
          </form>
        </Modal>
      )}

      {/* Reschedule */}
      {rescheduling && (
        <Modal title={`${t('appt_reschedule')} — ${rescheduling.reference}`} onClose={() => setRescheduling(null)}>
          <form onSubmit={submitReschedule} className="space-y-3">
            <Field label={t('appt_newDate')}>
              <TextInput
                type="date"
                required
                value={newSlot.date}
                onChange={e => setNewSlot({ ...newSlot, date: e.target.value })}
              />
            </Field>
            <Field label={t('appt_newTime')}>
              <TextInput
                type="time"
                required
                value={newSlot.time}
                onChange={e => setNewSlot({ ...newSlot, time: e.target.value })}
              />
            </Field>
            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={saving} className="flex-1">
                {saving ? t('loading') : t('save')}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setRescheduling(null)}>
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
  tone: 'sky' | 'emerald' | 'primary' | 'amber';
}) {
  const tones: Record<string, string> = {
    sky: 'text-sky-400 bg-sky-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    primary: 'text-primary bg-primary/10',
    amber: 'text-amber-400 bg-amber-500/10',
  };
  return (
    <div className="glass-panel flex items-center gap-3 rounded-xl p-4">
      <span className={`rounded-lg p-2.5 ${tones[tone]}`}>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-zinc-500">{label}</p>
        <p className="text-lg font-bold text-white">{value}</p>
      </div>
    </div>
  );
}
