import { FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes } from 'crypto';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { z } from 'zod';
import { buildVehicleFile, daysUntil } from './vehicleFile.service';

const documentSchema = z.object({
  type: z.enum(['REGISTRATION', 'INSURANCE', 'PERIODIC_INSPECTION', 'OTHER']),
  title: z.string().trim().optional().nullable(),
  documentNumber: z.string().trim().optional().nullable(),
  issuer: z.string().trim().optional().nullable(),
  issueDate: z.coerce.date().optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

const replacementSchema = z.object({
  jobCardId: z.string().uuid().optional().nullable(),
  partId: z.string().uuid().optional().nullable(),
  partName: z.string().trim().min(2, 'اسم القطعة مطلوب'),
  partNumber: z.string().trim().optional().nullable(),
  quantity: z.coerce.number().int().min(1, 'الكمية قطعة واحدة على الأقل').default(1),
  unitPrice: z.coerce.number().min(0, 'السعر لا يمكن أن يكون سالبًا').default(0),
  mileageAtReplacement: z.coerce.number().int().min(0).optional().nullable(),
  replacedAt: z.coerce.date().optional(),
  warrantyMonths: z.coerce.number().int().min(0).max(240).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

const mileageSchema = z.object({
  mileage: z.coerce.number().int().min(0, 'قراءة العداد لا يمكن أن تكون سالبة'),
  recordedAt: z.coerce.date().optional(),
  note: z.string().trim().optional().nullable(),
});

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(result.error.errors.map(e => e.message).join(', '), 400);
  }
  return result.data;
}

async function assertVehicle(vehicleId: string) {
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, deletedAt: null } });
  if (!vehicle) throw new AppError('السيارة غير موجودة', 404);
  return vehicle;
}

/** Adds warrantyMonths to the replacement date, when a warranty was given. */
function warrantyUntilFrom(replacedAt: Date, months?: number | null): Date | null {
  if (!months) return null;
  const until = new Date(replacedAt.getTime());
  const day = until.getDate();
  until.setMonth(until.getMonth() + months);
  if (until.getDate() < day) until.setDate(0);
  return until;
}

export class VehicleFileController {
  // ---------- The file ----------
  static async getFile(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const file = await buildVehicleFile(id);
    return reply.send(file);
  }

  /** Read-only view for the customer, reached by the share token — no login. */
  static async getPublicFile(request: FastifyRequest, reply: FastifyReply) {
    const { token } = request.params as { token: string };

    const vehicle = await prisma.vehicle.findFirst({
      where: { shareToken: token, deletedAt: null },
      select: { id: true },
    });
    if (!vehicle) throw new AppError('الرابط غير صالح أو تم إلغاؤه', 404);

    const file = await buildVehicleFile(vehicle.id);

    // The public view never exposes the customer's phone number or the token.
    return reply.send({
      ...file,
      vehicle: {
        ...file.vehicle,
        shareToken: undefined,
        customer: { id: undefined, fullName: file.vehicle.customer?.fullName, mobileNumber: undefined },
      },
    });
  }

  // ---------- Share link ----------
  static async createShareLink(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await assertVehicle(id);

    // Rotating the token invalidates any link handed out before.
    const shareToken = randomBytes(24).toString('base64url');
    await prisma.vehicle.update({ where: { id }, data: { shareToken } });

    return reply.send({ message: 'تم إنشاء رابط المشاركة', shareToken });
  }

  static async revokeShareLink(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await assertVehicle(id);

    await prisma.vehicle.update({ where: { id }, data: { shareToken: null } });
    return reply.send({ message: 'تم إلغاء رابط المشاركة' });
  }

  // ---------- Documents ----------
  static async listDocuments(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await assertVehicle(id);

    const documents = await prisma.vehicleDocument.findMany({
      where: { vehicleId: id, deletedAt: null },
      orderBy: [{ expiryDate: 'asc' }],
    });

    return reply.send({
      documents: documents.map(d => ({ ...d, daysUntilExpiry: daysUntil(d.expiryDate) })),
    });
  }

  /** Documents about to lapse across the whole workshop — drives the alerts. */
  static async expiringDocuments(request: FastifyRequest, reply: FastifyReply) {
    const { days = '30' } = request.query as { days?: string };
    const window = Math.min(365, Math.max(1, parseInt(days, 10) || 30));

    const until = new Date();
    until.setDate(until.getDate() + window);

    const documents = await prisma.vehicleDocument.findMany({
      where: {
        deletedAt: null,
        expiryDate: { not: null, lte: until },
        vehicle: { deletedAt: null },
      },
      include: {
        vehicle: {
          select: {
            id: true,
            brand: true,
            model: true,
            plateNumber: true,
            customer: { select: { fullName: true, mobileNumber: true } },
          },
        },
      },
      orderBy: { expiryDate: 'asc' },
      take: 100,
    });

    return reply.send({
      documents: documents.map(d => ({ ...d, daysUntilExpiry: daysUntil(d.expiryDate) })),
    });
  }

  static async createDocument(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await assertVehicle(id);

    const data = parse(documentSchema, request.body);
    if (data.issueDate && data.expiryDate && data.expiryDate < data.issueDate) {
      throw new AppError('تاريخ الانتهاء يجب أن يكون بعد تاريخ الإصدار', 400);
    }

    const document = await prisma.vehicleDocument.create({ data: { ...data, vehicleId: id } });
    return reply.status(201).send({ message: 'تم إضافة المستند بنجاح', document });
  }

