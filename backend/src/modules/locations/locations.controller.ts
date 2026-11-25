import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { z } from 'zod';

const countrySchema = z.object({
  code: z.string().trim().min(2, 'كود الدولة مطلوب').max(3).toUpperCase(),
  nameAr: z.string().trim().min(2, 'الاسم بالعربية مطلوب'),
  nameEn: z.string().trim().min(2, 'الاسم بالإنجليزية مطلوب'),
});

const citySchema = z.object({
  countryId: z.string().uuid('الدولة مطلوبة'),
  nameAr: z.string().trim().min(2, 'اسم المدينة بالعربية مطلوب'),
  nameEn: z.string().trim().min(2, 'اسم المدينة بالإنجليزية مطلوب'),
});

const cityUpdateSchema = citySchema.partial().extend({
  isActive: z.boolean().optional(),
});

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(result.error.errors.map(e => e.message).join(', '), 400);
  }
  return result.data;
}

export class LocationsController {
  // ---------- Countries ----------
  static async listCountries(request: FastifyRequest, reply: FastifyReply) {
    const countries = await prisma.country.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { cities: { where: { deletedAt: null } } } } },
      orderBy: { nameAr: 'asc' },
    });
    return reply.send({ countries });
  }

  static async createCountry(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(countrySchema, request.body);

    const existing = await prisma.country.findFirst({ where: { code: data.code, deletedAt: null } });
    if (existing) throw new AppError('كود الدولة مستخدم بالفعل', 409);

    const country = await prisma.country.create({ data });
    return reply.status(201).send({ message: 'تم إضافة الدولة بنجاح', country });
  }

  static async updateCountry(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = parse(countrySchema.partial().extend({ isActive: z.boolean().optional() }), request.body);

    const existing = await prisma.country.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('الدولة غير موجودة', 404);

    if (data.code && data.code !== existing.code) {
      const clash = await prisma.country.findFirst({ where: { code: data.code, deletedAt: null } });
      if (clash) throw new AppError('كود الدولة مستخدم بالفعل', 409);
    }

    const country = await prisma.country.update({ where: { id }, data });
    return reply.send({ message: 'تم تحديث الدولة بنجاح', country });
  }

  static async removeCountry(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const existing = await prisma.country.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('الدولة غير موجودة', 404);

    const cities = await prisma.city.count({ where: { countryId: id, deletedAt: null } });
    if (cities > 0) throw new AppError('لا يمكن حذف دولة مرتبطة بمدن مسجلة', 400);

    await prisma.country.update({ where: { id }, data: { deletedAt: new Date() } });
    return reply.send({ message: 'تم حذف الدولة بنجاح' });
  }

  // ---------- Cities ----------
  static async listCities(request: FastifyRequest, reply: FastifyReply) {
    const { countryId, search } = request.query as { countryId?: string; search?: string };
    const term = search?.trim();

    const cities = await prisma.city.findMany({
      where: {
        deletedAt: null,
        ...(countryId ? { countryId } : {}),
        ...(term
          ? { OR: [{ nameAr: { contains: term } }, { nameEn: { contains: term } }] }
          : {}),
      },
      include: {
        country: { select: { id: true, code: true, nameAr: true, nameEn: true } },
        _count: { select: { branches: { where: { deletedAt: null } } } },
      },
      orderBy: { nameAr: 'asc' },
    });
    return reply.send({ cities });
  }

  static async createCity(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(citySchema, request.body);

    const country = await prisma.country.findFirst({ where: { id: data.countryId, deletedAt: null } });
    if (!country) throw new AppError('الدولة غير موجودة', 404);

    const clash = await prisma.city.findFirst({
      where: { countryId: data.countryId, nameAr: data.nameAr, deletedAt: null },
    });
    if (clash) throw new AppError('المدينة مسجلة بالفعل في هذه الدولة', 409);

    const city = await prisma.city.create({ data, include: { country: true } });
    return reply.status(201).send({ message: 'تم إضافة المدينة بنجاح', city });
  }

  static async updateCity(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = parse(cityUpdateSchema, request.body);

    const existing = await prisma.city.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('المدينة غير موجودة', 404);

    if (data.countryId) {
      const country = await prisma.country.findFirst({ where: { id: data.countryId, deletedAt: null } });
      if (!country) throw new AppError('الدولة غير موجودة', 404);
    }

    const city = await prisma.city.update({ where: { id }, data, include: { country: true } });
    return reply.send({ message: 'تم تحديث المدينة بنجاح', city });
  }

  static async removeCity(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const existing = await prisma.city.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('المدينة غير موجودة', 404);

    const branches = await prisma.branch.count({ where: { cityId: id, deletedAt: null } });
    if (branches > 0) throw new AppError('لا يمكن حذف مدينة مرتبطة بفروع مسجلة', 400);

    await prisma.city.update({ where: { id }, data: { deletedAt: new Date() } });
    return reply.send({ message: 'تم حذف المدينة بنجاح' });
  }
}
