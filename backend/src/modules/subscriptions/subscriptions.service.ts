import { Prisma, Subscription } from '@prisma/client';
import { prisma } from '../../config/db';

/**
 * Shared subscription logic (M1), used by both the subscriptions module and
 * the job-card module so coverage behaves identically wherever it is applied.
 */

/** Adds whole months to a date, clamping the day when the target month is shorter. */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() < day) {
    // e.g. 31 Jan + 1 month would roll into March — pull it back to 28/29 Feb.
    result.setDate(0);
  }
  return result;
}

/**
 * Flips every ACTIVE subscription whose end date has passed to EXPIRED.
 * Called before any read that reports on status, so the data a user sees is
 * never stale, without needing a scheduled job.
 */
export async function expireOverdueSubscriptions(): Promise<number> {
  const result = await prisma.subscription.updateMany({
    where: { status: 'ACTIVE', deletedAt: null, endDate: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
  return result.count;
}

/** Builds the next subscription number in the form SUB-YYYYMMDD-XXXX. */
export async function generateSubscriptionNumber(): Promise<string> {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10).replace(/-/g, '');

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const countToday = await prisma.subscription.count({
    where: { createdAt: { gte: startOfToday } },
  });

  return `SUB-${todayStr}-${String(countToday + 1).padStart(4, '0')}`;
}

/**
 * The subscription that covers a given customer (and optionally a given
 * vehicle) right now. A subscription with no vehicle covers every vehicle the
 * customer owns; one tied to a vehicle covers only that vehicle.
 */
export async function findActiveSubscription(
  customerId: string,
  vehicleId?: string | null,
): Promise<(Subscription & { plan: { nameAr: string; nameEn: string } }) | null> {
  const now = new Date();

  const candidates = await prisma.subscription.findMany({
    where: {
      customerId,
      deletedAt: null,
      status: 'ACTIVE',
      startDate: { lte: now },
      endDate: { gte: now },
      ...(vehicleId ? { OR: [{ vehicleId: null }, { vehicleId }] } : {}),
    },
    include: { plan: { select: { nameAr: true, nameEn: true } } },
    orderBy: { endDate: 'desc' },
  });

  if (candidates.length === 0) return null;

  // Prefer one that still has a free visit left, then the vehicle-specific one.
  const withFreeVisit = candidates.find(s => s.freeVisitsUsed < s.freeVisitsTotal);
  if (withFreeVisit) return withFreeVisit;

  const vehicleBound = candidates.find(s => s.vehicleId === vehicleId);
  return vehicleBound || candidates[0];
}

export interface CoverageResult {
  subscriptionId: string;
  isFreeVisit: boolean;
  discountPercent: number;
}

/**
 * Applies a subscription to a freshly created job card: consumes a free visit
 * when one is left, otherwise records the plan discount. Runs inside the
 * caller's transaction so the counter and the card never drift apart.
 */
export async function applyCoverageToJobCard(
  tx: Prisma.TransactionClient,
  subscription: Subscription,
  jobCardId: string,
): Promise<CoverageResult> {
  const hasFreeVisit = subscription.freeVisitsUsed < subscription.freeVisitsTotal;
  const discountPercent = Number(subscription.discountPercent);

  if (hasFreeVisit) {
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { freeVisitsUsed: { increment: 1 } },
    });

    await tx.subscriptionUsage.create({
      data: {
        subscriptionId: subscription.id,
        jobCardId,
        type: 'FREE_VISIT',
        note: 'خصم زيارة مجانية من رصيد الاشتراك',
      },
    });

    await tx.jobCard.update({
      where: { id: jobCardId },
      data: { subscriptionId: subscription.id, isFreeVisit: true, subscriptionDiscount: null },
    });

    return { subscriptionId: subscription.id, isFreeVisit: true, discountPercent: 0 };
  }

  if (discountPercent > 0) {
    await tx.subscriptionUsage.create({
      data: {
        subscriptionId: subscription.id,
        jobCardId,
        type: 'DISCOUNT',
        discountPercent: subscription.discountPercent,
        note: `خصم اشتراك بنسبة ${discountPercent}%`,
      },
    });
  }

  await tx.jobCard.update({
    where: { id: jobCardId },
    data: {
      subscriptionId: subscription.id,
      isFreeVisit: false,
      subscriptionDiscount: discountPercent > 0 ? subscription.discountPercent : null,
    },
  });

  return { subscriptionId: subscription.id, isFreeVisit: false, discountPercent };
}

/** Days left on a subscription; negative once it has ended. */
export function daysRemaining(endDate: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return Math.ceil((end.getTime() - Date.now()) / MS_PER_DAY);
}
