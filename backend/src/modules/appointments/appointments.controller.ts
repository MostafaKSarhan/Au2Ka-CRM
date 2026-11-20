import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { z } from 'zod';
import {
  bookAppointment,
  ensureWorkingDays,
  getDayPlan,
  occupancyReport,
  sendDueReminders,
  dateKeyOf,
} from './appointments.service';
import { notify } from '../messaging/messaging.service';
import { applyJobCardOpening } from '../jobCards/jobCard.open';

const bookSchema = z.object({
  customerId: z.string().uuid('العميل مطلوب'),
  vehicleId: z.string().uuid().optional().nullable(),
  scheduledAt: z.coerce.date(),
  complaint: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

const rescheduleSchema = z.object({
  scheduledAt: z.coerce.date(),
  notes: z.string().trim().optional().nullable(),
});

const workingDaySchema = z.object({
  isOpen: z.boolean().optional(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, 'صيغة الوقت يجب أن تكون HH:MM').optional(),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, 'صيغة الوقت يجب أن تكون HH:MM').optional(),
  slotMinutes: z.coerce.number().int().min(15).max(240).optional(),
  dailyCapacity: z.coerce.number().int().min(0).max(200).optional(),
  reservedForSubscribers: z.coerce.number().int().min(0).max(50).optional(),
});

const holidaySchema = z.object({
  date: z.coerce.date(),
  nameAr: z.string().trim().min(2, 'اسم الإجازة بالعربية مطلوب'),
  nameEn: z.string().trim().min(2, 'اسم الإجازة بالإنجليزية مطلوب'),
  isClosed: z.boolean().default(true),
  capacity: z.coerce.number().int().min(0).optional().nullable(),
});

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(result.error.errors.map(e => e.message).join(', '), 400);
  }
  return result.data;
}

const appointmentInclude = {
  customer: { select: { id: true, fullName: true, mobileNumber: true } },
  vehicle: { select: { id: true, brand: true, model: true, plateNumber: true } },
  jobCard: { select: { id: true, jobNumber: true } },
};

