import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { ensureReferralCode } from '../referrals/referrals.service';
import { notify } from '../messaging/messaging.service';

/**
 * طلبات الانضمام.
 *
 * الزائر الذي يصل من رمز إحالة صديقه لا يستطيع دخول البوابة: هي للعملاء
 * المسجّلين وحدهم، فكان الرمز يقوده إلى باب مقفل. هذه الطلبات تفتح الباب
 * دون أن تفتح سجل العملاء: يرسل الزائر بياناته، فتصل الاستقبال طلبًا
 * معلّقًا، ولا يصير عميلًا إلا باعتماد موظف.
 *
 * ولهذا لا يُربط كود الإحالة إلا عند الاعتماد: لو رُبط عند الإرسال لنسب
 * كل زائر نفسه لأي كود وحصد نقاطًا بلا زيارة.
 */

/** حد الطلبات من رقم واحد في الساعة، كي لا يُغرق أحد شاشة الاستقبال. */
const MAX_PER_HOUR = 3;

export interface JoinInput {
  fullName: string;
  mobileNumber: string;
  brand?: string | null;
  model?: string | null;
  plateNumber?: string | null;
  note?: string | null;
  referralCode?: string | null;
}

export async function submitJoinRequest(input: JoinInput) {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.joinRequest.count({
    where: { mobileNumber: input.mobileNumber, createdAt: { gte: since }, deletedAt: null },
  });
  if (recent >= MAX_PER_HOUR) {
    throw new AppError('وصلتنا طلباتك، سنتواصل معك قريبًا', 429);
  }

  // طلب معلّق قائم من نفس الرقم: يُحدَّث بدل أن يتكرر على شاشة الاستقبال.
  const pending = await prisma.joinRequest.findFirst({
    where: { mobileNumber: input.mobileNumber, status: 'PENDING', deletedAt: null },
  });

  const data = {
    fullName: input.fullName,
    mobileNumber: input.mobileNumber,
    brand: input.brand || null,
    model: input.model || null,
    plateNumber: input.plateNumber || null,
    note: input.note || null,
    referralCode: input.referralCode || null,
  };

  const request = pending
    ? await prisma.joinRequest.update({ where: { id: pending.id }, data })
    : await prisma.joinRequest.create({ data });

  // الاستقبال يرى الطلب فور وصوله دون أن يفتح الشاشة بحثًا عنه.
  try {
    await notify({
      role: 'RECEPTION',
      type: 'JOIN_REQUEST',
      titleAr: 'طلب انضمام جديد',
      titleEn: 'New join request',
      bodyAr: `${request.fullName} — ${request.mobileNumber}`,
      bodyEn: `${request.fullName} — ${request.mobileNumber}`,
      linkType: 'JOIN_REQUEST',
      linkId: request.id,
      dedupeKey: `join:${request.id}`,
    });
  } catch {
    // التنبيه تحسين لا شرط: الطلب محفوظ ويظهر في الشاشة على أي حال.
  }

  return request;
}

/**
 * يحوّل الطلب إلى عميل حقيقي.
 *
 * هنا — لا عند الإرسال — يُربط كود الإحالة، لأن الموظف هو من تحقّق من أن
 * صاحب الطلب شخص حقيقي يريد الخدمة.
 */
export async function approveJoinRequest(
  id: string,
  reviewerId: string | null,
  overrides: Partial<JoinInput> & { branchId?: string | null } = {},
) {
  const request = await prisma.joinRequest.findFirst({ where: { id, deletedAt: null } });
  if (!request) throw new AppError('الطلب غير موجود', 404);
  if (request.status !== 'PENDING') throw new AppError('الطلب تمت مراجعته بالفعل', 400);

  const mobileNumber = overrides.mobileNumber || request.mobileNumber;

  // رقم مسجّل بالفعل: لا يُنشأ عميل ثانٍ بنفس الرقم.
  const existing = await prisma.customer.findFirst({
    where: { mobileNumber, deletedAt: null },
  });
  if (existing) {
    throw new AppError(`الرقم ${mobileNumber} مسجّل بالفعل باسم ${existing.fullName}`, 409);
  }

  const customer = await prisma.customer.create({
    data: {
      fullName: overrides.fullName || request.fullName,
      mobileNumber,
      branchId: overrides.branchId || null,
      notes: request.note || null,
    },
  });

  const brand = overrides.brand ?? request.brand;
  const model = overrides.model ?? request.model;
  const plateNumber = overrides.plateNumber ?? request.plateNumber;

  if (brand && model && plateNumber) {
    await prisma.vehicle.create({
      data: { customerId: customer.id, brand, model, plateNumber, mileage: 0 },
    });
  }

  // الإحالة: الكود يخص عميلًا آخر، ولا يصح أن يحيل أحد نفسه.
  let referralLinked = false;
  if (request.referralCode) {
    const referrer = await prisma.customer.findFirst({
      where: { referralCode: request.referralCode, deletedAt: null },
    });
    if (referrer && referrer.id !== customer.id) {
      await ensureReferralCode(referrer.id);
      await prisma.referral.create({
        data: {
          code: request.referralCode,
          referrerId: referrer.id,
          referredId: customer.id,
          status: 'REGISTERED',
          registeredAt: new Date(),
          notes: 'من طلب انضمام عبر رابط الإحالة',
        },
      });
      referralLinked = true;
    }
  }

  const updated = await prisma.joinRequest.update({
    where: { id },
    data: {
      status: 'APPROVED',
      customerId: customer.id,
      reviewedAt: new Date(),
      reviewedById: reviewerId,
    },
  });

  return { request: updated, customer, referralLinked };
}

export async function rejectJoinRequest(id: string, reviewerId: string | null, reason?: string) {
  const request = await prisma.joinRequest.findFirst({ where: { id, deletedAt: null } });
  if (!request) throw new AppError('الطلب غير موجود', 404);
  if (request.status !== 'PENDING') throw new AppError('الطلب تمت مراجعته بالفعل', 400);

  return prisma.joinRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewedById: reviewerId,
      rejectReason: reason?.trim() || null,
    },
  });
}
