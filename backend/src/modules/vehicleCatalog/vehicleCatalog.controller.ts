import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { z } from 'zod';

const brandSchema = z.object({
  nameAr: z.string().trim().min(2, 'اسم الماركة بالعربية مطلوب'),
  nameEn: z.string().trim().min(1, 'اسم الماركة بالإنجليزية مطلوب'),
});

const modelSchema = z.object({
  brandId: z.string().uuid('الماركة مطلوبة'),
  nameAr: z.string().trim().min(1, 'اسم الموديل بالعربية مطلوب'),
  nameEn: z.string().trim().min(1, 'اسم الموديل بالإنجليزية مطلوب'),
  yearFrom: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  yearTo: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
});

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(result.error.errors.map(e => e.message).join(', '), 400);
  }
  return result.data;
}

function assertYearRange(yearFrom?: number | null, yearTo?: number | null) {
  if (yearFrom && yearTo && yearTo < yearFrom) {
    throw new AppError('سنة النهاية يجب أن تكون بعد سنة البداية', 400);
  }
}

export class VehicleCatalogController {
  // ---------- Brands ----------
  static async listBrands(request: FastifyRequest, reply: FastifyReply) {
    const brands = await prisma.vehicleBrand.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { models: { where: { deletedAt: null } } } } },
      orderBy: { nameEn: 'asc' },
    });
    return reply.send({ brands });
  }

  static async createBrand(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(brandSchema, request.body);

    const clash = await prisma.vehicleBrand.findFirst({ where: { nameEn: data.nameEn, deletedAt: null } });
    if (clash) throw new AppError('الماركة مسجلة بالفعل', 409);

    const brand = await prisma.vehicleBrand.create({ data });
    return reply.status(201).send({ message: 'تم إضافة الماركة بنجاح', brand });
  }

  static async updateBrand(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = parse(brandSchema.partial().extend({ isActive: z.boolean().optional() }), request.body);

    const existing = await prisma.vehicleBrand.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('الماركة غير موجودة', 404);

    if (data.nameEn && data.nameEn !== existing.nameEn) {
      const clash = await prisma.vehicleBrand.findFirst({ where: { nameEn: data.nameEn, deletedAt: null } });
      if (clash) throw new AppError('الماركة مسجلة بالفعل', 409);
    }

    const brand = await prisma.vehicleBrand.update({ where: { id }, data });
    return reply.send({ message: 'تم تحديث الماركة بنجاح', brand });
  }

  static async removeBrand(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const existing = await prisma.vehicleBrand.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('الماركة غير موجودة', 404);

    const models = await prisma.vehicleModel.count({ where: { brandId: id, deletedAt: null } });
    if (models > 0) throw new AppError('لا يمكن حذف ماركة مرتبطة بموديلات مسجلة', 400);

    await prisma.vehicleBrand.update({ where: { id }, data: { deletedAt: new Date() } });
    return reply.send({ message: 'تم حذف الماركة بنجاح' });
  }

  // ---------- Models ----------
  static async listModels(request: FastifyRequest, reply: FastifyReply) {
    const { brandId, search } = request.query as { brandId?: string; search?: string };

    const models = await prisma.vehicleModel.findMany({
      where: {
        deletedAt: null,
        ...(brandId ? { brandId } : {}),
        ...(search
          ? { OR: [{ nameAr: { contains: search } }, { nameEn: { contains: search } }] }
          : {}),
      },
      include: {
        brand: { select: { id: true, nameAr: true, nameEn: true } },
        _count: { select: { vehicles: { where: { deletedAt: null } } } },
      },
      orderBy: [{ brand: { nameEn: 'asc' } }, { nameEn: 'asc' }],
    });

    return reply.send({ models });
  }

  static async createModel(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(modelSchema, request.body);
    assertYearRange(data.yearFrom, data.yearTo);

    const brand = await prisma.vehicleBrand.findFirst({ where: { id: data.brandId, deletedAt: null } });
    if (!brand) throw new AppError('الماركة غير موجودة', 404);

    const clash = await prisma.vehicleModel.findFirst({
      where: { brandId: data.brandId, nameEn: data.nameEn, deletedAt: null },
    });
    if (clash) throw new AppError('الموديل مسجل بالفعل لهذه الماركة', 409);

    const model = await prisma.vehicleModel.create({ data, include: { brand: true } });
    return reply.status(201).send({ message: 'تم إضافة الموديل بنجاح', model });
  }

  static async updateModel(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = parse(modelSchema.partial().extend({ isActive: z.boolean().optional() }), request.body);

    const existing = await prisma.vehicleModel.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('الموديل غير موجود', 404);

    assertYearRange(
      data.yearFrom === undefined ? existing.yearFrom : data.yearFrom,
      data.yearTo === undefined ? existing.yearTo : data.yearTo,
    );

    const model = await prisma.vehicleModel.update({ where: { id }, data, include: { brand: true } });
    return reply.send({ message: 'تم تحديث الموديل بنجاح', model });
  }

  static async removeModel(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const existing = await prisma.vehicleModel.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('الموديل غير موجود', 404);

    const vehicles = await prisma.vehicle.count({ where: { vehicleModelId: id, deletedAt: null } });
    if (vehicles > 0) throw new AppError('لا يمكن حذف موديل مرتبط بسيارات مسجلة', 400);

    await prisma.vehicleModel.update({ where: { id }, data: { deletedAt: new Date() } });
    return reply.send({ message: 'تم حذف الموديل بنجاح' });
  }
}
