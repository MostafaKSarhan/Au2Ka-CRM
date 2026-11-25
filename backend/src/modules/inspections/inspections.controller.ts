import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { z } from 'zod';
import {
  calculateHealthScore,
  generateMonthForSubscribers,
  generateMonthlyReport,
  healthBand,
  nextServiceFrom,
} from './inspections.service';

const itemSchema = z.object({
  code: z.string().trim().min(2, 'كود البند مطلوب').max(40).toUpperCase(),
  nameAr: z.string().trim().min(2, 'اسم البند بالعربية مطلوب'),
  nameEn: z.string().trim().min(2, 'اسم البند بالإنجليزية مطلوب'),
  category: z.string().trim().optional().nullable(),
  hintAr: z.string().trim().optional().nullable(),
  hintEn: z.string().trim().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

const itemUpdateSchema = itemSchema.partial().extend({ isActive: z.boolean().optional() });

const saveInspectionSchema = z.object({
  mileage: z.coerce.number().int().min(0).optional().nullable(),
  technicianId: z.string().uuid().optional().nullable(),
  summaryAr: z.string().trim().optional().nullable(),
  summaryEn: z.string().trim().optional().nullable(),
  complete: z.boolean().optional(),
  results: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        rating: z.enum(['NOT_CHECKED', 'OK', 'NEEDS_ATTENTION', 'CRITICAL']),
        note: z.string().trim().optional().nullable(),
      }),
    )
    .default([]),
});

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(result.error.errors.map(e => e.message).join(', '), 400);
  }
  return result.data;
}

/** The scope caps the approved checklist at 25 items. */
const MAX_ITEMS = 25;

export class InspectionsController {
  // ---------- Checklist definition ----------
  static async listItems(request: FastifyRequest, reply: FastifyReply) {
    const { activeOnly } = request.query as { activeOnly?: string };

    const items = await prisma.inspectionItem.findMany({
      where: { deletedAt: null, ...(activeOnly === 'true' ? { isActive: true } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
    });

    return reply.send({ items, max: MAX_ITEMS });
  }

  static async createItem(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(itemSchema, request.body);

    const active = await prisma.inspectionItem.count({ where: { deletedAt: null, isActive: true } });
    if (active >= MAX_ITEMS) {
      throw new AppError(`الحد الأقصى ${MAX_ITEMS} بندًا فعّالًا — أوقف بندًا قبل إضافة آخر`, 400);
    }

    const clash = await prisma.inspectionItem.findFirst({ where: { code: data.code, deletedAt: null } });
    if (clash) throw new AppError('كود البند مستخدم بالفعل', 409);

    const item = await prisma.inspectionItem.create({ data });
    return reply.status(201).send({ message: 'تم إضافة بند الفحص', item });
  }

  static async updateItem(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = parse(itemUpdateSchema, request.body);

    const existing = await prisma.inspectionItem.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('بند الفحص غير موجود', 404);

    if (data.isActive && !existing.isActive) {
      const active = await prisma.inspectionItem.count({ where: { deletedAt: null, isActive: true } });
      if (active >= MAX_ITEMS) {
        throw new AppError(`الحد الأقصى ${MAX_ITEMS} بندًا فعّالًا`, 400);
      }
    }

    const item = await prisma.inspectionItem.update({ where: { id }, data });
    return reply.send({ message: 'تم تحديث بند الفحص', item });
  }

  static async removeItem(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const existing = await prisma.inspectionItem.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('بند الفحص غير موجود', 404);

    const used = await prisma.inspectionResult.count({ where: { itemId: id } });
    if (used > 0) {
      throw new AppError('البند مستخدم في فحوصات سابقة — أوقفه بدل حذفه حتى لا تتأثر التقارير', 400);
    }

    await prisma.inspectionItem.update({ where: { id }, data: { deletedAt: new Date() } });
    return reply.send({ message: 'تم حذف بند الفحص' });
  }

  // ---------- The filled form ----------
  /** The inspection for a job card, creating the blank form on first open. */
  static async getForJobCard(request: FastifyRequest, reply: FastifyReply) {
    const { jobCardId } = request.params as { jobCardId: string };

    const jobCard = await prisma.jobCard.findFirst({
      where: { id: jobCardId, deletedAt: null },
      select: { id: true, vehicleId: true, jobNumber: true, vehicle: { select: { mileage: true } } },
    });
    if (!jobCard) throw new AppError('كرت العمل غير موجود', 404);

    const items = await prisma.inspectionItem.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
    });

    let inspection = await prisma.inspection.findFirst({
      where: { jobCardId, deletedAt: null },
      include: { results: true, technician: { select: { firstName: true, lastName: true } } },
    });

    if (!inspection) {
      const created = await prisma.inspection.create({
        data: {
          jobCardId,
          vehicleId: jobCard.vehicleId,
          mileage: jobCard.vehicle?.mileage ?? null,
        },
      });
      inspection = await prisma.inspection.findUnique({
        where: { id: created.id },
        include: { results: true, technician: { select: { firstName: true, lastName: true } } },
      });
    }

    // Items are returned alongside the saved ratings, so a checklist that
    // grew since the form was filled still shows its new rows as unchecked.
    const resultsByItem = new Map(inspection!.results.map(r => [r.itemId, r]));

    return reply.send({
      inspection: {
        ...inspection,
        band: healthBand(inspection!.healthScore),
      },
      jobNumber: jobCard.jobNumber,
      items: items.map(item => ({
        ...item,
        rating: resultsByItem.get(item.id)?.rating || 'NOT_CHECKED',
        note: resultsByItem.get(item.id)?.note || '',
      })),
    });
  }

