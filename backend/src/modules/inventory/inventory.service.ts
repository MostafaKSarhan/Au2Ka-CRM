import { Prisma, StockMovementType } from '@prisma/client';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';

/**
 * M10 — inventory and spare parts.
 *
 * One warehouse. Purchase orders, supplier accounts and multiple warehouses
 * are explicitly out of scope, so stock moves in three ways only: an intake,
 * an issue to a repair, and a correction after a stock count.
 */

export interface MoveOptions {
  partId: string;
  type: StockMovementType;
  /** Always the signed change: +10 for an intake, -2 for an issue. */
  quantity: number;
  unitPrice?: number | null;
  jobCardId?: string | null;
  reference?: string | null;
  reasonAr: string;
  reasonEn: string;
  createdById?: string | null;
  /** Lets a repair be recorded even when the shelf shows less than it should. */
  allowNegative?: boolean;
}

/**
 * Moves stock and writes the ledger entry together, so the balance on the part
 * and the history behind it can never disagree.
 */
export async function moveStock(tx: Prisma.TransactionClient, options: MoveOptions) {
  if (options.quantity === 0) throw new AppError('الكمية لا يمكن أن تكون صفرًا', 400);

  const part = await tx.part.findFirst({
    where: { id: options.partId, deletedAt: null },
    select: { id: true, nameAr: true, quantity: true, reorderLevel: true },
  });
  if (!part) throw new AppError('القطعة غير موجودة', 404);

  const balanceAfter = part.quantity + options.quantity;
  if (balanceAfter < 0 && !options.allowNegative) {
    throw new AppError(
      `الرصيد المتاح من «${part.nameAr}» هو ${part.quantity} فقط`,
      400,
    );
  }

  await tx.part.update({ where: { id: part.id }, data: { quantity: balanceAfter } });

  const movement = await tx.stockMovement.create({
    data: {
      partId: part.id,
      type: options.type,
      quantity: options.quantity,
      balanceAfter,
      unitPrice: options.unitPrice ?? null,
      jobCardId: options.jobCardId || null,
      reference: options.reference || null,
      reasonAr: options.reasonAr,
      reasonEn: options.reasonEn,
      createdById: options.createdById || null,
    },
  });

  return {
    movement,
    balanceAfter,
    /** True when this move took the part to or below its reorder level. */
    hitReorderLevel: balanceAfter <= part.reorderLevel && part.quantity > part.reorderLevel,
    partName: part.nameAr,
  };
}

/**
 * Issues a part to a repair: stock goes down and the part is written into the
 * vehicle's file in the same transaction, so the two never drift apart.
 */
export async function issueToJobCard(options: {
  partId: string;
  jobCardId: string;
  quantity: number;
  unitPrice?: number | null;
  warrantyMonths?: number | null;
  createdById?: string | null;
  allowNegative?: boolean;
}) {
  const jobCard = await prisma.jobCard.findFirst({
    where: { id: options.jobCardId, deletedAt: null },
    select: { id: true, jobNumber: true, vehicleId: true, vehicle: { select: { mileage: true } } },
  });
  if (!jobCard) throw new AppError('كرت العمل غير موجود', 404);

  const part = await prisma.part.findFirst({
    where: { id: options.partId, deletedAt: null },
  });
  if (!part) throw new AppError('القطعة غير موجودة', 404);

  const unitPrice = options.unitPrice ?? Number(part.sellPrice);
  const replacedAt = new Date();

  const warrantyUntil = options.warrantyMonths
    ? (() => {
        const until = new Date(replacedAt.getTime());
        const day = until.getDate();
        until.setMonth(until.getMonth() + options.warrantyMonths!);
        if (until.getDate() < day) until.setDate(0);
        return until;
      })()
    : null;

  return prisma.$transaction(async tx => {
    const result = await moveStock(tx, {
      partId: options.partId,
      type: 'OUT',
      quantity: -Math.abs(options.quantity),
      unitPrice,
      jobCardId: options.jobCardId,
      reasonAr: `صرف على كرت العمل ${jobCard.jobNumber}`,
      reasonEn: `Issued to job card ${jobCard.jobNumber}`,
      createdById: options.createdById,
      allowNegative: options.allowNegative,
    });

    // M3 — the same issue becomes a line in the vehicle's lifetime file.
    const replacement = await tx.vehiclePartReplacement.create({
      data: {
        vehicleId: jobCard.vehicleId,
        jobCardId: jobCard.id,
        partId: part.id,
        partName: part.nameAr,
        partNumber: part.partNumber,
        quantity: Math.abs(options.quantity),
        unitPrice,
        mileageAtReplacement: jobCard.vehicle?.mileage ?? null,
        replacedAt,
        warrantyMonths: options.warrantyMonths ?? null,
        warrantyUntil,
      },
    });

    return { ...result, replacement, jobNumber: jobCard.jobNumber };
  });
}

/** Parts at or below their reorder level — what needs ordering. */
export async function lowStockParts(limit = 100) {
  // Prisma cannot compare two columns in a filter, so the shortlist is
  // narrowed in SQL terms as far as it can be and finished here.
  const parts = await prisma.part.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: { quantity: 'asc' },
    take: 500,
  });

  return parts
    .filter(p => p.quantity <= p.reorderLevel)
    .slice(0, limit)
    .map(p => ({
      ...p,
      shortfall: Math.max(0, p.reorderLevel - p.quantity),
    }));
}

/** What the warehouse is worth, and how it is moving. */
export async function inventoryReport(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [parts, movements] = await Promise.all([
    prisma.part.findMany({
      where: { deletedAt: null },
      select: { id: true, nameAr: true, nameEn: true, quantity: true, reorderLevel: true, purchasePrice: true, sellPrice: true, category: true },
    }),
    prisma.stockMovement.findMany({
      where: { createdAt: { gte: since } },
      select: { partId: true, type: true, quantity: true },
    }),
  ]);

  const purchaseValue = parts.reduce((sum, p) => sum + p.quantity * Number(p.purchasePrice), 0);
  const sellValue = parts.reduce((sum, p) => sum + p.quantity * Number(p.sellPrice), 0);

  const issuedByPart = new Map<string, number>();
  for (const m of movements) {
    if (m.type !== 'OUT') continue;
    issuedByPart.set(m.partId, (issuedByPart.get(m.partId) || 0) + Math.abs(m.quantity));
  }

  const withUsage = parts.map(p => ({
    id: p.id,
    nameAr: p.nameAr,
    nameEn: p.nameEn,
    category: p.category,
    quantity: p.quantity,
    issued: issuedByPart.get(p.id) || 0,
  }));

  const mostUsed = [...withUsage].sort((a, b) => b.issued - a.issued).filter(p => p.issued > 0).slice(0, 10);
  // Stock sitting on the shelf with nothing issued in the window.
  const stagnant = withUsage.filter(p => p.issued === 0 && p.quantity > 0).slice(0, 10);

  return {
    days,
    totals: {
      parts: parts.length,
      units: parts.reduce((sum, p) => sum + p.quantity, 0),
      purchaseValue: Math.round(purchaseValue * 100) / 100,
      sellValue: Math.round(sellValue * 100) / 100,
      expectedProfit: Math.round((sellValue - purchaseValue) * 100) / 100,
    },
    lowStock: parts.filter(p => p.quantity <= p.reorderLevel).length,
    mostUsed,
    stagnant,
  };
}
