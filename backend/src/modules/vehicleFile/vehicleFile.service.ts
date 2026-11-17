import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';

/**
 * M3 — the vehicle lifetime file.
 *
 * Everything here is assembled from what the system itself recorded from the
 * day it went live; historical data from before that is the workshop's own to
 * enter, as stated in the scope document.
 */

export interface TimelineEntry {
  id: string;
  kind: 'JOB_CARD' | 'PART' | 'DOCUMENT' | 'MILEAGE';
  date: Date;
  title: string;
  detail?: string | null;
  amount?: number | null;
  mileage?: number | null;
  reference?: string | null;
}

/** Warranty state of a replaced part on a given day. */
export function warrantyState(warrantyUntil: Date | null): 'NONE' | 'ACTIVE' | 'EXPIRED' {
  if (!warrantyUntil) return 'NONE';
  return new Date(warrantyUntil) >= new Date() ? 'ACTIVE' : 'EXPIRED';
}

/** Days until a document expires; negative once it has lapsed. */
export function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const target = new Date(date);
  target.setHours(23, 59, 59, 999);
  return Math.ceil((target.getTime() - Date.now()) / MS_PER_DAY);
}

/** The total a job card is worth: estimated cost plus any additional services. */
export function jobCardTotal(jobCard: { estimatedCost: any; additionalServices: string | null }): number {
  const base = jobCard.estimatedCost ? Number(jobCard.estimatedCost) : 0;

  let extras = 0;
  if (jobCard.additionalServices) {
    try {
      const parsed = JSON.parse(jobCard.additionalServices);
      if (Array.isArray(parsed)) {
        extras = parsed.reduce((sum: number, s: any) => sum + (Number(s?.price) || 0), 0);
      }
    } catch {
      // Free-text services carry no price — nothing to add.
    }
  }

  return base + extras;
}

/**
 * Builds the whole file for one vehicle: timeline, mileage history, cumulative
 * costs by year, replaced parts, documents and the photo archive.
 */
