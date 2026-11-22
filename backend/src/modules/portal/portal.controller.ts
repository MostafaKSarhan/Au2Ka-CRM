import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { z } from 'zod';
import { issueOtp, revokeSession, verifyOtp } from './portal.auth';
import { queueMessage } from '../messaging/messaging.service';
import * as whatsapp from '../whatsapp/whatsapp.service';
import { buildVehicleFile } from '../vehicleFile/vehicleFile.service';
import { bookAppointment, getDayPlan } from '../appointments/appointments.service';
import { ensureReferralCode, pointsToRiyals } from '../referrals/referrals.service';

const requestOtpSchema = z.object({
  mobileNumber: z.string().trim().min(6, 'رقم الجوال مطلوب'),
});

const verifyOtpSchema = z.object({
  mobileNumber: z.string().trim().min(6, 'رقم الجوال مطلوب'),
  code: z.string().trim().length(6, 'الرمز مكوّن من ٦ أرقام'),
});

const bookSchema = z.object({
  vehicleId: z.string().uuid().optional().nullable(),
  scheduledAt: z.coerce.date(),
  complaint: z.string().trim().max(500).optional().nullable(),
});

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(result.error.errors.map(e => e.message).join(', '), 400);
  }
  return result.data;
}

/** Only this customer's own records are ever reachable from the portal. */
function customerId(request: FastifyRequest): string {
  if (!request.portalCustomerId) throw new AppError('يلزم تسجيل الدخول', 401);
  return request.portalCustomerId;
}

export class PortalController {
  // ---------- Sign in ----------
  static async requestOtp(request: FastifyRequest, reply: FastifyReply) {
    const { mobileNumber } = parse(requestOtpSchema, request.body);
    const otp = await issueOtp(mobileNumber);

    // The code goes out through the messaging queue, so it is logged like any
    // other message. Automatic WhatsApp delivery arrives with M8; until then
    // the queue hands reception a ready-to-send message.
    await queueMessage({
      channel: 'WHATSAPP',
      customerId: otp.customerId,
      body: `رمز الدخول إلى بوابة عملاء Au2Ka هو: ${otp.code}\nصالح لمدة ١٠ دقائق. لا تشاركه مع أحد.`,
      values: {},
    });

    // In development the code is logged so the portal can be tried locally
    // without a WhatsApp connection. It is never returned in the response.
    if (process.env.NODE_ENV === 'development') {
      request.log.info({ mobileNumber, code: otp.code }, 'portal OTP issued (development only)');
    }

    // لا يُقال للعميل «أُرسل إلى جوالك» إلا إذا كان هناك ما يرسله فعلًا.
    // قبل ربط واتساب الرسمي يبقى الرمز في الطابور ولا يصل أحدًا، فكان
    // العميل ينتظر رسالة لن تأتي ويظن النظام معطّلًا.
    const canDeliver = await whatsapp.isEnabled();

    return reply.send({
      message: canDeliver
        ? 'تم إرسال رمز التحقق إلى جوالك'
        : 'الرمز جاهز لدى الورشة — اطلبه من الاستقبال',
      deliveredToPhone: canDeliver,
      expiresAt: otp.expiresAt,
    });
  }

  static async verifyOtp(request: FastifyRequest, reply: FastifyReply) {
    const { mobileNumber, code } = parse(verifyOtpSchema, request.body);

    const session = await verifyOtp(mobileNumber, code, request.headers['user-agent']);

    return reply.send({
      message: 'تم تسجيل الدخول',
      token: session.token,
      expiresAt: session.expiresAt,
      customer: { id: session.customer.id, fullName: session.customer.fullName },
    });
  }

