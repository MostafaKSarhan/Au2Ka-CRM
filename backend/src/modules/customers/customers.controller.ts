import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { z } from 'zod';

const createCustomerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  mobileNumber: z.string().trim().min(5, 'Mobile number must be at least 5 characters'),
  notes: z.string().optional(),
});

export class CustomersController {
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const search = query.search || '';

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const whereClause = {
      deletedAt: null,
      OR: [
        { fullName: { contains: search } },
        { mobileNumber: { contains: search } },
      ],
    };

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where: whereClause }),
      prisma.customer.findMany({
        where: whereClause,
        include: {
          vehicles: {
            where: { deletedAt: null }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return reply.send({
      customers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    });
  }

  static async get(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const customer = await prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: {
        vehicles: {
          where: { deletedAt: null }
        },
        jobCards: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    return reply.send({ customer });
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = createCustomerSchema.safeParse(request.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(', ');
      throw new AppError(errorMsg, 400);
    }

    const customer = await prisma.customer.create({
      data: parseResult.data,
    });

    return reply.status(201).send({
      message: 'Customer created successfully',
      customer,
    });
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const parseResult = createCustomerSchema.safeParse(request.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(', ');
      throw new AppError(errorMsg, 400);
    }

    const customerExists = await prisma.customer.findFirst({
      where: { id, deletedAt: null },
    });

    if (!customerExists) {
      throw new AppError('Customer not found', 404);
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: parseResult.data,
    });

    return reply.send({
      message: 'Customer updated successfully',
      customer,
    });
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const customerExists = await prisma.customer.findFirst({
      where: { id, deletedAt: null },
    });

    if (!customerExists) {
      throw new AppError('Customer not found', 404);
    }

    await prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return reply.send({ message: 'Customer soft deleted successfully' });
  }
}
