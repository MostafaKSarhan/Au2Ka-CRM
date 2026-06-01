import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../config/db';
import { JobStatus, ApprovalStatus } from '@prisma/client';

export async function getDashboardStats(request: FastifyRequest, reply: FastifyReply) {
  try {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // 1. Total Customers & Growth
    const totalCustomers = await prisma.customer.count({ where: { deletedAt: null } });
    const customersLastMonth = await prisma.customer.count({
      where: { deletedAt: null, createdAt: { lt: startOfCurrentMonth } }
    });
    const customersCurrentMonth = totalCustomers - customersLastMonth;
    const customerGrowth = customersLastMonth > 0 ? Math.round((customersCurrentMonth / customersLastMonth) * 100) : 0;

    // 2. Total Vehicles & Growth
    const totalVehicles = await prisma.vehicle.count({ where: { deletedAt: null } });
    const vehiclesLastMonth = await prisma.vehicle.count({
      where: { deletedAt: null, createdAt: { lt: startOfCurrentMonth } }
    });
    const vehiclesCurrentMonth = totalVehicles - vehiclesLastMonth;
    const vehicleGrowth = vehiclesLastMonth > 0 ? Math.round((vehiclesCurrentMonth / vehiclesLastMonth) * 100) : 0;

    // 3. Total Job Cards & Growth
    const totalJobCards = await prisma.jobCard.count({ where: { deletedAt: null } });
    const jobCardsLastMonth = await prisma.jobCard.count({
      where: { deletedAt: null, createdAt: { lt: startOfCurrentMonth } }
    });
    const jobCardsCurrentMonth = totalJobCards - jobCardsLastMonth;
    const jobCardGrowth = jobCardsLastMonth > 0 ? Math.round((jobCardsCurrentMonth / jobCardsLastMonth) * 100) : 0;

    // 4. Vehicles Under Repair (IN_PROGRESS)
    const vehiclesUnderRepair = await prisma.jobCard.count({
      where: { deletedAt: null, status: 'IN_PROGRESS' }
    });

    // 5. Completed Repairs (COMPLETED)
    const completedRepairs = await prisma.jobCard.count({
      where: { deletedAt: null, status: 'COMPLETED' }
    });

    // 6. Delivered Vehicles (DELIVERED)
    const deliveredVehicles = await prisma.jobCard.count({
      where: { deletedAt: null, status: 'DELIVERED' }
    });

    // Job cards by status for charts
    const statusCounts = await prisma.jobCard.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: {
        id: true
      }
    });

    const statusChartData = Object.keys(JobStatus).map((status) => {
      const found = statusCounts.find((s) => s.status === status);
      return {
        status,
        count: found ? found._count.id : 0
      };
    });

    return reply.send({
      status: 'success',
      data: {
        stats: {
          totalCustomers: { count: totalCustomers, growth: customerGrowth },
          totalVehicles: { count: totalVehicles, growth: vehicleGrowth },
          totalJobCards: { count: totalJobCards, growth: jobCardGrowth },
          vehiclesUnderRepair: { count: vehiclesUnderRepair },
          completedRepairs: { count: completedRepairs },
          deliveredVehicles: { count: deliveredVehicles }
        },
        statusChartData
      }
    });
  } catch (error: any) {
    return reply.status(500).send({ status: 'error', message: error.message });
  }
}

export async function getRecentJobCards(request: FastifyRequest, reply: FastifyReply) {
  try {
    const recent = await prisma.jobCard.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: {
        customer: {
          select: { fullName: true, mobileNumber: true }
        },
        vehicle: {
          select: { brand: true, model: true, plateNumber: true }
        }
      }
    });
    return reply.send({ status: 'success', data: recent });
  } catch (error: any) {
    return reply.status(500).send({ status: 'error', message: error.message });
  }
}

