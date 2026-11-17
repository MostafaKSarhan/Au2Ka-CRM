import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { z } from 'zod';
import { inventoryReport, issueToJobCard, lowStockParts, moveStock } from './inventory.service';
import { notify } from '../messaging/messaging.service';

const intakeSchema = z.object({
  partId: z.string().uuid('القطعة مطلوبة'),
  quantity: z.coerce.number().int().min(1, 'الكمية قطعة واحدة على الأقل'),
  unitPrice: z.coerce.number().min(0).optional().nullable(),
  reference: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),
});

const issueSchema = z.object({
  partId: z.string().uuid('القطعة مطلوبة'),
  jobCardId: z.string().uuid('كرت العمل مطلوب'),
  quantity: z.coerce.number().int().min(1, 'الكمية قطعة واحدة على الأقل'),
  unitPrice: z.coerce.number().min(0).optional().nullable(),
  warrantyMonths: z.coerce.number().int().min(0).max(240).optional().nullable(),
  allowNegative: z.boolean().optional(),
});

const countSchema = z.object({
  partId: z.string().uuid('القطعة مطلوبة'),
  /** The figure actually counted on the shelf. */
  countedQuantity: z.coerce.number().int().min(0, 'الكمية لا يمكن أن تكون سالبة'),
  note: z.string().trim().min(2, 'سبب التسوية مطلوب'),
});

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(result.error.errors.map(e => e.message).join(', '), 400);
  }
  return result.data;
}

/** Raises the reorder alert when a move takes a part to its threshold. */
async function alertIfLow(result: { hitReorderLevel: boolean; partName: string; balanceAfter: number }, partId: string) {
  if (!result.hitReorderLevel) return;

  await notify({
    role: 'ADMIN',
    type: 'SYSTEM',
    titleAr: `«${result.partName}» وصل حد إعادة الطلب`,
    titleEn: `"${result.partName}" has reached its reorder level`,
    bodyAr: `الرصيد المتبقي: ${result.balanceAfter}`,
    bodyEn: `Remaining balance: ${result.balanceAfter}`,
    linkType: 'PART',
    linkId: partId,
    dedupeKey: `reorder:${partId}:${new Date().toISOString().slice(0, 10)}`,
  });
}

export class InventoryController {
  /** Goods received into the warehouse. */
  static async intake(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(intakeSchema, request.body);

    const result = await prisma.$transaction(tx =>
      moveStock(tx, {
        partId: data.partId,
        type: 'IN',
        quantity: Math.abs(data.quantity),
        unitPrice: data.unitPrice ?? null,
        reference: data.reference || null,
        reasonAr: data.note || 'إدخال مخزون',
        reasonEn: data.note || 'Stock intake',
        createdById: request.user?.id || null,
      }),
    );

    // Intake may update what the part costs us.
    if (data.unitPrice != null) {
      await prisma.part.update({
        where: { id: data.partId },
        data: { purchasePrice: data.unitPrice },
      });
    }

    return reply.status(201).send({
      message: `تم إدخال ${data.quantity} — الرصيد الآن ${result.balanceAfter}`,
      movement: result.movement,
      balanceAfter: result.balanceAfter,
    });
  }

  /** A part issued to a repair, which also writes it into the vehicle file. */
  static async issue(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(issueSchema, request.body);

    const result = await issueToJobCard({
      ...data,
      createdById: request.user?.id || null,
    });

    await alertIfLow(result, data.partId);

    return reply.status(201).send({
      message: `تم صرف ${data.quantity} على الكرت ${result.jobNumber} — الرصيد الآن ${result.balanceAfter}`,
      movement: result.movement,
      replacement: result.replacement,
      balanceAfter: result.balanceAfter,
    });
  }

  /** Corrects the book figure to what a stock count actually found. */
  static async stockCount(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(countSchema, request.body);

    const part = await prisma.part.findFirst({
      where: { id: data.partId, deletedAt: null },
      select: { quantity: true, nameAr: true },
    });
    if (!part) throw new AppError('القطعة غير موجودة', 404);

    const difference = data.countedQuantity - part.quantity;
    if (difference === 0) {
      return reply.send({
        message: 'الرصيد الدفتري مطابق للجرد — لا حاجة لتسوية',
        balanceAfter: part.quantity,
        difference: 0,
      });
    }

    const result = await prisma.$transaction(tx =>
      moveStock(tx, {
        partId: data.partId,
        type: 'ADJUSTMENT',
        quantity: difference,
        reasonAr: `تسوية جرد: ${data.note}`,
        reasonEn: `Stock count adjustment: ${data.note}`,
        createdById: request.user?.id || null,
        // A count is the truth by definition.
        allowNegative: true,
      }),
    );

    await alertIfLow(result, data.partId);

    return reply.send({
      message: `تمت التسوية بفارق ${difference > 0 ? '+' : ''}${difference} — الرصيد الآن ${result.balanceAfter}`,
      movement: result.movement,
      balanceAfter: result.balanceAfter,
      difference,
    });
  }

  /** The movement history, for the whole warehouse or for one part. */
  static async movements(request: FastifyRequest, reply: FastifyReply) {
    const { partId, type, page = '1', limit = '30' } = request.query as Record<
      string,
      string | undefined
    >;

    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit || '30', 10) || 30));
    const skip = (pageNum - 1) * take;

    const where: any = {};
    if (partId) where.partId = partId;
    if (type) where.type = type;

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          part: { select: { id: true, partNumber: true, nameAr: true, nameEn: true, unit: true } },
          jobCard: { select: { id: true, jobNumber: true } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return reply.send({
      movements,
      pagination: { page: pageNum, limit: take, total, pages: Math.ceil(total / take) },
    });
  }

  static async lowStock(request: FastifyRequest, reply: FastifyReply) {
    const parts = await lowStockParts();
    return reply.send({ parts });
  }

  static async report(request: FastifyRequest, reply: FastifyReply) {
    const { days = '30' } = request.query as { days?: string };
    const window = Math.min(365, Math.max(1, parseInt(days, 10) || 30));

    const report = await inventoryReport(window);
    return reply.send(report);
  }
}