export async function buildVehicleFile(vehicleId: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, deletedAt: null },
    include: {
      customer: { select: { id: true, fullName: true, mobileNumber: true } },
      vehicleModel: {
        select: {
          id: true,
          nameAr: true,
          nameEn: true,
          brand: { select: { nameAr: true, nameEn: true } },
        },
      },
    },
  });
  if (!vehicle) throw new AppError('السيارة غير موجودة', 404);

  const [jobCards, replacements, documents, mileageLogs, subscription] = await Promise.all([
    prisma.jobCard.findMany({
      where: { vehicleId, deletedAt: null },
      include: {
        photos: true,
        subscription: { select: { subscriptionNumber: true } },
      },
      orderBy: { entryDate: 'asc' },
    }),
    prisma.vehiclePartReplacement.findMany({
      where: { vehicleId, deletedAt: null },
      include: { jobCard: { select: { id: true, jobNumber: true } } },
      orderBy: { replacedAt: 'desc' },
    }),
    prisma.vehicleDocument.findMany({
      where: { vehicleId, deletedAt: null },
      orderBy: [{ expiryDate: 'asc' }],
    }),
    prisma.vehicleMileageLog.findMany({
      where: { vehicleId },
      orderBy: { recordedAt: 'asc' },
    }),
    prisma.subscription.findFirst({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        customerId: vehicle.customerId,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
        OR: [{ vehicleId: null }, { vehicleId }],
      },
      include: { plan: { select: { nameAr: true, nameEn: true } } },
      orderBy: { endDate: 'desc' },
    }),
  ]);

  // ---- Timeline -----------------------------------------------------------
  const timeline: TimelineEntry[] = [];

  for (const jc of jobCards) {
    timeline.push({
      id: jc.id,
      kind: 'JOB_CARD',
      date: jc.entryDate,
      title: jc.jobNumber,
      detail: jc.customerComplaint,
      amount: jobCardTotal(jc),
      reference: jc.status,
    });
  }

  for (const r of replacements) {
    timeline.push({
      id: r.id,
      kind: 'PART',
      date: r.replacedAt,
      title: r.partName,
      detail: r.partNumber,
      amount: Number(r.unitPrice) * r.quantity,
      mileage: r.mileageAtReplacement,
      reference: r.jobCard?.jobNumber || null,
    });
  }

  for (const d of documents) {
    if (!d.issueDate) continue;
    timeline.push({
      id: d.id,
      kind: 'DOCUMENT',
      date: d.issueDate,
      title: d.title || d.type,
      detail: d.documentNumber,
      reference: d.type,
    });
  }

  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ---- Costs by year ------------------------------------------------------
  const costsByYear = new Map<number, { jobCards: number; parts: number }>();

  const bucket = (year: number) => {
    if (!costsByYear.has(year)) costsByYear.set(year, { jobCards: 0, parts: 0 });
    return costsByYear.get(year)!;
  };

  for (const jc of jobCards) {
    bucket(new Date(jc.entryDate).getFullYear()).jobCards += jobCardTotal(jc);
  }
  for (const r of replacements) {
    bucket(new Date(r.replacedAt).getFullYear()).parts += Number(r.unitPrice) * r.quantity;
  }

  const years = [...costsByYear.keys()].sort((a, b) => a - b);
  let running = 0;
  const costs = years.map(year => {
    const row = costsByYear.get(year)!;
    const total = row.jobCards + row.parts;
    running += total;
    return { year, jobCards: row.jobCards, parts: row.parts, total, cumulative: running };
  });

  // ---- Mileage ------------------------------------------------------------
  const mileageSeries = mileageLogs.map(m => ({
    date: m.recordedAt,
    mileage: m.mileage,
    source: m.source,
  }));

  // Average km per month across the recorded range — the usage rate chart.
  let averagePerMonth: number | null = null;
  if (mileageSeries.length >= 2) {
    const first = mileageSeries[0];
    const last = mileageSeries[mileageSeries.length - 1];
    const months =
      (new Date(last.date).getTime() - new Date(first.date).getTime()) / (30 * 24 * 60 * 60 * 1000);
    if (months > 0.1) {
      averagePerMonth = Math.round((last.mileage - first.mileage) / months);
    }
  }

  // ---- Photo archive, newest first ---------------------------------------
  const photos = jobCards
    .flatMap(jc =>
      jc.photos.map(p => ({
        id: p.id,
        filePath: p.filePath,
        uploadedAt: p.uploadedAt,
        jobNumber: jc.jobNumber,
      })),
    )
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  const totalSpent = costs.reduce((sum, c) => sum + c.total, 0);

  return {
    vehicle: {
      id: vehicle.id,
      brand: vehicle.brand,
      model: vehicle.model,
      plateNumber: vehicle.plateNumber,
      mileage: vehicle.mileage,
      createdAt: vehicle.createdAt,
      shareToken: vehicle.shareToken,
      customer: vehicle.customer,
      catalogModel: vehicle.vehicleModel,
    },
    subscription: subscription
      ? {
          subscriptionNumber: subscription.subscriptionNumber,
          plan: subscription.plan,
          endDate: subscription.endDate,
          freeVisitsRemaining: Math.max(
            0,
            subscription.freeVisitsTotal - subscription.freeVisitsUsed,
          ),
        }
      : null,
    summary: {
      visits: jobCards.length,
      firstVisit: jobCards[0]?.entryDate || null,
      lastVisit: jobCards[jobCards.length - 1]?.entryDate || null,
      totalSpent,
      partsReplaced: replacements.reduce((sum, r) => sum + r.quantity, 0),
      currentMileage: vehicle.mileage,
      averageKmPerMonth: averagePerMonth,
      photoCount: photos.length,
    },
    timeline,
    costs,
    mileageSeries,
    replacements: replacements.map(r => ({
      ...r,
      total: Number(r.unitPrice) * r.quantity,
      warranty: warrantyState(r.warrantyUntil),
      warrantyDaysLeft: daysUntil(r.warrantyUntil),
    })),
    documents: documents.map(d => ({
      ...d,
      daysUntilExpiry: daysUntil(d.expiryDate),
    })),
    photos,
    jobCards: jobCards.map(jc => ({
      id: jc.id,
      jobNumber: jc.jobNumber,
      entryDate: jc.entryDate,
      status: jc.status,
      customerComplaint: jc.customerComplaint,
      requiredRepairs: jc.requiredRepairs,
      total: jobCardTotal(jc),
      isFreeVisit: jc.isFreeVisit,
      subscriptionNumber: jc.subscription?.subscriptionNumber || null,
    })),
  };
}
