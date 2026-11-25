import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { z } from 'zod';
import {
  addPoints,
  ensureReferralCode,
  getSettings,
  pointsToRiyals,
  refreshTier,
} from './referrals.service';

const settingsSchema = z.object({
  rewardType: z.enum(['POINTS', 'DISCOUNT', 'FREE_SERVICE']).optional(),
  referrerPoints: z.coerce.number().int().min(0).max(100000).optional(),
  referredPoints: z.coerce.number().int().min(0).max(100000).optional(),
  referrerDiscountPercent: z.coerce.number().min(0).max(100).optional(),
  referredDiscountPercent: z.coerce.number().min(0).max(100).optional(),
  freeServiceAr: z.string().trim().optional().nullable(),
  freeServiceEn: z.string().trim().optional().nullable(),
  pointValue: z.coerce.number().min(0).optional(),
  pointsPerRiyal: z.coerce.number().min(0).max(100).optional(),
  tierBasis: z.enum(['SPEND', 'SUBSCRIPTION']).optional(),
  silverThreshold: z.coerce.number().min(0).optional(),
  goldThreshold: z.coerce.number().min(0).optional(),
  platinumThreshold: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

const redeemSchema = z.object({
  points: z.coerce.number().int().min(1, 'عدد النقاط مطلوب'),
  jobCardId: z.string().uuid().optional().nullable(),
  note: z.string().trim().optional().nullable(),
});

const adjustSchema = z.object({
  points: z.coerce.number().int().refine(v => v !== 0, 'لا يمكن أن تكون النقاط صفرًا'),
  reasonAr: z.string().trim().min(2, 'سبب التعديل مطلوب'),
  reasonEn: z.string().trim().min(2, 'سبب التعديل بالإنجليزية مطلوب'),
});

const linkSchema = z.object({
  code: z.string().trim().min(4, 'كود الإحالة مطلوب').toUpperCase(),
  referredId: z.string().uuid('العميل الجديد مطلوب'),
});

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(result.error.errors.map(e => e.message).join(', '), 400);
  }
  return result.data;
}

export class ReferralsController {
  // ---------- The reward rule ----------
  static async getSettings(request: FastifyRequest, reply: FastifyReply) {
    const settings = await getSettings();
    return reply.send({ settings });
  }

  static async updateSettings(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(settingsSchema, request.body);
    const current = await getSettings();

    // السلّم لا يصعد إلا لأعلى: حد كل مستوى فوق الذي قبله، وإلا صار مستوى
    // لا يبلغه أحد أبدًا.
    const silver = data.silverThreshold ?? Number(current.silverThreshold);
    const gold = data.goldThreshold ?? Number(current.goldThreshold);
    const platinum = data.platinumThreshold ?? Number(current.platinumThreshold);

    if (gold <= silver) {
      throw new AppError('حد المستوى الذهبي يجب أن يكون أعلى من الفضي', 400);
    }
    if (platinum <= gold) {
      throw new AppError('حد المستوى البلاتيني يجب أن يكون أعلى من الذهبي', 400);
    }

    const settings = await prisma.referralSettings.update({ where: { id: current.id }, data });
    return reply.send({ message: 'تم حفظ قاعدة المكافأة', settings });
  }

