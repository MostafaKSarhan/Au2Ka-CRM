import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { z } from 'zod';

const planSchema = z.object({
  nameAr: z.string().trim().min(2, 'اسم الباقة بالعربية مطلوب'),
  nameEn: z.string().trim().min(2, 'اسم الباقة بالإنجليزية مطلوب'),
  descriptionAr: z.string().trim().optional().nullable(),
  descriptionEn: z.string().trim().optional().nullable(),
  price: z.coerce.number().min(0, 'السعر لا يمكن أن يكون سالبًا').default(0),
  durationMonths: z.coerce.number().int().min(1, 'المدة شهر واحد على الأقل').max(120).default(12),
  freeVisits: z.coerce.number().int().min(0, 'عدد الزيارات لا يمكن أن يكون سالبًا').default(0),
  discountPercent: z.coerce.number().min(0).max(100, 'نسبة الخصم بين 0 و100').default(0),
  benefitsAr: z.string().trim().optional().nullable(),
  benefitsEn: z.string().trim().optional().nullable(),
});

const planUpdateSchema = planSchema.partial().extend({
  isActive: z.boolean().optional(),
});

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(result.error.errors.map(e => e.message).join(', '), 400);
  }
  return result.data;
}

export class PlansController {
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { activeOnly } = request.query as { activeOnly?: string };

    const plans = await prisma.plan.findMany({
      where: {
        deletedAt: null,
        ...(activeOnly === 'true' ? { isActive: true } : {}),
      },
      include: {
        _count: {
          select: {
            subscriptions: { where: { deletedAt: null, status: 'ACTIVE' } },
          },
        },
      },
      orderBy: { price: 'asc' },
    });

    return reply.send({ plans });
  }

  static async getOne(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const plan = await prisma.plan.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { subscriptions: { where: { deletedAt: null } } } },
      },
    });
    if (!plan) throw new AppError('الباقة غير موجودة', 404);

    return reply.send({ plan });
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(planSchema, request.body);

    const clash = await prisma.plan.findFirst({ where: { nameAr: data.nameAr, deletedAt: null } });
    if (clash) throw new AppError('يوجد باقة بنفس الاسم بالفعل', 409);

    const plan = await prisma.plan.create({ data });
    return reply.status(201).send({ message: 'تم إضافة الباقة بنجاح', plan });
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = parse(planUpdateSchema, request.body);

    const existing = await prisma.plan.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('الباقة غير موجودة', 404);

    if (data.nameAr && data.nameAr !== existing.nameAr) {
      const clash = await prisma.plan.findFirst({ where: { nameAr: data.nameAr, deletedAt: null } });
      if (clash) throw new AppError('يوجد باقة بنفس الاسم بالفعل', 409);
    }

    // Editing a plan never rewrites subscriptions already sold: every
    // subscription keeps its own snapshot of visits and discount.
    const plan = await prisma.plan.update({ where: { id }, data });
    return reply.send({ message: 'تم تحديث الباقة بنجاح', plan });
  }

  static async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const existing = await prisma.plan.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('الباقة غير موجودة', 404);

    const active = await prisma.subscription.count({
      where: { planId: id, deletedAt: null, status: 'ACTIVE' },
    });
    if (active > 0) {
      throw new AppError('لا يمكن حذف باقة عليها اشتراكات سارية — أوقفها بدلاً من حذفها', 400);
    }

    await prisma.plan.update({ where: { id }, data: { deletedAt: new Date() } });
    return reply.send({ message: 'تم حذف الباقة بنجاح' });
  }
}
