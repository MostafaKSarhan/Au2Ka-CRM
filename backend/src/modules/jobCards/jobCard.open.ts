import { prisma } from '../../config/db';
import {
  applyCoverageToJobCard,
  expireOverdueSubscriptions,
  findActiveSubscription,
} from '../subscriptions/subscriptions.service';
import { completeReferralOnFirstVisit } from '../referrals/referrals.service';

/**
 * Everything that must happen the moment a job card is opened, whichever door
 * it came through: the reception desk, or a scheduled appointment the front
 * office turned into a card.
 *
 * It lives here because the appointment route used to create the card on its
 * own and skip both steps, so a subscriber who booked ahead lost the free
 * visit their plan had already been paid for, and a referral stayed pending
 * for ever — neither side ever got its reward.
 *
 * Neither step may stop the card from opening: the car is already in the
 * workshop. A failure comes back as a note on the card instead, so the
 * front office can see that it needs a second look.
 */
export async function applyJobCardOpening(input: {
  jobCardId: string;
  customerId: string;
  vehicleId: string;
  onError?: (err: unknown, what: string) => void;
}): Promise<{ coverageNote: string; referralNote: string }> {
  let coverageNote = '';
  let referralNote = '';

  // M1 — subscription coverage: a free visit is consumed if the customer
  // still has one, otherwise the plan discount is recorded on the card.
  try {
    await expireOverdueSubscriptions();
    const subscription = await findActiveSubscription(input.customerId, input.vehicleId);

    if (subscription) {
      const coverage = await prisma.$transaction(tx =>
        applyCoverageToJobCard(tx, subscription, input.jobCardId),
      );

      coverageNote = coverage.isFreeVisit
        ? ` — تم خصم زيارة مجانية من اشتراك ${subscription.subscriptionNumber}`
        : coverage.discountPercent > 0
          ? ` — تم تطبيق خصم اشتراك ${coverage.discountPercent}%`
          : ` — العميل مشترك (${subscription.subscriptionNumber}) بدون رصيد زيارات متبقٍ`;
    }
  } catch (err) {
    input.onError?.(err, 'failed to apply subscription coverage');
    coverageNote = ' — تعذّر تطبيق تغطية الاشتراك، يرجى المراجعة';
  }

  // M5 — a referred customer's first visit is what earns both sides their
  // reward.
  try {
    const referral = await completeReferralOnFirstVisit(input.customerId, input.jobCardId);
    if (referral) {
      referralNote = ` — تم احتساب مكافأة الإحالة (${referral.referrerPoints} نقطة للمُحيل)`;
    }
  } catch (err) {
    input.onError?.(err, 'failed to complete referral on first visit');
  }

  return { coverageNote, referralNote };
}

/**
 * What the customer actually owes on a delivered card: the estimate, the
 * priced extra services, and the spare parts fitted from stock.
 *
 * The parts have to be in here. Without them a card whose whole cost was the
 * parts issued to it recorded a spend of zero, so the customer earned no
 * loyalty points and never moved up a tier, while the ZATCA invoice for that
 * same card billed them for every part in full.
 */
export async function jobCardWorth(jobCard: {
  id: string;
  estimatedCost: any;
  additionalServices: string | null;
}): Promise<number> {
  const base = jobCard.estimatedCost ? Number(jobCard.estimatedCost) : 0;

  let extras = 0;
  if (jobCard.additionalServices) {
    try {
      const parsed = JSON.parse(jobCard.additionalServices);
      if (Array.isArray(parsed)) {
        extras = parsed.reduce((sum: number, s: any) => sum + (Number(s?.price) || 0), 0);
      }
    } catch {
      // Free-text services carry no price.
    }
  }

  const replacements = await prisma.vehiclePartReplacement.findMany({
    where: { jobCardId: jobCard.id, deletedAt: null },
    select: { unitPrice: true, quantity: true },
  });
  const parts = replacements.reduce((sum, r) => sum + Number(r.unitPrice) * r.quantity, 0);

  return Math.round((base + extras + parts) * 100) / 100;
}
