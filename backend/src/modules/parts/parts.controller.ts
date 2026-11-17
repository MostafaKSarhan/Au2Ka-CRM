import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { z } from 'zod';

const partSchema = z.object({
  partNumber: z.string().trim().min(1, 'رقم القطعة مطلوب').max(60),
  nameAr: z.string().trim().min(2, 'اسم القطعة بالعربية مطلوب'),
  nameEn: z.string().trim().min(2, 'اسم القطعة بالإنجليزية مطلوب'),
  category: z.string().trim().optional().nullable(),
  unit: z.string().trim().min(1).default('PCS'),
  purchasePrice: z.coerce.number().min(0, 'سعر الشراء لا يمكن أن يكون سالبًا').default(0),
  sellPrice: z.coerce.number().min(0, 'سعر البيع لا يمكن أن يكون سالبًا').default(0),
  quantity: z.coerce.number().int().min(0, 'الكمية لا يمكن أن تكون سالبة').default(0),
  reorderLevel: z.coerce.number().int().min(0, 'حد إعادة الطلب لا يمكن أن يكون سالبًا').default(0),
  location: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

const partUpdateSchema = partSchema.partial().extend({
  isActive: z.boolean().optional(),
});

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(result.error.errors.map(e => e.message).join(', '), 400);
  }
  return result.data;
}

export class PartsController {
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { search, category, lowStock, page = '1', limit = '20' } = request.query as {
      search?: string;
      category?: string;
      lowStock?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * take;

    const where = {
      deletedAt: null,
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { nameAr: { contains: search } },
              { nameEn: { contains: search } },
              { partNumber: { contains: search } },
            ],
          }
        : {}),
    };

    const [parts, total] = await Promise.all([
      prisma.part.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.part.count({ where }),
    ]);

    // "Low stock" compares two columns, which Prisma cannot express in a filter — do it here.
    const rows = lowStock === 'true' ? parts.filter(p => p.quantity <= p.reorderLevel) : parts;

    return reply.send({
      parts: rows,
      pagination: { page: pageNum, limit: take, total, pages: Math.ceil(total / take) },
    });
  }

  static async categories(request: FastifyRequest, reply: FastifyReply) {
    const rows = await prisma.part.findMany({
      where: { deletedAt: null, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return reply.send({ categories: rows.map(r => r.category).filter(Boolean) });
  }

  static async getOne(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const part = await prisma.part.findFirst({ where: { id, deletedAt: null } });
    if (!part) throw new AppError('القطعة غير موجودة', 404);

    return reply.send({ part });
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(partSchema, request.body);

    const clash = await prisma.part.findFirst({ where: { partNumber: data.partNumber, deletedAt: null } });
    if (clash) throw new AppError('رقم القطعة مستخدم بالفعل', 409);

    const part = await prisma.part.create({ data });
    return reply.status(201).send({ message: 'تم إضافة القطعة بنجاح', part });
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = parse(partUpdateSchema, request.body);

    const existing = await prisma.part.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('القطعة غير موجودة', 404);

    if (data.partNumber && data.partNumber !== existing.partNumber) {
      const clash = await prisma.part.findFirst({ where: { partNumber: data.partNumber, deletedAt: null } });
      if (clash) throw new AppError('رقم القطعة مستخدم بالفعل', 409);
    }

    const part = await prisma.part.update({ where: { id }, data });
    return reply.send({ message: 'تم تحديث القطعة بنجاح', part });
  }

  static async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const existing = await prisma.part.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('القطعة غير موجودة', 404);

    await prisma.part.update({ where: { id }, data: { deletedAt: new Date() } });
    return reply.send({ message: 'تم حذف القطعة بنجاح' });
  }
}
