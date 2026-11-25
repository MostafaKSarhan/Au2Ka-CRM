import { Prisma, CustomerTier, PointsEntryType } from '@prisma/client';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';

/**
 * M5 — referrals, points and customer tiers.
 *
 * The scope allows one adjustable reward rule, held in a single settings row.
 * Simultaneous campaigns and compound rules are explicitly out of scope.
 */

const SETTINGS_ID = 'default';

/** The workshop's reward rule, created with sensible defaults on first use. */
export async function getSettings() {
  const existing = await prisma.referralSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;

  return prisma.referralSettings.create({ data: { id: SETTINGS_ID } });
}

/**
 * A short, unambiguous referral code. Letters that are easily mistaken for
 * digits (I, O) are left out so a customer can read one out over the phone.
 */
function randomCode(length = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/** The customer's referral code, generated the first time it is asked for. */
export async function ensureReferralCode(customerId: string): Promise<string> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, deletedAt: null },
    select: { id: true, referralCode: true },
  });
  if (!customer) throw new AppError('العميل غير موجود', 404);
  if (customer.referralCode) return customer.referralCode;

  // Retry on the rare collision rather than failing the request.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const taken = await prisma.customer.findUnique({ where: { referralCode: code } });
    if (taken) continue;

    await prisma.customer.update({ where: { id: customerId }, data: { referralCode: code } });
    return code;
  }

  throw new AppError('تعذّر توليد كود إحالة — حاول مرة أخرى', 500);
}

/** Moves a customer's points and writes the ledger entry in one transaction. */
export async function addPoints(
  tx: Prisma.TransactionClient,
  options: {
    customerId: string;
    points: number;
    type: PointsEntryType;
    reasonAr: string;
    reasonEn: string;
    referralId?: string | null;
    jobCardId?: string | null;
    createdById?: string | null;
  },
) {
  const customer = await tx.customer.findUnique({
    where: { id: options.customerId },
    select: { pointsBalance: true },
  });
  if (!customer) throw new AppError('العميل غير موجود', 404);

  const balanceAfter = customer.pointsBalance + options.points;
  if (balanceAfter < 0) throw new AppError('رصيد النقاط لا يكفي', 400);

  await tx.customer.update({
    where: { id: options.customerId },
    data: { pointsBalance: balanceAfter },
  });

  return tx.pointsEntry.create({
    data: {
      customerId: options.customerId,
      type: options.type,
      points: options.points,
      balanceAfter,
      reasonAr: options.reasonAr,
      reasonEn: options.reasonEn,
      referralId: options.referralId || null,
      jobCardId: options.jobCardId || null,
      createdById: options.createdById || null,
    },
  });
}

/**
 * Which tier a figure falls into, given the thresholds.
 *
 * The tier is a rating the workshop gives the customer, not something the
 * customer buys: it is reached by spending, and the ladder has four rungs so
 * a new customer can see a next step rather than one distant jump.
 */
export function tierFor(
  value: number,
  silver: number,
  gold: number,
  platinum: number,
): CustomerTier {
  if (value >= platinum) return 'PLATINUM';
  if (value >= gold) return 'GOLD';
  if (value >= silver) return 'SILVER';
  return 'REGULAR';
}

/**
 * Recalculates one customer's tier from whichever basis the workshop chose:
 * what they have spent, or the plan they subscribe to.
 */