export async function getJobCardsReport(request: FastifyRequest, reply: FastifyReply) {
  try {
    const {
      page = '1',
      limit = '10',
      search = '',
      status,
      approvalStatus,
      technicianName,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = request.query as any;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = { deletedAt: null };

    if (search) {
      whereClause.OR = [
        { jobNumber: { contains: search } },
        { customer: { fullName: { contains: search } } },
        { customer: { mobileNumber: { contains: search } } },
        { vehicle: { plateNumber: { contains: search } } },
        { vehicle: { brand: { contains: search } } },
        { vehicle: { model: { contains: search } } }
      ];
    }

    if (status) {
      whereClause.status = status as JobStatus;
    }

    if (approvalStatus) {
      whereClause.approvalStatus = approvalStatus as ApprovalStatus;
    }

    if (technicianName) {
      whereClause.technicianName = { contains: technicianName };
    }

    if (startDate || endDate) {
      whereClause.entryDate = {};
      if (startDate) {
        whereClause.entryDate.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.entryDate.lte = new Date(endDate);
      }
    }

    const [total, jobCards] = await prisma.$transaction([
      prisma.jobCard.count({ where: whereClause }),
      prisma.jobCard.findMany({
        where: whereClause,
        skip,
        take: limitNum,
        orderBy: { [sortBy]: sortOrder },
        include: {
          customer: true,
          vehicle: true,
          photos: true,
          activities: {
            include: {
              user: {
                select: { firstName: true, lastName: true, role: true }
              }
            },
            orderBy: { createdAt: 'asc' }
          }
        }
      })
    ]);

    return reply.send({
      status: 'success',
      data: {
        jobCards,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error: any) {
    return reply.status(500).send({ status: 'error', message: error.message });
  }
}

export async function getCustomersReport(request: FastifyRequest, reply: FastifyReply) {
  try {
    const {
      page = '1',
      limit = '10',
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = request.query as any;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = { deletedAt: null };

    if (search) {
      whereClause.OR = [
        { fullName: { contains: search } },
        { mobileNumber: { contains: search } }
      ];
    }

    const [total, customers] = await prisma.$transaction([
      prisma.customer.count({ where: whereClause }),
      prisma.customer.findMany({
        where: whereClause,
        skip,
        take: limitNum,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: { vehicles: true, jobCards: true }
          },
          jobCards: {
            orderBy: { entryDate: 'desc' },
            take: 1,
            select: { entryDate: true }
          }
        }
      })
    ]);

    const formattedCustomers = customers.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      mobileNumber: c.mobileNumber,
      notes: c.notes,
      createdAt: c.createdAt,
      vehiclesCount: c._count.vehicles,
      jobCardsCount: c._count.jobCards,
      lastVisit: c.jobCards[0]?.entryDate || null
    }));

    return reply.send({
      status: 'success',
      data: {
        customers: formattedCustomers,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error: any) {
    return reply.status(500).send({ status: 'error', message: error.message });
  }
}

export async function getVehiclesReport(request: FastifyRequest, reply: FastifyReply) {
  try {
    const {
      page = '1',
      limit = '10',
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = request.query as any;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = { deletedAt: null };

    if (search) {
      whereClause.OR = [
        { brand: { contains: search } },
        { model: { contains: search } },
        { plateNumber: { contains: search } }
      ];
    }

    const [total, vehicles] = await prisma.$transaction([
      prisma.vehicle.count({ where: whereClause }),
      prisma.vehicle.findMany({
        where: whereClause,
        skip,
        take: limitNum,
        orderBy: { [sortBy]: sortOrder },
        include: {
          customer: {
            select: { id: true, fullName: true, mobileNumber: true }
          },
          _count: {
            select: { jobCards: true }
          }
        }
      })
    ]);

    const formattedVehicles = vehicles.map((v) => ({
      id: v.id,
      brand: v.brand,
      model: v.model,
      plateNumber: v.plateNumber,
      mileage: v.mileage,
      createdAt: v.createdAt,
      owner: v.customer,
      repairsCount: v._count.jobCards
    }));

    return reply.send({
      status: 'success',
      data: {
        vehicles: formattedVehicles,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error: any) {
    return reply.status(500).send({ status: 'error', message: error.message });
  }
}

export async function getGlobalSearch(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { q = '' } = request.query as any;
    if (!q) {
      return reply.send({ status: 'success', data: { jobCards: [], customers: [], vehicles: [] } });
    }

    const [jobCards, customers, vehicles] = await prisma.$transaction([
      prisma.jobCard.findMany({
        where: {
          deletedAt: null,
          OR: [
            { jobNumber: { contains: q } },
            { customerComplaint: { contains: q } }
          ]
        },
        take: 5,
        include: { customer: true, vehicle: true }
      }),
      prisma.customer.findMany({
        where: {
          deletedAt: null,
          OR: [
            { fullName: { contains: q } },
            { mobileNumber: { contains: q } }
          ]
        },
        take: 5
      }),
      prisma.vehicle.findMany({
        where: {
          deletedAt: null,
          OR: [
            { brand: { contains: q } },
            { model: { contains: q } },
            { plateNumber: { contains: q } }
          ]
        },
        take: 5,
        include: { customer: true }
      })
    ]);

    return reply.send({
      status: 'success',
      data: {
        jobCards,
        customers,
        vehicles
      }
    });
  } catch (error: any) {
    return reply.status(500).send({ status: 'error', message: error.message });
  }
}