  static async updateDocument(request: FastifyRequest, reply: FastifyReply) {
    const { documentId } = request.params as { documentId: string };
    const data = parse(documentSchema.partial(), request.body);

    const existing = await prisma.vehicleDocument.findFirst({
      where: { id: documentId, deletedAt: null },
    });
    if (!existing) throw new AppError('المستند غير موجود', 404);

    const issueDate = data.issueDate === undefined ? existing.issueDate : data.issueDate;
    const expiryDate = data.expiryDate === undefined ? existing.expiryDate : data.expiryDate;
    if (issueDate && expiryDate && expiryDate < issueDate) {
      throw new AppError('تاريخ الانتهاء يجب أن يكون بعد تاريخ الإصدار', 400);
    }

    const document = await prisma.vehicleDocument.update({ where: { id: documentId }, data });
    return reply.send({ message: 'تم تحديث المستند بنجاح', document });
  }

  static async removeDocument(request: FastifyRequest, reply: FastifyReply) {
    const { documentId } = request.params as { documentId: string };

    const existing = await prisma.vehicleDocument.findFirst({
      where: { id: documentId, deletedAt: null },
    });
    if (!existing) throw new AppError('المستند غير موجود', 404);

    await prisma.vehicleDocument.update({ where: { id: documentId }, data: { deletedAt: new Date() } });
    return reply.send({ message: 'تم حذف المستند' });
  }

  // ---------- Replaced parts ----------
  static async createReplacement(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const vehicle = await assertVehicle(id);

    const data = parse(replacementSchema, request.body);

    if (data.jobCardId) {
      const jobCard = await prisma.jobCard.findFirst({
        where: { id: data.jobCardId, deletedAt: null, vehicleId: id },
      });
      if (!jobCard) throw new AppError('كرت العمل غير موجود أو لا يخص هذه السيارة', 404);
    }

    // Pull the name and number from the catalogue when a part was picked.
    let partName = data.partName;
    let partNumber = data.partNumber ?? null;
    if (data.partId) {
      const part = await prisma.part.findFirst({ where: { id: data.partId, deletedAt: null } });
      if (!part) throw new AppError('القطعة غير موجودة في الكتالوج', 404);
      partName = part.nameAr;
      partNumber = part.partNumber;
    }

    const replacedAt = data.replacedAt || new Date();

    const replacement = await prisma.vehiclePartReplacement.create({
      data: {
        vehicleId: id,
        jobCardId: data.jobCardId || null,
        partId: data.partId || null,
        partName,
        partNumber,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        mileageAtReplacement: data.mileageAtReplacement ?? vehicle.mileage,
        replacedAt,
        warrantyMonths: data.warrantyMonths ?? null,
        warrantyUntil: warrantyUntilFrom(replacedAt, data.warrantyMonths),
        notes: data.notes || null,
      },
    });

    return reply.status(201).send({ message: 'تم تسجيل القطعة المستبدلة', replacement });
  }

  static async updateReplacement(request: FastifyRequest, reply: FastifyReply) {
    const { replacementId } = request.params as { replacementId: string };
    const data = parse(replacementSchema.partial(), request.body);

    const existing = await prisma.vehiclePartReplacement.findFirst({
      where: { id: replacementId, deletedAt: null },
    });
    if (!existing) throw new AppError('سجل القطعة غير موجود', 404);

    const replacedAt = data.replacedAt || existing.replacedAt;
    const warrantyMonths =
      data.warrantyMonths === undefined ? existing.warrantyMonths : data.warrantyMonths;

    const replacement = await prisma.vehiclePartReplacement.update({
      where: { id: replacementId },
      data: {
        ...data,
        replacedAt,
        warrantyMonths,
        warrantyUntil: warrantyUntilFrom(replacedAt, warrantyMonths),
      },
    });

    return reply.send({ message: 'تم تحديث سجل القطعة', replacement });
  }

  static async removeReplacement(request: FastifyRequest, reply: FastifyReply) {
    const { replacementId } = request.params as { replacementId: string };

    const existing = await prisma.vehiclePartReplacement.findFirst({
      where: { id: replacementId, deletedAt: null },
    });
    if (!existing) throw new AppError('سجل القطعة غير موجود', 404);

    await prisma.vehiclePartReplacement.update({
      where: { id: replacementId },
      data: { deletedAt: new Date() },
    });
    return reply.send({ message: 'تم حذف سجل القطعة' });
  }

  // ---------- Mileage ----------
  static async addMileage(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const vehicle = await assertVehicle(id);

    const data = parse(mileageSchema, request.body);
    if (data.mileage < vehicle.mileage) {
      throw new AppError(
        `قراءة العداد أقل من آخر قراءة مسجلة (${vehicle.mileage}) — راجع الرقم`,
        400,
      );
    }

    const [log] = await prisma.$transaction([
      prisma.vehicleMileageLog.create({
        data: {
          vehicleId: id,
          mileage: data.mileage,
          recordedAt: data.recordedAt || new Date(),
          source: 'MANUAL',
          note: data.note || null,
        },
      }),
      prisma.vehicle.update({ where: { id }, data: { mileage: data.mileage } }),
    ]);

    return reply.status(201).send({ message: 'تم تسجيل قراءة العداد', log });
  }
}
