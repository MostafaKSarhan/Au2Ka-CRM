import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { z } from 'zod';
import {
  addMonths,
  daysRemaining,
  expireOverdueSubscriptions,
  findActiveSubscription,
  generateSubscriptionNumber,
} from './subscriptions.service';

const createSchema = z.object({
  customerId: z.string().uuid('العميل مطلوب'),
  vehicleId: z.string().uuid('السيارة غير صحيحة').optional().nullable(),
  planId: z.string().uuid('الباقة مطلوبة'),
  startDate: z.coerce.date().optional(),
  paidAmount: z.coerce.number().min(0, 'المبلغ لا يمكن أن يكون سالبًا').optional(),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'CARD', 'OTHER']).optional().nullable(),
  paymentNote: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
});

const updateSchema = z.object({
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED']).optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'CARD', 'OTHER']).optional().nullable(),
  paymentNote: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  endDate: z.coerce.date().optional(),
});

const renewSchema = z.object({
  planId: z.string().uuid('الباقة مطلوبة').optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'CARD', 'OTHER']).optional().nullable(),
  paymentNote: z.string().trim().optional().nullable(),
});

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(result.error.errors.map(e => e.message).join(', '), 400);
  }
  return result.data;
}

const subscriptionInclude = {
  customer: { select: { id: true, fullName: true, mobileNumber: true } },
  vehicle: { select: { id: true, brand: true, model: true, plateNumber: true } },
  plan: { select: { id: true, nameAr: true, nameEn: true, price: true, durationMonths: true } },
  branch: { select: { id: true, nameAr: true, nameEn: true } },
  _count: { select: { usages: true, jobCards: true } },
};

/** Adds the derived fields the screens need, so the UI does no date maths. */
function decorate(sub: any) {
  return {
    ...sub,
    daysRemaining: daysRemaining(sub.endDate),
    freeVisitsRemaining: Math.max(0, sub.freeVisitsTotal - sub.freeVisitsUsed),
    // An early renewal is ACTIVE but does not start until the previous term ends.
    hasStarted: new Date(sub.startDate) <= new Date(),
  };
}