export async function refreshTier(customerId: string): Promise<CustomerTier> {
  const settings = await getSettings();

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, deletedAt: null },
    select: { id: true, lifetimeSpend: true, tier: true },
  });
  if (!customer) throw new AppError('العميل غير موجود', 404);

  let tier: CustomerTier;

  if (settings.tierBasis === 'SUBSCRIPTION') {
    const subscription = await prisma.subscription.findFirst({
      where: {
        customerId,
        deletedAt: null,
        status: 'ACTIVE',
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
      include: { plan: { select: { price: true } } },
      orderBy: { endDate: 'desc' },
    });

    tier = subscription
      ? tierFor(
          Number(subscription.plan.price),
          Number(settings.silverThreshold),
          Number(settings.goldThreshold),
          Number(settings.platinumThreshold),
        )
      : 'REGULAR';
  } else {
    tier = tierFor(
      Number(customer.lifetimeSpend),
      Number(settings.silverThreshold),
      Number(settings.goldThreshold),
      Number(settings.platinumThreshold),
    );
  }

  if (tier !== customer.tier) {
    await prisma.customer.update({ where: { id: customerId }, data: { tier } });
  }

  return tier;
}

/**
 * Records what a customer spent on a delivered job card: it feeds their
 * lifetime total, may earn points, and can move them up a tier.
 */
export async function recordSpend(customerId: string, amount: number, jobCardId: string) {
  if (!(amount > 0)) return null;

  const settings = await getSettings();

  await prisma.customer.update({
    where: { id: customerId },
    data: { lifetimeSpend: { increment: amount } },
  });

  const perRiyal = Number(settings.pointsPerRiyal);
  if (settings.isActive && perRiyal > 0) {
    const earned = Math.floor(amount * perRiyal);
    if (earned > 0) {
      await prisma.$transaction(tx =>
        addPoints(tx, {
          customerId,
          points: earned,
          type: 'EARNED_SPEND',
          reasonAr: `نقاط على إنفاق ${Math.round(amount)} ريال`,
          reasonEn: `Points earned on ${Math.round(amount)} SAR spend`,
          jobCardId,
        }),
      );
    }
  }

  return refreshTier(customerId);
}

/**
 * Completes a referral once the referred customer's first job card is opened,
 * paying both sides according to the rule. Runs at most once per referral.
 */
export async function completeReferralOnFirstVisit(customerId: string, jobCardId: string) {
  const settings = await getSettings();
  if (!settings.isActive) return null;

  const referral = await prisma.referral.findFirst({
    where: { referredId: customerId, deletedAt: null, status: { in: ['PENDING', 'REGISTERED'] } },
    include: {
      referrer: { select: { id: true, fullName: true } },
      referred: { select: { id: true, fullName: true } },
    },
  });
  if (!referral) return null;

  const referrerPoints = settings.rewardType === 'POINTS' ? settings.referrerPoints : 0;
  const referredPoints = settings.rewardType === 'POINTS' ? settings.referredPoints : 0;

  await prisma.$transaction(async tx => {
    if (referrerPoints > 0) {
      await addPoints(tx, {
        customerId: referral.referrerId,
        points: referrerPoints,
        type: 'EARNED_REFERRAL',
        reasonAr: `مكافأة إحالة ${referral.referred?.fullName ?? ''}`.trim(),
        reasonEn: `Referral reward for ${referral.referred?.fullName ?? ''}`.trim(),
        referralId: referral.id,
        jobCardId,
      });
    }

    if (referredPoints > 0) {
      await addPoints(tx, {
        customerId,
        points: referredPoints,
        type: 'EARNED_REFERRAL',
        reasonAr: `مكافأة ترحيب بإحالة من ${referral.referrer.fullName}`,
        reasonEn: `Welcome reward, referred by ${referral.referrer.fullName}`,
        referralId: referral.id,
        jobCardId,
      });
    }

    await tx.referral.update({
      where: { id: referral.id },
      data: {
        status: 'COMPLETED',
        firstVisitAt: new Date(),
        jobCardId,
        rewardedAt: new Date(),
        referrerReward: referrerPoints,
        referredReward: referredPoints,
      },
    });
  });

  return { referralId: referral.id, referrerPoints, referredPoints };
}

/** What a points balance is worth on an invoice, in riyals. */
export async function pointsToRiyals(points: number): Promise<number> {
  const settings = await getSettings();
  return Math.round(points * Number(settings.pointValue) * 100) / 100;
}
