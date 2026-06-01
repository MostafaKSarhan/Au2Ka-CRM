import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { AppError } from '../../utils/appError';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';

const pump = promisify(pipeline);

const createJobCardSchema = z.object({
  customerId: z.string().uuid('Invalid Customer ID format'),
  vehicleId: z.string().uuid('Invalid Vehicle ID format'),
  customerComplaint: z.string().trim().min(2, 'Customer complaint must be at least 2 characters'),
  initialInspection: z.string().optional(),
  requiredRepairs: z.string().optional(),
  estimatedCost: z.number().nonnegative('Cost must be positive or zero').optional(),
  technicianName: z.string().optional(),
  notes: z.string().optional(),
  isVehiclePhotographed: z.boolean().optional(),
  additionalServices: z.string().optional(),
});

const updateJobCardSchema = z.object({
  customerComplaint: z.string().optional(),
  initialInspection: z.string().optional(),
  requiredRepairs: z.string().optional(),
  estimatedCost: z.number().nonnegative('Cost must be positive or zero').optional().nullable(),
  approvalStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  technicianName: z.string().optional(),
  notes: z.string().optional(),
  isVehiclePhotographed: z.boolean().optional(),
  status: z.enum(['RECEIVED', 'INSPECTION', 'WAITING_APPROVAL', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED']).optional(),
  additionalServices: z.string().optional(),
});

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  RECEIVED: ['INSPECTION'],
  INSPECTION: ['RECEIVED', 'WAITING_APPROVAL'],
  WAITING_APPROVAL: ['INSPECTION', 'IN_PROGRESS'],
  IN_PROGRESS: ['WAITING_APPROVAL', 'COMPLETED'],
  COMPLETED: ['IN_PROGRESS', 'DELIVERED'],
  DELIVERED: ['COMPLETED']
};

const statusLabels: Record<string, string> = {
  RECEIVED: 'تم الاستلام',
  INSPECTION: 'قيد الفحص',
  WAITING_APPROVAL: 'انتظار الموافقة',
  IN_PROGRESS: 'تحت الإصلاح',
  COMPLETED: 'تم الإصلاح',
  DELIVERED: 'تم التسليم'
};

const approvalLabels: Record<string, string> = {
  PENDING: 'انتظار موافقة العميل',
  APPROVED: 'موافق على الإصلاح',
  REJECTED: 'مرفوض من العميل'
};

export class JobCardsController {
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const query = request.query as any;
    const status = query.status;
    const search = query.search || '';

    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const whereClause: any = {
      deletedAt: null,
    };

    if (status) {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { jobNumber: { contains: search } },
        { customer: { fullName: { contains: search } } },
        { vehicle: { plateNumber: { contains: search } } },
      ];
    }

    const [total, jobCards] = await Promise.all([
      prisma.jobCard.count({ where: whereClause }),
      prisma.jobCard.findMany({
        where: whereClause,
        include: {
          customer: true,
          vehicle: true,
          photos: true,
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return reply.send({
      jobCards,
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

    const jobCard = await prisma.jobCard.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: true,
        vehicle: true,
        photos: true,
        activities: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                role: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      },
    });

    if (!jobCard) {
      throw new AppError('Job card not found', 404);
    }

    return reply.send({ jobCard });
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = createJobCardSchema.safeParse(request.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(', ');
      throw new AppError(errorMsg, 400);
    }

    const { customerId, vehicleId } = parseResult.data;

    // Verify customer & vehicle exist
    const customer = await prisma.customer.findFirst({ where: { id: customerId, deletedAt: null } });
    if (!customer) throw new AppError('Customer not found', 404);

    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, deletedAt: null } });
    if (!vehicle) throw new AppError('Vehicle not found', 404);

    // Generate Sequential unique jobNumber WRK-YYYYMMDD-XXXX
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const countToday = await prisma.jobCard.count({
      where: {
        createdAt: {
          gte: startOfToday,
        },
      },
    });

    const sequenceNum = String(countToday + 1).padStart(4, '0');
    const jobNumber = `WRK-${todayStr}-${sequenceNum}`;

    const jobCard = await prisma.jobCard.create({
      data: {
        jobNumber,
        ...parseResult.data,
      },
      include: {
        customer: true,
        vehicle: true,
      },
    });

    // Log Activity in Arabic
    if (request.user) {
      await prisma.jobCardActivity.create({
        data: {
          jobCardId: jobCard.id,
          userId: request.user.id,
          action: `تم فتح كرت استقبال مركبة جديد برقم ${jobNumber} (الحالة: تم الاستلام)`,
        }
      });
    }

    return reply.status(201).send({
      message: 'Job card created successfully',
      jobCard,
    });
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const parseResult = updateJobCardSchema.safeParse(request.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors.map(e => e.message).join(', ');
      throw new AppError(errorMsg, 400);
    }

    const jobCardExists = await prisma.jobCard.findFirst({
      where: { id, deletedAt: null },
    });

    if (!jobCardExists) {
      throw new AppError('Job card not found', 404);
    }

    const updates: any = { ...parseResult.data };

    // Strict Status Transition Check
    if (updates.status && updates.status !== jobCardExists.status) {
      const current = jobCardExists.status;
      const target = updates.status;
      const allowed = ALLOWED_TRANSITIONS[current] || [];
      if (!allowed.includes(target)) {
        throw new AppError(`Status transition from ${current} to ${target} is not allowed.`, 400);
      }
    }

    // First save activity logs if any changes
    if (request.user) {
      const logs: string[] = [];
      if (updates.status && updates.status !== jobCardExists.status) {
        const fromLabel = statusLabels[jobCardExists.status] || jobCardExists.status;
        const toLabel = statusLabels[updates.status] || updates.status;
        logs.push(`تم نقل حالة العمل من (${fromLabel}) إلى (${toLabel})`);
      }
      if (updates.approvalStatus && updates.approvalStatus !== jobCardExists.approvalStatus) {
        const fromApp = approvalLabels[jobCardExists.approvalStatus] || jobCardExists.approvalStatus;
        const toApp = approvalLabels[updates.approvalStatus] || updates.approvalStatus;
        logs.push(`تم تعديل حالة موافقة الإصلاح من (${fromApp}) إلى (${toApp})`);
      }
      if (updates.estimatedCost !== undefined && Number(updates.estimatedCost) !== Number(jobCardExists.estimatedCost)) {
        logs.push(`تحديث التكلفة التقريبية إلى ${updates.estimatedCost} ريال`);
      }

      if (logs.length > 0) {
        await prisma.jobCardActivity.create({
          data: {
            jobCardId: id,
            userId: request.user.id,
            action: logs.join('، '),
          }
        });
      }
    }

    const jobCard = await prisma.jobCard.update({
      where: { id },
      data: updates,
      include: {
        customer: true,
        vehicle: true,
        photos: true,
        activities: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                role: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      },
    });

    return reply.send({
      message: 'Job card updated successfully',
      jobCard,
    });
  }

  static async uploadPhoto(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const jobCardExists = await prisma.jobCard.findFirst({
      where: { id, deletedAt: null },
    });

    if (!jobCardExists) {
      throw new AppError('Job card not found', 404);
    }

    const data = await request.file();
    if (!data) {
      throw new AppError('No file uploaded', 400);
    }

    const uploadDir = path.join(__dirname, '../../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileExt = path.extname(data.filename);
    const uniqueFilename = `${id}-${Date.now()}${fileExt}`;
    const targetPath = path.join(uploadDir, uniqueFilename);

    await pump(data.file, fs.createWriteStream(targetPath));

    const relativePath = `/uploads/${uniqueFilename}`;

    const photo = await prisma.jobCardPhotos.create({
      data: {
        jobCardId: id,
        filePath: relativePath,
      },
    });

    await prisma.jobCard.update({
      where: { id },
      data: { isVehiclePhotographed: true },
    });

    // Log photo upload in Arabic
    if (request.user) {
      await prisma.jobCardActivity.create({
        data: {
          jobCardId: id,
          userId: request.user.id,
          action: 'تم تصوير السيارة ورفع صورة استلام جديدة للهيكل الخارجي',
        }
      });
    }

    return reply.status(201).send({
      message: 'Photo uploaded successfully',
      photo,
    });
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const jobCardExists = await prisma.jobCard.findFirst({
      where: { id, deletedAt: null },
    });

    if (!jobCardExists) {
      throw new AppError('Job card not found', 404);
    }

    await prisma.jobCard.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return reply.send({ message: 'Job card deleted successfully' });
  }
}