  static async logout(request: FastifyRequest, reply: FastifyReply) {
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      await revokeSession(header.slice(7).trim());
    }
    return reply.send({ message: 'تم تسجيل الخروج' });
  }

  // ---------- The customer's own view ----------
  static async me(request: FastifyRequest, reply: FastifyReply) {
    const id = customerId(request);

    const customer = await prisma.customer.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        mobileNumber: true,
        tier: true,
        pointsBalance: true,
        vehicles: {
          where: { deletedAt: null },
          select: { id: true, brand: true, model: true, plateNumber: true, mileage: true },
        },
      },
    });
    if (!customer) throw new AppError('الحساب غير متاح', 404);

    const [subscription, referralCode, openCards, nextAppointment] = await Promise.all([
      prisma.subscription.findFirst({
        where: {
          customerId: id,
          deletedAt: null,
          status: 'ACTIVE',
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
        include: { plan: { select: { nameAr: true, nameEn: true } } },
        orderBy: { endDate: 'desc' },
      }),
      ensureReferralCode(id),
      prisma.jobCard.count({
        where: { customerId: id, deletedAt: null, status: { notIn: ['DELIVERED'] } },
      }),
      prisma.appointment.findFirst({
        where: {
          customerId: id,
          deletedAt: null,
          status: { in: ['BOOKED', 'CONFIRMED'] },
          scheduledAt: { gte: new Date() },
        },
        orderBy: { scheduledAt: 'asc' },
        select: { id: true, reference: true, scheduledAt: true, status: true },
      }),
    ]);

    return reply.send({
      customer,
      pointsValue: await pointsToRiyals(customer.pointsBalance),
      referralCode,
      subscription: subscription
        ? {
            subscriptionNumber: subscription.subscriptionNumber,
            plan: subscription.plan,
            endDate: subscription.endDate,
            freeVisitsRemaining: Math.max(
              0,
              subscription.freeVisitsTotal - subscription.freeVisitsUsed,
            ),
            freeVisitsTotal: subscription.freeVisitsTotal,
            discountPercent: subscription.discountPercent,
          }
        : null,
      openCards,
      nextAppointment,
    });
  }

  /** Where each of the customer's vehicles stands in the workshop right now. */
  static async jobCards(request: FastifyRequest, reply: FastifyReply) {
    const id = customerId(request);

    const jobCards = await prisma.jobCard.findMany({
      where: { customerId: id, deletedAt: null },
      select: {
        id: true,
        jobNumber: true,
        status: true,
        approvalStatus: true,
        entryDate: true,
        customerComplaint: true,
        requiredRepairs: true,
        estimatedCost: true,
        isFreeVisit: true,
        subscriptionDiscount: true,
        vehicle: { select: { brand: true, model: true, plateNumber: true } },
      },
      orderBy: { entryDate: 'desc' },
      take: 50,
    });

    return reply.send({ jobCards });
  }

  static async vehicleFile(request: FastifyRequest, reply: FastifyReply) {
    const id = customerId(request);
    const { vehicleId } = request.params as { vehicleId: string };

    // The vehicle must belong to the signed-in customer.
    const owned = await prisma.vehicle.findFirst({
      where: { id: vehicleId, customerId: id, deletedAt: null },
      select: { id: true },
    });
    if (!owned) throw new AppError('السيارة غير موجودة', 404);

    const file = await buildVehicleFile(vehicleId);
    return reply.send(file);
  }

  static async reports(request: FastifyRequest, reply: FastifyReply) {
    const id = customerId(request);

    const reports = await prisma.monthlyReport.findMany({
      where: { customerId: id, deletedAt: null },
      include: { vehicle: { select: { brand: true, model: true, plateNumber: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 24,
    });

    return reply.send({ reports });
  }

  static async report(request: FastifyRequest, reply: FastifyReply) {
    const id = customerId(request);
    const { reportId } = request.params as { reportId: string };

    const report = await prisma.monthlyReport.findFirst({
      where: { id: reportId, customerId: id, deletedAt: null },
      include: { vehicle: { select: { brand: true, model: true, plateNumber: true } } },
    });
    if (!report) throw new AppError('التقرير غير موجود', 404);

    let findings: any[] = [];
    if (report.findings) {
      try {
        findings = JSON.parse(report.findings);
      } catch {
        findings = [];
      }
    }

    return reply.send({ report: { ...report, findings } });
  }

  // ---------- Booking ----------
  static async availability(request: FastifyRequest, reply: FastifyReply) {
    const id = customerId(request);
    const { date } = request.query as { date?: string };

    const target = date ? new Date(`${date}T00:00:00`) : new Date();
    if (Number.isNaN(target.getTime())) throw new AppError('التاريخ غير صحيح', 400);

    // A subscriber sees the slots held for subscribers as available.
    const subscribed = await prisma.subscription.count({
      where: {
        customerId: id,
        deletedAt: null,
        status: 'ACTIVE',
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    });

    const plan = await getDayPlan(target, subscribed > 0);

    // The customer sees only whether a slot is free, never who booked it.
    return reply.send({
      date: plan.date,
      isOpen: plan.isOpen,
      reason: plan.reason,
      isSubscriber: subscribed > 0,
      slots: plan.slots.map(s => ({ time: s.time, available: s.available })),
    });
  }

  static async appointments(request: FastifyRequest, reply: FastifyReply) {
    const id = customerId(request);

    const appointments = await prisma.appointment.findMany({
      where: { customerId: id, deletedAt: null },
      select: {
        id: true,
        reference: true,
        scheduledAt: true,
        status: true,
        complaint: true,
        vehicle: { select: { brand: true, model: true, plateNumber: true } },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 30,
    });

    return reply.send({ appointments });
  }

  static async book(request: FastifyRequest, reply: FastifyReply) {
    const id = customerId(request);
    const data = parse(bookSchema, request.body);

    const appointment = await bookAppointment({
      customerId: id,
      vehicleId: data.vehicleId || null,
      scheduledAt: data.scheduledAt,
      complaint: data.complaint || null,
      source: 'CUSTOMER_PORTAL',
    });

    return reply.status(201).send({
      message: 'تم تأكيد حجزك',
      appointment: {
        id: appointment.id,
        reference: appointment.reference,
        scheduledAt: appointment.scheduledAt,
        status: appointment.status,
      },
    });
  }

  static async cancelAppointment(request: FastifyRequest, reply: FastifyReply) {
    const id = customerId(request);
    const { appointmentId } = request.params as { appointmentId: string };

    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, customerId: id, deletedAt: null },
    });
    if (!appointment) throw new AppError('الموعد غير موجود', 404);
    if (!['BOOKED', 'CONFIRMED'].includes(appointment.status)) {
      throw new AppError('لا يمكن إلغاء هذا الموعد — تواصل مع الورشة', 400);
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELLED' },
    });

    return reply.send({ message: 'تم إلغاء الموعد' });
  }
}
