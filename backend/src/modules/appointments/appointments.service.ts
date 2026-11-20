import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { findActiveSubscription } from '../subscriptions/subscriptions.service';
import { notify, queueMessage } from '../messaging/messaging.service';

/**
 * M4 — appointments and subscriber priority.
 *
 * The workshop has one adjustable daily capacity; slots are offered within
 * working hours, and a share of each day is held for subscribers until the
 * day itself so they always find room.
 */

/** Statuses that still occupy a slot. */
const ACTIVE_STATUSES = ['BOOKED', 'CONFIRMED', 'ARRIVED'] as const;

export interface Slot {
  time: string;
  at: Date;
  booked: number;
  capacity: number;
  available: boolean;
  /** Only a subscriber may take this slot today — it is part of the held share. */
  subscribersOnly: boolean;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Start of the given day, in the server's own timezone. */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * YYYY-MM-DD in the workshop's own timezone.
 *
 * toISOString() would convert to UTC first, which in Saudi Arabia (UTC+3)
 * reports local midnight as the previous day — the calendar, the holiday
 * lookup and the dates we send customers would all be a day out.
 */
export function dateKeyOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export async function ensureWorkingDays() {
  const count = await prisma.workingDay.count();
  if (count >= 7) return;

  // Saudi working week: Friday (5) and Saturday (6) closed by default.
  for (let weekday = 0; weekday < 7; weekday++) {
    await prisma.workingDay.upsert({
      where: { weekday },
      update: {},
      create: { weekday, isOpen: weekday !== 5 && weekday !== 6 },
    });
  }
}

export interface DayPlan {
  date: string;
  isOpen: boolean;
  reason?: string;
  capacity: number;
  reservedForSubscribers: number;
  booked: number;
  slots: Slot[];
}

/**
 * What the workshop can take on one day: its hours, its capacity, what is
 * already booked, and which slots are still open.
 */
export async function getDayPlan(date: Date, forSubscriber = false): Promise<DayPlan> {
  const day = startOfDay(date);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);

  const dateKey = dateKeyOf(day);

  const [rule, holiday, appointments] = await Promise.all([
    prisma.workingDay.findUnique({ where: { weekday: day.getDay() } }),
    prisma.holiday.findFirst({
      where: { date: new Date(`${dateKey}T00:00:00.000Z`), deletedAt: null },
    }),
    prisma.appointment.findMany({
      where: {
        deletedAt: null,
        status: { in: ACTIVE_STATUSES as unknown as any[] },
        scheduledAt: { gte: day, lt: next },
      },
      select: { scheduledAt: true, isSubscriber: true },
    }),
  ]);

  if (!rule || !rule.isOpen) {
    return {
      date: dateKey,
      isOpen: false,
      reason: 'WEEKLY_OFF',
      capacity: 0,
      reservedForSubscribers: 0,
      booked: appointments.length,
      slots: [],
    };
  }

  if (holiday?.isClosed) {
    return {
      date: dateKey,
      isOpen: false,
      reason: 'HOLIDAY',
      capacity: 0,
      reservedForSubscribers: 0,
      booked: appointments.length,
      slots: [],
    };
  }

  const capacity = holiday?.capacity ?? rule.dailyCapacity;
  const reserved = Math.min(rule.reservedForSubscribers, capacity);

  // The held share is released on the day itself, so it never goes to waste.
  const isToday = dateKey === dateKeyOf(new Date());
  const effectiveReserved = isToday ? 0 : reserved;

  const openMin = toMinutes(rule.openTime);
  const closeMin = toMinutes(rule.closeTime);
  const step = Math.max(15, rule.slotMinutes);

  const bookedAt = new Map<string, number>();
  for (const appt of appointments) {
    const key = `${pad(appt.scheduledAt.getHours())}:${pad(appt.scheduledAt.getMinutes())}`;
    bookedAt.set(key, (bookedAt.get(key) || 0) + 1);
  }

  const slotCount = Math.max(1, Math.floor((closeMin - openMin) / step));
  // Capacity is spread evenly across the day's slots, at least one each.
  const perSlot = Math.max(1, Math.ceil(capacity / slotCount));

