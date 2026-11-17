import { InspectionRating } from '@prisma/client';
import { prisma } from '../../config/db';

/**
 * M2 — the monthly technical report.
 *
 * The technician fills a structured checklist on the job card; the system
 * turns the ratings into a health score, works out when the next service is
 * due, and gathers everything for the month into one report per vehicle.
 */

/** How much each rating is worth when scoring the vehicle out of 100. */
const RATING_WEIGHT: Record<string, number> = {
  OK: 100,
  NEEDS_ATTENTION: 55,
  CRITICAL: 0,
};

/** Service intervals used when nothing more specific is known. */
export const SERVICE_INTERVAL_KM = 10_000;
export const SERVICE_INTERVAL_MONTHS = 6;

/** Ceilings that stop an average from hiding a serious fault. */
const CRITICAL_CEILING = 49; // lands in POOR
const ATTENTION_CEILING = 79; // lands in FAIR

/**
 * The overall health of the vehicle, 0–100. Items that were not checked are
 * left out so a half-filled form does not read as a failing car.
 *
 * A plain average would let one critical fault hide behind many good items —
 * nineteen fine checks and one failed brake would still read "good". So the
 * score is capped by the worst finding: this number is what the customer sees.
 */
export function calculateHealthScore(
  results: Array<{ rating: InspectionRating }>,
): number {
  const scored = results.filter(r => r.rating !== 'NOT_CHECKED');
  if (scored.length === 0) return 0;

  const total = scored.reduce((sum, r) => sum + (RATING_WEIGHT[r.rating] ?? 0), 0);
  const average = Math.round(total / scored.length);

  if (scored.some(r => r.rating === 'CRITICAL')) return Math.min(average, CRITICAL_CEILING);
  if (scored.some(r => r.rating === 'NEEDS_ATTENTION')) return Math.min(average, ATTENTION_CEILING);

  return average;
}

/** A plain-language band for the score, for the report header. */
export function healthBand(score: number): 'GOOD' | 'FAIR' | 'POOR' {
  if (score >= 80) return 'GOOD';
  if (score >= 55) return 'FAIR';
  return 'POOR';
}

/** When the next service falls due, from the reading taken at this visit. */
export function nextServiceFrom(mileage: number | null | undefined, from: Date) {
  const date = new Date(from.getTime());
  date.setMonth(date.getMonth() + SERVICE_INTERVAL_MONTHS);

  return {
    nextServiceMileage: mileage != null ? mileage + SERVICE_INTERVAL_KM : null,
    nextServiceDate: date,
  };
}

/**
 * Turns the findings into recommendations a customer can read, worst first.
 * Deliberately avoids workshop jargon — that is the point of the module.
 */
export function buildRecommendations(
  results: Array<{ rating: InspectionRating; note: string | null; item: { nameAr: string; nameEn: string } }>,
): { ar: string; en: string } {
  const critical = results.filter(r => r.rating === 'CRITICAL');
  const attention = results.filter(r => r.rating === 'NEEDS_ATTENTION');

  const ar: string[] = [];
  const en: string[] = [];

  for (const r of critical) {
    ar.push(`• ${r.item.nameAr}: يحتاج إصلاحًا فوريًا${r.note ? ` — ${r.note}` : ''}.`);
    en.push(`• ${r.item.nameEn}: needs immediate attention${r.note ? ` — ${r.note}` : ''}.`);
  }

  for (const r of attention) {
    ar.push(`• ${r.item.nameAr}: لا يحتاج إصلاحًا الآن، لكن ننصح بمتابعته في الزيارة القادمة${r.note ? ` — ${r.note}` : ''}.`);
    en.push(`• ${r.item.nameEn}: no repair needed now, but worth checking next visit${r.note ? ` — ${r.note}` : ''}.`);
  }

  if (ar.length === 0) {
    ar.push('• جميع البنود التي تم فحصها سليمة، ولا توجد ملاحظات تستدعي الإصلاح حاليًا.');
    en.push('• Everything we checked is in good order; nothing needs repair at the moment.');
  }

  return { ar: ar.join('\n'), en: en.join('\n') };
}

/** The total a job card is worth: estimated cost plus any additional services. */
function jobCardTotal(jobCard: { estimatedCost: any; additionalServices: string | null }): number {
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

  return base + extras;
}

export interface GenerateResult {
  created: boolean;
  reportId: string;
  visits: number;
}