export class SubscriptionsController {
  static async list(request: FastifyRequest, reply: FastifyReply) {
    await expireOverdueSubscriptions();

    const { status, customerId, vehicleId, search, expiringInDays, page = '1', limit = '20' } =
      request.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    const skip = (pageNum - 1) * take;

    const where: any = { deletedAt: null };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (vehicleId) where.vehicleId = vehicleId;

    if (expiringInDays) {
      const days = parseInt(expiringInDays, 10);
      if (!Number.isNaN(days)) {
        const until = new Date();
        until.setDate(until.getDate() + days);
        where.status = 'ACTIVE';
        where.endDate = { gte: new Date(), lte: until };
      }
    }

    if (search) {
      where.OR = [
        { subscriptionNumber: { contains: search } },
        { customer: { fullName: { contains: search } } },
        { customer: { mobileNumber: { contains: search } } },
        { vehicle: { plateNumber: { contains: search } } },
      ];
    }

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: subscriptionInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.subscription.count({ where }),
    ]);

    return reply.send({
      subscriptions: subscriptions.map(decorate),
      pagination: { page: pageNum, limit: take, total, pages: Math.ceil(total / take) },
    });
  }

  static async getOne(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const subscription = await prisma.subscription.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...subscriptionInclude,
        usages: {
          include: {
            jobCard: { select: { id: true, jobNumber: true, entryDate: true, status: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!subscription) throw new AppError('الاشتراك غير موجود', 404);

    return reply.send({ subscription: decorate(subscription) });
  }

  /** The coverage that applies to a customer right now — used by the job-card screen. */
  static async activeForCustomer(request: FastifyRequest, reply: FastifyReply) {
    const { customerId } = request.params as { customerId: string };
    const { vehicleId } = request.query as { vehicleId?: string };

    await expireOverdueSubscriptions();

    const subscription = await findActiveSubscription(customerId, vehicleId || null);
    if (!subscription) return reply.send({ subscription: null });

    return reply.send({ subscription: decorate(subscription) });
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(createSchema, request.body);

    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, deletedAt: null },
    });
    if (!customer) throw new AppError('العميل غير موجود', 404);

    if (data.vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: data.vehicleId, deletedAt: null, customerId: data.customerId },
      });
      if (!vehicle) throw new AppError('السيارة غير موجودة أو لا تخص هذا العميل', 404);
    }

    const plan = await prisma.plan.findFirst({ where: { id: data.planId, deletedAt: null } });
    if (!plan) throw new AppError('الباقة غير موجودة', 404);
    if (!plan.isActive) throw new AppError('الباقة متوقفة ولا يمكن الاشتراك فيها', 400);

    // One live subscription per customer/vehicle combination keeps the
    // free-visit balance unambiguous.
    const overlapping = await findActiveSubscription(data.customerId, data.vehicleId || null);
    if (overlapping) {
      throw new AppError(
        `يوجد اشتراك ساري بالفعل لهذا العميل برقم ${overlapping.subscriptionNumber} ينتهي في ${overlapping.endDate.toISOString().slice(0, 10)}`,
        409,
      );
    }

    const startDate = data.startDate || new Date();
    const endDate = addMonths(startDate, plan.durationMonths);
    const subscriptionNumber = await generateSubscriptionNumber();

    const subscription = await prisma.subscription.create({
      data: {
        subscriptionNumber,
        customerId: data.customerId,
        vehicleId: data.vehicleId || null,
        planId: plan.id,
        branchId: data.branchId || customer.branchId || null,
        startDate,
        endDate,
        status: 'ACTIVE',
        // Snapshot — later edits to the plan must not change this subscription.
        freeVisitsTotal: plan.freeVisits,
        freeVisitsUsed: 0,
        discountPercent: plan.discountPercent,
        paidAmount: data.paidAmount ?? 0,
        paymentMethod: data.paymentMethod || null,
        paymentNote: data.paymentNote || null,
        notes: data.notes || null,
      },
      include: subscriptionInclude,
    });

    return reply.status(201).send({
      message: 'تم تسجيل الاشتراك بنجاح',
      subscription: decorate(subscription),
    });
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = parse(updateSchema, request.body);

    const existing = await prisma.subscription.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('الاشتراك غير موجود', 404);

    if (data.endDate && data.endDate < existing.startDate) {
      throw new AppError('تاريخ النهاية يجب أن يكون بعد تاريخ البداية', 400);
    }

    const subscription = await prisma.subscription.update({
      where: { id },
      data,
      include: subscriptionInclude,
    });

    return reply.send({
      message: 'تم تحديث الاشتراك بنجاح',
      subscription: decorate(subscription),
    });
  }

  /** Starts a fresh term for the same customer, continuing from the current end date. */
  static async renew(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = parse(renewSchema, request.body);

    const existing = await prisma.subscription.findFirst({
      where: { id, deletedAt: null },
      include: { plan: true },
    });
    if (!existing) throw new AppError('الاشتراك غير موجود', 404);

    const plan = data.planId
      ? await prisma.plan.findFirst({ where: { id: data.planId, deletedAt: null } })
      : existing.plan;
    if (!plan) throw new AppError('الباقة غير موجودة', 404);
    if (!plan.isActive) throw new AppError('الباقة متوقفة ولا يمكن التجديد عليها', 400);

    // A renewal picks up where the old term ends, unless it already lapsed.
    const now = new Date();
    const renewedEarly = existing.endDate > now;
    const startDate = renewedEarly ? existing.endDate : now;
    const endDate = addMonths(startDate, plan.durationMonths);
    const subscriptionNumber = await generateSubscriptionNumber();

    // Renewing early must not cut the current term short: the old subscription
    // keeps covering the customer until its own end date, and
    // expireOverdueSubscriptions closes it the moment the new term begins.
    const [, renewed] = await prisma.$transaction([
      prisma.subscription.update({
        where: { id: existing.id },
        data: {
          status: !renewedEarly && existing.status === 'ACTIVE' ? 'EXPIRED' : existing.status,
        },
      }),
      prisma.subscription.create({
        data: {
          subscriptionNumber,
          customerId: existing.customerId,
          vehicleId: existing.vehicleId,
          planId: plan.id,
          branchId: existing.branchId,
          startDate,
          endDate,
          status: 'ACTIVE',
          freeVisitsTotal: plan.freeVisits,
          freeVisitsUsed: 0,
          discountPercent: plan.discountPercent,
          paidAmount: data.paidAmount ?? 0,
          paymentMethod: data.paymentMethod || null,
          paymentNote: data.paymentNote || null,
          notes: `تجديد للاشتراك رقم ${existing.subscriptionNumber}`,
        },
        include: subscriptionInclude,
      }),
    ]);

    return reply.status(201).send({
      message: 'تم تجديد الاشتراك بنجاح',
      subscription: decorate(renewed),
    });
  }

  static async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const existing = await prisma.subscription.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('الاشتراك غير موجود', 404);

    await prisma.subscription.update({ where: { id }, data: { deletedAt: new Date() } });
    return reply.send({ message: 'تم حذف الاشتراك' });
  }

  /** Subscribers report: counts, revenue, and who is about to lapse. */
  static async stats(request: FastifyRequest, reply: FastifyReply) {
    await expireOverdueSubscriptions();

    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    const [active, expired, cancelled, revenue, expiringSoon, byPlan] = await Promise.all([
      prisma.subscription.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { deletedAt: null, status: 'EXPIRED' } }),
      prisma.subscription.count({ where: { deletedAt: null, status: 'CANCELLED' } }),
      prisma.subscription.aggregate({ where: { deletedAt: null }, _sum: { paidAmount: true } }),
      prisma.subscription.findMany({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          endDate: { gte: now, lte: in30Days },
        },
        include: subscriptionInclude,
        orderBy: { endDate: 'asc' },
        take: 50,
      }),
      prisma.subscription.groupBy({
        by: ['planId'],
        where: { deletedAt: null, status: 'ACTIVE' },
        _count: { _all: true },
      }),
    ]);

    const plans = await prisma.plan.findMany({
      where: { id: { in: byPlan.map(p => p.planId) } },
      select: { id: true, nameAr: true, nameEn: true },
    });

    const freeVisits = await prisma.subscription.aggregate({
      where: { deletedAt: null, status: 'ACTIVE' },
      _sum: { freeVisitsTotal: true, freeVisitsUsed: true },
    });

    return reply.send({
      counts: { active, expired, cancelled, total: active + expired + cancelled },
      revenue: revenue._sum.paidAmount || 0,
      freeVisits: {
        total: freeVisits._sum.freeVisitsTotal || 0,
        used: freeVisits._sum.freeVisitsUsed || 0,
        remaining: (freeVisits._sum.freeVisitsTotal || 0) - (freeVisits._sum.freeVisitsUsed || 0),
      },
      byPlan: byPlan.map(row => ({
        planId: row.planId,
        count: row._count._all,
        plan: plans.find(p => p.id === row.planId) || null,
      })),
      expiringSoon: expiringSoon.map(decorate),
    });
  }
}