/** Transitions the calendar allows, so a status cannot jump backwards. */
const ALLOWED: Record<string, string[]> = {
  BOOKED: ['CONFIRMED', 'ARRIVED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['ARRIVED', 'CANCELLED', 'NO_SHOW'],
  ARRIVED: ['CONVERTED', 'CANCELLED'],
  CONVERTED: [],
  CANCELLED: ['BOOKED'],
  NO_SHOW: ['BOOKED'],
};

export class AppointmentsController {
  // ---------- Working hours ----------
  static async listWorkingDays(request: FastifyRequest, reply: FastifyReply) {
    await ensureWorkingDays();
    const days = await prisma.workingDay.findMany({ orderBy: { weekday: 'asc' } });
    return reply.send({ days });
  }

  static async updateWorkingDay(request: FastifyRequest, reply: FastifyReply) {
    const { weekday } = request.params as { weekday: string };
    const data = parse(workingDaySchema, request.body);

    const value = parseInt(weekday, 10);
    if (Number.isNaN(value) || value < 0 || value > 6) throw new AppError('اليوم غير صحيح', 400);

    const existing = await prisma.workingDay.findUnique({ where: { weekday: value } });
    if (!existing) throw new AppError('اليوم غير معرَّف', 404);

    const openTime = data.openTime ?? existing.openTime;
    const closeTime = data.closeTime ?? existing.closeTime;
    if (closeTime <= openTime) {
      throw new AppError('وقت الإغلاق يجب أن يكون بعد وقت الفتح', 400);
    }

    const day = await prisma.workingDay.update({ where: { weekday: value }, data });
    return reply.send({ message: 'تم تحديث ساعات العمل', day });
  }

  // ---------- Holidays ----------
  static async listHolidays(request: FastifyRequest, reply: FastifyReply) {
    const holidays = await prisma.holiday.findMany({
      where: { deletedAt: null },
      orderBy: { date: 'asc' },
    });
    return reply.send({ holidays });
  }

  static async createHoliday(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(holidaySchema, request.body);
    const dateKey = new Date(`${dateKeyOf(data.date)}T00:00:00.000Z`);

    const clash = await prisma.holiday.findFirst({ where: { date: dateKey, deletedAt: null } });
    if (clash) throw new AppError('هذا اليوم مسجّل كإجازة بالفعل', 409);

    const holiday = await prisma.holiday.create({ data: { ...data, date: dateKey } });
    return reply.status(201).send({ message: 'تم إضافة الإجازة', holiday });
  }

  static async removeHoliday(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const existing = await prisma.holiday.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('الإجازة غير موجودة', 404);

    await prisma.holiday.update({ where: { id }, data: { deletedAt: new Date() } });
    return reply.send({ message: 'تم حذف الإجازة' });
  }

  // ---------- Availability ----------
  static async availability(request: FastifyRequest, reply: FastifyReply) {
    const { date, customerId } = request.query as { date?: string; customerId?: string };
    await ensureWorkingDays();

    const target = date ? new Date(`${date}T00:00:00`) : new Date();
    if (Number.isNaN(target.getTime())) throw new AppError('التاريخ غير صحيح', 400);

    // Subscribers see the slots held for them as available.
    let forSubscriber = false;
    if (customerId) {
      const active = await prisma.subscription.count({
        where: {
          customerId,
          deletedAt: null,
          status: 'ACTIVE',
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
      });
      forSubscriber = active > 0;
    }

    const plan = await getDayPlan(target, forSubscriber);
    return reply.send({ ...plan, forSubscriber });
  }

  /** The week's calendar: capacity and load for each of seven days. */
  static async week(request: FastifyRequest, reply: FastifyReply) {
    const { from } = request.query as { from?: string };
    await ensureWorkingDays();

    const start = from ? new Date(`${from}T00:00:00`) : new Date();
    if (Number.isNaN(start.getTime())) throw new AppError('التاريخ غير صحيح', 400);
    start.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const plan = await getDayPlan(date, true);
      days.push({
        date: plan.date,
        weekday: date.getDay(),
        isOpen: plan.isOpen,
        reason: plan.reason,
        capacity: plan.capacity,
        booked: plan.booked,
      });
    }

    return reply.send({ days });
  }

  // ---------- Appointments ----------
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { date, from, to, status, search, page = '1', limit = '50' } =
      request.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const take = Math.min(200, Math.max(1, parseInt(limit || '50', 10) || 50));
    const skip = (pageNum - 1) * take;

    const where: any = { deletedAt: null };
    if (status) where.status = status;

    if (date) {
      const day = new Date(`${date}T00:00:00`);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      where.scheduledAt = { gte: day, lt: next };
    } else if (from || to) {
      where.scheduledAt = {};
      if (from) where.scheduledAt.gte = new Date(`${from}T00:00:00`);
      if (to) where.scheduledAt.lte = new Date(`${to}T23:59:59`);
    }

    if (search) {
      where.OR = [
        { reference: { contains: search } },
        { customer: { fullName: { contains: search } } },
        { customer: { mobileNumber: { contains: search } } },
        { vehicle: { plateNumber: { contains: search } } },
      ];
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: appointmentInclude,
        orderBy: { scheduledAt: 'asc' },
        skip,
        take,
      }),
      prisma.appointment.count({ where }),
    ]);

    return reply.send({
      appointments,
      pagination: { page: pageNum, limit: take, total, pages: Math.ceil(total / take) },
    });
  }

  static async book(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(bookSchema, request.body);

    const appointment = await bookAppointment({
      ...data,
      source: 'RECEPTION',
      createdById: request.user?.id || null,
    });

    return reply.status(201).send({ message: 'تم حجز الموعد بنجاح', appointment });
  }

  static async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status?: string };

    if (!status) throw new AppError('الحالة مطلوبة', 400);

    const existing = await prisma.appointment.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('الموعد غير موجود', 404);

    const allowed = ALLOWED[existing.status] || [];
    if (!allowed.includes(status)) {
      throw new AppError(`لا يمكن الانتقال من ${existing.status} إلى ${status}`, 400);
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status: status as any },
      include: appointmentInclude,
    });

    return reply.send({ message: 'تم تحديث حالة الموعد', appointment });
  }

  static async reschedule(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = parse(rescheduleSchema, request.body);

    const existing = await prisma.appointment.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('الموعد غير موجود', 404);
    if (existing.status === 'CONVERTED') {
      throw new AppError('الموعد تحوّل إلى كرت عمل ولا يمكن تأجيله', 400);
    }

    const plan = await getDayPlan(data.scheduledAt, existing.isSubscriber);
    if (!plan.isOpen) throw new AppError('الورشة مغلقة في اليوم الجديد', 400);

    const time = `${String(data.scheduledAt.getHours()).padStart(2, '0')}:${String(
      data.scheduledAt.getMinutes(),
    ).padStart(2, '0')}`;
    const slot = plan.slots.find(s => s.time === time);
    if (!slot) throw new AppError('الوقت الجديد خارج ساعات العمل', 400);
    if (!slot.available && !(existing.isSubscriber && slot.subscribersOnly)) {
      throw new AppError('الوقت الجديد محجوز بالكامل', 409);
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        scheduledAt: data.scheduledAt,
        notes: data.notes ?? existing.notes,
        status: 'BOOKED',
        // A moved appointment earns a fresh reminder.
        reminderSentAt: null,
      },
      include: appointmentInclude,
    });

    return reply.send({ message: 'تم تأجيل الموعد', appointment });
  }

  /** Turns the appointment into a job card in one step. */
  static async convert(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const appointment = await prisma.appointment.findFirst({
      where: { id, deletedAt: null },
      include: { customer: true, vehicle: true },
    });
    if (!appointment) throw new AppError('الموعد غير موجود', 404);
    if (appointment.jobCardId) throw new AppError('الموعد محوّل بالفعل إلى كرت عمل', 400);
    if (appointment.status === 'CANCELLED') throw new AppError('الموعد ملغي', 400);
    if (!appointment.vehicleId) {
      throw new AppError('حدّد سيارة العميل أولًا حتى يمكن فتح كرت عمل', 400);
    }

    const todayStr = dateKeyOf(new Date()).replace(/-/g, '');
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const countToday = await prisma.jobCard.count({ where: { createdAt: { gte: startOfToday } } });
    const jobNumber = `WRK-${todayStr}-${String(countToday + 1).padStart(4, '0')}`;

    const jobCard = await prisma.jobCard.create({
      data: {
        jobNumber,
        customerId: appointment.customerId,
        vehicleId: appointment.vehicleId,
        branchId: appointment.branchId,
        customerComplaint: appointment.complaint || 'موعد مجدول',
        notes: `محوّل من الموعد ${appointment.reference}`,
      },
      include: { customer: true, vehicle: true },
    });

    await prisma.appointment.update({
      where: { id },
      data: { status: 'CONVERTED', jobCardId: jobCard.id },
    });

    // A card opened from an appointment earns the customer exactly what a card
    // opened at the desk earns: the subscription covers the visit, and a
    // pending referral pays both sides.
    const { coverageNote, referralNote } = await applyJobCardOpening({
      jobCardId: jobCard.id,
      customerId: appointment.customerId,
      vehicleId: appointment.vehicleId,
      onError: (err, what) => request.log.error({ err }, what),
    });

    if (request.user) {
      await prisma.jobCardActivity.create({
        data: {
          jobCardId: jobCard.id,
          userId: request.user.id,
          action: `تم فتح الكرت ${jobNumber} من الموعد ${appointment.reference}${coverageNote}${referralNote}`,
        },
      });
    }

    return reply.status(201).send({ message: 'تم تحويل الموعد إلى كرت عمل', jobCard });
  }

  static async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const existing = await prisma.appointment.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('الموعد غير موجود', 404);

    await prisma.appointment.update({ where: { id }, data: { deletedAt: new Date() } });
    return reply.send({ message: 'تم حذف الموعد' });
  }

  // ---------- Reports & reminders ----------
  static async report(request: FastifyRequest, reply: FastifyReply) {
    const { from, to } = request.query as { from?: string; to?: string };

    const end = to ? new Date(`${to}T23:59:59`) : new Date();
    const start = from ? new Date(`${from}T00:00:00`) : new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new AppError('التاريخ غير صحيح', 400);
    }
    if (start > end) throw new AppError('تاريخ البداية بعد تاريخ النهاية', 400);

    const summary = await occupancyReport(start, end);
    return reply.send({
      from: dateKeyOf(start),
      to: dateKeyOf(end),
      ...summary,
    });
  }

  static async runReminders(request: FastifyRequest, reply: FastifyReply) {
    const queued = await sendDueReminders();

    await notify({
      role: 'RECEPTION',
      type: 'SYSTEM',
      titleAr: `تم تجهيز ${queued} تذكير موعد`,
      titleEn: `${queued} appointment reminders queued`,
      dedupeKey: `reminders:${new Date().toISOString().slice(0, 13)}`,
    });

    return reply.send({ message: 'تم تجهيز التذكيرات', queued });
  }
}