  // ---------- Referral codes & links ----------
  static async getCode(request: FastifyRequest, reply: FastifyReply) {
    const { customerId } = request.params as { customerId: string };
    const code = await ensureReferralCode(customerId);

    const referrals = await prisma.referral.findMany({
      where: { referrerId: customerId, deletedAt: null },
      include: { referred: { select: { id: true, fullName: true, mobileNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({
      code,
      referrals,
      counts: {
        total: referrals.length,
        completed: referrals.filter(r => r.status === 'COMPLETED').length,
        pending: referrals.filter(r => r.status !== 'COMPLETED').length,
      },
    });
  }

  /** Attaches a new customer to the referrer whose code they came with. */
  static async link(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(linkSchema, request.body);

    const referrer = await prisma.customer.findFirst({
      where: { referralCode: data.code, deletedAt: null },
    });
    if (!referrer) throw new AppError('كود الإحالة غير صحيح', 404);

    if (referrer.id === data.referredId) {
      throw new AppError('لا يمكن للعميل إحالة نفسه', 400);
    }

    const referred = await prisma.customer.findFirst({
      where: { id: data.referredId, deletedAt: null },
    });
    if (!referred) throw new AppError('العميل الجديد غير موجود', 404);

    const already = await prisma.referral.findFirst({
      where: { referredId: data.referredId, deletedAt: null },
    });
    if (already) throw new AppError('هذا العميل مرتبط بإحالة بالفعل', 409);

    // A customer who has already visited is not a new referral.
    const visits = await prisma.jobCard.count({
      where: { customerId: data.referredId, deletedAt: null },
    });
    if (visits > 0) {
      throw new AppError('العميل لديه زيارات سابقة — الإحالة للعملاء الجدد فقط', 400);
    }

    const referral = await prisma.referral.create({
      data: {
        code: data.code,
        referrerId: referrer.id,
        referredId: data.referredId,
        status: 'REGISTERED',
        registeredAt: new Date(),
      },
      include: {
        referrer: { select: { id: true, fullName: true } },
        referred: { select: { id: true, fullName: true } },
      },
    });

    return reply.status(201).send({ message: 'تم ربط الإحالة بنجاح', referral });
  }

  static async listReferrals(request: FastifyRequest, reply: FastifyReply) {
    const { status, search, page = '1', limit = '20' } = request.query as Record<
      string,
      string | undefined
    >;

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    const skip = (pageNum - 1) * take;

    const where: any = { deletedAt: null };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { referrer: { fullName: { contains: search } } },
        { referred: { fullName: { contains: search } } },
      ];
    }

    const [referrals, total] = await Promise.all([
      prisma.referral.findMany({
        where,
        include: {
          referrer: { select: { id: true, fullName: true, mobileNumber: true, tier: true } },
          referred: { select: { id: true, fullName: true, mobileNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.referral.count({ where }),
    ]);

    return reply.send({
      referrals,
      pagination: { page: pageNum, limit: take, total, pages: Math.ceil(total / take) },
    });
  }

  // ---------- Points ----------
  static async wallet(request: FastifyRequest, reply: FastifyReply) {
    const { customerId } = request.params as { customerId: string };

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        tier: true,
        pointsBalance: true,
        lifetimeSpend: true,
        referralCode: true,
      },
    });
    if (!customer) throw new AppError('العميل غير موجود', 404);

    const entries = await prisma.pointsEntry.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return reply.send({
      customer,
      valueInRiyals: await pointsToRiyals(customer.pointsBalance),
      entries,
    });
  }

  /** Spends points against an invoice — the balance becomes a discount. */
  static async redeem(request: FastifyRequest, reply: FastifyReply) {
    const { customerId } = request.params as { customerId: string };
    const data = parse(redeemSchema, request.body);

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true, pointsBalance: true },
    });
    if (!customer) throw new AppError('العميل غير موجود', 404);

    if (data.points > customer.pointsBalance) {
      throw new AppError(`الرصيد المتاح ${customer.pointsBalance} نقطة فقط`, 400);
    }

    const value = await pointsToRiyals(data.points);

    const entry = await prisma.$transaction(tx =>
      addPoints(tx, {
        customerId,
        points: -data.points,
        type: 'REDEEMED',
        reasonAr: data.note || `استبدال ${data.points} نقطة بخصم ${value} ريال`,
        reasonEn: data.note || `Redeemed ${data.points} points for ${value} SAR`,
        jobCardId: data.jobCardId || null,
        createdById: request.user?.id || null,
      }),
    );

    return reply.send({
      message: `تم استبدال ${data.points} نقطة بخصم ${value} ريال`,
      discount: value,
      entry,
    });
  }

  /** A manual correction by an admin, always with a stated reason. */
  static async adjust(request: FastifyRequest, reply: FastifyReply) {
    const { customerId } = request.params as { customerId: string };
    const data = parse(adjustSchema, request.body);

    const entry = await prisma.$transaction(tx =>
      addPoints(tx, {
        customerId,
        points: data.points,
        type: 'ADJUSTMENT',
        reasonAr: data.reasonAr,
        reasonEn: data.reasonEn,
        createdById: request.user?.id || null,
      }),
    );

    return reply.send({ message: 'تم تعديل رصيد النقاط', entry });
  }

  // ---------- Tiers & reporting ----------
  static async recalculateTier(request: FastifyRequest, reply: FastifyReply) {
    const { customerId } = request.params as { customerId: string };
    const tier = await refreshTier(customerId);
    return reply.send({ message: 'تم تحديث مستوى العميل', tier });
  }

  /** Who brings the workshop the most customers, and how the tiers are spread. */
  static async report(request: FastifyRequest, reply: FastifyReply) {
    const [byStatus, tiers, topReferrers, pointsAgg] = await Promise.all([
      prisma.referral.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.customer.groupBy({
        by: ['tier'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.referral.groupBy({
        by: ['referrerId'],
        where: { deletedAt: null, status: 'COMPLETED' },
        _count: { _all: true },
        orderBy: { _count: { referrerId: 'desc' } },
        take: 10,
      }),
      prisma.customer.aggregate({
        where: { deletedAt: null },
        _sum: { pointsBalance: true },
      }),
    ]);

    const referrers = await prisma.customer.findMany({
      where: { id: { in: topReferrers.map(r => r.referrerId) } },
      select: { id: true, fullName: true, mobileNumber: true, tier: true, pointsBalance: true },
    });

    const outstandingPoints = pointsAgg._sum.pointsBalance || 0;

    return reply.send({
      byStatus: Object.fromEntries(byStatus.map(r => [r.status, r._count._all])),
      tiers: Object.fromEntries(tiers.map(r => [r.tier, r._count._all])),
      topReferrers: topReferrers.map(r => ({
        count: r._count._all,
        customer: referrers.find(c => c.id === r.referrerId) || null,
      })),
      outstandingPoints,
      outstandingValue: await pointsToRiyals(outstandingPoints),
    });
  }
}
