import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { approveJoinRequest, rejectJoinRequest, submitJoinRequest } from './joinRequests.service';

const submitSchema = z.object({
  fullName: z.string().trim().min(3, 'الاسم مطلوب'),
  mobileNumber: z
    .string()
    .trim()
    .regex(/^05\d{8}$/, 'رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام'),
  brand: z.string().trim().optional().nullable(),
  model: z.string().trim().optional().nullable(),
  plateNumber: z.string().trim().optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  referralCode: z.string().trim().max(32).optional().nullable(),
});

const approveSchema = z.object({
  fullName: z.string().trim().min(3).optional(),
  mobileNumber: z.string().trim().regex(/^05\d{8}$/).optional(),
  brand: z.string().trim().optional().nullable(),
  model: z.string().trim().optional().nullable(),
  plateNumber: z.string().trim().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
});

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(result.error.errors.map(e => e.message).join(', '), 400);
  }
  return result.data;
}

export class JoinRequestsController {
  /**
   * واجهة عامة بلا تسجيل دخول: من وصل برمز إحالة ليس عميلًا بعد.
   *
   * الرد واحد مهما كان الرقم مسجّلًا أو لا، فلا تصلح هذه الواجهة لمعرفة
   * من هو عميل لدى الورشة ومن ليس كذلك.
   */
  static async submit(request: FastifyRequest, reply: FastifyReply) {
    const data = parse(submitSchema, request.body);
    await submitJoinRequest(data);

    return reply.status(201).send({
      message: 'وصلنا طلبك. سيتواصل معك فريق الورشة قريبًا لتأكيد التسجيل.',
    });
  }

  // ---------- للموظفين ----------
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { status = 'PENDING', search } = request.query as Record<string, string | undefined>;
    const term = search?.trim();

    const where: any = { deletedAt: null };
    if (status && status !== 'ALL') where.status = status;
    if (term) {
      where.OR = [
        { fullName: { contains: term } },
        { mobileNumber: { contains: term } },
        { plateNumber: { contains: term } },
      ];
    }

    const [requests, pendingCount] = await Promise.all([
      prisma.joinRequest.findMany({
        where,
        include: {
          customer: { select: { id: true, fullName: true } },
          reviewedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.joinRequest.count({ where: { status: 'PENDING', deletedAt: null } }),
    ]);

    // الموظف يحتاج أن يعرف قبل الاعتماد إن كان الرقم مسجّلًا بالفعل.
    const mobiles = requests.map(r => r.mobileNumber);
    const known = mobiles.length
      ? await prisma.customer.findMany({
          where: { mobileNumber: { in: mobiles }, deletedAt: null },
          select: { mobileNumber: true, fullName: true },
        })
      : [];

    return reply.send({
      requests: requests.map(r => ({
        ...r,
        alreadyCustomer: known.find(k => k.mobileNumber === r.mobileNumber)?.fullName || null,
      })),
      pendingCount,
    });
  }

  static async approve(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = parse(approveSchema, request.body || {});

    const result = await approveJoinRequest(id, request.user?.id || null, data);

    return reply.send({
      message: result.referralLinked
        ? `تم تسجيل ${result.customer.fullName} وربط الإحالة`
        : `تم تسجيل ${result.customer.fullName}`,
      customer: result.customer,
      referralLinked: result.referralLinked,
    });
  }

  static async reject(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { reason } = (request.body || {}) as { reason?: string };

    await rejectJoinRequest(id, request.user?.id || null, reason);
    return reply.send({ message: 'تم رفض الطلب' });
  }
}
