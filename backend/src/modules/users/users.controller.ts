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
});

const updateUserSchema = z.object({
  mobileNumber: z.string().min(1).optional(),
  firstName: z.string().trim().min(2).optional(),
  lastName: z.string().trim().min(2).optional(),
  role: z.enum(['ADMIN', 'RECEPTION', 'TECHNICIAN']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  password: z.string().min(6).optional(),
});

export class UsersController {
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        mobileNumber: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
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

    const { mobileNumber, password, firstName, lastName, role } = parseResult.data;

    // Check mobile number uniqueness
    const existing = await prisma.user.findFirst({ where: { mobileNumber, deletedAt: null } });
    if (existing) {
      throw new AppError('رقم الجوال مستخدم بالفعل', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { mobileNumber, passwordHash, firstName, lastName, role },
      select: {
        id: true,
        mobileNumber: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
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

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        mobileNumber: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
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
    const technicians = await prisma.user.findMany({
      where: { role: 'TECHNICIAN', status: 'ACTIVE', deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
    });
    return reply.send({ technicians });
  }
}
