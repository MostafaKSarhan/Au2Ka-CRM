import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { z } from 'zod';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-workshop-crm-2026';

const loginSchema = z.object({
  mobileNumber: z.string().min(1),
  password: z.string().min(6),
});

export class AuthController {
  static async login(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError('Invalid request fields', 400);
    }

    const { mobileNumber, password } = parseResult.data;

    const user = await prisma.user.findFirst({
      where: { mobileNumber, deletedAt: null },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new AppError('Invalid mobile or password', 401);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid mobile or password', 401);
    }

    const token = jwt.sign(
      { id: user.id, mobileNumber: user.mobileNumber, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return reply.send({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        mobileNumber: user.mobileNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  }

  static async me(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      throw new AppError('Unauthorized', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
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

    if (!user || user.status !== 'ACTIVE') {
      throw new AppError('User not found or inactive', 404);
    }

    return reply.send({ user });
  }

  static async logout(request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ message: 'Logged out successfully' });
  }
}
