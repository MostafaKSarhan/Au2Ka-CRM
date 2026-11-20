import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { z } from 'zod';

const branchSchema = z.object({
  code: z.string().trim().min(2, 'كود الفرع مطلوب').max(20),
  nameAr: z.string().trim().min(2, 'اسم الفرع بالعربية مطلوب'),
  nameEn: z.string().trim().min(2, 'اسم الفرع بالإنجليزية مطلوب'),
  cityId: z.string().uuid('المدينة مطلوبة'),
  address: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
});

const branchUpdateSchema = branchSchema.partial().extend({
  isActive: z.boolean().optional(),
});

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(result.error.errors.map(e => e.message).join(', '), 400);
  }
  return result.data;
}

const branchInclude = {
  city: {
    select: {
      id: true,
      nameAr: true,
      nameEn: true,
      country: { select: { id: true, code: true, nameAr: true, nameEn: true } },
    },
  },
  _count: {
    select: {
      users: { where: { deletedAt: null } },
      customers: { where: { deletedAt: null } },
      jobCards: { where: { deletedAt: null } },
    },
  },
};

export class BranchesController {
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { search, cityId } = request.query as { search?: string; cityId?: string };

    const branches = await prisma.branch.findMany({
      where: {
        deletedAt: null,
        ...(cityId ? { cityId } : {}),
        ...(search
          ? {
              OR: [
                { nameAr: { contains: search } },
                { nameEn: { contains: search } },
                { code: { contains: search } },
              ],
            }
          : {}),
      },
      include: branchInclude,
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({ branches });
  }

  static async getOne(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const branch = await prisma.branch.findFirst({
      where: { id, deletedAt: null },
      include: branchInclude,
    });
    if (!branch) throw new AppError('الفرع غير موجود', 404);

    return reply.send({ branch });
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(branchSchema, request.body);

    const city = await prisma.city.findFirst({ where: { id: data.cityId, deletedAt: null } });
    if (!city) throw new AppError('المدينة غير موجودة', 404);

    const clash = await prisma.branch.findFirst({ where: { code: data.code, deletedAt: null } });
    if (clash) throw new AppError('كود الفرع مستخدم بالفعل', 409);

    const branch = await prisma.branch.create({ data, include: branchInclude });
    return reply.status(201).send({ message: 'تم إضافة الفرع بنجاح', branch });
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = parse(branchUpdateSchema, request.body);

    const existing = await prisma.branch.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('الفرع غير موجود', 404);

    if (data.cityId) {
      const city = await prisma.city.findFirst({ where: { id: data.cityId, deletedAt: null } });
      if (!city) throw new AppError('المدينة غير موجودة', 404);
    }

    if (data.code && data.code !== existing.code) {
      const clash = await prisma.branch.findFirst({ where: { code: data.code, deletedAt: null } });
      if (clash) throw new AppError('كود الفرع مستخدم بالفعل', 409);
    }

    const branch = await prisma.branch.update({ where: { id }, data, include: branchInclude });
    return reply.send({ message: 'تم تحديث الفرع بنجاح', branch });
  }

  static async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const existing = await prisma.branch.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('الفرع غير موجود', 404);

    const [users, jobCards] = await Promise.all([
      prisma.user.count({ where: { branchId: id, deletedAt: null } }),
      prisma.jobCard.count({ where: { branchId: id, deletedAt: null } }),
    ]);

    if (users > 0) throw new AppError('لا يمكن حذف فرع مرتبط بموظفين — انقلهم لفرع آخر أولاً', 400);
    if (jobCards > 0) throw new AppError('لا يمكن حذف فرع مرتبط بكروت عمل مسجلة', 400);

    await prisma.branch.update({ where: { id }, data: { deletedAt: new Date() } });
    return reply.send({ message: 'تم حذف الفرع بنجاح' });
  }
}
