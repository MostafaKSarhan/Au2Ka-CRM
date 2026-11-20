import React, { useEffect, useState } from 'react';
import { Clock, CalendarOff, PlusCircle, Trash2, Save } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from '../../store/LanguageContext';
import {
  SectionHeader, Field, TextInput, PrimaryButton, GhostButton,
  IconButton, Banner, Modal, TableShell,
} from './ui';

interface WorkingDay {
  weekday: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  dailyCapacity: number;
  reservedForSubscribers: number;
}

interface Holiday {
  id: string;
  date: string;
  nameAr: string;
  nameEn: string;
  isClosed: boolean;
  capacity: number | null;
}

const WEEKDAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const emptyHoliday = { date: '', nameAr: '', nameEn: '' };

export function WorkingHoursTab() {
  const { lang, t } = useTranslation();
  const isAr = lang === 'ar';
  const names = isAr ? WEEKDAYS_AR : WEEKDAYS_EN;

  const [days, setDays] = useState<WorkingDay[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [showHoliday, setShowHoliday] = useState(false);
  const [holidayForm, setHolidayForm] = useState(emptyHoliday);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [daysRes, holidaysRes] = await Promise.all([
        api.get('/appointments/working-days'),
        api.get('/appointments/holidays'),
      ]);
      setDays(daysRes.data.days || []);
      setHolidays(holidaysRes.data.holidays || []);
    } catch {
      setMsg('❌ ' + t('md_loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  function patch(weekday: number, changes: Partial<WorkingDay>) {
    setDays(days.map(d => (d.weekday === weekday ? { ...d, ...changes } : d)));
  }

  async function saveDay(day: WorkingDay) {
    setSavingDay(day.weekday);
    setMsg('');
    try {
      await api.put(`/appointments/working-days/${day.weekday}`, {
        isOpen: day.isOpen,
        openTime: day.openTime,
        closeTime: day.closeTime,
        slotMinutes: Number(day.slotMinutes),
        dailyCapacity: Number(day.dailyCapacity),
        reservedForSubscribers: Number(day.reservedForSubscribers),
      });
      setMsg('✅ ' + t('wh_daySaved'));
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSavingDay(null);
    }
  }

  async function submitHoliday(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await api.post('/appointments/holidays', { ...holidayForm, isClosed: true });
      setMsg('✅ ' + t('wh_holidayAdded'));
      setShowHoliday(false);
      setHolidayForm(emptyHoliday);
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  async function removeHoliday(h: Holiday) {
    if (!confirm(`${t('md_confirmDelete')} "${isAr ? h.nameAr : h.nameEn}"؟`)) return;
    try {
      await api.delete(`/appointments/holidays/${h.id}`);
      setMsg('✅ ' + t('wh_holidayDeleted'));
      load();
    } catch (err: any) {
      setMsg('❌ ' + (err.response?.data?.message || t('md_deleteFailed')));
    }
  }

  return (
    <div className="space-y-5">
      <Banner message={msg} />

      <div className="glass-panel space-y-4 rounded-xl p-5">
        <SectionHeader icon={Clock} title={t('wh_workingHours')} subtitle={t('wh_workingHoursHint')} />

        {loading ? (
          <p className="py-8 text-center text-sm text-zinc-500">{t('loading')}</p>
        ) : (
          <div className="space-y-2">
            {days.map(day => (
              <div
                key={day.weekday}
                className={`rounded-lg border p-3 transition ${
                  day.isOpen ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-900 bg-zinc-950/60'
                }`}
              >
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex min-w-[110px] cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={day.isOpen}
                      onChange={e => patch(day.weekday, { isOpen: e.target.checked })}
                      className="cursor-pointer accent-red-600"
                    />
                    <span className="text-sm font-bold text-white">{names[day.weekday]}</span>
                  </label>

                  <div className="w-24">
                    <label className="mb-1 block text-[10px] text-zinc-500">{t('wh_open')}</label>
                    <TextInput
                      type="time"
                      disabled={!day.isOpen}
                      value={day.openTime}
                      onChange={e => patch(day.weekday, { openTime: e.target.value })}
                      className="!py-1.5 text-xs"
                    />
                  </div>
                  <div className="w-24">
                    <label className="mb-1 block text-[10px] text-zinc-500">{t('wh_close')}</label>
                    <TextInput
                      type="time"
                      disabled={!day.isOpen}
                      value={day.closeTime}
                      onChange={e => patch(day.weekday, { closeTime: e.target.value })}
                      className="!py-1.5 text-xs"
                    />
                  </div>
                  <div className="w-20">
                    <label className="mb-1 block text-[10px] text-zinc-500">{t('wh_slot')}</label>
                    <TextInput
                      type="number"
                      min={15}
                      max={240}
                      step={15}
                      disabled={!day.isOpen}
                      value={day.slotMinutes}
                      onChange={e => patch(day.weekday, { slotMinutes: Number(e.target.value) })}
                      className="!py-1.5 text-xs"
                    />
                  </div>
                  <div className="w-20">
                    <label className="mb-1 block text-[10px] text-zinc-500">{t('wh_capacity')}</label>
                    <TextInput
                      type="number"
                      min={0}
                      disabled={!day.isOpen}
                      value={day.dailyCapacity}
                      onChange={e => patch(day.weekday, { dailyCapacity: Number(e.target.value) })}
                      className="!py-1.5 text-xs"
                    />
                  </div>
                  <div className="w-24">
                    <label className="mb-1 block text-[10px] text-zinc-500">{t('wh_reserved')}</label>
                    <TextInput
                      type="number"
                      min={0}
                      disabled={!day.isOpen}
                      value={day.reservedForSubscribers}
                      onChange={e => patch(day.weekday, { reservedForSubscribers: Number(e.target.value) })}
                      className="!py-1.5 text-xs"
                    />
                  </div>

                  <GhostButton
                    onClick={() => saveDay(day)}
                    disabled={savingDay === day.weekday}
                    className="!px-3 !py-1.5 text-xs"
                  >
                    <Save size={13} /> {t('save')}
                  </GhostButton>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-zinc-600">{t('wh_reservedNote')}</p>
      </div>

      <div className="glass-panel space-y-4 rounded-xl p-5">
        <SectionHeader
          icon={CalendarOff}
          title={t('wh_holidays')}
          subtitle={t('wh_holidaysHint')}
          action={
            <PrimaryButton onClick={() => setShowHoliday(true)}>
              <PlusCircle size={16} /> {t('wh_addHoliday')}
            </PrimaryButton>
          }
        />

        <TableShell
          headers={[t('wh_date'), t('md_nameAr'), t('md_nameEn'), t('actions')]}
          loading={loading}
          loadingText={t('loading')}
          isEmpty={holidays.length === 0}
          empty={t('wh_noHolidays')}
        >
          {holidays.map(h => (
            <tr key={h.id} className="border-b border-zinc-900 transition hover:bg-zinc-900/40">
              <td className="px-3 py-2.5 font-mono text-xs text-primary" dir="ltr">
                {h.date.slice(0, 10)}
              </td>
              <td className="px-3 py-2.5 font-semibold text-white">{h.nameAr}</td>
              <td className="px-3 py-2.5 text-zinc-400">{h.nameEn}</td>
              <td className="px-3 py-2.5">
                <IconButton tone="danger" onClick={() => removeHoliday(h)} title={t('delete')}>
                  <Trash2 size={15} />
                </IconButton>
              </td>
            </tr>
          ))}
        </TableShell>
      </div>

      {showHoliday && (
        <Modal title={t('wh_addHoliday')} onClose={() => setShowHoliday(false)}>
          <form onSubmit={submitHoliday} className="space-y-3">
            <Field label={t('wh_date')}>
              <TextInput
                type="date"
                required
                value={holidayForm.date}
                onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })}
              />
            </Field>
            <Field label={t('md_nameAr')}>
              <TextInput
                required
                value={holidayForm.nameAr}
                onChange={e => setHolidayForm({ ...holidayForm, nameAr: e.target.value })}
              />
            </Field>
            <Field label={t('md_nameEn')}>
              <TextInput
                required
                value={holidayForm.nameEn}
                onChange={e => setHolidayForm({ ...holidayForm, nameEn: e.target.value })}
              />
            </Field>
            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={saving} className="flex-1">
                {saving ? t('loading') : t('save')}
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setShowHoliday(false)}>
                {t('cancel')}
              </GhostButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
