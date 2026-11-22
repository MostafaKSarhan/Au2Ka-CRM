import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { z } from 'zod';

const createVehicleSchema = z.object({
  customerId: z.string().uuid('Invalid Customer ID format'),
  brand: z.string().trim().min(1, 'Brand cannot be empty'),
  model: z.string().trim().min(1, 'Model cannot be empty'),
  plateNumber: z.string().trim().min(1, 'Plate number cannot be empty'),
  mileage: z.number().int().nonnegative('Mileage must be positive or zero'),
});

export class VehiclesController {
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const search = query.search || '';

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    // customerId كان يُتجاهل بصمت، فمن مرّره ظن أنه يحصر النتائج على سيارات
    // عميل واحد بينما ترجع له سيارات الورشة كلها.
    const customerId = typeof query.customerId === 'string' ? query.customerId : undefined;

    const whereClause = {
      deletedAt: null,
      ...(customerId ? { customerId } : {}),
      ...(search
        ? {
            OR: [
              { plateNumber: { contains: search } },
              { brand: { contains: search } },
              { model: { contains: search } },
            ],
          }
        : {}),
    };

    const [total, vehicles] = await Promise.all([
      prisma.vehicle.count({ where: whereClause }),
      prisma.vehicle.findMany({
        where: whereClause,
        include: {
          customer: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return reply.send({
      vehicles,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    });
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = createVehicleSchema.safeParse(request.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(', ');
      throw new AppError(errorMsg, 400);
    }

    const { customerId } = parseResult.data;

    // Check if customer exists
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });

    if (!customer) {
      throw new AppError('Associated Customer not found', 404);
    }

    const vehicle = await prisma.vehicle.create({
      data: parseResult.data,
    });

    return reply.status(201).send({
      message: 'Vehicle created successfully',
      vehicle,
    });
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const parseResult = createVehicleSchema.safeParse(request.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(', ');
      throw new AppError(errorMsg, 400);
    }

    const vehicleExists = await prisma.vehicle.findFirst({
      where: { id, deletedAt: null },
    });

    if (!vehicleExists) {
      throw new AppError('Vehicle not found', 404);
    }

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: parseResult.data,
    });

    return reply.send({
      message: 'Vehicle updated successfully',
      vehicle,
    });
  }
}