  static async save(request: FastifyRequest, reply: FastifyReply) {
    const { jobCardId } = request.params as { jobCardId: string };
    const data = parse(saveInspectionSchema, request.body);

    const inspection = await prisma.inspection.findFirst({
      where: { jobCardId, deletedAt: null },
    });
    if (!inspection) throw new AppError('نموذج الفحص غير موجود — افتحه أولًا', 404);

    const healthScore = calculateHealthScore(data.results);
    const { nextServiceMileage, nextServiceDate } = nextServiceFrom(
      data.mileage ?? inspection.mileage,
      new Date(),
    );

    await prisma.$transaction([
      // Replacing the rows wholesale keeps the saved form exactly as submitted.
      prisma.inspectionResult.deleteMany({ where: { inspectionId: inspection.id } }),
      prisma.inspectionResult.createMany({
        data: data.results.map(r => ({
          inspectionId: inspection.id,
          itemId: r.itemId,
          rating: r.rating,
          note: r.note || null,
        })),
      }),
      prisma.inspection.update({
        where: { id: inspection.id },
        data: {
          mileage: data.mileage ?? inspection.mileage,
          technicianId: data.technicianId ?? request.user?.id ?? null,
          summaryAr: data.summaryAr ?? null,
          summaryEn: data.summaryEn ?? null,
          healthScore,
          nextServiceMileage,
          nextServiceDate,
          completedAt: data.complete ? new Date() : inspection.completedAt,
        },
      }),
    ]);

    const saved = await prisma.inspection.findUnique({
      where: { id: inspection.id },
      include: { results: { include: { item: true } } },
    });

    return reply.send({
      message: data.complete ? 'تم اعتماد الفحص الفني' : 'تم حفظ الفحص الفني',
      inspection: { ...saved, band: healthBand(healthScore) },
    });
  }

  /** How the vehicle's health moved across its inspections. */
  static async history(request: FastifyRequest, reply: FastifyReply) {
    const { vehicleId } = request.params as { vehicleId: string };

    const inspections = await prisma.inspection.findMany({
      where: { vehicleId, deletedAt: null, completedAt: { not: null } },
      select: {
        id: true,
        completedAt: true,
        healthScore: true,
        mileage: true,
        jobCard: { select: { jobNumber: true } },
      },
      orderBy: { completedAt: 'asc' },
    });

    return reply.send({
      history: inspections.map(i => ({ ...i, band: healthBand(i.healthScore) })),
    });
  }

  // ---------- Monthly reports ----------
  static async listReports(request: FastifyRequest, reply: FastifyReply) {
    const { year, month, vehicleId, customerId, page = '1', limit = '20' } =
      request.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
    const skip = (pageNum - 1) * take;

    const where: any = { deletedAt: null };
    if (year) where.year = parseInt(year, 10);
    if (month) where.month = parseInt(month, 10);
    if (vehicleId) where.vehicleId = vehicleId;
    if (customerId) where.customerId = customerId;

    const [reports, total] = await Promise.all([
      prisma.monthlyReport.findMany({
        where,
        include: {
          vehicle: { select: { id: true, brand: true, model: true, plateNumber: true } },
          customer: { select: { id: true, fullName: true, mobileNumber: true } },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { generatedAt: 'desc' }],
        skip,
        take,
      }),
      prisma.monthlyReport.count({ where }),
    ]);

    return reply.send({
      reports: reports.map(r => ({
        ...r,
        band: r.healthScore != null ? healthBand(r.healthScore) : null,
      })),
      pagination: { page: pageNum, limit: take, total, pages: Math.ceil(total / take) },
    });
  }

  static async getReport(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const report = await prisma.monthlyReport.findFirst({
      where: { id, deletedAt: null },
      include: {
        vehicle: {
          select: { id: true, brand: true, model: true, plateNumber: true, mileage: true },
        },
        customer: { select: { id: true, fullName: true, mobileNumber: true } },
      },
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

    return reply.send({
      report: {
        ...report,
        findings,
        band: report.healthScore != null ? healthBand(report.healthScore) : null,
      },
    });
  }

  static async generate(request: FastifyRequest, reply: FastifyReply) {
    const { vehicleId, year, month } = request.body as {
      vehicleId?: string;
      year?: number;
      month?: number;
    };

    const now = new Date();
    const y = year || now.getFullYear();
    const m = month || now.getMonth() + 1;

    if (m < 1 || m > 12) throw new AppError('الشهر غير صحيح', 400);

    if (vehicleId) {
      const result = await generateMonthlyReport(vehicleId, y, m);
      if (!result) throw new AppError('السيارة غير موجودة', 404);
      return reply.send({ message: 'تم توليد التقرير', result });
    }

    const summary = await generateMonthForSubscribers(y, m);
    return reply.send({
      message: `تم توليد تقارير ${m}/${y} للسيارات المشتركة`,
      summary,
    });
  }

  static async markReportSent(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const existing = await prisma.monthlyReport.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('التقرير غير موجود', 404);

    const report = await prisma.monthlyReport.update({
      where: { id },
      data: { sentAt: new Date() },
    });

    return reply.send({ message: 'تم تسجيل إرسال التقرير', report });
  }
}