/**
 * Builds (or rebuilds) one vehicle's report for one month from what the system
 * recorded: visits, costs, odometer movement, parts, and the latest inspection.
 */
export async function generateMonthlyReport(
  vehicleId: string,
  year: number,
  month: number,
): Promise<GenerateResult | null> {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, deletedAt: null },
    select: { id: true, customerId: true },
  });
  if (!vehicle) return null;

  const [jobCards, replacements, mileageLogs, inspection] = await Promise.all([
    prisma.jobCard.findMany({
      where: { vehicleId, deletedAt: null, entryDate: { gte: start, lt: end } },
      select: { id: true, estimatedCost: true, additionalServices: true },
    }),
    prisma.vehiclePartReplacement.findMany({
      where: { vehicleId, deletedAt: null, replacedAt: { gte: start, lt: end } },
      select: { quantity: true, unitPrice: true },
    }),
    prisma.vehicleMileageLog.findMany({
      where: { vehicleId, recordedAt: { gte: start, lt: end } },
      orderBy: { recordedAt: 'asc' },
      select: { mileage: true },
    }),
    prisma.inspection.findFirst({
      where: {
        vehicleId,
        deletedAt: null,
        completedAt: { not: null, gte: start, lt: end },
      },
      include: { results: { include: { item: true } } },
      orderBy: { completedAt: 'desc' },
    }),
  ]);

  const totalCost =
    jobCards.reduce((sum, jc) => sum + jobCardTotal(jc), 0) +
    replacements.reduce((sum, r) => sum + Number(r.unitPrice) * r.quantity, 0);

  const recommendations = inspection
    ? buildRecommendations(inspection.results)
    : {
        ar: '• لم يُجرَ فحص فني لهذه السيارة خلال هذا الشهر. ننصح بزيارة دورية للاطمئنان عليها.',
        en: '• No technical inspection was carried out this month. A routine visit is recommended.',
      };

  const findings = inspection
    ? JSON.stringify(
        inspection.results
          .filter(r => r.rating !== 'NOT_CHECKED')
          .map(r => ({
            nameAr: r.item.nameAr,
            nameEn: r.item.nameEn,
            rating: r.rating,
            note: r.note,
          })),
      )
    : null;

  const data = {
    vehicleId,
    customerId: vehicle.customerId,
    year,
    month,
    visits: jobCards.length,
    totalCost,
    partsReplaced: replacements.reduce((sum, r) => sum + r.quantity, 0),
    startMileage: mileageLogs[0]?.mileage ?? null,
    endMileage: mileageLogs[mileageLogs.length - 1]?.mileage ?? null,
    healthScore: inspection?.healthScore ?? null,
    recommendationsAr: recommendations.ar,
    recommendationsEn: recommendations.en,
    findings,
    generatedAt: new Date(),
  };

  const existing = await prisma.monthlyReport.findFirst({
    where: { vehicleId, year, month, deletedAt: null },
  });

  if (existing) {
    // Regenerating refreshes the numbers but keeps whether it was already sent.
    const report = await prisma.monthlyReport.update({ where: { id: existing.id }, data });
    return { created: false, reportId: report.id, visits: data.visits };
  }

  const report = await prisma.monthlyReport.create({ data });
  return { created: true, reportId: report.id, visits: data.visits };
}

/**
 * Generates the month's reports for every subscribed customer's vehicles —
 * the automatic monthly run the scope calls for.
 */
export async function generateMonthForSubscribers(year: number, month: number) {
  const subscriptions = await prisma.subscription.findMany({
    where: { deletedAt: null, status: 'ACTIVE' },
    select: { customerId: true, vehicleId: true },
  });

  const vehicleIds = new Set<string>();

  for (const sub of subscriptions) {
    if (sub.vehicleId) {
      vehicleIds.add(sub.vehicleId);
      continue;
    }
    // A subscription with no vehicle covers every vehicle the customer owns.
    const vehicles = await prisma.vehicle.findMany({
      where: { customerId: sub.customerId, deletedAt: null },
      select: { id: true },
    });
    vehicles.forEach(v => vehicleIds.add(v.id));
  }

  let created = 0;
  let updated = 0;

  for (const vehicleId of vehicleIds) {
    const result = await generateMonthlyReport(vehicleId, year, month);
    if (!result) continue;
    if (result.created) created++;
    else updated++;
  }

  return { vehicles: vehicleIds.size, created, updated };
}
