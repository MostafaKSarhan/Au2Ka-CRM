import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';

const createUserSchema = z.object({
  mobileNumber: z.string().min(1, 'رقم الجوال مطلوب'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  firstName: z.string().trim().min(2, 'الاسم الأول يجب أن يكون حرفين على الأقل'),
  lastName: z.string().trim().min(2, 'الاسم الأخير يجب أن يكون حرفين على الأقل'),
  role: z.enum(['ADMIN', 'RECEPTION', 'TECHNICIAN']),
  branchId: z.string().uuid('الفرع غير صحيح').optional().nullable(),
});

const updateUserSchema = z.object({
  mobileNumber: z.string().min(1).optional(),
  firstName: z.string().trim().min(2).optional(),
  lastName: z.string().trim().min(2).optional(),
  role: z.enum(['ADMIN', 'RECEPTION', 'TECHNICIAN']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  password: z.string().min(6).optional(),
  branchId: z.string().uuid('الفرع غير صحيح').optional().nullable(),
});

// Shape returned to the client for every user record.
const userSelect = {
  id: true,
  mobileNumber: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  createdAt: true,
  branchId: true,
  branch: { select: { id: true, code: true, nameAr: true, nameEn: true } },
} as const;

/** Rejects a branchId that does not point at a live branch. */
async function assertBranchExists(branchId?: string | null) {
  if (!branchId) return;
  const branch = await prisma.branch.findFirst({ where: { id: branchId, deletedAt: null } });
  if (!branch) throw new AppError('الفرع غير موجود', 404);
}

export class UsersController {
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const { branchId, role } = request.query as { branchId?: string; role?: string };

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        ...(role ? { role: role as any } : {}),
      },
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({ users });
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = createUserSchema.safeParse(request.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(', ');
      throw new AppError(errorMsg, 400);
    }

    const { mobileNumber, password, firstName, lastName, role, branchId } = parseResult.data;

    // Check mobile number uniqueness
    const existing = await prisma.user.findFirst({ where: { mobileNumber, deletedAt: null } });
    if (existing) {
      throw new AppError('رقم الجوال مستخدم بالفعل', 409);
    }

    await assertBranchExists(branchId);

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { mobileNumber, passwordHash, firstName, lastName, role, branchId: branchId ?? null },
      select: userSelect,
    });

    return reply.status(201).send({ message: 'تم إنشاء المستخدم بنجاح', user });
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const parseResult = updateUserSchema.safeParse(request.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(', ');
      throw new AppError(errorMsg, 400);
    }

    const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('المستخدم غير موجود', 404);

    const data: any = { ...parseResult.data };
    if (data.password) {
      data.passwordHash = await bcrypt.hash(data.password, 12);
      delete data.password;
    }

    if (data.branchId !== undefined) {
      await assertBranchExists(data.branchId);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });

    return reply.send({ message: 'تم تحديث المستخدم بنجاح', user });
  }

  static async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    // Prevent self-delete
    if (request.user?.id === id) {
      throw new AppError('لا يمكنك حذف حسابك الخاص', 400);
    }

    const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError('المستخدم غير موجود', 404);

    await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });

    return reply.send({ message: 'تم حذف المستخدم بنجاح' });
  }

  static async listTechnicians(request: FastifyRequest, reply: FastifyReply) {
    const { branchId } = request.query as { branchId?: string };

    const technicians = await prisma.user.findMany({
      where: {
        role: 'TECHNICIAN',
        status: 'ACTIVE',
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        branch: { select: { id: true, nameAr: true, nameEn: true } },
      },
      orderBy: { firstName: 'asc' },
    });
    return reply.send({ technicians });
  }
}