  const slots: Slot[] = [];
  for (let minute = openMin; minute + step <= closeMin; minute += step) {
    const time = `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
    const at = new Date(day);
    at.setHours(Math.floor(minute / 60), minute % 60, 0, 0);

    const booked = bookedAt.get(time) || 0;
    slots.push({
      time,
      at,
      booked,
      capacity: perSlot,
      available: booked < perSlot,
      subscribersOnly: false,
    });
  }

  // Mark the last free slots of the day as held, so reception can see which
  // ones a walk-in may not take.
  const totalBooked = appointments.length;
  const remaining = capacity - totalBooked;
  if (!forSubscriber && effectiveReserved > 0 && remaining <= effectiveReserved) {
    slots.forEach(s => {
      if (s.available) {
        s.subscribersOnly = true;
        s.available = false;
      }
    });
  }

  return {
    date: dateKey,
    isOpen: true,
    capacity,
    reservedForSubscribers: effectiveReserved,
    booked: totalBooked,
    slots,
  };
}

/** Builds the next appointment reference in the form APT-YYYYMMDD-XXXX. */
export async function generateReference(): Promise<string> {
  const todayStr = dateKeyOf(new Date()).replace(/-/g, '');
  const start = startOfDay(new Date());

  const count = await prisma.appointment.count({ where: { createdAt: { gte: start } } });
  return `APT-${todayStr}-${String(count + 1).padStart(4, '0')}`;
}

export interface BookInput {
  customerId: string;
  vehicleId?: string | null;
  scheduledAt: Date;
  complaint?: string | null;
  notes?: string | null;
  source?: 'RECEPTION' | 'CUSTOMER_PORTAL';
  createdById?: string | null;
}

/**
 * Books a slot, refusing anything the day cannot take. Subscribers may use the
 * held share; everyone else is turned away once the open slots are gone.
 */
export async function bookAppointment(input: BookInput) {
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, deletedAt: null },
  });
  if (!customer) throw new AppError('العميل غير موجود', 404);

  if (input.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: input.vehicleId, deletedAt: null, customerId: input.customerId },
    });
    if (!vehicle) throw new AppError('السيارة غير موجودة أو لا تخص هذا العميل', 404);
  }

  if (input.scheduledAt.getTime() < Date.now() - 60_000) {
    throw new AppError('لا يمكن الحجز في وقت مضى', 400);
  }

  const subscription = await findActiveSubscription(input.customerId, input.vehicleId || null);
  const isSubscriber = !!subscription;

  const plan = await getDayPlan(input.scheduledAt, isSubscriber);
  if (!plan.isOpen) {
    throw new AppError(
      plan.reason === 'HOLIDAY' ? 'الورشة مغلقة في هذا اليوم (إجازة)' : 'الورشة مغلقة في هذا اليوم',
      400,
    );
  }

  const time = `${pad(input.scheduledAt.getHours())}:${pad(input.scheduledAt.getMinutes())}`;
  const slot = plan.slots.find(s => s.time === time);
  if (!slot) throw new AppError('الوقت المطلوب خارج ساعات العمل', 400);

  if (plan.booked >= plan.capacity) {
    throw new AppError('اكتملت الطاقة الاستيعابية لهذا اليوم', 409);
  }

  if (!slot.available) {
    throw new AppError(
      slot.subscribersOnly
        ? 'الفتحات المتبقية في هذا اليوم محجوزة للمشتركين'
        : 'هذا الوقت محجوز بالكامل — اختر وقتًا آخر',
      409,
    );
  }

  // One live appointment per customer per day keeps the calendar honest.
  const day = startOfDay(input.scheduledAt);
  const nextDay = new Date(day);
  nextDay.setDate(nextDay.getDate() + 1);

  const clash = await prisma.appointment.findFirst({
    where: {
      customerId: input.customerId,
      deletedAt: null,
      status: { in: ACTIVE_STATUSES as unknown as any[] },
      scheduledAt: { gte: day, lt: nextDay },
    },
  });
  if (clash) {
    throw new AppError(`للعميل موعد قائم في نفس اليوم برقم ${clash.reference}`, 409);
  }

  const reference = await generateReference();

  const appointment = await prisma.appointment.create({
    data: {
      reference,
      customerId: input.customerId,
      vehicleId: input.vehicleId || null,
      branchId: customer.branchId,
      scheduledAt: input.scheduledAt,
      durationMin: 60,
      isSubscriber,
      complaint: input.complaint || null,
      notes: input.notes || null,
      source: input.source || 'RECEPTION',
      createdById: input.createdById || null,
    },
    include: {
      customer: { select: { fullName: true, mobileNumber: true } },
      vehicle: { select: { brand: true, model: true, plateNumber: true } },
    },
  });

  // Immediate confirmation to the customer, plus a note on the floor.
  try {
    await queueMessage({
      templateCode: 'APPOINTMENT_CONFIRMED',
      customerId: input.customerId,
      createdById: input.createdById || null,
      values: {
        customerName: appointment.customer.fullName,
        date: dateKeyOf(input.scheduledAt),
        time,
        reference,
      },
    });

    await notify({
      role: 'RECEPTION',
      type: 'SYSTEM',
      titleAr: `موعد جديد ${reference} — ${appointment.customer.fullName}`,
      titleEn: `New appointment ${reference} — ${appointment.customer.fullName}`,
      bodyAr: `${dateKeyOf(input.scheduledAt)} ${time}`,
      bodyEn: `${dateKeyOf(input.scheduledAt)} ${time}`,
      linkType: 'APPOINTMENT',
      linkId: appointment.id,
    });
  } catch {
    // Confirmation is a side effect; the booking itself already succeeded.
  }

  return appointment;
}

/**
 * Queues the 24-hour reminders that are due, once per appointment.
 * Called by the messaging worker alongside the other scheduled alerts.
 */
export async function sendDueReminders(): Promise<number> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const due = await prisma.appointment.findMany({
    where: {
      deletedAt: null,
      status: { in: ['BOOKED', 'CONFIRMED'] },
      reminderSentAt: null,
      scheduledAt: { gte: now, lte: in24h },
    },
    include: { customer: { select: { fullName: true } } },
    take: 50,
  });

  let queued = 0;

  for (const appt of due) {
    const time = `${pad(appt.scheduledAt.getHours())}:${pad(appt.scheduledAt.getMinutes())}`;

    const result = await queueMessage({
      templateCode: 'APPOINTMENT_REMINDER',
      customerId: appt.customerId,
      values: {
        customerName: appt.customer.fullName,
        date: dateKeyOf(appt.scheduledAt),
        time,
        reference: appt.reference,
      },
    });

    // Marked either way: a customer who opted out should not be retried daily.
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { reminderSentAt: new Date() },
    });

    if (result.queued) queued++;
  }

  return queued;
}

/** Occupancy and punctuality over a date range. */
export async function occupancyReport(from: Date, to: Date) {
  const appointments = await prisma.appointment.findMany({
    where: { deletedAt: null, scheduledAt: { gte: startOfDay(from), lte: to } },
    select: { status: true, scheduledAt: true, isSubscriber: true },
  });

  const byStatus: Record<string, number> = {};
  for (const appt of appointments) {
    byStatus[appt.status] = (byStatus[appt.status] || 0) + 1;
  }

  // Capacity across the range, counting only the days the workshop opens.
  let totalCapacity = 0;
  const cursor = startOfDay(from);
  while (cursor <= to) {
    const plan = await getDayPlan(new Date(cursor), true);
    totalCapacity += plan.capacity;
    cursor.setDate(cursor.getDate() + 1);
  }

  const kept = (byStatus.CONVERTED || 0) + (byStatus.ARRIVED || 0);
  const missed = (byStatus.NO_SHOW || 0) + (byStatus.CANCELLED || 0);
  const settled = kept + missed;

  return {
    total: appointments.length,
    subscribers: appointments.filter(a => a.isSubscriber).length,
    byStatus,
    totalCapacity,
    occupancyRate: totalCapacity > 0 ? Math.round((appointments.length / totalCapacity) * 100) : 0,
    punctualityRate: settled > 0 ? Math.round((kept / settled) * 100) : null,
  };
}
